import {createHash,randomUUID} from 'node:crypto';
import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {DatabaseService} from './database';
import type {Principal} from './auth';
import {XenditSandboxClient,buildXenditPaySession,parseXenditSession,xenditSandboxReadiness,xenditSessionReference,
 XenditTransportError,xenditSelectedChannels,type XenditSession} from './xendit-sandbox';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type OrderRow={id:string;invoice_number:string;total_idr:string;currency:string;status:string;
 operational_status:string;payment_status:string;payment_method:string;contact_name:string;
 contact_phone:string;contact_email:string;expires_at:string|null};
type SessionRow={id:string;order_id:string;attempt:number;reference_id:string;amount_idr:string;
 state:string;payment_session_id:string|null;payment_link_url:string|null;expires_at:string|null;
 payment_id:string|null;payment_request_id:string|null;provider_business_id:string|null;
 created_at:string;last_checked_at:string|null};
const publicSession=(r:SessionRow)=>({
 id:r.id,referenceId:r.reference_id,state:r.state,sessionId:r.payment_session_id,
 paymentUrl:r.state==='active'?r.payment_link_url:null,
 expiresAt:r.expires_at,amountIdr:Number(r.amount_idr),paymentId:r.payment_id,
 paymentRequestId:r.payment_request_id,
 message:r.state==='unknown'?'Status pembuatan sesi belum pasti. Jangan membuat ulang pembayaran; minta admin memeriksa Xendit.':
  r.state==='awaiting_reconciliation'?'Pembayaran terdeteksi. Sedang menunggu verifikasi server.':
  'Sesi sandbox Xendit, bukan pembayaran nyata.'
});
@Injectable()
export class XenditPaymentSessionsService{
 constructor(private readonly db:DatabaseService,private readonly xendit:XenditSandboxClient){}
 readiness(){return {...xenditSandboxReadiness(),orderSandboxEnabled:process.env.XENDIT_SANDBOX_ORDER_ENABLED==='true',
  settlementEnabled:false};}
 private guard(){
  const ready=this.readiness();
  if(!ready.sandboxEnabled||!ready.webhookEnabled||!ready.orderSandboxEnabled)
   throw new ServiceUnavailableException({code:'XENDIT_SANDBOX_NOT_READY',message:'Sandbox Xendit belum diaktifkan dan diverifikasi oleh operator.'});
 }
 private validateId(id:string){
  if(!uuid.test(id))throw new BadRequestException('ID pesanan tidak valid');
 }
 async current(user:Principal,orderId:string){
  this.validateId(orderId);
  if(!user.emailVerified)throw new ForbiddenException('Email harus terverifikasi');
  const order=await this.db.query<{id:string}>( 'SELECT id FROM product.orders WHERE id=$1 AND customer_user_id=$2',[orderId,user.id]);
  if(!order.rows[0])throw new NotFoundException('Pesanan tidak ditemukan');
  const r=await this.db.query<SessionRow>('SELECT * FROM product.xendit_payment_sessions WHERE order_id=$1 ORDER BY attempt DESC LIMIT 1',[orderId]);
  return {orderId,readiness:this.readiness(),session:r.rows[0]?publicSession(r.rows[0]):null};
 }
 async prepare(user:Principal,orderId:string,raw:unknown){
  this.guard();this.validateId(orderId);
  if(!user.emailVerified||!user.email)throw new ForbiddenException('Akun perlu email terverifikasi');
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||
   Object.keys(raw).some(k=>k!=='idempotencyKey'))throw new BadRequestException('Body sesi tidak valid');
  const key=(raw as Record<string,unknown>).idempotencyKey;
  if(typeof key!=='string'||!uuid.test(key))throw new BadRequestException('Kunci sesi tidak valid');
  const attempt=await this.db.transaction(async client=>{
   const found=await client.query<OrderRow>( 'SELECT id,invoice_number,total_idr::text,currency,status,operational_status,payment_status,payment_method,contact_name,contact_phone,contact_email,expires_at FROM product.orders WHERE id=$1 AND customer_user_id=$2 FOR UPDATE',[orderId,user.id]);
   const o=found.rows[0];
   if(!o)throw new NotFoundException('Pesanan tidak ditemukan');
   if(o.currency!=='IDR'||!Number.isSafeInteger(Number(o.total_idr))||Number(o.total_idr)<=0||
    o.payment_status!=='not_initiated'||o.status!=='draft'||
    !['qris','virtual_account','ewallet'].includes(o.payment_method)||
    o.operational_status!=='draft'||(o.expires_at&&Date.parse(o.expires_at)<=Date.now()))
    throw new ConflictException('Pesanan tidak memenuhi syarat sandbox Xendit');
   const prior=await client.query<SessionRow>( 'SELECT * FROM product.xendit_payment_sessions WHERE order_id=$1 ORDER BY attempt DESC LIMIT 1 FOR UPDATE',[orderId]);
   const previous=prior.rows[0];
   if(previous&&['prepared','creating','active','unknown','awaiting_reconciliation','review','completed'].includes(previous.state)){
    if(previous.state==='active'&&previous.expires_at&&Date.parse(previous.expires_at)<=Date.now())
     throw new ConflictException('Sesi Xendit kedaluwarsa; perlu rekonsiliasi sebelum membuat ulang');
    throw new ConflictException({code:'XENDIT_SESSION_EXISTS',message:'Sesi sudah tercatat. Buka ulang detail pesanan untuk melihat statusnya.'});
   }
   const index=(previous?.attempt??0)+1;
   const reference=xenditSessionReference(o.invoice_number,index);
   const hash=createHash('sha256').update(orderId+':'+reference+':'+String(o.total_idr)).digest('hex');
   const inserted=await client.query<{id:string}>( 'INSERT INTO product.xendit_payment_sessions(order_id,attempt,reference_id,amount_idr,request_hash,request_idempotency_key,state) VALUES ($1,$2,$3,$4,$5,$6,\'creating\') RETURNING id',[o.id,index,reference,o.total_idr,hash,key]);
   return {recordId:inserted.rows[0].id,order:o,reference,amountIdr:Number(o.total_idr)};
  });
  // Never send a second CREATE after a connection timeout. The upstream may
  // have created a session despite no HTTP response; mark as UNKNOWN instead.
  let session:XenditSession;
  try{
   const payload=buildXenditPaySession({
    referenceId:attempt.reference,amountIdr:attempt.amountIdr,orderId,
    email:user.email,customerName:attempt.order.contact_name,
    phone:attempt.order.contact_phone,
    allowedChannels:xenditSelectedChannels(process.env.XENDIT_ALLOWED_CHANNELS),
    returnOrigin:process.env.XENDIT_RETURN_ORIGIN||'https://vapmart-web-staging.up.railway.app'
   });
   session=await this.xendit.createSession(payload);
   if(session.reference_id!==attempt.reference||session.amount!==attempt.amountIdr||
    session.status!=='ACTIVE'||session.business_id!==process.env.XENDIT_BUSINESS_ID||!session.payment_link_url)
    throw new ServiceUnavailableException({code:'XENDIT_SESSION_MISMATCH'});
  }catch(e){
   const known=e instanceof XenditTransportError&&!e.retriable&&e.httpStatus>=400&&e.httpStatus<500;
   await this.db.query('UPDATE product.xendit_payment_sessions SET state=$2,last_error_code=$3,updated_at=now() WHERE id=$1',
    [attempt.recordId,known?'failed':'unknown',known?'PROVIDER_REJECTED':'PROVIDER_RESULT_UNCERTAIN']);
   throw new ServiceUnavailableException({code:known?'XENDIT_SESSION_REJECTED':'XENDIT_SESSION_RESULT_UNKNOWN',
    message:known?'Sesi ditolak oleh Xendit Test Mode.':'Hasil create sesi belum pasti; jangan coba ulang sampai direkonsiliasi.'});
  }
  const saved=await this.db.query<SessionRow>(
   'UPDATE product.xendit_payment_sessions SET state=\'active\',payment_session_id=$2,payment_link_url=$3,expires_at=$4,provider_business_id=$5,provider_status=$6,updated_at=now() WHERE id=$1 RETURNING *',
   [attempt.recordId,session.payment_session_id,session.payment_link_url,session.expires_at||null,session.business_id,session.status]);
  return publicSession(saved.rows[0]);
 }
 /** Read-only provider reconciliation. Does NOT mark an order paid. */
 async reconcile(user:Principal,orderId:string){
  this.guard();
  const current=await this.current(user,orderId);
  if(!current.session?.sessionId)throw new ConflictException('Sesi tidak memiliki ID provider; perlu penyelidikan manual.');
  const provider=await this.xendit.readSession(current.session.sessionId);
  const rows=await this.db.query<SessionRow>('SELECT * FROM product.xendit_payment_sessions WHERE order_id=$1 AND payment_session_id=$2',[orderId,provider.payment_session_id]);
  const stored=rows.rows[0];
  if(!stored||stored.reference_id!==provider.reference_id||Number(stored.amount_idr)!==provider.amount||
   stored.provider_business_id!==provider.business_id||provider.currency!=='IDR'||provider.country!=='ID')
   throw new ConflictException('Data provider tidak cocok. Tahan pembayaran dan investigasi.');
  const state=provider.status==='COMPLETED'?'awaiting_reconciliation':provider.status.toLowerCase();
  const saved=await this.db.query<SessionRow>(
   'UPDATE product.xendit_payment_sessions SET state=$3,provider_status=$4,payment_id=$5,payment_request_id=$6,last_checked_at=now(),updated_at=now() WHERE order_id=$1 AND payment_session_id=$2 AND state<>\'completed\' RETURNING *',
   [orderId,provider.payment_session_id,state,provider.status,provider.payment_id,provider.payment_request_id]);
  return {session:publicSession(saved.rows[0]||stored),verifiedProviderRead:true,
   orderPaidChanged:false,note:'Status Xendit hanya diverifikasi. Belum ada settlement/paid transition otomatis pada CP53.'};
 }
}
