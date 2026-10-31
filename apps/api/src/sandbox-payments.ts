import {createHmac,timingSafeEqual} from 'node:crypto';
import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {DatabaseService} from './database';
import {digitalEnabled} from './member-commerce';

export function verifySandboxSignature(raw:Buffer|undefined,signature:string|undefined,secret:string|undefined):boolean{
  if(!raw||!secret||secret.length<32||!signature||!/^sha256=[a-f0-9]{64}$/i.test(signature))return false;
  const expected=createHmac('sha256',secret).update(raw).digest();
  const actual=Buffer.from(signature.slice(7),'hex');
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
type Outcome='paid'|'failed'|'expired';
export function validateSandboxEvent(body:unknown){
  if(!body||typeof body!=='object'||Array.isArray(body))throw new BadRequestException('Invalid event payload');
  const v=body as Record<string,unknown>;
  if(typeof v.eventId!=='string'||!/^[A-Za-z0-9._:-]{8,120}$/.test(v.eventId))
    throw new BadRequestException('Invalid event ID');
  if(typeof v.orderId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.orderId))
    throw new BadRequestException('Invalid order ID');
  if(!['paid','failed','expired'].includes(String(v.status))||
    typeof v.amountIdr!=='number'||!Number.isSafeInteger(v.amountIdr)||v.amountIdr<=0||v.amountIdr>2000000)
    throw new BadRequestException('Invalid status or amount');
  return {eventId:v.eventId,orderId:v.orderId,status:v.status as Outcome,amountIdr:v.amountIdr};
}
@Injectable()
export class SandboxPaymentsService{
 constructor(private readonly db:DatabaseService){}
 async receive(body:unknown,raw:Buffer|undefined,signature:string|undefined){
   if(!digitalEnabled()||!process.env.SANDBOX_WEBHOOK_SECRET)
     throw new ServiceUnavailableException({code:'SANDBOX_PAYMENT_DISABLED'});
   if(!verifySandboxSignature(raw,signature,process.env.SANDBOX_WEBHOOK_SECRET))
     throw new ForbiddenException('Invalid sandbox signature');
   const event=validateSandboxEvent(body);
   return this.db.transaction(async(client)=>{
     const r=await client.query<{id:string;user_id:string;sku:string;amount_idr:string;credit_coins:string;status:string}>(
       "SELECT id,user_id,sku,amount_idr::text,credit_coins::text,status FROM commerce.digital_orders WHERE id=$1 FOR UPDATE",[event.orderId]);
     const order=r.rows[0];if(!order)throw new NotFoundException('Order not found');
     if(Number(order.amount_idr)!==event.amountIdr)throw new BadRequestException('Payment amount mismatch');
     if(order.status==='paid')return {status:'already_paid',orderId:order.id,creditedCoins:0};
     if(order.status!=='pending')return {status:order.status,orderId:order.id,creditedCoins:0};
     // Prevent a second membership activation from posting another 100,000 Coin.
     if(event.status==='paid'&&order.sku==='MEMBER-ACTIVATION'){
       const m=await client.query<{status:string}>(
        'SELECT status FROM membership.accounts WHERE user_id=$1 FOR UPDATE',[order.user_id]);
       if(m.rows[0]?.status==='ACTIVE')throw new ConflictException('Membership already activated; review duplicate payment');
     }
     const eventRow=await client.query(
       "INSERT INTO commerce.payment_events(event_id,order_id,provider,outcome,amount_idr) VALUES($1,$2,'sandbox',$3,$4) ON CONFLICT(event_id) DO NOTHING RETURNING event_id",
       [event.eventId,order.id,event.status,event.amountIdr]);
     if(eventRow.rowCount!==1)throw new ConflictException('Duplicate event ID');
     if(event.status!=='paid'){
       await client.query('UPDATE commerce.digital_orders SET status=$2,updated_at=now() WHERE id=$1',[order.id,event.status]);
       return {status:event.status,orderId:order.id,creditedCoins:0};
     }
     const credit=await client.query(
       "INSERT INTO wallet.ledger_entries(user_id,order_id,delta_coins,entry_type,memo) VALUES($1,$2,$3,'credit',$4) ON CONFLICT(order_id,entry_type) DO NOTHING RETURNING id",
       [order.user_id,order.id,order.credit_coins,order.sku==='MEMBER-ACTIVATION'?'Aktivasi Vapmart Member':'Top Up '+order.sku]);
     if(credit.rowCount!==1)throw new ConflictException('Ledger credit already posted');
     const updated=await client.query<{available_coins:string}>(
       'UPDATE wallet.accounts SET available_coins=available_coins+$2::bigint,updated_at=now() WHERE user_id=$1 RETURNING available_coins::text',
       [order.user_id,order.credit_coins]);
     if(updated.rowCount!==1)throw new ServiceUnavailableException({code:'WALLET_ACCOUNT_MISSING'});
     if(order.sku==='MEMBER-ACTIVATION'){
       const activated=await client.query(
         "UPDATE membership.accounts SET status='ACTIVE',activated_at=now(),activation_order_id=$2 WHERE user_id=$1 AND status='REGISTERED'",
         [order.user_id,order.id]);
       if(activated.rowCount!==1)throw new ConflictException('Member activation not eligible');
       await client.query('INSERT INTO membership.cards(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING',[order.user_id]);
     }
     await client.query("UPDATE commerce.digital_orders SET status='paid',paid_at=now(),updated_at=now() WHERE id=$1",[order.id]);
     return {status:'paid',orderId:order.id,creditedCoins:Number(order.credit_coins),balanceCoin:Number(updated.rows[0].available_coins)};
   });
 }
}
