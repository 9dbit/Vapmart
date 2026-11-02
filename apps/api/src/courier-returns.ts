import {ConflictException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {DatabaseService} from './database';
import type {Principal} from './auth';
import {requireUuid,inventoryLock,ensureBalance,writeEvent,refreshProductAvailability} from './warehouses';
import {parseReturnRequest,parseReturnReview,parseReturnReceipt,parseRestockRequest} from './courier-protocol';
type ReturnRow={id:string;batch_id:string;order_id:string;customer_user_id:string;request_key:string;
 status:string;reason:string;review_note:string|null;received_note:string|null;received_warehouse_id:string|null;restock_key:string|null};
@Injectable()
export class CourierReturnService{
 constructor(private readonly db:DatabaseService){}
 async request(actor:Principal,raw:unknown){
  if(!actor.emailVerified)throw new ForbiddenException('Verified customer account required');
  const d=parseReturnRequest(raw);
  return this.db.transaction(async client=>{
   const row=await client.query<{order_id:string;customer_user_id:string;shipment_state:string|null;provider_shipment_id:string|null;handover_at:string|null}>(
    `SELECT f.order_id,o.customer_user_id,s.state AS shipment_state,s.provider_shipment_id,
      f.carrier_handover_at AS handover_at
     FROM product.fulfillment_batches f JOIN product.orders o ON o.id=f.order_id
     LEFT JOIN product.shipments s ON s.fulfillment_batch_id=f.id
     WHERE f.id=$1 AND o.customer_user_id=$2 FOR UPDATE OF f`,
    [d.batchId,actor.id]);
   const x=row.rows[0];if(!x)throw new NotFoundException('Batch does not belong to customer');
   if(x.shipment_state!=='delivered'||!x.provider_shipment_id||!x.handover_at)
    throw new ConflictException('Return requests require a provider-confirmed delivered shipment');
   const old=await client.query<ReturnRow>(
    'SELECT id,batch_id,order_id,customer_user_id,request_key,status,reason,review_note,received_note,received_warehouse_id,restock_key FROM product.courier_returns WHERE batch_id=$1 AND customer_user_id=$2 FOR UPDATE',
    [d.batchId,actor.id]);
   if(old.rows[0]){
    if(old.rows[0].request_key!==d.idempotencyKey||old.rows[0].reason!==d.reason)
     throw new ConflictException('Return request already exists for this delivered batch');
    return {returnId:old.rows[0].id,status:old.rows[0].status,replayed:true,refundIssued:false};
   }
   const inserted=await client.query<{id:string}>(
    "INSERT INTO product.courier_returns(batch_id,order_id,customer_user_id,request_key,reason,status) VALUES($1,$2,$3,$4,$5,'requested') RETURNING id",
    [d.batchId,x.order_id,actor.id,d.idempotencyKey,d.reason]);
   await client.query("INSERT INTO product.courier_return_events(return_id,status,actor_id,note) VALUES($1,'requested',$2,$3)",
    [inserted.rows[0].id,actor.id,d.reason]);
   return {returnId:inserted.rows[0].id,status:'requested',replayed:false,refundIssued:false,returnCourierBooking:false};
  });
 }
 async customerList(actor:Principal){
  if(!actor.emailVerified)throw new ForbiddenException('Verified customer required');
  const r=await this.db.query(
   'SELECT id,batch_id,order_id,status,reason,review_note,created_at,updated_at FROM product.courier_returns WHERE customer_user_id=$1 ORDER BY created_at DESC LIMIT 100',
   [actor.id]);
  return {items:r.rows,refundAutomatic:false,returnBookingEnabled:false};
 }
 async adminList(){
  const r=await this.db.query(
   `SELECT r.id,r.batch_id,r.order_id,r.status,r.reason,r.review_note,r.received_note,
    r.received_warehouse_id,r.created_at,r.updated_at,b.name AS brand_name,w.code AS origin_warehouse
    FROM product.courier_returns r JOIN product.fulfillment_batches f ON f.id=r.batch_id
    JOIN product.brands b ON b.id=f.brand_id JOIN product.warehouses w ON w.id=f.warehouse_id
    ORDER BY r.created_at DESC LIMIT 200`);
  return {items:r.rows,refundAutomatic:false,providerReturnBooked:false};
 }
 async review(actor:Principal,id:string,body:unknown){
  if(!actor.emailVerified)throw new ForbiddenException('Verified admin required');
  requireUuid(id,'return');const d=parseReturnReview(body);
  return this.db.transaction(async client=>{
   const r=await client.query<ReturnRow>(
    'SELECT id,batch_id,order_id,customer_user_id,request_key,status,reason,review_note,received_note,received_warehouse_id,restock_key FROM product.courier_returns WHERE id=$1 FOR UPDATE',[id]);
   const x=r.rows[0];if(!x)throw new NotFoundException('Return not found');
   if(x.status===d.decision&&x.review_note===d.notes)return {returnId:id,status:x.status,replayed:true};
   if(x.status!=='requested')throw new ConflictException('Return already reviewed');
   await client.query('UPDATE product.courier_returns SET status=$2,review_note=$3,review_actor=$4,updated_at=now() WHERE id=$1',
    [id,d.decision,d.notes,actor.id]);
   await client.query('INSERT INTO product.courier_return_events(return_id,status,actor_id,note) VALUES($1,$2,$3,$4)',
    [id,d.decision,actor.id,d.notes]);
   return {returnId:id,status:d.decision,replayed:false,refundIssued:false};
  });
 }
 async receive(actor:Principal,id:string,body:unknown){
  if(!actor.emailVerified)throw new ForbiddenException('Verified admin required');
  requireUuid(id,'return');const d=parseReturnReceipt(body);
  return this.db.transaction(async client=>{
   await inventoryLock(client);
   const r=await client.query<ReturnRow>(
    'SELECT id,batch_id,order_id,customer_user_id,request_key,status,reason,review_note,received_note,received_warehouse_id,restock_key FROM product.courier_returns WHERE id=$1 FOR UPDATE',[id]);
   const x=r.rows[0];if(!x)throw new NotFoundException('Return not found');
   if(x.status==='received'&&x.received_note===d.notes&&x.received_warehouse_id===d.warehouseId)
    return {returnId:id,status:'received',replayed:true};
   if(x.status!=='approved')throw new ConflictException('Return must be approved before physical receiving');
   const w=await client.query<{id:string}>('SELECT id FROM product.warehouses WHERE id=$1 AND is_active=true AND is_system_hold=false FOR UPDATE',[d.warehouseId]);
   if(!w.rows[0])throw new ConflictException('Active physical receiving warehouse required');
   await client.query(
    "UPDATE product.courier_returns SET status='received',received_warehouse_id=$2,received_note=$3,updated_at=now() WHERE id=$1",
    [id,d.warehouseId,d.notes]);
   await client.query("INSERT INTO product.courier_return_events(return_id,status,actor_id,note) VALUES($1,'received',$2,$3)",
    [id,actor.id,d.notes]);
   return {returnId:id,status:'received',stockChanged:false,replayed:false,refundIssued:false};
  });
 }
 async restock(actor:Principal,id:string,body:unknown){
  if(!actor.emailVerified)throw new ForbiddenException('Verified admin required');
  requireUuid(id,'return');const d=parseRestockRequest(body);
  return this.db.transaction(async client=>{
   await inventoryLock(client);
   const r=await client.query<ReturnRow>(
    'SELECT id,batch_id,order_id,customer_user_id,request_key,status,reason,review_note,received_note,received_warehouse_id,restock_key FROM product.courier_returns WHERE id=$1 FOR UPDATE',[id]);
   const x=r.rows[0];if(!x)throw new NotFoundException('Return not found');
   if(x.status==='restocked'){
    if(x.restock_key!==d.idempotencyKey)throw new ConflictException('Return already restocked under another request');
    return {returnId:id,status:'restocked',replayed:true,refundIssued:false};
   }
   if(x.status!=='received'||!x.received_warehouse_id)
    throw new ConflictException('Physical return inspection must be completed before restock');
   const w=await client.query<{id:string}>(
    'SELECT id FROM product.warehouses WHERE id=$1 AND is_active=true AND is_system_hold=false FOR UPDATE',[x.received_warehouse_id]);
   if(!w.rows[0])throw new ConflictException('Receiving warehouse unavailable');
   const lines=await client.query<{product_id:string;quantity:number}>(
    'SELECT product_id,sum(quantity)::integer AS quantity FROM product.fulfillment_lines WHERE batch_id=$1 GROUP BY product_id ORDER BY product_id',
    [x.batch_id]);
   if(!lines.rows.length)throw new ConflictException('No returnable fulfillment goods');
   for(const line of lines.rows){
    await client.query('SELECT id FROM product.products WHERE id=$1 FOR UPDATE',[line.product_id]);
    const balance=await ensureBalance(client,x.received_warehouse_id,line.product_id);
    await writeEvent(client,{row:balance,deltaHand:line.quantity,deltaReserved:0,
      reason:'return',notes:d.notes,actor:actor.id,key:d.idempotencyKey,batchId:x.batch_id});
   }
   await refreshProductAvailability(client,lines.rows.map(x=>x.product_id));
   await client.query(
    "UPDATE product.courier_returns SET status='restocked',restock_key=$2,updated_at=now() WHERE id=$1",
    [id,d.idempotencyKey]);
   await client.query("INSERT INTO product.courier_return_events(return_id,status,actor_id,note) VALUES($1,'restocked',$2,$3)",
    [id,actor.id,d.notes]);
   return {returnId:id,status:'restocked',replayed:false,refundIssued:false,
    restockedUnits:lines.rows.reduce((sum,x)=>sum+x.quantity,0)};
  });
 }
 async timeline(id:string){
  requireUuid(id,'return');
  const r=await this.db.query('SELECT status,note,created_at FROM product.courier_return_events WHERE return_id=$1 ORDER BY created_at,id',[id]);
  return {returnId:id,items:r.rows,providerReturnBooking:false};
 }
}
