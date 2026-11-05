import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException,UnauthorizedException} from '@nestjs/common';
import {createHash,timingSafeEqual} from 'node:crypto';
import type {PoolClient} from 'pg';
import {DatabaseService} from './database';
import type {Principal} from './auth';
import {batchSql,goodsSql,manifestBlockers,type BatchRow,type GoodsRow} from './courier-manifests';
import {CourierEventService} from './courier-events';
import {JubelioShipmentClient} from './jubelio-shipment';
import {jubelioConfigured,shippingProvider} from './shipping-config';
import {requireUuid} from './warehouses';

const obj=(x:unknown):Record<string,any>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,any>:{};
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function jubelioBookingEnabled(){return shippingProvider()==='jubelio'&&jubelioConfigured()&&process.env.JUBELIO_BOOKING_ENABLED==='true';}
export const jubelioStatuses:Record<string,string>={WAITING:'confirmed',CONFIRMED_BY_COURIER:'allocated',ON_THE_WAY_PICK_UP:'picking_up',PICKED_UP:'picked',ON_DELIVERY:'in_transit',ON_HOLD:'on_hold',DELIVERED:'delivered',RETURNED:'returned',CANCELED:'cancelled',CANCELLED:'cancelled',DECLINED:'rejected',SHIPMENT_ISSUE:'on_hold'};
export function providerShipment(raw:unknown,requireStatus=false){
 const x=obj(raw),id=String(x.shipment_id??''),awb=x.awb??x.awb_code;
 const status=x.latest_status??x.shipment_status??x.status;
 if(!/^\d{1,15}$/.test(id)||!Number.isSafeInteger(Number(id))||Number(id)<=0||
   (awb!=null&&(typeof awb!=='string'||!/^[-A-Za-z0-9_./]{3,90}$/.test(awb)))||
   (requireStatus&&!jubelioStatuses[status]))throw new ServiceUnavailableException('Respons shipment Jubelio belum dapat diverifikasi');
 return {id,awb:typeof awb==='string'?awb:null,status:typeof status==='string'?jubelioStatuses[status]||null:null,reference:x.ref_no,raw:x};
}
export function verifyJubelioToken(token:string){
 const expected=process.env.JUBELIO_WEBHOOK_TOKEN||'';
 if(expected.length<40||process.env.JUBELIO_WEBHOOK_ENABLED!=='true')throw new ServiceUnavailableException('Jubelio webhook disabled');
 if(!timingSafeEqual(createHash('sha256').update(expected).digest(),createHash('sha256').update(token).digest()))throw new UnauthorizedException('Untrusted courier webhook');
}
type Quote={provider:string;origin_postal_code:string;destination_postal_code:string;origin_area_id:string;destination_area_id:string;provider_service_id:number;amount_idr:string;courier_code:string;service_code:string};
type Manifest={id:string;state:string;pickup_method:string;pickup_date:string|null;pickup_time:string|null};
type Booking={batch_id:string;request_key:string;reference:string;state:string;payload:Record<string,any>;accepted_fee_idr:string;provider_shipment_id:string|null;created_at:Date};
@Injectable()
export class JubelioDispatchService{
 constructor(private readonly db:DatabaseService,private readonly jubelio:JubelioShipmentClient,private readonly events:CourierEventService){}
 private async context(batchId:string,client?:PoolClient){
  requireUuid(batchId,'batch');const db:Pick<DatabaseService,'query'>=client||this.db;
  const b=await db.query<BatchRow>(batchSql+(client?' FOR UPDATE OF f,o,w':''),[batchId]);
  const row=b.rows[0];if(!row)throw new NotFoundException('Batch not found');
  const goods=await db.query<GoodsRow>(goodsSql,[batchId]);
  const count=await db.query<{n:number}>('SELECT count(*)::integer n FROM product.fulfillment_batches WHERE order_id=$1',[row.order_id]);
  const quotes=await db.query<Quote>('SELECT * FROM product.shipping_rate_quotes WHERE id=$1',[row.shipping_quote_id]);
  const m=await db.query<Manifest>('SELECT id,state,pickup_method,pickup_date::text,pickup_time FROM product.courier_manifests WHERE batch_id=$1',[batchId]);
  const quote=quotes.rows[0]||null,manifest=m.rows[0]||null;
  const blockers=manifestBlockers(row,goods.rows,count.rows[0].n,quote).filter(x=>!['EXTERNAL_BOOKING_DISABLED','JUBELIO_BOOKING_NOT_ENABLED','WAREHOUSE_SPECIFIC_COURIER_QUOTE_REQUIRED'].includes(x));
  if(!jubelioBookingEnabled())blockers.push('JUBELIO_BOOKING_DISABLED');
  if(!quote||quote.provider!=='jubelio'||quote.origin_postal_code!==row.origin_postal_code||quote.destination_postal_code!==row.postal_code||
   quote.origin_area_id!==process.env.JUBELIO_SHIPMENT_ORIGIN_AREA_ID||quote.origin_postal_code!==process.env.SHIPPING_ORIGIN_POSTAL_CODE||
   quote.courier_code!==row.shipping_courier_code||quote.service_code!==row.shipping_service_code)blockers.push('WAREHOUSE_SPECIFIC_COURIER_QUOTE_REQUIRED');
  if(!manifest||manifest.state!=='prepared')blockers.push('MANIFEST_REQUIRED');
  if(manifest&&(manifest.pickup_method!=='pickup'||manifest.pickup_date||manifest.pickup_time))blockers.push('IMMEDIATE_PICKUP_REQUIRED');
  const snapshot={row,goods:goods.rows,quote,manifest};
  return {snapshot,blockers,snapshotHash:hash(snapshot)};
 }
 private async quoted(batchId:string){
  const context=await this.context(batchId);
  if(context.blockers.length)return {...context,rate:null,payload:null,fingerprint:null};
  const {row,goods,quote}=context.snapshot;
  // A postcode with multiple villages requires explicit origin support, rather
  // than silently sending a courier to a different pickup area.
  const origin=await this.jubelio.destination(row.origin_postal_code!);
  if(origin.areaId!==quote!.origin_area_id)throw new ConflictException('Kelurahan gudang berbeda dari asal tarif Jubelio');
  const destination=await this.jubelio.destination(row.postal_code!,quote!.destination_area_id);
  const rates=await this.jubelio.rates(destination,goods.map(g=>({quantity:g.quantity,value:Number(g.price_idr),weight:g.weight_grams!,length:g.length_cm!,width:g.width_cm!,height:g.height_cm!})));
  const rate=rates.find(r=>r.providerServiceId===quote!.provider_service_id&&r.courierCode===row.shipping_courier_code&&r.serviceCode===row.shipping_service_code);
  if(!rate)throw new ConflictException('Layanan kurir pesanan tidak tersedia. Periksa tarif dan pesanan sebelum booking.');
  const payload={ref_no:'vapmart-'+batchId,courier_id:Number(rate.courierCode),courier_service_id:rate.providerServiceId,
   shipping_insurance:rate.insuranceIdr,is_insurance:rate.insuranceIdr>0,is_cod:false,cod_amount:0,
   origin:{name:row.origin_contact_name,email:'',phone:row.origin_contact_phone,address:row.origin_address,area_id:origin.areaId,coordinate:'',zipcode:origin.postalCode},
   destination:{name:row.contact_name,email:row.contact_email||'',phone:row.contact_phone,address:row.address_line,area_id:destination.areaId,coordinate:'',zipcode:destination.postalCode},
   items:goods.map(g=>({item_code:g.sku||g.product_id,item_name:g.name,category:'-',quantity:g.quantity,value:Number(g.price_idr),weight:g.weight_grams,length:g.length_cm,width:g.width_cm,height:g.height_cm}))};
  return {...context,rate,payload,fingerprint:hash({snapshotHash:context.snapshotHash,payload,fee:rate.priceIdr})};
 }
 async preview(batchId:string){
  requireUuid(batchId,'batch');
  const old=await this.db.query<Booking>('SELECT * FROM product.jubelio_bookings WHERE batch_id=$1',[batchId]);
  if(old.rows[0])return {batchId,attempt:await this.result(batchId),blockers:[],canBook:false};
  const q=await this.quoted(batchId);
  return {batchId,attempt:null,blockers:q.blockers,canBook:!q.blockers.length,fingerprint:q.fingerprint,feeIdr:q.rate?.priceIdr,
   originalFeeIdr:Number(q.snapshot.quote?.amount_idr||0),service:q.rate?`${q.rate.courierName} ${q.rate.serviceName}`:null,
   pickup:'immediate_request',origin:q.snapshot.row.origin_address,destination:q.snapshot.row.address_line};
 }
 async book(actor:Principal,batchId:string,raw:unknown){
  if(!jubelioBookingEnabled())throw new ServiceUnavailableException({code:'COURIER_BOOKING_DISABLED',message:'Booking Jubelio belum aktif'});
  if(!actor.emailVerified)throw new ForbiddenException('Verified admin required');
  requireUuid(batchId,'batch');const x=obj(raw);
  requireUuid(x.idempotencyKey,'booking key');
  if(Object.keys(x).some(k=>!['idempotencyKey','fingerprint','acceptedFeeIdr'].includes(k))||!Number.isSafeInteger(x.acceptedFeeIdr)||typeof x.fingerprint!=='string'||!/^\w{64}$/.test(x.fingerprint))throw new BadRequestException('Periksa tarif sebelum booking');
  if((await this.db.query('SELECT 1 FROM product.jubelio_bookings WHERE batch_id=$1',[batchId])).rows.length)return this.result(batchId);
  const q=await this.quoted(batchId);
  if(q.blockers.length)throw new ConflictException({message:'Pesanan belum siap untuk booking',blockers:q.blockers});
  if(q.fingerprint!==x.fingerprint||q.rate!.priceIdr!==x.acceptedFeeIdr)throw new ConflictException('Tarif atau isi pesanan berubah. Periksa tarif dan konfirmasi ulang.');
  const claimed=await this.db.transaction(async client=>{
   const fresh=await this.context(batchId,client);
   if(fresh.blockers.length||fresh.snapshotHash!==q.snapshotHash)throw new ConflictException('Data pesanan berubah sebelum booking');
   if((await client.query('SELECT 1 FROM product.shipments WHERE fulfillment_batch_id=$1',[batchId])).rows.length)return false;
   const r=await client.query(`INSERT INTO product.jubelio_bookings(batch_id,request_key,reference,state,payload_hash,payload,accepted_fee_idr,created_by)
    VALUES($1,$2,$3,'pending',$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING batch_id`,
    [batchId,x.idempotencyKey,q.payload!.ref_no,q.fingerprint,JSON.stringify(q.payload),x.acceptedFeeIdr,actor.id]);
   return Boolean(r.rows.length);
  });
  if(!claimed)return this.result(batchId);
  try{
   const created=providerShipment(await this.jubelio.createShipment(q.payload));
   await this.finish(batchId,created);
  }catch{
   // Never expose provider messages (may contain PII/tokens); never auto-retry.
   await this.db.query("UPDATE product.jubelio_bookings SET state='uncertain',updated_at=now() WHERE batch_id=$1 AND state='pending'",[batchId]);
  }
  return this.result(batchId);
 }
 private async finish(batchId:string,shipment:ReturnType<typeof providerShipment>){
  return this.db.transaction(async client=>{
   const r=await client.query<Booking>('SELECT * FROM product.jubelio_bookings WHERE batch_id=$1 FOR UPDATE',[batchId]);
   const attempt=r.rows[0];if(!attempt)throw new NotFoundException('Booking not found');
   if(attempt.provider_shipment_id&&attempt.provider_shipment_id!==shipment.id)throw new ConflictException('Referensi memiliki lebih dari satu shipment; periksa Jubelio');
   if(shipment.reference&&shipment.reference!==attempt.reference)throw new ConflictException('Shipment reference mismatch');
   await client.query(`INSERT INTO product.shipments(order_id,brand_id,provider,courier_code,service_code,tracking_number,state,provider_shipment_id,fulfillment_batch_id,actual_shipping_fee_idr)
    SELECT f.order_id,f.brand_id,'jubelio',o.shipping_courier_code,o.shipping_service_code,$2,'booked',$3,f.id,$4
    FROM product.fulfillment_batches f JOIN product.orders o ON o.id=f.order_id WHERE f.id=$1
    ON CONFLICT(fulfillment_batch_id) DO NOTHING`,[batchId,shipment.awb,shipment.id,attempt.accepted_fee_idr]);
   const s=await client.query('SELECT provider_shipment_id FROM product.shipments WHERE fulfillment_batch_id=$1',[batchId]);
   if(s.rows[0]?.provider_shipment_id!==shipment.id)throw new ConflictException('Shipment already registered');
   await client.query("UPDATE product.jubelio_bookings SET state='booked',provider_shipment_id=$2,updated_at=now() WHERE batch_id=$1",[batchId,shipment.id]);
  });
 }
 async result(batchId:string){
  requireUuid(batchId,'batch');
  const r=await this.db.query(`SELECT b.state,b.reference,b.provider_shipment_id,s.tracking_number,s.provider_status,b.accepted_fee_idr
   FROM product.jubelio_bookings b LEFT JOIN product.shipments s ON s.fulfillment_batch_id=b.batch_id WHERE b.batch_id=$1`,[batchId]);
  if(!r.rows[0])throw new ConflictException('Batch atau idempotency key sudah digunakan; muat ulang daftar pengiriman');
  return {...r.rows[0],pickupRequested:r.rows[0].state==='booked',message:r.rows[0].state==='booked'?'Booking dan permintaan pickup diterima Jubelio. Menunggu konfirmasi kurir.':'Hasil booking belum pasti. Gunakan Periksa hasil booking; jangan membuat shipment manual atau booking ulang.'};
 }
 async reconcile(batchId:string){
  requireUuid(batchId,'batch');
  const b=(await this.db.query<Booking>('SELECT * FROM product.jubelio_bookings WHERE batch_id=$1',[batchId])).rows[0];
  if(!b)throw new NotFoundException('Booking not found');
  if(b.state==='booked'){await this.sync(batchId);return this.result(batchId);}
  if(Date.now()-new Date(b.created_at).getTime()<30000)throw new ConflictException('Permintaan masih diproses. Tunggu 30 detik sebelum pemeriksaan.');
  const matches=await this.jubelio.findShipment(b.reference);
  if(matches.length!==1)throw new ConflictException(matches.length?'Ada beberapa shipment untuk referensi ini. Periksa Jubelio.':'Shipment belum ditemukan. Booking tetap dikunci untuk mencegah duplikasi; periksa riwayat Jubelio.');
  const candidate=providerShipment(matches[0]);
  const full=providerShipment(await this.jubelio.shipment(candidate.id),true);
  if(full.reference!==b.reference||Number(full.raw.courier_service_id)!==b.payload.courier_service_id||String(full.raw.destination_area_id)!==b.payload.destination.area_id)throw new ConflictException('Detail shipment berbeda dari booking Vapmart');
  await this.finish(batchId,full);await this.apply(full);
  return this.result(batchId);
 }
 private async apply(shipment:ReturnType<typeof providerShipment>){
  const result=await this.events.applyVerified({event:'order.status',providerOrderId:shipment.id,status:shipment.status,waybill:shipment.awb,priceIdr:null},['jubelio']);
  const price=Number(shipment.raw.price_bill??shipment.raw.price);
  if(Number.isSafeInteger(price)&&price>=0&&price<=10000000){
   await this.events.applyVerified({event:'order.price',providerOrderId:shipment.id,status:null,waybill:null,priceIdr:price},['jubelio']);
   await this.db.query("UPDATE product.shipments SET actual_shipping_fee_idr=$2 WHERE provider='jubelio' AND provider_shipment_id=$1",[shipment.id,price]);
  }
  return result;
 }
 async sync(batchId:string){
  requireUuid(batchId,'batch');
  const b=(await this.db.query<Booking>("SELECT * FROM product.jubelio_bookings WHERE batch_id=$1 AND state='booked'",[batchId])).rows[0];
  if(!b?.provider_shipment_id)throw new NotFoundException('Resi belum terdaftar');
  const s=providerShipment(await this.jubelio.shipment(b.provider_shipment_id),true);
  if(s.id!==b.provider_shipment_id||s.reference!==b.reference)throw new ConflictException('Jubelio shipment identity mismatch');
  return this.apply(s);
 }
 async label(batchId:string){
  requireUuid(batchId,'batch');
  const b=(await this.db.query<Booking>("SELECT * FROM product.jubelio_bookings WHERE batch_id=$1 AND state='booked'",[batchId])).rows[0];
  if(!b?.provider_shipment_id)throw new NotFoundException('Resi belum terdaftar');
  const data=obj(await this.jubelio.shippingLabel(b.provider_shipment_id));
  let url:URL;try{url=new URL(data.file_url);}catch{throw new ServiceUnavailableException('Label belum tersedia');}
  if(url.protocol!=='https:'||url.username||url.password||!/(^|\.)(jubelio\.com|jubelio\.store|amazonaws\.com|cloudfront\.net)$/.test(url.hostname))throw new ServiceUnavailableException('Alamat label Jubelio belum terverifikasi');
  return {url:url.href};
 }
 async webhook(token:string,raw:Buffer|undefined){
  verifyJubelioToken(token);
  if(!Buffer.isBuffer(raw)||raw.length>32768||raw.length===0)throw new BadRequestException('JSON webhook <=32KB required');
  let body:Record<string,any>;try{body=obj(JSON.parse(raw.toString('utf8')));}catch{throw new BadRequestException('Malformed JSON');}
  const data=Object.keys(obj(body.data)).length?obj(body.data):body;
  const id=String(data.shipment_id??''),reference=typeof data.ref_no==='string'?data.ref_no:'',awb=typeof data.awb==='string'?data.awb:typeof data.awb_code==='string'?data.awb_code:'';
  // Notifications are hints only. Never apply a status or price from this body.
  const match=await this.db.query<{batch_id:string}>(`SELECT b.batch_id FROM product.jubelio_bookings b
   LEFT JOIN product.shipments s ON s.fulfillment_batch_id=b.batch_id
   WHERE b.state='booked' AND ((b.provider_shipment_id=$1 AND $1<>'') OR (b.reference=$2 AND $2<>'') OR (s.tracking_number=$3 AND $3<>'')) LIMIT 2`,[id.slice(0,30),reference.slice(0,100),awb.slice(0,100)]);
  if(match.rows.length===1){await this.sync(match.rows[0].batch_id);return {accepted:true,synchronized:true};}
  return {accepted:true,ignored:true}; // Includes provider validation fixtures and unrelated shipments.
 }
}
