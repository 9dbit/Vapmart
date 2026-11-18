import {ConflictException} from '@nestjs/common';
import type {PoolClient} from 'pg';
import type {XenditSession} from './xendit-sandbox';

/** Caller holds the order lock and has retrieved the session from Xendit. */
export async function applyXenditLivePayment(client:PoolClient,order:any,stored:any,provider:XenditSession){
 if(stored.environment!=='live'||order.payment_environment!=='live'||provider.status!=='COMPLETED'||
  stored.payment_session_id!==provider.payment_session_id||stored.reference_id!==provider.reference_id||
  Number(order.total_idr)!==provider.amount||Number(stored.amount_idr)!==provider.amount||
  stored.provider_business_id!==provider.business_id||provider.business_id!==process.env.XENDIT_BUSINESS_ID||
  provider.currency!=='IDR'||provider.country!=='ID'||order.currency!=='IDR'||
  !/^py-[A-Za-z0-9-]{16,}$/.test(provider.payment_id||'')||!/^pr-[A-Za-z0-9-]{16,}$/.test(provider.payment_request_id||''))
  throw new ConflictException('Bukti pembayaran live tidak cocok. Pembayaran perlu ditinjau.');
 const canApply=['not_initiated','pending'].includes(order.payment_status)&&!order.payment_provider;
 const receipt=await client.query<{id:string}>(
  'INSERT INTO product.xendit_live_payments(order_id,session_record_id,payment_id,payment_request_id,business_id,amount_idr,currency,disposition) VALUES($1,$2,$3,$4,$5,$6,\'IDR\',$7) ON CONFLICT(payment_id) DO NOTHING RETURNING id',
  [stored.order_id,stored.id,provider.payment_id,provider.payment_request_id,provider.business_id,provider.amount,canApply?'applied':'review']);
 if(!receipt.rows[0]){
  const previous=(await client.query('SELECT order_id,session_record_id,disposition FROM product.xendit_live_payments WHERE payment_id=$1',[provider.payment_id])).rows[0];
  if(previous?.order_id!==stored.order_id||previous?.session_record_id!==stored.id)throw new ConflictException('ID pembayaran sudah digunakan pesanan lain.');
  return {changed:false,review:previous.disposition==='review'};
 }
 const hold=!['draft','pending_payment','pre_order'].includes(order.operational_status)||
  Boolean(order.expires_at&&Date.parse(order.expires_at)<=Date.now());
 if(canApply)await client.query(
  "UPDATE product.orders SET payment_status='paid',payment_provider='xendit',payment_reference=$2,status='paid',operational_status=$3,operational_hold=$4 WHERE id=$1",
  [stored.order_id,provider.payment_id,hold?'on_hold':'processing',hold]);
 await client.query(
  'INSERT INTO product.order_events(order_id,actor_id,action,notes,before_data,after_data) VALUES($1,NULL,$2,$3,$4::jsonb,$5::jsonb)',
  [stored.order_id,canApply?'payment_confirmed':'xendit_payment_review',
   canApply?'Pembayaran Xendit live diverifikasi melalui pembacaan status provider.':'Pembayaran diterima setelah status pesanan berubah; perlu review admin.',
   JSON.stringify({paymentStatus:order.payment_status,status:order.operational_status}),
   JSON.stringify({provider:'xendit',environment:'live',paymentId:provider.payment_id,paymentRequestId:provider.payment_request_id,
    sessionId:provider.payment_session_id,amountIdr:provider.amount,receiptId:receipt.rows[0].id,
    paymentStatus:canApply?'paid':order.payment_status,status:canApply?(hold?'on_hold':'processing'):order.operational_status})]);
 return {changed:canApply,review:!canApply};
}
