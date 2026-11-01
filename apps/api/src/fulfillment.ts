import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {DatabaseService} from './database';
import type {Principal} from './auth';
import {ensureBalance,inventoryLock,refreshProductAvailability,requireUuid,writeEvent} from './warehouses';

export function paidOrderVerified(order:{status:string;payment_status:string;payment_provider:string|null;payment_reference:string|null}):boolean{
 return order.status==='paid'&&order.payment_status==='paid'&&!!order.payment_provider&&!!order.payment_reference;
}
export function parseFulfillmentRequest(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Fulfillment request required');
 const obj=raw as Record<string,unknown>;
 if(Object.keys(obj).length!==1||!('idempotencyKey' in obj))throw new BadRequestException('Idempotency key required');
 return {idempotencyKey:requireUuid(obj.idempotencyKey,'request key')};
}
export function parseFulfillmentStatus(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Invalid state request');
 const b=raw as Record<string,unknown>;
 if(Object.keys(b).some(k=>!['state','notes'].includes(k))||typeof b.state!=='string'||
  !['picking','packed','ready_for_carrier'].includes(b.state)||
  typeof b.notes!=='string'||b.notes.trim().length<6||b.notes.length>300)
  throw new BadRequestException('A supported internal state and audit note are required');
 return {state:b.state as 'picking'|'packed'|'ready_for_carrier',notes:b.notes.trim()};
}
const nextStates:Record<string,string>={reserved:'picking',picking:'packed',packed:'ready_for_carrier'};
type Order={id:string;status:string;payment_status:string;payment_provider:string|null;payment_reference:string|null};
type OrderLine={id:string;product_id:string;quantity:number;brand_id:string|null;slug:string};
type Place={warehouse_id:string;on_hand:number;reserved:number;code:string};
@Injectable()
export class FulfillmentService {
 constructor(private readonly db:DatabaseService){}
 async list(){
  const result=await this.db.query(
   `SELECT f.id,f.order_id,f.brand_id,b.name AS brand_name,f.warehouse_id,w.code AS warehouse_code,
    f.state,f.created_at,f.updated_at,o.payment_status,
    (SELECT COALESCE(sum(l.quantity),0)::integer FROM product.fulfillment_lines l WHERE l.batch_id=f.id) AS units
    FROM product.fulfillment_batches f JOIN product.brands b ON b.id=f.brand_id
    JOIN product.warehouses w ON w.id=f.warehouse_id JOIN product.orders o ON o.id=f.order_id
    ORDER BY f.created_at DESC LIMIT 200`);
  return {items:result.rows,courierBookingEnabled:false,paymentEnabled:false,trackingSource:'internal_only'};
 }
 async plan(orderId:string){
  requireUuid(orderId,'order');
  const [order,items]=await Promise.all([
   this.db.query<Order>('SELECT id,status,payment_status,payment_provider,payment_reference FROM product.orders WHERE id=$1',[orderId]),
   this.db.query<{id:string;product_id:string;brand_id:string|null;quantity:number;product_name:string;sku:string|null}>(
    'SELECT oi.id,oi.product_id,COALESCE(oi.brand_id,p.brand_id) AS brand_id,oi.quantity,oi.product_name,oi.sku FROM product.order_items oi JOIN product.products p ON p.id=oi.product_id WHERE oi.order_id=$1 ORDER BY brand_id,oi.id',[orderId])
  ]);
  if(!order.rows[0])throw new NotFoundException('Order not found');
  const warehouseStock=await this.db.query<{product_id:string;warehouse_code:string;available:number}>(
   'SELECT s.product_id,w.code AS warehouse_code,s.on_hand-s.reserved AS available FROM product.warehouse_stock s JOIN product.warehouses w ON w.id=s.warehouse_id WHERE s.product_id=ANY($1::uuid[]) AND w.is_active AND w.is_dispatch_enabled ORDER BY w.code',
   [items.rows.map(x=>x.product_id)]);
  const availability=new Map<string,{warehouseCode:string;available:number}[]>();
  for(const x of warehouseStock.rows){const rows=availability.get(x.product_id)||[];rows.push({warehouseCode:x.warehouse_code,available:x.available});availability.set(x.product_id,rows);}
  const lines=items.rows.map(x=>({...x,locations:availability.get(x.product_id)||[]}));
  return {orderId,eligible:paidOrderVerified(order.rows[0]),lines,courierBookingEnabled:false,requiresVerifiedPayment:true};
 }
 async prepare(actor:Principal,orderId:string,body:unknown){
  if(!actor.emailVerified)throw new ForbiddenException('Verified administrator required');
  requireUuid(orderId,'order');const {idempotencyKey}=parseFulfillmentRequest(body);
  return this.db.transaction(async client=>{
   await inventoryLock(client);
   const r=await client.query<Order>('SELECT id,status,payment_status,payment_provider,payment_reference FROM product.orders WHERE id=$1 FOR UPDATE',[orderId]);
   const order=r.rows[0];if(!order)throw new NotFoundException('Order not found');
   const previous=await client.query<{request_key:string}>('SELECT request_key FROM product.fulfillment_preparations WHERE order_id=$1',[orderId]);
   if(previous.rows[0]){
    if(previous.rows[0].request_key!==idempotencyKey)throw new ConflictException('Order was already prepared with a different request key');
    const rows=await client.query('SELECT id,brand_id,warehouse_id,state FROM product.fulfillment_batches WHERE order_id=$1 ORDER BY brand_id,warehouse_id',[orderId]);
    return {orderId,batches:rows.rows,replayed:true,courierBookingEnabled:false};
   }
   if(!paidOrderVerified(order))throw new ConflictException('Cannot reserve a draft or unverified payment');
   const lines=await client.query<OrderLine>(
    `SELECT oi.id,oi.product_id,oi.quantity,COALESCE(oi.brand_id,p.brand_id) AS brand_id,p.slug
    FROM product.order_items oi JOIN product.products p ON p.id=oi.product_id
    WHERE oi.order_id=$1 ORDER BY oi.product_id,oi.id FOR UPDATE OF p`,[orderId]);
   if(!lines.rows.length)throw new ConflictException('Order has no items');
   const batches=new Map<string,{id:string;brandId:string;warehouseId:string}>();
   const affected:string[]=[];
   for(const line of lines.rows){
    if(line.slug.startsWith('demo-')||!line.brand_id)throw new ConflictException('Order contains a product without verified brand');
    const stock=await client.query<Place>(
     `SELECT s.warehouse_id,s.on_hand,s.reserved,w.code
       FROM product.warehouse_stock s JOIN product.warehouses w ON w.id=s.warehouse_id
       WHERE s.product_id=$1 AND w.is_active=true AND w.is_dispatch_enabled=true
       ORDER BY w.code,s.warehouse_id FOR UPDATE OF s`,[line.product_id]);
    let remaining=line.quantity;
    for(const place of stock.rows){
     const available=place.on_hand-place.reserved;
     if(available<=0)continue;
     const quantity=Math.min(available,remaining);
     const key=line.brand_id+':'+place.warehouse_id;
     let batch=batches.get(key);
     if(!batch){
      const inserted=await client.query<{id:string}>(
       "INSERT INTO product.fulfillment_batches(order_id,brand_id,warehouse_id,state) VALUES($1,$2,$3,'reserved') RETURNING id",
       [orderId,line.brand_id,place.warehouse_id]);
      batch={id:inserted.rows[0].id,brandId:line.brand_id,warehouseId:place.warehouse_id};
      batches.set(key,batch);
      await client.query(
       "INSERT INTO product.fulfillment_tracking_events(batch_id,state,source,actor_id,notes) VALUES($1,'reserved','internal',$2,'Reserved only after verified paid order')",
       [batch.id,actor.id]);
     }
     await client.query('INSERT INTO product.fulfillment_lines(batch_id,order_item_id,product_id,quantity) VALUES($1,$2,$3,$4)',
       [batch.id,line.id,line.product_id,quantity]);
     const bal=await ensureBalance(client,place.warehouse_id,line.product_id);
     await writeEvent(client,{row:bal,deltaHand:0,deltaReserved:quantity,reason:'reserve',
       notes:'Verified paid order '+orderId,actor:actor.id,batchId:batch.id});
     remaining-=quantity;affected.push(line.product_id);
     if(remaining===0)break;
    }
    if(remaining!==0)throw new ConflictException('Insufficient dispatch-enabled warehouse stock for product '+line.product_id);
   }
   await refreshProductAvailability(client,affected);
   await client.query('INSERT INTO product.fulfillment_preparations(order_id,request_key,actor_id) VALUES($1,$2,$3)',[orderId,idempotencyKey,actor.id]);
   return {orderId,batches:[...batches.values()],replayed:false,courierBookingEnabled:false,paymentEnabled:false};
  });
 }
 async transition(actor:Principal,batchId:string,body:unknown){
  if(!actor.emailVerified)throw new ForbiddenException('Verified administrator required');
  requireUuid(batchId,'batch');const change=parseFulfillmentStatus(body);
  return this.db.transaction(async client=>{
   const r=await client.query<{id:string;state:string}>('SELECT id,state FROM product.fulfillment_batches WHERE id=$1 FOR UPDATE',[batchId]);
   const b=r.rows[0];if(!b)throw new NotFoundException('Fulfillment batch not found');
   if(b.state===change.state)return {id:b.id,state:b.state,replayed:true,carrierBookingEnabled:false};
   if(nextStates[b.state]!==change.state)throw new ConflictException('Invalid fulfillment transition');
   await client.query('UPDATE product.fulfillment_batches SET state=$2,updated_at=now() WHERE id=$1',[batchId,change.state]);
   await client.query(
    "INSERT INTO product.fulfillment_tracking_events(batch_id,state,source,actor_id,notes) VALUES($1,$2,'internal',$3,$4)",
    [batchId,change.state,actor.id,change.notes]);
   return {id:batchId,state:change.state,replayed:false,carrierBookingEnabled:false};
  });
 }
 async release(actor:Principal,batchId:string,body:unknown){
  if(!actor.emailVerified)throw new ForbiddenException('Verified administrator required');
  requireUuid(batchId,'batch');
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body as Record<string,unknown>).some(x=>x!=='notes'))
   throw new BadRequestException('Release note required');
  const notes=(body as Record<string,unknown>).notes;
  if(typeof notes!=='string'||notes.trim().length<8||notes.length>300)throw new BadRequestException('Document cancellation and refund before releasing stock');
  return this.db.transaction(async client=>{
   await inventoryLock(client);
   const r=await client.query<{id:string;state:string;order_id:string;status:string;payment_status:string}>(
    'SELECT f.id,f.state,f.order_id,o.status,o.payment_status FROM product.fulfillment_batches f JOIN product.orders o ON o.id=f.order_id WHERE f.id=$1 FOR UPDATE OF f',[batchId]);
   const b=r.rows[0];if(!b)throw new NotFoundException('Batch not found');
   if(b.state==='cancelled')return {id:batchId,state:'cancelled',replayed:true};
   if(b.status!=='cancelled'||b.payment_status!=='refunded'||b.state!=='reserved')
    throw new ConflictException('Release requires a cancelled, refunded order and unpicked batch');
   const lines=await client.query<{product_id:string;quantity:number;warehouse_id:string}>(
    'SELECT l.product_id,l.quantity,f.warehouse_id FROM product.fulfillment_lines l JOIN product.fulfillment_batches f ON f.id=l.batch_id WHERE f.id=$1 ORDER BY l.product_id',[batchId]);
   for(const line of lines.rows){
    await client.query('SELECT id FROM product.products WHERE id=$1 FOR UPDATE',[line.product_id]);
    const balance=await ensureBalance(client,line.warehouse_id,line.product_id);
    await writeEvent(client,{row:balance,deltaHand:0,deltaReserved:-line.quantity,reason:'release',
      notes:notes.trim(),actor:actor.id,batchId});
   }
   await refreshProductAvailability(client,lines.rows.map(x=>x.product_id));
   await client.query("UPDATE product.fulfillment_batches SET state='cancelled',updated_at=now() WHERE id=$1",[batchId]);
   await client.query("INSERT INTO product.fulfillment_tracking_events(batch_id,state,source,actor_id,notes) VALUES($1,'cancelled','internal',$2,$3)",[batchId,actor.id,notes.trim()]);
   return {id:batchId,state:'cancelled',replayed:false};
  });
 }
 async timeline(batchId:string){
  requireUuid(batchId,'batch');
  const r=await this.db.query(
   'SELECT state,source,notes,created_at FROM product.fulfillment_tracking_events WHERE batch_id=$1 ORDER BY created_at,id LIMIT 100',[batchId]);
  return {batchId,events:r.rows,carrierTracking:false};
 }
 async brandBatches(brandId:string){
  requireUuid(brandId,'brand');
  const r=await this.db.query(
   `SELECT f.id,f.order_id,f.state,w.code AS warehouse_code,f.created_at,
      (SELECT coalesce(sum(l.quantity),0)::integer FROM product.fulfillment_lines l WHERE l.batch_id=f.id) AS units
    FROM product.fulfillment_batches f JOIN product.warehouses w ON w.id=f.warehouse_id
    WHERE f.brand_id=$1 ORDER BY f.created_at DESC LIMIT 100`,[brandId]);
  return {brandId,items:r.rows,customerDataExcluded:true,carrierTracking:false};
 }
 async customerTracking(user:Principal,orderId:string){
  requireUuid(orderId,'order');
  const row=await this.db.query<{id:string}>('SELECT id FROM product.orders WHERE id=$1 AND customer_user_id=$2',[orderId,user.id]);
  if(!row.rows[0])throw new NotFoundException('Order not found');
  const r=await this.db.query(
   `SELECT f.id AS batch_id,b.name AS brand_name,f.state,w.city AS origin_city,
      (SELECT json_agg(json_build_object('state',e.state,'at',e.created_at) ORDER BY e.created_at,e.id)
       FROM product.fulfillment_tracking_events e WHERE e.batch_id=f.id) AS events
      FROM product.fulfillment_batches f JOIN product.brands b ON b.id=f.brand_id
      JOIN product.warehouses w ON w.id=f.warehouse_id WHERE f.order_id=$1
      ORDER BY b.name,w.code`,[orderId]);
  return {orderId,batches:r.rows,carrierTrackingAvailable:false,trackingNumber:null,paymentEnabled:false};
 }
}
