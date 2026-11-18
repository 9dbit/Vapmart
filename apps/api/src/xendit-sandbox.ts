import {createHash,timingSafeEqual} from 'node:crypto';
import {BadGatewayException,BadRequestException,ForbiddenException,Injectable,ServiceUnavailableException} from '@nestjs/common';

const BASE='https://api.xendit.co';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sessionId=/^ps-[a-zA-Z0-9-]{24}$/;

const validTestHosts=new Set(['checkout-staging.xendit.co','dev.xen.to']);
const string=(v:unknown)=>typeof v==='string'?v:'';
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};

/** Test-mode only. This deployment intentionally cannot request a live payment. */
export function xenditSandboxReadiness(env:NodeJS.ProcessEnv=process.env){
 const key=env.XENDIT_TEST_SECRET_KEY||'';
 const callback=env.XENDIT_WEBHOOK_TOKEN||'';
 const business=env.XENDIT_BUSINESS_ID||'';
 const mode=env.XENDIT_ENVIRONMENT||'test';
 const channels=env.XENDIT_ALLOWED_CHANNELS||'';
 let selected:string[]=[];
 try{selected=xenditSelectedChannels(channels);}catch{}
 const sandboxEnabled=mode==='test'&&env.XENDIT_SANDBOX_ENABLED==='true'&&
  key.length>24&&key.startsWith('xnd_development');
 const webhookEnabled=mode==='test'&&env.XENDIT_WEBHOOK_ENABLED==='true'&&
  callback.length>=16&&business.length>=16;
 const connected=sandboxEnabled&&webhookEnabled&&selected.length>0;
 const orderSandboxEnabled=connected&&env.XENDIT_SANDBOX_ORDER_ENABLED==='true';
 return {provider:'xendit' as const,environment:mode,sandboxEnabled,connected,orderSandboxEnabled,
  webhookEnabled,liveEnabled:false,
  merchantConfigured:Boolean(business),testKeyConfigured:key.length>24,
  channelsConfigured:selected.length>0,channels:selected,
  callbackTokenConfigured:callback.length>=16,
  paymentEnabled:orderSandboxEnabled,livePaymentEnabled:false,settlementEnabled:false,
  missing:[
   ...(!business?['XENDIT_BUSINESS_ID']:[]),
   ...(!key?['XENDIT_TEST_SECRET_KEY']:[]),
   ...(!callback?['XENDIT_WEBHOOK_TOKEN']:[]),
   ...(!channels?['XENDIT_ALLOWED_CHANNELS']:[]),
   ...(env.XENDIT_SANDBOX_ENABLED!=='true'?['XENDIT_SANDBOX_ENABLED']:[]),
   ...(env.XENDIT_WEBHOOK_ENABLED!=='true'?['XENDIT_WEBHOOK_ENABLED']:[]),
   ...(!orderSandboxEnabled?['XENDIT_SANDBOX_ORDER_ENABLED']:[])
  ]};
}
export function xenditChannelsForMethod(method:string,channels:string[]):string[]{
 return channels.filter(c=>method==='virtual_account'?c.endsWith('_VIRTUAL_ACCOUNT'):
  method==='qris'?c==='QRIS':method==='ewallet'?['DANA','OVO','SHOPEEPAY','LINKAJA','GOPAY','JENIUSPAY','ASTRAPAY'].includes(c):false);
}
export function xenditSessionReference(invoice:string,attempt:number){
 if(!/^VM-[0-9]{10}$/.test(invoice)||!Number.isSafeInteger(attempt)||attempt<1||attempt>99)
  throw new BadRequestException('Invalid Xendit session reference');
 return invoice+'-PAY'+attempt;
}
/** Xendit channel codes must be confirmed against the merchant's activated
 * channel list before sandbox onboarding. No open-all checkout by default.
 */
export function xenditSelectedChannels(value:unknown):string[]{
 if(typeof value!=='string')throw new ServiceUnavailableException({code:'XENDIT_CHANNELS_NOT_CONFIGURED'});
 const channels=value.split(',').map(x=>x.trim()).filter(Boolean);
 if(!channels.length||channels.length>25||new Set(channels).size!==channels.length||
  channels.some(x=>!/^[A-Z][A-Z0-9_]{1,39}$/.test(x)))
  throw new ServiceUnavailableException({code:'XENDIT_CHANNELS_INVALID'});
 return channels;
}
export type SessionContext={referenceId:string;amountIdr:number;orderId:string;email:string;
 customerName:string;phone:string;returnOrigin:string;allowedChannels?:string[]};
