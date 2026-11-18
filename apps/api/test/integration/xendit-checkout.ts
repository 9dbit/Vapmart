import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
const {createFixture}=require(resolve('../../scripts/cp39-fixture-server.cjs'));
const {XenditSandboxClient}=require('../../dist/xendit-sandbox');
test('sandbox order -> hosted session -> verified callback -> duplicate without real fulfillment',async()=>{
 const {app,db,base}=await createFixture();const original={...process.env};
 const business='661f87c614802d6c402cd82d',sid='ps-'+'c'.repeat(24),token='fixture_callback_secret_cp54';
 Object.assign(process.env,{VAPMART_PAYMENT_PROVIDER:'xendit',XENDIT_ENVIRONMENT:'test',
  XENDIT_TEST_SECRET_KEY:'xnd_development_fake_cp54_secret_1234567',XENDIT_BUSINESS_ID:business,
  XENDIT_WEBHOOK_TOKEN:token,XENDIT_ALLOWED_CHANNELS:'BCA_VIRTUAL_ACCOUNT',XENDIT_WEBHOOK_ENABLED:'true',
  XENDIT_SANDBOX_ENABLED:'true',XENDIT_SANDBOX_ORDER_ENABLED:'true'});
 const call=async(path:string,body?:any,auth='fixture-buyer',extra:Record<string,string>={})=>{
  const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+auth,'content-type':'application/json',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:r.status,data:await r.json()};
 };
 const ok=async(path:string,body?:any,auth?:string)=>{const r=await call(path,body,auth);assert.ok(r.status<300,JSON.stringify(r));return r.data};
 try{
  const cfg=await ok('/v1/checkout/config');assert.equal(cfg.gateway.status,'sandbox_active');assert.deepEqual(cfg.methods,['bank_transfer','virtual_account']);
  const readiness=await ok('/v1/admin/payments/xendit/readiness',undefined,'fixture-admin');assert.equal(readiness.paymentEnabled,true);
  assert.ok(!JSON.stringify(readiness).includes(process.env.XENDIT_TEST_SECRET_KEY!));
  const product=(await db.query("SELECT id FROM product.products WHERE slug='travel-pouch-cp41'")).rows[0];assert.ok(product);
  const form={items:[{productId:product.id,quantity:1}],name:'Sandbox Buyer',phone:'081234567890',address:'Jalan Sandbox Nomor 54',city:'Bandung',province:'Jawa Barat',postalCode:'40115',paymentMethod:'virtual_account',idempotencyKey:randomUUID()};
  assert.equal((await call('/v1/checkout/orders',{...form,paymentMethod:'qris'})).status,503);
  const order=await ok('/v1/checkout/orders',form);assert.equal(order.paymentStatus,'not_initiated');
  const path='/v1/checkout/orders/'+order.id+'/payment-session';let creates=0,provider:any;
  const client=app.get(XenditSandboxClient);
  client.createSession=async(payload:any)=>{creates++;assert.deepEqual(payload.allowed_payment_channels,['BCA_VIRTUAL_ACCOUNT']);
   provider={payment_session_id:sid,reference_id:payload.reference_id,amount:order.totalIdr,currency:'IDR',country:'ID',business_id:business,status:'ACTIVE',payment_link_url:'https://dev.xen.to/testCp54',expires_at:new Date(Date.now()+3600000).toISOString()};return provider;};
  client.readSession=async()=>provider;
  assert.equal((await call(path,{idempotencyKey:randomUUID()},'fixture-other')).status,404);assert.equal(creates,0);
  assert.equal((await ok(path,{idempotencyKey:randomUUID()})).state,'active');
  assert.equal((await ok(path,{idempotencyKey:randomUUID()})).sessionId,sid);assert.equal(creates,1);
  provider={...provider,status:'COMPLETED',payment_id:'py-fixture-cp54',payment_request_id:'pr-fixture-cp54'};
  const event={event:'payment_session.completed',business_id:business,created:new Date().toISOString(),data:{...provider,session_type:'PAY'}};
  assert.equal((await call('/v1/webhooks/xendit/payment-sessions',event,'',{'x-callback-token':'invalid-token'})).status,403);
  assert.equal((await call('/v1/webhooks/xendit/payment-sessions',event,'',{'x-callback-token':token})).status,200);
  const current=await ok(path);assert.equal(current.session.state,'completed');assert.equal(current.session.paymentUrl,null);
  assert.equal((await call('/v1/webhooks/xendit/payment-sessions',event,'',{'x-callback-token':token})).data.duplicate,true);
  const verified=await ok(path+'/reconcile',{});assert.equal(verified.session.state,'completed');assert.equal(verified.orderPaidChanged,false);
  const stored=(await db.query('SELECT payment_status,payment_provider FROM product.orders WHERE id=$1',[order.id])).rows[0];
  assert.equal(stored.payment_status,'not_initiated');assert.equal(stored.payment_provider,null);
  assert.equal((await db.query('SELECT count(*)::int n FROM product.xendit_payment_sessions WHERE order_id=$1',[order.id])).rows[0].n,1);
  assert.equal((await db.query('SELECT disposition FROM product.xendit_webhook_inbox WHERE payment_session_id=$1',[sid])).rows[0].disposition,'reconciled');
  console.log('CP54_SANDBOX_CHECKOUT_PASS');
 }finally{for(const k of Object.keys(process.env)){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];}await app.close();}
});
