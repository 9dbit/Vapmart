import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {DatabaseService} from './database';
import type {Principal} from './auth';
import {paidOrderVerified,fulfillmentOrderEligible} from './fulfillment';
import {requireUuid,inventoryLock} from './warehouses';
import {parseManifestRequest} from './courier-protocol';
import {buildBiteshipOrderPayload} from './courier-adapter';
import {shippingProvider,jubelioConfigured} from './shipping-config';
const bookingEnabled=()=>shippingProvider()==='jubelio'&&jubelioConfigured()&&process.env.JUBELIO_BOOKING_ENABLED==='true';

export type BatchRow={
 id:string;order_id:string;brand_id:string|null;warehouse_id:string;state:string;
 status:string;operational_status?:string;payment_status:string;payment_provider:string|null;payment_reference:string|null;
 shipping_quote_id:string|null;shipping_courier_code:string|null;shipping_service_code:string|null;
 contact_name:string|null;contact_phone:string|null;contact_email:string|null;address_line:string|null;
 city:string|null;province:string|null;postal_code:string|null;
 warehouse_name:string;origin_address:string;origin_city:string;origin_province:string;
 origin_postal_code:string|null;origin_contact_name:string|null;origin_contact_phone:string|null;
 is_active:boolean;is_dispatch_enabled:boolean;is_system_hold:boolean;
};
export type GoodsRow={order_item_id:string;product_id:string;quantity:number;name:string;sku:string|null;
 price_idr:string;weight_grams:number|null;length_cm:number|null;width_cm:number|null;height_cm:number|null};
export const batchSql=`SELECT f.id,f.order_id,f.brand_id,f.warehouse_id,f.state,
 o.status,o.operational_status,o.payment_status,o.payment_provider,o.payment_reference,
 o.shipping_quote_id,o.shipping_courier_code,o.shipping_service_code,
 o.contact_name,o.contact_phone,o.contact_email,o.address_line,o.city,o.province,o.postal_code,
 w.name AS warehouse_name,w.address_line AS origin_address,w.city AS origin_city,w.province AS origin_province,
 w.postal_code AS origin_postal_code,w.contact_name AS origin_contact_name,w.contact_phone AS origin_contact_phone,
 w.is_active,w.is_dispatch_enabled,w.is_system_hold
 FROM product.fulfillment_batches f JOIN product.orders o ON o.id=f.order_id
 JOIN product.warehouses w ON w.id=f.warehouse_id WHERE f.id=$1`;
export const goodsSql=`SELECT l.order_item_id,l.product_id,l.quantity,p.name,p.sku,
 oi.unit_price_idr::text AS price_idr,p.weight_grams,p.length_cm,p.width_cm,p.height_cm
 FROM product.fulfillment_lines l JOIN product.products p ON p.id=l.product_id
 JOIN product.order_items oi ON oi.id=l.order_item_id
 WHERE l.batch_id=$1 ORDER BY p.name,l.id`;