export function buildXenditPaySession(input:SessionContext){
 if(!uuid.test(input.orderId)||!/^[A-Za-z0-9-]{8,50}$/.test(input.referenceId)||
  !Number.isSafeInteger(input.amountIdr)||input.amountIdr<=0||input.amountIdr>1000000000)
  throw new BadRequestException('Invalid Xendit session amount or reference');
 const origin=new URL(input.returnOrigin);
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.hash||origin.search||
  !['vapmart.id','www.vapmart.id','vapmart-web-staging.up.railway.app'].includes(origin.hostname))
  throw new BadRequestException('Invalid Xendit return origin');
 const customerName=input.customerName.trim();
 const parts=customerName.replace(/[^\p{L}\p{N} ]/gu,'').split(/\s+/).filter(Boolean);
 const first=parts[0]||'Vapmart';
 const last=parts.slice(1).join(' ')||'Customer';
 const phone=input.phone.replace(/[^0-9+]/g,'');
 const mobile=phone.startsWith('08')?'+62'+phone.slice(1):phone.startsWith('62')?'+'+phone:phone;
 const base={
  reference_id:input.referenceId,
  session_type:'PAY' as const,
  mode:'PAYMENT_LINK' as const,
  amount:input.amountIdr,
  currency:'IDR' as const,
  country:'ID' as const,
  capture_method:'AUTOMATIC' as const,
  allow_save_payment_method:'DISABLED' as const,
  ...(input.allowedChannels?.length?{allowed_payment_channels:input.allowedChannels}:{}),
  locale:'id',
  description:'Vapmart - '+input.referenceId,
  success_return_url:origin.origin+'/pesanan/'+input.orderId+'?payment=return',
  cancel_return_url:origin.origin+'/pesanan/'+input.orderId+'?payment=cancel',
  metadata:{vapmart_order_id:input.orderId,source:'vapmart_sandbox'},
  customer:{
   reference_id:input.orderId.replace(/-/g,''),
   type:'INDIVIDUAL' as const,
   email:input.email.trim().slice(0,50),
   ...(mobile.startsWith('+')&&mobile.length>=10&&mobile.length<=20?{mobile_number:mobile}:{}),
   individual_detail:{given_names:first.slice(0,60),surname:last.slice(0,60)}
  }
 };
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(base.customer.email))throw new BadRequestException('Customer email invalid');
 return base;
}
export type XenditSession={payment_session_id:string;reference_id:string;amount:number;
 currency:'IDR';country:'ID';status:'ACTIVE'|'COMPLETED'|'EXPIRED'|'CANCELED';
 payment_link_url:string|null;expires_at?:string;business_id?:string;
 payment_id?:string|null;payment_request_id?:string|null;};
