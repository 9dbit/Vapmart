import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {DatabaseService} from './database';
import {inventoryLock,ensureBalance,writeEvent,refreshProductAvailability,requireUuid} from './warehouses';
import {paidOrderVerified} from './fulfillment';
import {courierRanks,courierState,normalizeBiteshipWebhook,providerEventHash,verifyWebhookHeader} from './courier-protocol';
import type {ProviderEvent} from './courier-protocol';
type Shipment={
 id:string;fulfillment_batch_id:string;provider:string;provider_shipment_id:string;
 state:string;provider_status:string|null;status_rank:number;tracking_number:string|null;
 warehouse_id:string;batch_state:string;carrier_handover_at:string|null;
 status:string;payment_status:string;payment_provider:string|null;payment_reference:string|null
};
export function trackingDecision(priorRank:number,newStatus:string){
 const rank=courierRanks[newStatus]||0;
 if(newStatus==='on_hold')return {rank,canAdvance:false,needsReview:true};
 if(rank===0)return {rank,canAdvance:priorRank<3,needsReview:priorRank>=3};
 return {rank,canAdvance:rank>priorRank,needsReview:false};
}
@Injectable()
export class CourierEventService{
 constructor(private readonly db:DatabaseService){}
 // Called only for a provider order ID already bound to a real shipment.
 async ingest(headers:Record<string,string|string[]|undefined>,rawBody:Buffer|undefined){
  verifyWebhookHeader(headers);
  if(!Buffer.isBuffer(rawBody)||rawBody.length===0||rawBody.length>32768)
   throw new BadRequestException('Courier webhook payload must be JSON <=32KB');
  let body:unknown;try{body=JSON.parse(rawBody.toString('utf8'));}catch{
   throw new BadRequestException('Malformed courier event JSON');
  }
  return this.applyVerified(normalizeBiteshipWebhook(body),['biteship','biteship_test']);
 }
 // This method accepts only events obtained by a trusted server-side adapter.
 async applyVerified(evt:ProviderEvent,providers:string[]){
  const hash=providerEventHash(evt);
  return this.db.transaction(async client=>{
   await inventoryLock(client);
   const result=await client.query<Shipment>(
    `SELECT s.id,s.fulfillment_batch_id,s.provider,s.provider_shipment_id,s.state,s.provider_status,
    s.status_rank,s.tracking_number,f.warehouse_id,f.state AS batch_state,
    f.carrier_handover_at,o.status,o.payment_status,o.payment_provider,o.payment_reference
    FROM product.shipments s JOIN product.fulfillment_batches f ON f.id=s.fulfillment_batch_id
    JOIN product.orders o ON o.id=f.order_id
    WHERE s.provider_shipment_id=$1 AND s.provider=ANY($2::text[]) FOR UPDATE OF s,f,o`,
    [evt.providerOrderId,providers]);
   const shipment=result.rows[0];
   if(!shipment)throw new NotFoundException('Provider shipment not registered');
   const inserted=await client.query<{id:string}>(
    `INSERT INTO product.courier_tracking_events(shipment_id,event_hash,event_type,provider_status,waybill_id,observed_fee_idr,is_applied)
     VALUES($1,$2,$3,$4,$5,$6,false) ON CONFLICT(shipment_id,event_hash) DO NOTHING RETURNING id`,
    [shipment.id,hash,evt.event,evt.status,evt.waybill,evt.priceIdr]);
   if(!inserted.rows[0])return {accepted:true,replayed:true,carrierState:shipment.state,chargedCustomer:false};
   const eventId=inserted.rows[0].id;
   let applied=false,reconcilePrice=false,needsReview=false;
   if(evt.event==='order.price'){
    // Provider price corrections MUST NOT alter customer order total, payment ledger or wallet.
    reconcilePrice=true;
   }else{
    // Official waybill changes come through order.waybill_id. A stale status event
    // cannot overwrite a newer waybill number after the package advanced.
    if(evt.waybill&&(evt.event==='order.waybill_id'||
       (!shipment.tracking_number&&
        (evt.status===null||(courierRanks[evt.status]||0)>=shipment.status_rank)))){
     await client.query('UPDATE product.shipments SET tracking_number=$2,updated_at=now() WHERE id=$1',
      [shipment.id,evt.waybill]);
     applied=true;
    }
    if(evt.event==='order.status'&&evt.status){
     const decision=trackingDecision(shipment.status_rank,evt.status);
     needsReview=decision.needsReview;
     if(decision.canAdvance&&!(shipment.provider==='jubelio'&&['cancelled','rejected'].includes(shipment.provider_status||''))){
      const physicalHandover=decision.rank>=3&&evt.status!=='return_in_transit'&&evt.status!=='returned';
      if(physicalHandover&&!shipment.carrier_handover_at){
       if(shipment.batch_state!=='ready_for_carrier'||!paidOrderVerified(shipment))
        throw new ConflictException('Shipment must be paid, reserved and ready before physical carrier pickup');
       const lines=await client.query<{product_id:string;quantity:number}>(
        'SELECT product_id,quantity FROM product.fulfillment_lines WHERE batch_id=$1 ORDER BY product_id',[shipment.fulfillment_batch_id]);
       if(!lines.rows.length)throw new ConflictException('Manifest without reservable fulfillment lines');
       const touched:string[]=[];
       for(const line of lines.rows){
        await client.query('SELECT id FROM product.products WHERE id=$1 FOR UPDATE',[line.product_id]);
        const bal=await ensureBalance(client,shipment.warehouse_id,line.product_id);
        if(bal.reserved<line.quantity)throw new ConflictException('Reserved quantity no longer matches handover');
        await writeEvent(client,{row:bal,deltaHand:-line.quantity,deltaReserved:-line.quantity,
         reason:'fulfilled',notes:shipment.provider+' pickup-confirmed order '+evt.providerOrderId,
         actor:null,batchId:shipment.fulfillment_batch_id});
        touched.push(line.product_id);
       }
       await client.query('UPDATE product.fulfillment_batches SET carrier_handover_at=now(),updated_at=now() WHERE id=$1',
        [shipment.fulfillment_batch_id]);
       await refreshProductAvailability(client,touched);
      }
      if((evt.status==='return_in_transit'||evt.status==='returned')&&!shipment.carrier_handover_at){
       needsReview=true;
      }else{
       await client.query('UPDATE product.shipments SET state=$2,provider_status=$3,status_rank=$4,updated_at=now() WHERE id=$1',
        [shipment.id,courierState(evt.status),evt.status,Math.max(shipment.status_rank,decision.rank)]);
       applied=true;
      }
     }
    }
   }
   await client.query('UPDATE product.courier_tracking_events SET is_applied=$2 WHERE id=$1',[eventId,applied]);
   return {accepted:true,replayed:false,eventId,applied,needsReview,reconcilePrice,
    carrierBookingPerformed:false,chargedCustomer:false};
  });
 }
 async adminEvents(batchId:string){
  requireUuid(batchId,'batch');
  const r=await this.db.query(
   `SELECT e.id,e.event_type,e.provider_status,e.waybill_id,e.observed_fee_idr,e.is_applied,e.received_at
    FROM product.courier_tracking_events e JOIN product.shipments s ON s.id=e.shipment_id
    WHERE s.fulfillment_batch_id=$1 ORDER BY e.received_at,e.id LIMIT 200`,[batchId]);
  const ship=await this.db.query(
   'SELECT state,provider_status,tracking_number,provider,provider_shipment_id FROM product.shipments WHERE fulfillment_batch_id=$1',[batchId]);
  return {batchId,items:r.rows,shipment:ship.rows[0]||null,automaticCustomerCharge:false};
 }
 async customerEvents(userId:string,orderId:string){
  requireUuid(orderId,'order');
  const allowed=await this.db.query<{id:string}>('SELECT id FROM product.orders WHERE id=$1 AND customer_user_id=$2',[orderId,userId]);
  if(!allowed.rows[0])throw new NotFoundException('Order not found');
  const r=await this.db.query(
   `SELECT f.id AS batch_id,f.brand_id,s.state AS carrier_state,s.provider_status,s.tracking_number,
    e.event_type,e.provider_status AS event_status,e.is_applied,e.received_at
    FROM product.fulfillment_batches f
    LEFT JOIN product.shipments s ON s.fulfillment_batch_id=f.id
    LEFT JOIN product.courier_tracking_events e ON e.shipment_id=s.id
    WHERE f.order_id=$1 ORDER BY f.id,e.received_at,e.id LIMIT 300`,[orderId]);
  return {orderId,items:r.rows,scope:'customer_order_only',externalTrackingConnected:r.rows.some(x=>Boolean(x.tracking_number))};
 }
}