export function manifestBlockers(batch:BatchRow,goods:GoodsRow[],splitCount:number,quote:{origin_postal_code:string;destination_postal_code:string;provider:string}|null){
 const blockers:string[]=[];
 if(!paidOrderVerified(batch))blockers.push('VERIFIED_PAYMENT_REQUIRED');
 if(batch.operational_status&&batch.operational_status!=='processing')blockers.push('ORDER_NOT_PROCESSING');
 if(batch.state!=='ready_for_carrier')blockers.push('PACKING_NOT_READY');
 if(!batch.is_active||!batch.is_dispatch_enabled||batch.is_system_hold)blockers.push('WAREHOUSE_DISPATCH_NOT_VERIFIED');
 if(!batch.origin_postal_code||!/^\d{5}$/.test(batch.origin_postal_code)||!batch.origin_address?.trim()||!batch.origin_city?.trim())
  blockers.push('WAREHOUSE_ADDRESS_INCOMPLETE');
 if(!batch.origin_contact_name||!batch.origin_contact_phone)blockers.push('WAREHOUSE_PICKUP_CONTACT_REQUIRED');
 if(!batch.contact_name||!batch.contact_phone||!batch.address_line||!batch.postal_code)blockers.push('RECIPIENT_ADDRESS_INCOMPLETE');
 if(!goods.length||goods.some(g=>!Number.isSafeInteger(g.weight_grams)||!g.weight_grams||g.weight_grams<1))
  blockers.push('PRODUCT_WEIGHT_UNVERIFIED');
 if(goods.some(g=>!g.length_cm||!g.width_cm||!g.height_cm))blockers.push('PARCEL_DIMENSIONS_UNVERIFIED');
 if(splitCount!==1)blockers.push('SPLIT_ORIGIN_RATES_REQUIRED');
 if(!quote||quote.provider!=='biteship_test'||quote.origin_postal_code!==batch.origin_postal_code||
    quote.destination_postal_code!==batch.postal_code)blockers.push('WAREHOUSE_SPECIFIC_COURIER_QUOTE_REQUIRED');
 if(!batch.shipping_courier_code||!batch.shipping_service_code)blockers.push('COURIER_SERVICE_NOT_SELECTED');
 if(quote?.provider==='jubelio')blockers.push('JUBELIO_BOOKING_NOT_ENABLED');
 // The rate integration does not activate chargeable carrier bookings.
 blockers.push('EXTERNAL_BOOKING_DISABLED');
 return blockers;
}
@Injectable()
export class CourierManifestService{
 constructor(private readonly db:DatabaseService){}
 config(){
  return {provider:shippingProvider(),manifestsEnabled:true,internalPickupPlanEnabled:true,
   externalBookingEnabled:bookingEnabled(),externalCancellationEnabled:false,
   awbGenerated:false,paymentEnabled:false,returnShipmentBookingEnabled:false,
   webhookEnabled:shippingProvider()==='jubelio'?process.env.JUBELIO_WEBHOOK_ENABLED==='true'&&(process.env.JUBELIO_WEBHOOK_TOKEN||'').length>=40:shippingProvider()==='biteship'&&process.env.BITESHIP_WEBHOOK_ENABLED==='true'&&Boolean(process.env.BITESHIP_WEBHOOK_HEADER_SECRET),
   webhookRegistrationRequired:shippingProvider()==='jubelio',
   labelType:bookingEnabled()?'provider_label_and_internal_slip':'internal_packing_slip_only'};
 }
 async list(){
  const r=await this.db.query(
   `SELECT f.id AS batch_id,f.order_id,b.name AS brand_name,w.code AS warehouse_code,f.state,
   o.shipping_provider,o.shipping_courier_code,o.shipping_service_code,q.courier_name AS shipping_courier_name,q.service_name AS shipping_service_name,q.amount_idr::text AS shipping_fee_idr,
   m.id AS manifest_id,m.state AS manifest_state,m.pickup_method,m.pickup_date,m.pickup_time,m.total_weight_grams,
   jb.state AS booking_state,s.id AS shipment_id,s.state AS carrier_state,s.provider_status,s.tracking_number,s.provider_shipment_id,
   (SELECT count(*)::integer FROM product.courier_tracking_events ev WHERE ev.shipment_id=s.id) AS provider_events
   FROM product.fulfillment_batches f LEFT JOIN product.brands b ON b.id=f.brand_id
   JOIN product.warehouses w ON w.id=f.warehouse_id JOIN product.orders o ON o.id=f.order_id
   LEFT JOIN product.shipping_rate_quotes q ON q.id=o.shipping_quote_id
   LEFT JOIN product.courier_manifests m ON m.batch_id=f.id
   LEFT JOIN product.shipments s ON s.fulfillment_batch_id=f.id
   LEFT JOIN product.jubelio_bookings jb ON jb.batch_id=f.id
   ORDER BY f.created_at DESC LIMIT 200`);
  return {items:r.rows,externalBookingEnabled:bookingEnabled(),provider:shippingProvider(),labelType:bookingEnabled()?'provider_label_and_internal_slip':'internal_packing_slip_only'};
 }
 async orderBatches(orderId:string){
  requireUuid(orderId,'order');
  const orderResult=await this.db.query<{
   id:string;status:string;payment_status:string;operational_status:string;
   payment_provider:string|null;payment_reference:string|null;
   courier_name:string|null;service_name:string|null;
  }>(`SELECT o.id,o.status,o.payment_status,o.operational_status,o.payment_provider,o.payment_reference,
     q.courier_name,q.service_name FROM product.orders o
     LEFT JOIN product.shipping_rate_quotes q ON q.id=o.shipping_quote_id WHERE o.id=$1`,[orderId]);
  const order=orderResult.rows[0];
  if(!order)throw new NotFoundException('Pesanan tidak ditemukan');
  const result=await this.db.query(`SELECT f.id AS batch_id,f.order_id,b.name AS brand_name,
   w.code AS warehouse_code,f.state,m.id AS manifest_id,m.state AS manifest_state,
   m.pickup_method,m.pickup_date,m.pickup_time,
   jb.state AS booking_state,jb.created_at AS booking_created_at,
   s.state AS carrier_state,s.provider_status,s.tracking_number,s.provider_shipment_id,
   (SELECT count(*)::integer FROM product.courier_tracking_events ev WHERE ev.shipment_id=s.id) AS provider_events
   FROM product.fulfillment_batches f
   LEFT JOIN product.brands b ON b.id=f.brand_id
   JOIN product.warehouses w ON w.id=f.warehouse_id
   LEFT JOIN product.courier_manifests m ON m.batch_id=f.id
   LEFT JOIN product.jubelio_bookings jb ON jb.batch_id=f.id
   LEFT JOIN product.shipments s ON s.fulfillment_batch_id=f.id
   WHERE f.order_id=$1 ORDER BY f.created_at,f.id`,[orderId]);
  const paymentVerified=paidOrderVerified(order);
  return {orderId,order:{id:order.id,status:order.status,paymentStatus:order.payment_status,
    operationalStatus:order.operational_status,paymentVerified,
    courierName:order.courier_name,serviceName:order.service_name},
    batches:result.rows,canPrepare:paymentVerified&&order.operational_status==='processing'&&!result.rows.length,
    provider:shippingProvider(),bookingEnabled:bookingEnabled()};
 }
 async preview(batchId:string){
  requireUuid(batchId,'batch');
  const [b,goods,count,m,quote]=await Promise.all([
   this.db.query<BatchRow>(batchSql,[batchId]),
   this.db.query<GoodsRow>(goodsSql,[batchId]),
   this.db.query<{n:number}>(`SELECT count(*)::integer AS n FROM product.fulfillment_batches WHERE order_id=(SELECT order_id FROM product.fulfillment_batches WHERE id=$1)`,[batchId]),
   this.db.query('SELECT id,state,pickup_method,pickup_date,pickup_time,total_weight_grams FROM product.courier_manifests WHERE batch_id=$1',[batchId]),
   this.db.query<{origin_postal_code:string;destination_postal_code:string;provider:string;courier_code:string;service_code:string;courier_name:string;service_name:string;amount_idr:string}>(`SELECT q.origin_postal_code,q.destination_postal_code,q.provider,q.courier_code,q.service_code,q.courier_name,q.service_name,q.amount_idr::text AS amount_idr FROM product.shipping_rate_quotes q
     JOIN product.orders o ON o.shipping_quote_id=q.id JOIN product.fulfillment_batches f ON f.order_id=o.id
     WHERE f.id=$1`,[batchId])
  ]);
  const row=b.rows[0];if(!row)throw new NotFoundException('Fulfillment batch not found');
  const weight=goods.rows.reduce((a,g)=>a+(g.weight_grams||0)*g.quantity,0);
  const blockers=manifestBlockers(row,goods.rows,count.rows[0]?.n||0,quote.rows[0]||null).filter(x=>!(bookingEnabled()&&['JUBELIO_BOOKING_NOT_ENABLED','EXTERNAL_BOOKING_DISABLED','WAREHOUSE_SPECIFIC_COURIER_QUOTE_REQUIRED'].includes(x)));
  let providerPayloadReady=false;
  if(shippingProvider()==='biteship'&&blockers.length===1&&blockers[0]==='EXTERNAL_BOOKING_DISABLED'){
   try{
    // Validate the documented request body with server data, but NEVER POST it to Biteship.
    buildBiteshipOrderPayload({
      referenceId:'vapmart-'+batchId,
      origin:{contactName:row.origin_contact_name||'',contactPhone:row.origin_contact_phone||'',
       address:row.origin_address,postalCode:row.origin_postal_code||''},
      destination:{contactName:row.contact_name||'',contactPhone:row.contact_phone||'',
       address:row.address_line||'',postalCode:row.postal_code||''},
      courierCompany:row.shipping_courier_code||'',courierType:row.shipping_service_code||'',
      items:goods.rows.map(g=>({name:g.name,valueIdr:Number(g.price_idr),quantity:g.quantity,
       weightGrams:g.weight_grams||0,lengthCm:g.length_cm||0,widthCm:g.width_cm||0,heightCm:g.height_cm||0}))
    });
    providerPayloadReady=true;
   }catch{blockers.unshift('PROVIDER_PAYLOAD_INVALID');}
  }
  return {batchId,orderId:row.order_id,brandId:row.brand_id,state:row.state,
   origin:{warehouse:row.warehouse_name,city:row.origin_city,postalCode:row.origin_postal_code},
   destination:{city:row.city,province:row.province,postalCode:row.postal_code},
   courier:{provider:quote.rows[0]?.provider||null,code:row.shipping_courier_code,service:row.shipping_service_code,name:quote.rows[0]?.courier_name||null,serviceName:quote.rows[0]?.service_name||null,priceIdr:quote.rows[0]?.amount_idr?Number(quote.rows[0].amount_idr):null},
   weightGrams:weight,items:goods.rows.map(g=>({sku:g.sku,name:g.name,quantity:g.quantity,
    weightGrams:g.weight_grams,dimensionsCm:[g.length_cm,g.width_cm,g.height_cm]})),
   manifest:m.rows[0]||null,bookingBlockers:blockers,providerPayloadReady,
   bookingEnabled:bookingEnabled(),providerCallPerformed:false};
 }
 async prepare(actor:Principal,batchId:string,raw:unknown){
  if(!actor.emailVerified)throw new ForbiddenException('Verified admin required');
  requireUuid(batchId,'batch');const req=parseManifestRequest(raw);
  return this.db.transaction(async client=>{
   await inventoryLock(client);
   const b=await client.query<BatchRow>(batchSql+' FOR UPDATE OF f,o',[batchId]);
   const row=b.rows[0];if(!row)throw new NotFoundException('Batch not found');
   const prior=await client.query<{id:string;request_key:string;notes:string;pickup_method:string;pickup_date:string|null;pickup_time:string|null}>(
    'SELECT id,request_key,notes,pickup_method,pickup_date::text,pickup_time FROM product.courier_manifests WHERE batch_id=$1 FOR UPDATE',[batchId]);
   if(prior.rows[0]){
    const old=prior.rows[0];
    if(old.request_key!==req.idempotencyKey||old.notes!==req.notes||old.pickup_method!==req.pickupMethod||
      old.pickup_date!==req.pickupDate||old.pickup_time!==req.pickupTime)
     throw new ConflictException('Manifest already prepared under different request');
    return {manifestId:old.id,batchId,replayed:true,externalBookingEnabled:bookingEnabled(),awb:null};
   }
   if(!fulfillmentOrderEligible(row)||row.state!=='ready_for_carrier')
    throw new ConflictException('Verified paid order must be packed and ready before manifest');
   if(!row.is_active||!row.is_dispatch_enabled||row.is_system_hold)throw new ConflictException('Dispatch warehouse not verified');
   const goods=await client.query<GoodsRow>(goodsSql,[batchId]);
   if(!goods.rows.length||goods.rows.some(x=>!Number.isSafeInteger(x.weight_grams)||!x.weight_grams||x.weight_grams<=0))
    throw new ConflictException('Every SKU needs verified weight');
   const total=goods.rows.reduce((a,g)=>a+Number(g.weight_grams)*g.quantity,0);
   if(total>100000000)throw new BadRequestException('Parcel weight exceeds manifest limit');
   const manifest=await client.query<{id:string}>(
    'INSERT INTO product.courier_manifests(batch_id,request_key,pickup_method,pickup_date,pickup_time,total_weight_grams,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
    [batchId,req.idempotencyKey,req.pickupMethod,req.pickupDate,req.pickupTime,total,req.notes,actor.id]);
   for(const g of goods.rows){
    await client.query(
     'INSERT INTO product.courier_manifest_items(manifest_id,order_item_id,product_id,quantity,weight_grams,unit_value_idr,length_cm,width_cm,height_cm) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
     [manifest.rows[0].id,g.order_item_id,g.product_id,g.quantity,g.weight_grams,g.price_idr,g.length_cm,g.width_cm,g.height_cm]);
   }
   return {manifestId:manifest.rows[0].id,batchId,replayed:false,externalBookingEnabled:bookingEnabled(),awb:null,
    totalWeightGrams:total,pickupPlanInternalOnly:true};
  });
 }
 async packingSlip(batchId:string){
  requireUuid(batchId,'batch');
  const r=await this.db.query(
   `SELECT m.id AS manifest_id,m.state,m.pickup_method,m.pickup_date,m.pickup_time,m.total_weight_grams,
    f.order_id,w.name AS warehouse_name,w.address_line AS warehouse_address,w.city AS warehouse_city,
    w.province AS warehouse_province,w.postal_code AS warehouse_postal_code,
    o.contact_name AS receiver_name,o.contact_phone AS receiver_phone,o.address_line AS receiver_address,
    o.city AS receiver_city,o.province AS receiver_province,o.postal_code AS receiver_postal_code,
    b.name AS brand_name
    FROM product.courier_manifests m JOIN product.fulfillment_batches f ON f.id=m.batch_id
    JOIN product.orders o ON o.id=f.order_id JOIN product.warehouses w ON w.id=f.warehouse_id
    LEFT JOIN product.brands b ON b.id=f.brand_id WHERE m.batch_id=$1`,[batchId]);
  if(!r.rows[0])throw new NotFoundException('Prepare a manifest before printing a packing slip');
  const items=await this.db.query(
   'SELECT mi.quantity,mi.weight_grams,p.name,p.sku FROM product.courier_manifest_items mi JOIN product.products p ON p.id=mi.product_id JOIN product.courier_manifests m ON m.id=mi.manifest_id WHERE m.batch_id=$1 ORDER BY p.name',[batchId]);
  return {type:'INTERNAL_PACKING_SLIP_NOT_COURIER_LABEL',awb:null,providerBooking:false,
   slip:r.rows[0],items:items.rows,privacy:'authorized_admin_only'};
 }
 async blockBooking():Promise<never>{
  throw new ServiceUnavailableException({code:'COURIER_BOOKING_DISABLED',
   message:'External carrier requests and chargeable courier bookings require separate owner approval'});
 }
}
