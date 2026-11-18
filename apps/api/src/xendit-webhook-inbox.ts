import {BadRequestException,ForbiddenException,Injectable,ServiceUnavailableException} from '@nestjs/common';
import type {PoolClient} from 'pg';
import {DatabaseService} from './database';
import {parseXenditWebhook,safeXenditCallbackToken,xenditCallbackToken,xenditSandboxReadiness,xenditWebhookHash} from './xendit-sandbox';
import {XenditPaymentSessionsService} from './xendit-payment-sessions';

@Injectable()
export class XenditWebhookInboxService{
 constructor(private readonly db:DatabaseService,private readonly sessions?:XenditPaymentSessionsService){}
 async receive(raw:Buffer|undefined,proof:string|undefined){
  const ready=xenditSandboxReadiness();
  if(!ready.transportEnabled||!ready.webhookEnabled)
   throw new ServiceUnavailableException({code:'XENDIT_WEBHOOK_DISABLED'});
  if(!safeXenditCallbackToken(proof,xenditCallbackToken()))
   throw new ForbiddenException('Invalid Xendit callback token');
  if(!raw||raw.length===0||raw.length>32768)
   throw new BadRequestException('Invalid Xendit webhook body');
  let body:unknown;
  try{body=JSON.parse(raw.toString('utf8'));}catch{throw new BadRequestException('Invalid Xendit webhook JSON');}
  const event=parseXenditWebhook(body);
  if(event.businessId!==process.env.XENDIT_BUSINESS_ID)
   throw new ForbiddenException('Invalid Xendit merchant');
  const hash=xenditWebhookHash(raw);
  const result=await this.db.transaction(async(client:PoolClient)=>{
   const session=await client.query<{id:string;amount_idr:string;state:string;provider_business_id:string|null}>(
    'SELECT id,amount_idr::text,state,provider_business_id FROM product.xendit_payment_sessions WHERE payment_session_id=$1 AND reference_id=$2 AND environment=$3 FOR UPDATE',
    [event.sessionId,event.referenceId,ready.environment]);
   const matched=session.rows[0];
   const disposition=matched&&Number(matched.amount_idr)===event.amountIdr&&matched.provider_business_id===event.businessId?
    'pending_reconciliation':'quarantined';
   const reason=disposition==='quarantined'?'UNKNOWN_SESSION_OR_MISMATCH':null;
   const inserted=await client.query<{id:string}>(
    'INSERT INTO product.xendit_webhook_inbox(event_hash,event_type,payment_session_id,reference_id,provider_business_id,amount_idr,currency,provider_status,payment_id,payment_request_id,provider_created_at,disposition,disposition_reason) VALUES ($1,$2,$3,$4,$5,$6,\'IDR\',$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING RETURNING id',
    [hash,event.event,event.sessionId,event.referenceId,event.businessId,event.amountIdr,event.status,
     event.paymentId,event.paymentRequestId,event.providerCreatedAt,disposition,reason]);
   if(inserted.rowCount===0)return {received:true,duplicate:true,paymentApplied:false};
   if(disposition==='pending_reconciliation'){
    // Deliberately do NOT alter product.orders payment status. Payment completion
    // must first be independently read from the provider and reconciled with
    // the immutable expected amount, currency, session and unique payment_id.
    await client.query(
     'UPDATE product.xendit_payment_sessions SET state=$2,provider_status=$3,payment_id=$4,payment_request_id=$5,updated_at=now() WHERE id=$1 AND (state IN (\'active\',\'creating\') OR (state=\'awaiting_reconciliation\' AND $3=\'COMPLETED\'))',
     [matched!.id,event.status==='COMPLETED'?'awaiting_reconciliation':'expired',
      event.status,event.paymentId,event.paymentRequestId]);
   }
   return {received:true,duplicate:false,paymentApplied:false,queuedForReconciliation:disposition==='pending_reconciliation'};
  });
  if(this.sessions){
   try{
    const verified=await this.sessions.verifySandboxSession(event.sessionId);
    if(event.status==='COMPLETED'&&verified&&!['completed','review'].includes(verified.session.state))
     throw new Error('PROVIDER_NOT_FINAL');
   }catch{
    // The inbox is already durable. A non-2xx response asks Xendit to retry;
    // duplicate delivery also re-runs readback without applying funds twice.
    throw new ServiceUnavailableException({code:'XENDIT_RECONCILIATION_PENDING'});
   }
  }
  return result;
 }
}
