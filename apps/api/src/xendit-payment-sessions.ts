import {applyXenditLivePayment} from './xendit-live-settlement';
import {createHash,randomUUID} from 'node:crypto';
import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {DatabaseService} from './database';
import type {Principal} from './auth';
import {XenditSandboxClient,buildXenditPaySession,parseXenditSession,xenditSandboxReadiness,xenditSessionReference,
 XenditTransportError,xenditSelectedChannels,xenditChannelsForMethod,type XenditSession} from './xendit-sandbox';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type OrderRow={payment_environment:string|null;id:string;invoice_number:string;total_idr:string;currency:string;status:string;
 operational_status:string;payment_status:string;payment_method:string;contact_name:string;
 contact_phone:string;contact_email:string;expires_at:string|null};
type SessionRow={environment:string;id:string;order_id:string;attempt:number;reference_id:string;amount_idr:string;
 state:string;payment_session_id:string|null;payment_link_url:string|null;expires_at:string|null;
 payment_id:string|null;payment_request_id:string|null;provider_business_id:string|null;
 created_at:string;last_checked_at:string|null};
const publicSession=(r:SessionRow)=>({
 environment:r.environment||'test',id:r.id,referenceId:r.reference_id,state:r.state,sessionId:r.payment_session_id,
 paymentUrl:r.state==='active'?r.payment_link_url:null,
 expiresAt:r.expires_at,amountIdr:Number(r.amount_idr),paymentId:r.payment_id,
 paymentRequestId:r.payment_request_id,
 message:r.state==='review'?'Pembayaran perlu ditinjau admin sebelum pesanan diproses.':r.state==='unknown'?'Status pembuatan sesi belum pasti. Jangan membuat ulang pembayaran; minta admin memeriksa Xendit.':
  r.state==='completed'?(r.environment==='live'?'Pembayaran diverifikasi oleh server. Lihat status pesanan untuk proses berikutnya.':'Simulasi pembayaran berhasil diverifikasi oleh server. Tidak ada dana nyata atau pengiriman barang.'):
  r.state==='awaiting_reconciliation'?'Pembayaran terdeteksi. Sedang menunggu verifikasi server.':
  r.environment==='live'?'Pembayaran melalui checkout Xendit.':'Sesi sandbox Xendit, bukan pembayaran nyata.'
});
@Injectable()
export class XenditPaymentSessionsService{
 constructor(private readonly db:DatabaseService,private readonly xendit:XenditSandboxClient){}
 readiness(){return xenditSandboxReadiness();}
 private guard(){
  const ready=this.readiness();
  if(!ready.paymentEnabled)
   throw new ServiceUnavailableException({code:'XENDIT_SANDBOX_NOT_READY',message:ready.environment==='live'?'Xendit live belum siap.':'Sandbox Xendit belum diaktifkan dan diverifikasi oleh operator.'});
 }
 private validateId(id:string){
  if(!uuid.test(id))throw new BadRequestException('ID pesanan tidak valid');
 }
 async current(user:Principal,orderId:string){
  this.validateId(orderId);
  if(!user.emailVerified)throw new ForbiddenException('Email harus terverifikasi');
  const order=await this.db.query<{id:string;payment_environment:string|null}>( 'SELECT id,payment_environment FROM product.orders WHERE id=$1 AND customer_user_id=$2',[orderId,user.id]);
  if(!order.rows[0])throw new NotFoundException('Pesanan tidak ditemukan');
  const r=await this.db.query<SessionRow>('SELECT * FROM product.xendit_payment_sessions WHERE order_id=$1 ORDER BY attempt DESC LIMIT 1',[orderId]);
  const ready=this.readiness(),same=(order.rows[0].payment_environment||'test')===ready.environment;
  const item=r.rows[0]?publicSession(r.rows[0]):null;
  return {orderId,readiness:{...ready,paymentEnabled:ready.paymentEnabled&&same},session:item?{...item,paymentUrl:same?item.paymentUrl:null}:null};
 }
 async prepare(user:Principal,orderId:string,raw:unknown){
  this.guard();this.validateId(orderId);
  if(!user.emailVerified||!user.email)throw new ForbiddenException('Akun perlu email terverifikasi');
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||
   Object.keys(raw).some(k=>k!=='idempotencyKey'))throw new BadRequestException('Body sesi tidak valid');
  const key=(raw as Record<string,unknown>).idempotencyKey;
  if(typeof key!=='string'||!uuid.test(key))throw new BadRequestException('Kunci sesi tidak valid');
  const ready=this.readiness(),selectedChannels=ready.channels;
  const attempt=await this.db.transaction(async client=>{
   const found=await client.query<OrderRow>( 'SELECT payment_environment,id,invoice_number,total_idr::text,currency,status,operational_status,payment_status,payment_method,contact_name,contact_phone,contact_email,expires_at FROM product.orders WHERE id=$1 AND customer_user_id=$2 FOR UPDATE',[orderId,user.id]);
   const o=found.rows[0];
   if(!o)throw new NotFoundException('Pesanan tidak ditemukan');
   const methodChannels=xenditChannelsForMethod(o.payment_method,selectedChannels);
   if(!methodChannels.length)throw new ConflictException('Kanal pembayaran pesanan ini belum dikonfigurasi.');
   if((o.payment_environment||'test')!==ready.environment||o.currency!=='IDR'||!Number.isSafeInteger(Number(o.total_idr))||Number(o.total_idr)<=0||
    o.payment_status!=='not_initiated'||o.status!=='draft'||
    !['qris','virtual_account','ewallet'].includes(o.payment_method)||
    o.operational_status!=='draft'||(o.expires_at&&Date.parse(o.expires_at)<=Date.now()))
    throw new ConflictException('Pesanan tidak memenuhi syarat pembayaran Xendit');
   const prior=await client.query<SessionRow>( 'SELECT * FROM product.xendit_payment_sessions WHERE order_id=$1 ORDER BY attempt DESC LIMIT 1 FOR UPDATE',[orderId]);
   const previous=prior.rows[0];
   if(previous&&Number(previous.amount_idr)!==Number(o.total_idr))throw new ConflictException('Nilai pesanan berubah. Sesi perlu ditinjau admin.');
   if(previous?.state==='active'&&previous.payment_link_url&&previous.expires_at&&Date.parse(previous.expires_at)>Date.now())
    return {existing:publicSession(previous)};
   if(previous&&['prepared','creating','active','unknown','awaiting_reconciliation','review','completed'].includes(previous.state)){
    if(previous.state==='active'&&previous.expires_at&&Date.parse(previous.expires_at)<=Date.now())
     throw new ConflictException('Sesi Xendit kedaluwarsa; perlu rekonsiliasi sebelum membuat ulang');
    throw new ConflictException({code:'XENDIT_SESSION_EXISTS',message:'Sesi sudah tercatat. Buka ulang detail pesanan untuk melihat statusnya.'});
   }
   const index=(previous?.attempt??0)+1;
   const reference=xenditSessionReference(o.invoice_number,index);
   const hash=createHash('sha256').update(orderId+':'+reference+':'+String(o.total_idr)).digest('hex');
   const inserted=await client.query<{id:string}>( 'INSERT INTO product.xendit_payment_sessions(order_id,attempt,reference_id,amount_idr,request_hash,request_idempotency_key,environment,state) VALUES ($1,$2,$3,$4,$5,$6,$7,\'creating\') RETURNING id',[o.id,index,reference,o.total_idr,hash,key,ready.environment]);
   return {recordId:inserted.rows[0].id,order:o,reference,amountIdr:Number(o.total_idr),methodChannels};
  });
  if('existing' in attempt)return attempt.existing!;
  // Never send a second CREATE after a connection timeout. The upstream may
  // have created a session despite no HTTP response; mark as UNKNOWN instead.
  let session:XenditSession;
  try{
   const payload=buildXenditPaySession({
    referenceId:attempt.reference,amountIdr:attempt.amountIdr,orderId,
    email:user.email,customerName:attempt.order.contact_name,
    phone:attempt.order.contact_phone,
    allowedChannels:attempt.methodChannels,
    environment:ready.environment,returnOrigin:process.env.XENDIT_RETURN_ORIGIN||'https://vapmart-web-staging.up.railway.app'
   });
   session=await this.xendit.createSession(payload);
   if(session.reference_id!==attempt.reference||session.amount!==attempt.amountIdr||
    session.status!=='ACTIVE'||session.business_id!==process.env.XENDIT_BUSINESS_ID||!session.payment_link_url)
    throw new ServiceUnavailableException({code:'XENDIT_SESSION_MISMATCH'});
  }catch(e){
   const known=e instanceof XenditTransportError&&[400,401,403,404,422].includes(e.httpStatus);
   // HTTP 409, timeout, or 5xx may have created an upstream session already.
   await this.db.query('UPDATE product.xendit_payment_sessions SET state=$2,last_error_code=$3,updated_at=now() WHERE id=$1',
    [attempt.recordId,known?'failed':'unknown',known?'PROVIDER_REJECTED':'PROVIDER_RESULT_UNCERTAIN']);
   throw new ServiceUnavailableException({code:known?'XENDIT_SESSION_REJECTED':'XENDIT_SESSION_RESULT_UNKNOWN',
    message:known?'Sesi ditolak oleh Xendit.':'Hasil create sesi belum pasti; jangan coba ulang sampai direkonsiliasi.'});
  }
  const saved=await this.db.query<SessionRow>(
   'UPDATE product.xendit_payment_sessions SET state=\'active\',payment_session_id=$2,payment_link_url=$3,expires_at=$4,provider_business_id=$5,provider_status=$6,updated_at=now() WHERE id=$1 RETURNING *',
   [attempt.recordId,session.payment_session_id,session.payment_link_url,session.expires_at||null,session.business_id,session.status]);
  return publicSession(saved.rows[0]);
 }
 /** Provider readback settles live orders; test sessions update only their ledger. */
 async reconcile(user:Principal,orderId:string){
  this.guard();
  const current=await this.current(user,orderId);
  if(!current.session?.sessionId)throw new ConflictException('Sesi tidak memiliki ID provider; perlu penyelidikan manual.');
  return this.verifySandboxSession(current.session.sessionId);
 }
 async verifySandboxSession(sessionId:string){
  const ready=this.readiness();
  if(!ready.transportEnabled||!ready.webhookEnabled)throw new ServiceUnavailableException('Koneksi Xendit tidak tersedia');
  const known=await this.db.query<SessionRow>('SELECT * FROM product.xendit_payment_sessions WHERE payment_session_id=$1',[sessionId]);
  if(!known.rows[0])return null;
  if((known.rows[0].environment||'test')!==ready.environment)throw new ConflictException('Lingkungan sesi berbeda.');
  const provider=await this.xendit.readSession(sessionId);
  return this.db.transaction(async client=>{
   const order=(await client.query<any>(
    'SELECT total_idr::text,payment_status,status,currency,payment_environment,payment_provider,payment_reference,operational_status,expires_at FROM product.orders WHERE id=$1 FOR UPDATE',[known.rows[0].order_id])).rows[0];
   const stored=(await client.query<SessionRow>('SELECT * FROM product.xendit_payment_sessions WHERE payment_session_id=$1 FOR UPDATE',[sessionId])).rows[0];
   if(!stored||!order||(stored.environment||'test')!==ready.environment||(order.payment_environment||'test')!==ready.environment||stored.payment_session_id!==provider.payment_session_id||stored.reference_id!==provider.reference_id||Number(stored.amount_idr)!==provider.amount||
    Number(order.total_idr)!==provider.amount||stored.provider_business_id!==provider.business_id||
    provider.business_id!==process.env.XENDIT_BUSINESS_ID||provider.currency!=='IDR'||provider.country!=='ID'||
    (provider.status==='COMPLETED'&&(!provider.payment_id||!provider.payment_request_id)))
    throw new ConflictException('Data provider tidak cocok. Tahan pembayaran dan investigasi.');
   let state=stored.state==='completed'?'completed':provider.status.toLowerCase();
   if(provider.status==='ACTIVE'&&stored.state==='awaiting_reconciliation')state=stored.state;
   let orderPaidChanged=false;
   if(ready.environment==='live'&&provider.status==='COMPLETED'){
    const result=await applyXenditLivePayment(client,order,stored,provider);orderPaidChanged=result.changed;if(result.review)state='review';
   }
   const saved=await client.query<SessionRow>(
    'UPDATE product.xendit_payment_sessions SET state=$2,provider_status=$3,payment_id=$4,payment_request_id=$5,last_checked_at=now(),updated_at=now() WHERE id=$1 RETURNING *',
    [stored.id,state,stored.state==='completed'?'COMPLETED':provider.status,provider.payment_id,provider.payment_request_id]);
   if(state==='completed')await client.query("UPDATE product.xendit_webhook_inbox SET disposition='reconciled',disposition_reason=NULL WHERE payment_session_id=$1 AND disposition='pending_reconciliation'",[sessionId]);
   return {session:publicSession(saved.rows[0]),verifiedProviderRead:true,orderPaidChanged,
    note:ready.environment==='live'?'Status pembayaran telah diverifikasi melalui Xendit.':'Hasil simulasi sandbox. Pembayaran nyata dan fulfillment tidak dijalankan.'};
  });
 }
}