export function parseXenditSession(raw:unknown,mode:'test'|'readback'='test'):XenditSession{
 const s=object(raw);
 const value={
  payment_session_id:string(s.payment_session_id),
  reference_id:string(s.reference_id),
  amount:Number(s.amount),
  currency:s.currency,
  country:s.country,
  status:string(s.status),
  payment_link_url:s.payment_link_url===null?null:string(s.payment_link_url),
  expires_at:string(s.expires_at)||undefined,
  business_id:string(s.business_id)||undefined,
  payment_id:string(s.payment_id)||null,
  payment_request_id:string(s.payment_request_id)||null
 };
 if(!sessionId.test(value.payment_session_id)||!value.reference_id||
  !Number.isSafeInteger(value.amount)||value.amount<=0||value.currency!=='IDR'||
  value.country!=='ID'||!['ACTIVE','COMPLETED','EXPIRED','CANCELED'].includes(value.status))
  throw new BadGatewayException({code:'XENDIT_INVALID_SESSION_RESPONSE'});
 if(value.payment_link_url){
  let link:URL;
  try{link=new URL(value.payment_link_url);}catch{throw new BadGatewayException({code:'XENDIT_INVALID_CHECKOUT_URL'});}
  if(link.protocol!=='https:'||link.username||link.password||link.port||link.hash||
   (mode==='test'&&!validTestHosts.has(link.hostname)))
   throw new BadGatewayException({code:'XENDIT_UNTRUSTED_CHECKOUT_URL'});
 }
 return value as XenditSession;
}
export function safeXenditCallbackToken(received:unknown,expected:unknown):boolean{
 if(typeof received!=='string'||typeof expected!=='string'||expected.length<16||
  received.length!==expected.length)return false;
 const a=Buffer.from(received),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export type XenditWebhook={event:'payment_session.completed'|'payment_session.expired';
 sessionId:string;referenceId:string;amountIdr:number;status:'COMPLETED'|'EXPIRED';
 businessId:string;providerCreatedAt:string;paymentId:string|null;paymentRequestId:string|null};
export function parseXenditWebhook(raw:unknown):XenditWebhook{
 const root=object(raw),data=object(root.data);
 const event=string(root.event),status=string(data.status),amount=Number(data.amount);
 const created=string(root.created),session=string(data.payment_session_id);
 if(!['payment_session.completed','payment_session.expired'].includes(event)||
  (event==='payment_session.completed'&&status!=='COMPLETED')||
  (event==='payment_session.expired'&&status!=='EXPIRED')||
  !sessionId.test(session)||typeof data.reference_id!=='string'||
  !/^[A-Za-z0-9-]{8,64}$/.test(data.reference_id)||
  !Number.isSafeInteger(amount)||amount<=0||amount>1000000000||
  data.currency!=='IDR'||data.country!=='ID'||data.session_type!=='PAY'||
  typeof root.business_id!=='string'||root.business_id.length<16||
  !created||!Number.isFinite(Date.parse(created)))
  throw new BadRequestException('Invalid Xendit Payment Session webhook');
 return {event:event as XenditWebhook['event'],sessionId:session,
  referenceId:data.reference_id,amountIdr:amount,status:status as XenditWebhook['status'],
  businessId:root.business_id,providerCreatedAt:created,
  paymentId:string(data.payment_id)||null,paymentRequestId:string(data.payment_request_id)||null};
}
export function xenditWebhookHash(raw:Buffer){return createHash('sha256').update(raw).digest('hex');}

export class XenditTransportError extends Error{
 constructor(readonly httpStatus:number,readonly retriable:boolean){
  super('XENDIT_UPSTREAM_ERROR');
 }
}
@Injectable()
export class XenditSandboxClient{
 private config(){
  const ready=xenditSandboxReadiness();
  if(!ready.sandboxEnabled)throw new ServiceUnavailableException({code:'XENDIT_SANDBOX_DISABLED'});
  return process.env.XENDIT_TEST_SECRET_KEY as string;
 }
 async request(method:'POST'|'GET',path:string,body?:unknown,client:typeof fetch=fetch):Promise<unknown>{
  const key=this.config();
  if(!/^\/sessions(?:\/[A-Za-z0-9-]{27})?$/.test(path))throw new BadRequestException('Xendit endpoint not allowed');
  let response:Response;
  try{
   response=await client(BASE+path,{
    method,headers:{authorization:'Basic '+Buffer.from(key+':').toString('base64'),
     accept:'application/json',...(body===undefined?{}:{'content-type':'application/json'})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
    redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)
   });
  }catch{throw new XenditTransportError(0,true);}
  if(!response.ok)throw new XenditTransportError(response.status,response.status>=500||response.status===429);
  let json:unknown;
  try{json=await response.json();}catch{throw new XenditTransportError(502,true);}
  return json;
 }
 async createSession(payload:ReturnType<typeof buildXenditPaySession>,client:typeof fetch=fetch){
  return parseXenditSession(await this.request('POST','/sessions',payload,client));
 }
 async readSession(id:string,client:typeof fetch=fetch){
  if(!sessionId.test(id))throw new BadRequestException('Invalid session ID');
  return parseXenditSession(await this.request('GET','/sessions/'+id,undefined,client),'readback');
 }
}
