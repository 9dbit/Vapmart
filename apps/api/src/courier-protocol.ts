import {createHash,timingSafeEqual} from 'node:crypto';
import {BadRequestException,ServiceUnavailableException,UnauthorizedException} from '@nestjs/common';
import {requireUuid} from './warehouses';

// Biteship's configurable "Headers Signature Key & Secret" is a shared-secret header.
// Do NOT misrepresent it as a request-body HMAC or accept unsigned provider webhooks.
export function webhookConfig(){
 const name=process.env.BITESHIP_WEBHOOK_HEADER_NAME||'';
 const secret=process.env.BITESHIP_WEBHOOK_HEADER_SECRET||'';
 return {enabled:process.env.BITESHIP_WEBHOOK_ENABLED==='true'&&
  /^x-[a-z0-9-]{5,55}$/.test(name)&&secret.length>=32,
  headerName:name,secret};
}
export function verifyWebhookHeader(headers:Record<string,string|string[]|undefined>){
 const config=webhookConfig();
 if(!config.enabled)throw new ServiceUnavailableException({code:'BITESHIP_WEBHOOK_DISABLED'});
 const v=headers[config.headerName.toLowerCase()];
 const value=typeof v==='string'?v:'';
 const expected=createHash('sha256').update(config.secret,'utf8').digest();
 const actual=createHash('sha256').update(value,'utf8').digest();
 if(value.length<1||!timingSafeEqual(expected,actual))throw new UnauthorizedException('Untrusted courier webhook');
}
export type ProviderEvent={
 event:'order.status'|'order.waybill_id'|'order.price';
 providerOrderId:string;status:string|null;waybill:string|null;priceIdr:number|null;
};
export const courierRanks:Record<string,number>={
 confirmed:1,scheduled:1,allocated:2,picking_up:2,picked:3,
 in_transit:4,dropping_off:5,delivered:6,
 on_hold:0,cancelled:0,rejected:0,courier_not_found:0,
 return_in_transit:7,returned:8,disposed:0
};
export function normalizeBiteshipWebhook(raw:unknown):ProviderEvent{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Courier body must be object');
 const x=raw as Record<string,unknown>;
 if(!['order.status','order.waybill_id','order.price'].includes(String(x.event)))
  throw new BadRequestException('Unsupported courier event');
 if(typeof x.order_id!=='string'||!/^[-A-Za-z0-9_]{8,100}$/.test(x.order_id))
  throw new BadRequestException('Provider order ID invalid');
 const status=x.status===null||x.status===undefined?null:x.status;
 if(status!==null&&(typeof status!=='string'||!(status in courierRanks)))
  throw new BadRequestException('Courier status unsupported');
 const waybill=x.courier_waybill_id===null||x.courier_waybill_id===undefined?null:x.courier_waybill_id;
 if(waybill!==null&&(typeof waybill!=='string'||!/^[-A-Za-z0-9_./]{3,90}$/.test(waybill)))
  throw new BadRequestException('Courier waybill invalid');
 const event=x.event as ProviderEvent['event'];
 if(event==='order.status'&&!status)throw new BadRequestException('Courier status required');
 if(event==='order.waybill_id'&&!waybill)throw new BadRequestException('Waybill required');
 const rawPrice=event==='order.price'?x.price:null;
 const priceIdr=rawPrice===null?null:rawPrice;
 if(event==='order.price'&&(!Number.isSafeInteger(priceIdr)||Number(priceIdr)<0||Number(priceIdr)>100000000))
  throw new BadRequestException('Invalid provider price');
 return {event,providerOrderId:x.order_id,status:status as string|null,waybill:waybill as string|null,
  priceIdr:priceIdr as number|null};
}
export function providerEventHash(event:ProviderEvent){
 return createHash('sha256').update(JSON.stringify([
  event.event,event.providerOrderId,event.status,event.waybill,event.priceIdr])).digest('hex');
}
export type ManifestRequest={idempotencyKey:string;notes:string;pickupMethod:'pickup'|'drop_off';pickupDate:string|null;pickupTime:string|null};
export function parseManifestRequest(raw:unknown):ManifestRequest{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Manifest body required');
 const x=raw as Record<string,unknown>;
 if(Object.keys(x).some(k=>!['idempotencyKey','notes','pickupMethod','pickupDate','pickupTime'].includes(k)))
  throw new BadRequestException('Unexpected manifest key');
 const idempotencyKey=requireUuid(x.idempotencyKey,'manifest key');
 if(typeof x.notes!=='string'||x.notes.trim().length<6||x.notes.length>300)
  throw new BadRequestException('Manifest notes need 6-300 characters');
 const pickupMethod=x.pickupMethod||'pickup';
 if(pickupMethod!=='pickup'&&pickupMethod!=='drop_off')throw new BadRequestException('Pickup method invalid');
 const pickupDate=x.pickupDate||null,pickupTime=x.pickupTime||null;
 if((pickupDate===null)!==(pickupTime===null))throw new BadRequestException('Complete pickup date and time together');
 if(pickupDate!==null&&
    (typeof pickupDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)||
    !Number.isFinite(Date.parse(pickupDate+'T00:00:00Z'))))
  throw new BadRequestException('Invalid pickup date');
 if(pickupTime!==null&&(typeof pickupTime!=='string'||!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(pickupTime)))
  throw new BadRequestException('Pickup time must be HH:mm');
 return {idempotencyKey,notes:x.notes.trim(),pickupMethod,pickupDate:pickupDate as string|null,pickupTime:pickupTime as string|null};
}
export function parseReturnRequest(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Return request object required');
 const d=raw as Record<string,unknown>;
 if(Object.keys(d).some(k=>!['batchId','idempotencyKey','reason'].includes(k))||
  typeof d.reason!=='string'||d.reason.trim().length<10||d.reason.length>500)
  throw new BadRequestException('Return reason must explain the issue');
 return {batchId:requireUuid(d.batchId,'batch'),idempotencyKey:requireUuid(d.idempotencyKey,'return key'),
  reason:d.reason.trim()};
}
export function parseReturnReview(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Review object required');
 const d=raw as Record<string,unknown>;
 if(Object.keys(d).some(k=>!['decision','notes'].includes(k))||
  !['approved','rejected'].includes(String(d.decision))||
  typeof d.notes!=='string'||d.notes.trim().length<8||d.notes.length>500)
  throw new BadRequestException('Approved/rejected decision and review note required');
 return {decision:d.decision as 'approved'|'rejected',notes:d.notes.trim()};
}
export function parseReturnReceipt(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Return receipt required');
 const d=raw as Record<string,unknown>;
 if(Object.keys(d).some(k=>!['warehouseId','notes'].includes(k))||
  typeof d.notes!=='string'||d.notes.trim().length<8||d.notes.length>500)
  throw new BadRequestException('Warehouse and inspection note required');
 return {warehouseId:requireUuid(d.warehouseId,'receiving warehouse'),notes:d.notes.trim()};
}
export function parseRestockRequest(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Restock command required');
 const d=raw as Record<string,unknown>;
 if(Object.keys(d).some(k=>!['idempotencyKey','notes'].includes(k))||
  typeof d.notes!=='string'||d.notes.trim().length<8||d.notes.length>300)
  throw new BadRequestException('Restock evidence required');
 return {idempotencyKey:requireUuid(d.idempotencyKey,'restock key'),notes:d.notes.trim()};
}
export function courierState(status:string):'booked'|'picked_up'|'in_transit'|'delivered'|'failed'|'cancelled'{
 if(['picked','picking_up'].includes(status))return status==='picked'?'picked_up':'booked';
 if(['in_transit','dropping_off'].includes(status))return 'in_transit';
 if(status==='delivered')return 'delivered';
 if(status==='cancelled')return 'cancelled';
 if(['returned','return_in_transit','rejected','courier_not_found','disposed','on_hold'].includes(status))return 'failed';
 return 'booked';
}
