import {StoreProfileService} from './store-profile';
import {manualPaymentBlocker,parseManualPayment} from './manual-payment';
import {ConflictException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import type {PoolClient} from 'pg';
import type {Principal} from './auth';
import {DatabaseService} from './database';
import {CheckoutService} from './checkout';
import {ShippingService} from './shipping';
import {effectivePrice,sellableSQL} from './catalog-pricing';
import {assertVersion,requireActor} from './data-integrity';
import {ensureBalance,inventoryLock,refreshProductAvailability,requireUuid,writeEvent} from './warehouses';
import {shippingFingerprint,shippingParcelFingerprint} from './shipping-fingerprint';
import {shippingConfig} from './shipping-config';
import {editBinding,editBlocker,orderHash,orderStatuses,parseOrderEdit,statusOptions,validateTransition,type OrderEdit,type OrderStatus} from './order-policy';
import * as V from './catalog-validation';

type OrderQuery={query:(sql:string,values?:unknown[])=>Promise<{rows:any[]}>};

@Injectable()
export class OrderManagementService{
 private writable(){if(process.env.ORDER_MANAGEMENT_ENABLED==='false')throw new ServiceUnavailableException('Perubahan pesanan sementara dinonaktifkan. Silakan coba kembali nanti.');}
 constructor(private readonly db:DatabaseService,private readonly checkout:CheckoutService,private readonly shipping:ShippingService,private readonly storeProfile:StoreProfileService){}
 private async order(client:OrderQuery,id:string,lock=false){
  requireUuid(id,'pesanan');const o=(await client.query('SELECT * FROM product.orders WHERE id=$1'+(lock?' FOR UPDATE':''),[id])).rows[0];
  if(!o)throw new NotFoundException('Pesanan tidak ditemukan');return o;
 }
 private async lines(client:OrderQuery,id:string){return (await client.query('SELECT * FROM product.order_items WHERE order_id=$1 ORDER BY product_id,id',[id])).rows;}
 private async batches(client:OrderQuery,id:string){return (await client.query(`SELECT f.id,f.state,f.carrier_handover_at,
  s.tracking_number,s.state AS carrier_state,s.provider_status,s.provider,j.state AS booking_state
  FROM product.fulfillment_batches f LEFT JOIN product.shipments s ON s.fulfillment_batch_id=f.id
  LEFT JOIN product.jubelio_bookings j ON j.batch_id=f.id WHERE f.order_id=$1 ORDER BY f.created_at,f.id`,[id])).rows;}
 private async audit(client:PoolClient,actor:string|null,id:string,action:string,notes:string,before:any,after:any){
  await client.query('INSERT INTO product.order_events(order_id,actor_id,action,notes,before_data,after_data) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',[id,actor,action,notes,JSON.stringify(before),JSON.stringify(after)]);
 }
 async detail(id:string){
  return this.db.transaction(async client=>{
   // A consistent snapshot, including order items, even while another admin saves.
   const o=await this.order(client,id,true),items=await this.lines(client,id),shipments=await this.batches(client,id);
   const q=o.shipping_quote_id?(await client.query('SELECT destination_area_id,destination_region FROM product.shipping_rate_quotes WHERE id=$1',[o.shipping_quote_id])).rows[0]:null;
   const paymentConfirmations=(await client.query('SELECT id,amount_idr,paid_at,bank_name,account_number,account_name,reference,notes,actor_id,created_at FROM product.manual_payment_confirmations WHERE order_id=$1',[id])).rows;
   const events=(await client.query('SELECT id,actor_id,action,notes,before_data,after_data,created_at FROM product.order_events WHERE order_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100',[id])).rows;
   const invoices=(await client.query('SELECT id,invoice_number,order_version,created_at FROM product.order_invoices WHERE order_id=$1 ORDER BY order_version DESC',[id])).rows;
   return {order:o,items,shipments,events,invoices,paymentConfirmations,manualPaymentBlocker:process.env.ORDER_MANAGEMENT_ENABLED==='false'?'Perubahan pesanan sementara dinonaktifkan.':manualPaymentBlocker(o),statusBlockers:Object.fromEntries(Object.keys(orderStatuses).map(target=>{try{if(process.env.ORDER_MANAGEMENT_ENABLED==='false')return [target,'Perubahan pesanan sementara dinonaktifkan.'];validateTransition(o,target as OrderStatus);if(['cancelled','refunded','failed'].includes(target)&&shipments.some(b=>b.booking_state||b.carrier_handover_at||b.carrier_state||!['reserved','cancelled'].includes(b.state)))return [target,'Selesaikan pembatalan/retur melalui Courier Ops terlebih dahulu.'];if(target==='completed'&&(!shipments.some(b=>b.state!=='cancelled')||shipments.some(b=>b.state!=='cancelled'&&b.carrier_state!=='delivered')))return [target,'Seluruh paket harus sudah diterima.'];return [target,null];}catch(e){return [target,e instanceof Error?e.message:'Tidak tersedia'];}})),destinationAreaId:q?.destination_area_id||null,editBlocker:process.env.ORDER_MANAGEMENT_ENABLED==='false'?'Perubahan pesanan sementara dinonaktifkan.':editBlocker(o,shipments.length>0),statusOptions:process.env.ORDER_MANAGEMENT_ENABLED==='false'?[]:statusOptions(o),statusLabels:orderStatuses,paymentEnabled:false};
  });
 }
 async products(q:unknown){
  const search=V.text(q??'','Pencarian',0,120);
  const rows=(await this.db.query(`SELECT p.id,p.name,p.sku,p.option_values,p.price_idr,p.sale_price_idr,p.sale_starts_at,p.sale_ends_at,p.stock_qty,p.weight_grams
   FROM product.products p WHERE ${sellableSQL} AND ($1='' OR strpos(lower(concat_ws(' ',p.name,p.sku)),lower($1))>0) ORDER BY p.name,p.id LIMIT 30`,[search])).rows;
  return {items:rows.map(p=>({...p,unitPriceIdr:effectivePrice({price_idr:p.price_idr,sale_price_idr:p.sale_price_idr,sale_starts_at:p.sale_starts_at,sale_ends_at:p.sale_ends_at})}))};
 }
 private async editable(client:OrderQuery,o:any,x:OrderEdit){
  assertVersion(o.edit_version,x.expectedVersion);
  const blocker=editBlocker(o,(await this.batches(client,o.id)).length>0);if(blocker)throw new ConflictException(blocker);
 }
 async rates(actor:Principal,id:string,raw:unknown){
  this.writable();requireActor(actor);const x=parseOrderEdit(raw),o=await this.order(this.db,id);await this.editable(this.db,o,x);
  const result=await this.shipping.rates(actor,{items:x.items.map(({productId,quantity})=>({productId,quantity})),destinationPostalCode:x.contact.postalCode,...(x.contact.areaId?{destinationAreaId:x.contact.areaId}:{})},{customerId:o.customer_user_id,prices:new Map(x.items.map(i=>[i.productId,i.unitPriceIdr]))});
  const ids=result.rates.map(r=>r.quoteId);
  if(ids.length)await this.db.query('UPDATE product.shipping_rate_quotes SET admin_order_id=$1,admin_edit_hash=$2 WHERE id=ANY($3::uuid[]) AND customer_user_id=$4 AND applied_order_id IS NULL',[id,editBinding(x),ids,o.customer_user_id]);
  return result;
 }
 private async calculate(client:PoolClient,o:any,x:OrderEdit){
  await this.editable(client,o,x);
  const oldLines=await this.lines(client,o.id);
  const quote=await this.checkout.quoted(x.items.map(({productId,quantity})=>({productId,quantity})),(s,p)=>client.query(s,p),x.voucherCode,o.customer_user_id,new Map(x.items.map(i=>[i.productId,i.unitPriceIdr])));
  const products=(await client.query('SELECT id,weight_grams,length_cm,width_cm,height_cm FROM product.products WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE',[x.items.map(i=>i.productId)])).rows;
  const fingerprintItems=x.items.map(i=>{const p=products.find(p=>p.id===i.productId);return {...i,weightGrams:p?.weight_grams,lengthCm:p?.length_cm,widthCm:p?.width_cm,heightCm:p?.height_cm};});
  const oldQuote=o.shipping_quote_id?(await client.query('SELECT * FROM product.shipping_rate_quotes WHERE id=$1',[o.shipping_quote_id])).rows[0]:null;
  const sameLines=JSON.stringify(x.items)===JSON.stringify(oldLines.map(i=>({productId:i.product_id,quantity:i.quantity,unitPriceIdr:Number(i.unit_price_idr)})).sort((a,b)=>a.productId.localeCompare(b.productId)));
  const sameContact=x.contact.name===o.contact_name&&x.contact.phone===o.contact_phone&&x.contact.address===o.address_line&&x.contact.city===o.city&&x.contact.province===o.province&&x.contact.postalCode===o.postal_code&&(!x.contact.areaId||x.contact.areaId===oldQuote?.destination_area_id);
  let selected:any=null,shippingNeeded=false;
  if(x.shippingQuoteId){
   selected=(await client.query('SELECT * FROM product.shipping_rate_quotes WHERE id=$1 FOR UPDATE',[x.shippingQuoteId])).rows[0];
   if(!selected||selected.customer_user_id!==o.customer_user_id||selected.admin_order_id!==o.id||selected.admin_edit_hash!==editBinding(x)||new Date(selected.expires_at).valueOf()<=Date.now()||selected.applied_order_id&&selected.applied_order_id!==o.id)throw new ConflictException('Quote ongkir berubah atau kedaluwarsa. Cek ongkir ulang.');
   const sig=selected.provider==='jubelio'?shippingParcelFingerprint(fingerprintItems):shippingFingerprint(fingerprintItems);
   if(sig!==selected.cart_fingerprint||selected.destination_postal_code!==x.contact.postalCode||selected.provider==='jubelio'&&selected.destination_area_id!==x.contact.areaId)throw new ConflictException('Isi paket atau wilayah berubah. Cek ongkir ulang.');
   if(selected.destination_region&&(selected.destination_region.city!==x.contact.city||selected.destination_region.province!==x.contact.province))throw new ConflictException('Kota dan provinsi harus sesuai wilayah tujuan.');
  }else if(oldQuote){
   const sig=oldQuote.provider==='jubelio'?shippingParcelFingerprint(fingerprintItems):shippingFingerprint(fingerprintItems);
   if(sameLines&&sameContact&&sig===oldQuote.cart_fingerprint)selected=oldQuote;else shippingNeeded=true;
  }else if(shippingConfig().rateLookupEnabled)shippingNeeded=true;
  const shippingFeeIdr=shippingNeeded?null:selected?Number(selected.amount_idr):quote.shippingFeeIdr;
  if(shippingFeeIdr===null)shippingNeeded=true;
  const additionalFeeIdr=x.fees.reduce((n,f)=>n+f.amountIdr,0);
  const totalIdr=shippingFeeIdr===null?null:quote.subtotalIdr-quote.discountIdr+shippingFeeIdr+additionalFeeIdr;
  const result={items:quote.items,subtotalIdr:quote.subtotalIdr,discountIdr:quote.discountIdr,voucherDiscountIdr:quote.voucherDiscountIdr,voucherId:quote.voucherId,voucherCode:quote.voucherCode,promotionDiscountIdr:quote.promotionDiscountIdr,promotionEventId:quote.promotionEventId,promotionTitle:quote.promotionTitle,shippingFeeIdr,additionalFeeIdr,totalIdr,shippingNeeded,shippingQuoteId:selected?.id||null,courier:selected?{provider:selected.provider,courierCode:selected.courier_code,serviceCode:selected.service_code}:null};
  return {result,oldLines,selected,previewHash:orderHash({input:x,result})};
 }
 async preview(actor:Principal,id:string,raw:unknown){
  this.writable();requireActor(actor);const x=parseOrderEdit(raw);
  return this.db.transaction(async client=>{await inventoryLock(client);const o=await this.order(client,id,true),p=await this.calculate(client,o,x);return {...p.result,previewHash:p.previewHash,before:{subtotalIdr:Number(o.subtotal_idr),discountIdr:Number(o.discount_idr),shippingFeeIdr:Number(o.shipping_fee_idr),additionalFeeIdr:Number(o.additional_fee_idr),totalIdr:Number(o.total_idr)}};});
 }
 async save(actor:Principal,id:string,raw:unknown){
  this.writable();const who=requireActor(actor),x=parseOrderEdit(raw),submitted=V.text(V.record(raw).previewHash,'Preview perubahan',64,64);
  return this.db.transaction(async client=>{
   await inventoryLock(client);const o=await this.order(client,id,true),p=await this.calculate(client,o,x),r=p.result;
   if(p.previewHash!==submitted)throw new ConflictException('Preview sudah berubah. Tinjau ulang total dan konfirmasi kembali.');
   if(r.shippingNeeded||r.totalIdr===null)throw new ConflictException('Pilih ongkir yang sesuai sebelum menyimpan pesanan.');
   if(o.shipping_quote_id!==r.shippingQuoteId){
    if(o.shipping_quote_id)await client.query('UPDATE product.shipping_rate_quotes SET applied_order_id=NULL WHERE id=$1 AND applied_order_id=$2',[o.shipping_quote_id,id]);
    if(r.shippingQuoteId)await client.query('UPDATE product.shipping_rate_quotes SET applied_order_id=$2 WHERE id=$1',[r.shippingQuoteId,id]);
   }
   await client.query('DELETE FROM product.order_items WHERE order_id=$1',[id]);
   for(const i of r.items)await client.query('INSERT INTO product.order_items(order_id,product_id,quantity,unit_price_idr,product_name,sku,brand_id,ownership_scope) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,i.productId,i.quantity,i.unitPriceIdr,i.name,i.sku,i.brandId,i.brandId?'brand':'platform']);
   const after=(await client.query(`UPDATE product.orders SET contact_name=$2,contact_phone=$3,address_line=$4,city=$5,province=$6,postal_code=$7,
    subtotal_idr=$8,discount_idr=$9,voucher_discount_idr=$10,voucher_id=$11,voucher_code=$12,promotion_discount_idr=$13,promotion_event_id=$14,promotion_title=$15,
    shipping_fee_idr=$16,additional_fees=$17::jsonb,additional_fee_idr=$18,total_idr=$19,shipping_quote_id=$20,shipping_provider=$21,shipping_courier_code=$22,shipping_service_code=$23 WHERE id=$1 RETURNING *`,
    [id,x.contact.name,x.contact.phone,x.contact.address,x.contact.city,x.contact.province,x.contact.postalCode,r.subtotalIdr,r.discountIdr,r.voucherDiscountIdr,r.voucherId,r.voucherCode,r.promotionDiscountIdr,r.promotionEventId,r.promotionTitle,r.shippingFeeIdr,JSON.stringify(x.fees),r.additionalFeeIdr,r.totalIdr,r.shippingQuoteId,r.courier?.provider||null,r.courier?.courierCode||null,r.courier?.serviceCode||null])).rows[0];
   await this.audit(client,who,id,'edit',x.notes,{order:o,items:p.oldLines},{order:after,items:await this.lines(client,id)});
   return {id,version:after.edit_version,totalIdr:r.totalIdr};
  });
 }
 async transition(actor:Principal,id:string,raw:unknown){
  this.writable();const who=requireActor(actor),x=V.record(raw,['expectedVersion','status','notes']),version=V.integer(x.expectedVersion,'Versi',1),notes=V.text(x.notes,'Alasan perubahan',8,300),target=V.text(x.status,'Status',1,30) as OrderStatus;
  return this.db.transaction(async client=>{
   await inventoryLock(client);const o=await this.order(client,id,true);assertVersion(o.edit_version,version);validateTransition(o,target);
   const batches=await this.batches(client,id);
   if(['cancelled','refunded','failed'].includes(target)&&batches.some(b=>b.booking_state||b.carrier_handover_at||b.carrier_state||!['reserved','cancelled'].includes(b.state)))throw new ConflictException('Pesanan sudah dipacking atau memiliki pengiriman. Selesaikan pembatalan/retur melalui Courier Ops terlebih dahulu.');
   if(target==='completed'&&(!(o.payment_status==='paid'&&o.payment_provider&&o.payment_reference)||!batches.some(b=>b.state!=='cancelled')||batches.some(b=>b.state!=='cancelled'&&b.carrier_state!=='delivered')))throw new ConflictException('Selesai memerlukan pembayaran terverifikasi dan seluruh paket telah diterima.');
   let legacy=o.status;if(target==='processing')legacy='paid';if(target==='completed')legacy='fulfilled';if(target==='cancelled'||target==='refunded')legacy='cancelled';
   // Cancelled unpaid/refunded reserved batches can be released atomically. Paid
   // cancellations retain reservation until a verified refund is recorded.
   if(['cancelled','refunded'].includes(target)&&o.payment_status!=='paid'){
    const touched:string[]=[];
    for(const b of batches.filter(b=>b.state==='reserved')){
     const lines=(await client.query('SELECT l.product_id,l.quantity,f.warehouse_id FROM product.fulfillment_lines l JOIN product.fulfillment_batches f ON f.id=l.batch_id WHERE l.batch_id=$1 ORDER BY l.product_id',[b.id])).rows;
     for(const line of lines){const bal=await ensureBalance(client,line.warehouse_id,line.product_id);await writeEvent(client,{row:bal,deltaHand:0,deltaReserved:-line.quantity,reason:'release',notes,actor:who,batchId:b.id});touched.push(line.product_id);}
     await client.query("UPDATE product.fulfillment_batches SET state='cancelled',updated_at=now() WHERE id=$1",[b.id]);
     await client.query("INSERT INTO product.fulfillment_tracking_events(batch_id,state,source,actor_id,notes) VALUES($1,'cancelled','internal',$2,$3)",[b.id,who,notes]);
    }
    await refreshProductAvailability(client,touched);
   }
   const after=(await client.query("UPDATE product.orders SET operational_status=$2,status=$3,operational_hold=($2='on_hold') WHERE id=$1 RETURNING *",[id,target,legacy])).rows[0];
   await this.audit(client,who,id,'status',notes,{status:o.operational_status,version:o.edit_version},{status:after.operational_status,version:after.edit_version});
   return {id,status:after.operational_status,version:after.edit_version};
  });
 }
 async confirmPayment(actor:Principal,id:string,raw:unknown){
  this.writable();const who=requireActor(actor),x=parseManualPayment(raw),hash=orderHash({...x,expectedVersion:undefined,idempotencyKey:undefined});
  try{return await this.db.transaction(async c=>{
   await inventoryLock(c);const o=await this.order(c,id,true);
   const previous=(await c.query('SELECT * FROM product.manual_payment_confirmations WHERE idempotency_key=$1 OR order_id=$2',[x.idempotencyKey,id])).rows[0];
   if(previous){if(previous.order_id===id&&previous.idempotency_key===x.idempotencyKey&&previous.request_hash===hash)return {id,confirmationId:previous.id,replayed:true};throw new ConflictException('Pembayaran sudah dikonfirmasi atau kunci permintaan sudah digunakan. Muat ulang pesanan.');}
   assertVersion(o.edit_version,x.expectedVersion);const blocker=manualPaymentBlocker(o);if(blocker)throw new ConflictException(blocker);
   if((await this.batches(c,id)).some(b=>b.state!=='cancelled'))throw new ConflictException('Pesanan memiliki proses gudang aktif. Tinjau terlebih dahulu.');
   if(x.amountIdr!==Number(o.total_idr))throw new ConflictException({code:'PAYMENT_AMOUNT_MISMATCH',message:'Nominal tidak sama dengan total tagihan. Selesaikan selisih sebelum konfirmasi.',differenceIdr:x.amountIdr-Number(o.total_idr)});
   const confirmation=(await c.query(`INSERT INTO product.manual_payment_confirmations(order_id,idempotency_key,request_hash,amount_idr,paid_at,bank_name,account_number,account_name,reference,reference_key,notes,actor_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,[id,x.idempotencyKey,hash,x.amountIdr,x.paidAt,x.bankName,x.accountNumber,x.accountName,x.reference,x.referenceKey,x.notes,who])).rows[0];
   const after=(await c.query("UPDATE product.orders SET payment_status='paid',payment_provider='manual_bank_transfer',payment_reference=$2,status='paid',operational_status='processing',operational_hold=false WHERE id=$1 RETURNING *",[id,x.reference])).rows[0];
   await this.audit(c,who,id,'payment_confirmed',x.notes,{paymentStatus:o.payment_status,status:o.operational_status},{paymentStatus:after.payment_status,status:after.operational_status,confirmationId:confirmation.id,amountIdr:x.amountIdr,paidAt:x.paidAt,reference:x.reference});
   return {id,confirmationId:confirmation.id,paymentStatus:'paid',status:'processing',version:after.edit_version};
  });}catch(e){if((e as {code?:string}).code==='23505')throw new ConflictException('Referensi transaksi atau konfirmasi ini sudah digunakan. Periksa riwayat pembayaran.');throw e;}
 }
 async invoice(actor:Principal,id:string,revision?:unknown){
  const who=requireActor(actor);
  return this.db.transaction(async client=>{
   const o=await this.order(client,id,true),version=revision===undefined?o.edit_version:V.integer(revision,'Revisi invoice',1);
   const previous=(await client.query('SELECT * FROM product.order_invoices WHERE order_id=$1 AND order_version=$2',[id,version])).rows[0];if(previous)return previous;
   if(version!==o.edit_version)throw new NotFoundException('Revisi invoice tidak ditemukan');
   const {profile}=await this.storeProfile.get(client);
   const snapshot={store:{...profile,address:[profile.address,[profile.city,profile.province,profile.postalCode].filter(Boolean).join(', ')].filter(Boolean).join(' — ')},order:o,items:await this.lines(client,id),statusLabel:orderStatuses[o.operational_status as OrderStatus]};
   return (await client.query('INSERT INTO product.order_invoices(order_id,order_version,invoice_number,snapshot,created_by) VALUES($1,$2,$3,$4::jsonb,$5) RETURNING *',[id,version,o.invoice_number,JSON.stringify(snapshot),who])).rows[0];
  });
 }
}
