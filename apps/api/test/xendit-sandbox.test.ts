import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
 xenditSandboxReadiness,xenditSessionReference,buildXenditPaySession,
 parseXenditSession,parseXenditWebhook,safeXenditCallbackToken,xenditWebhookHash,xenditSelectedChannels,
 XenditSandboxClient
} from '../src/xendit-sandbox';
import {XenditPaymentSessionsService} from '../src/xendit-payment-sessions';
import {XenditWebhookInboxService} from '../src/xendit-webhook-inbox';

const order='25f397b8-564f-46f4-971e-bc1d333ac1d0';
const sid='ps-'+'a'.repeat(24);
const ref='VM-0000000001-PAY1';
const business='661f87c614802d6c402cd82d';
const link='https://checkout-staging.xendit.co/sessions/'+sid;
const session={payment_session_id:sid,reference_id:ref,amount:150000,currency:'IDR',country:'ID',
 status:'ACTIVE',payment_link_url:link,business_id:business,expires_at:'2026-11-17T12:00:00Z'};
const event={event:'payment_session.completed',business_id:business,created:'2026-11-17T09:10:11Z',
 data:{...session,status:'COMPLETED',session_type:'PAY',payment_id:'py-test123',payment_request_id:'pr-test123'}};

test('Xendit gateway is fail-closed with no credentials or if live key is accidentally supplied',()=>{
 assert.equal(xenditSandboxReadiness({} as NodeJS.ProcessEnv).sandboxEnabled,false);
 assert.equal(xenditSandboxReadiness({} as NodeJS.ProcessEnv).paymentEnabled,false);
 const env={XENDIT_ENVIRONMENT:'test',XENDIT_SANDBOX_ENABLED:'true',XENDIT_TEST_SECRET_KEY:'xnd_production_should_never_be_used_123456789',XENDIT_WEBHOOK_TOKEN:'super-secret-webhook-token',XENDIT_BUSINESS_ID:business,XENDIT_WEBHOOK_ENABLED:'true'} as NodeJS.ProcessEnv;
 assert.equal(xenditSandboxReadiness(env).sandboxEnabled,false);
 assert.equal(xenditSandboxReadiness({...env,XENDIT_TEST_SECRET_KEY:'xnd_development_test_very_long_key_1234567'}).sandboxEnabled,true);
 assert.equal(xenditSandboxReadiness({...env,XENDIT_ENVIRONMENT:'live'}).sandboxEnabled,false);
});
test('Xendit session request is IDR and hosted only; customer contact is normalized',()=>{
 const payload=buildXenditPaySession({orderId:order,referenceId:ref,amountIdr:150000,
  email:'buyer@example.test',customerName:'Budi Santoso',phone:'081234567890',
  returnOrigin:'https://vapmart-web-staging.up.railway.app'});
 assert.equal(payload.mode,'PAYMENT_LINK');assert.equal(payload.session_type,'PAY');
 assert.equal(payload.amount,150000);assert.equal(payload.country,'ID');assert.equal(payload.currency,'IDR');
 assert.equal(payload.customer.mobile_number,'+6281234567890');
 assert.equal(payload.customer.reference_id,order.replace(/-/g,''));
 assert.equal(payload.success_return_url,'https://vapmart-web-staging.up.railway.app/pesanan/'+order+'?payment=return');
 assert.equal(xenditSessionReference('VM-0000000001',1),ref);
 assert.throws(()=>xenditSessionReference('invalid',1));
 assert.throws(()=>buildXenditPaySession({orderId:order,referenceId:ref,amountIdr:0,
  email:'buyer@example.test',customerName:'Budi',phone:'081234567890',
  returnOrigin:'https://vapmart.id'}),/Invalid/);
 assert.throws(()=>buildXenditPaySession({orderId:order,referenceId:ref,amountIdr:150000,
  email:'buyer@example.test',customerName:'Budi',phone:'081234567890',
  returnOrigin:'https://evil.example.test'}),/Invalid/);
});
test('signed Xendit test checkout URLs accepted, unexpected redirect hosts rejected',()=>{
 assert.equal(parseXenditSession(session).payment_link_url,link);
 const hasCode=(code:string)=>(e:any)=>e?.getResponse?.()?.code===code;
 assert.throws(()=>parseXenditSession({...session,payment_link_url:'https://fake-checkout.example.test/pay'}),hasCode('XENDIT_UNTRUSTED_CHECKOUT_URL'));
 assert.throws(()=>parseXenditSession({...session,amount:0}),hasCode('XENDIT_INVALID_SESSION_RESPONSE'));
 assert.throws(()=>parseXenditSession({...session,currency:'USD'}),hasCode('XENDIT_INVALID_SESSION_RESPONSE'));
});
test('Session webhook token, event/currency/amount and stable hash validation',()=>{
 assert.equal(safeXenditCallbackToken('token-1234567890-secret','token-1234567890-secret'),true);
 assert.equal(safeXenditCallbackToken('token-1234567890-secret','token-1234567890-other'),false);
 assert.equal(safeXenditCallbackToken(undefined,'token-1234567890-secret'),false);
 const read=parseXenditWebhook(event);
 assert.equal(read.referenceId,ref);assert.equal(read.amountIdr,150000);assert.equal(read.paymentId,'py-test123');
 assert.throws(()=>parseXenditWebhook({...event,data:{...event.data,currency:'PHP'}}),/Invalid Xendit/);
 assert.throws(()=>parseXenditWebhook({...event,data:{...event.data,status:'EXPIRED'}}),/Invalid Xendit/);
 assert.throws(()=>parseXenditWebhook({...event,data:{...event.data,amount:150001.25}}),/Invalid Xendit/);
 const bytes=Buffer.from(JSON.stringify(event));assert.equal(xenditWebhookHash(bytes).length,64);
 assert.equal(xenditWebhookHash(bytes),xenditWebhookHash(bytes));
});
test('test client sends Basic secret only server-side and parses mocked Xendit session',async()=>{
 const keys=['XENDIT_ENVIRONMENT','XENDIT_SANDBOX_ENABLED','XENDIT_TEST_SECRET_KEY'];
 const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  Object.assign(process.env,{XENDIT_ENVIRONMENT:'test',XENDIT_SANDBOX_ENABLED:'true',
   XENDIT_TEST_SECRET_KEY:'xnd_development_mock_secret_1234567890123'});
  const client=new XenditSandboxClient();
  const requested:string[]=[];
  const mocked=(async(url:string|URL|Request,options?:RequestInit)=>{
   requested.push(String(url));
   assert.equal(String(url),'https://api.xendit.co/sessions');
   assert.equal(options?.method,'POST');
   const auth=String((options?.headers as Record<string,string>).authorization);
   assert.equal(Buffer.from(auth.slice('Basic '.length),'base64').toString('utf8'),process.env.XENDIT_TEST_SECRET_KEY+':');
   return Response.json(session,{status:201});
  }) as typeof fetch;
  const data=await client.createSession(buildXenditPaySession({orderId:order,referenceId:ref,amountIdr:150000,
   email:'buyer@example.test',customerName:'Budi Santoso',phone:'081234567890',returnOrigin:'https://vapmart.id'}),mocked);
  assert.equal(data.payment_session_id,sid);
  assert.equal(requested.length,1);
 }finally{
  for(const k of keys){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];}
 }
});
test('webhook inbox authenticates before any database access and never marks order paid',async()=>{
 const names=['XENDIT_ENVIRONMENT','XENDIT_SANDBOX_ENABLED','XENDIT_TEST_SECRET_KEY',
  'XENDIT_WEBHOOK_ENABLED','XENDIT_WEBHOOK_TOKEN','XENDIT_BUSINESS_ID'];
 const original=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 try{
  Object.assign(process.env,{XENDIT_ENVIRONMENT:'test',XENDIT_SANDBOX_ENABLED:'true',
   XENDIT_TEST_SECRET_KEY:'xnd_development_mock_secret_1234567890123',
   XENDIT_WEBHOOK_ENABLED:'true',XENDIT_WEBHOOK_TOKEN:'token-1234567890-secret',XENDIT_BUSINESS_ID:business});
  const sql:string[]=[];
  const db={transaction:async(callback:(c:any)=>Promise<any>)=>callback({
   query:async(statement:string,values:unknown[])=>{
    sql.push(statement);
    if(statement.startsWith('SELECT'))return {rows:[{id:order,amount_idr:'150000',state:'active',provider_business_id:business}],rowCount:1};
    if(statement.startsWith('INSERT'))return {rows:[{id:order}],rowCount:1};
    if(statement.startsWith('UPDATE'))return {rows:[],rowCount:1};
    throw Error('unexpected query');
   }
  })};
  const inbox=new XenditWebhookInboxService(db as never),body=Buffer.from(JSON.stringify(event));
  await assert.rejects(()=>inbox.receive(body,'invalid-token'),/Invalid Xendit callback token/);
  assert.equal(sql.length,0,'bad callback proof cannot access DB');
  const result=await inbox.receive(body,'token-1234567890-secret');
  assert.equal(result.paymentApplied,false);
  assert.equal(result.queuedForReconciliation,true);
  assert.ok(sql.some(s=>s.includes('xendit_webhook_inbox')));
  assert.equal(sql.filter(s=>s.includes('UPDATE product.orders')).length,0,'webhook must never mark paid');
 }finally{
  for(const k of names){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];}
 }
});
test('sandbox prepare stays disabled even for forged or authenticated buyer order',async()=>{
 const db={transaction:async()=>{throw Error('Must not touch database')}};
 const service=new XenditPaymentSessionsService(db as never,new XenditSandboxClient());
 await assert.rejects(()=>service.prepare({id:order,email:'buyer@example.test',emailVerified:true},
  order,{idempotencyKey:order}),/Sandbox Xendit belum diaktifkan/);
});

test('sandbox requires explicit merchant-verified channels before remote creation',()=>{
 assert.deepEqual(xenditSelectedChannels('DANA,BRI_DIRECT_DEBIT'),['DANA','BRI_DIRECT_DEBIT']);
 assert.throws(()=>xenditSelectedChannels(''),/Service Unavailable/);
 assert.throws(()=>xenditSelectedChannels('DANA,DANA'),/Service Unavailable/);
 assert.throws(()=>xenditSelectedChannels('DANA,http://malicious'),/Service Unavailable/);
});
