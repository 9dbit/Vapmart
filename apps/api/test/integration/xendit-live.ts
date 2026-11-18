import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
const {createFixture}=require(resolve('../../scripts/cp39-fixture-server.cjs'));
const {XenditSandboxClient}=require('../../dist/xendit-sandbox');
test('live checkout, provider verification, concurrent replay, mode isolation and late-payment hold',async()=>{
 const {app,db,base}=await createFixture();const original={...process.env};
 const business='661f87c614802d6c402cd82d',token='fixture_live_callback_cp55';
 Object.assign(process.env,{VAPMART_PAYMENT_PROVIDER:'xendit',XENDIT_ENVIRONMENT:'live',XENDIT_SECRET_KEY:'xnd_production_fixture_only_cp55_123456',XENDIT_BUSINESS_ID:business,XENDIT_LIVE_WEBHOOK_TOKEN:token,XENDIT_LIVE_ALLOWED_CHANNELS:'QRIS,BCA_VIRTUAL_ACCOUNT,DANA',XENDIT_WEBHOOK_ENABLED:'true',XENDIT_LIVE_ENABLED:'true',XENDIT_LIVE_ORDER_ENABLED:'true'});
 const call=async(path:string,body?:any,auth='fixture-buyer',extra:Record<string,string>={})=>{const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+auth,'content-type':'application/json',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:r.status,data:await r.json()};};
 const ok=async(path:string,body?:any,auth?:string)=>{const r=await call(path,body,auth);assert.ok(r.status<300,JSON.stringify(r));return r.data;};
 try{
  const cfg=await ok('/v1/checkout/config');assert.equal(cfg.gateway.status,'live_active');assert.equal(cfg.gateway.livePaymentEnabled,true);assert.deepEqual(cfg.methods,['bank_transfer','qris','virtual_account','ewallet']);
  const product=(await db.query("SELECT id FROM product.products WHERE slug='travel-pouch-cp41'")).rows[0];
  const form={items:[{productId:product.id,quantity:1}],name:'Live Fixture',phone:'081234567890',address:'Jalan Pengujian Nomor 55',city:'Bandung',province:'Jawa Barat',postalCode:'40115',paymentMethod:'qris'};
  const sandbox=(await db.query("SELECT id FROM product.orders WHERE payment_environment='test' LIMIT 1")).rows[0];assert.ok(sandbox);
  const sandboxPath='/v1/checkout/orders/'+sandbox.id+'/payment-session';assert.equal((await ok(sandboxPath)).readiness.paymentEnabled,false);assert.equal((await call(sandboxPath,{idempotencyKey:randomUUID()})).status,409);
  const client=app.get(XenditSandboxClient);let provider:any,creates=0;
  client.createSession=async(payload:any)=>{creates++;assert.deepEqual(payload.allowed_payment_channels,['QRIS']);assert.equal(payload.metadata.source,'vapmart_live');provider={payment_session_id:'ps-'+String(creates).repeat(24),reference_id:payload.reference_id,amount:payload.amount,currency:'IDR',country:'ID',business_id:business,status:'ACTIVE',session_type:'PAY',mode:'PAYMENT_LINK',capture_method:'AUTOMATIC',payment_link_url:'https://xen.to/fixtureCp55',expires_at:new Date(Date.now()+3600000).toISOString()};return provider;};client.readSession=async()=>provider;
  const make=async()=>{const order=await ok('/v1/checkout/orders',{...form,idempotencyKey:randomUUID()});assert.equal(order.sandboxOnly,false);const path='/v1/checkout/orders/'+order.id+'/payment-session';assert.equal((await ok(path,{idempotencyKey:randomUUID()})).environment,'live');return{order,path};};
  const first=await make();assert.equal((await call(first.path,{idempotencyKey:randomUUID()},'fixture-other')).status,404);assert.equal(creates,1);
  provider={...provider,status:'COMPLETED',payment_id:'py-'+randomUUID(),payment_request_id:'pr-'+randomUUID()};const valid={...provider};
  provider={...valid,amount:valid.amount+1};assert.equal((await call(first.path+'/reconcile',{})).status,409);provider={...valid,business_id:'wrong-merchant-123456789'};assert.equal((await call(first.path+'/reconcile',{})).status,409);
  assert.equal((await db.query('SELECT payment_status FROM product.orders WHERE id=$1',[first.order.id])).rows[0].payment_status,'not_initiated');provider=valid;
  const event={event:'payment_session.completed',business_id:business,created:new Date().toISOString(),data:provider};assert.equal((await call('/v1/webhooks/xendit/payment-sessions',event,'',{'x-callback-token':'wrong-token'})).status,403);
  client.readSession=async()=>{throw Error('fixture provider outage')};assert.equal((await call('/v1/webhooks/xendit/payment-sessions',event,'',{'x-callback-token':token})).status,503);assert.equal((await db.query('SELECT payment_status FROM product.orders WHERE id=$1',[first.order.id])).rows[0].payment_status,'not_initiated');client.readSession=async()=>provider;
  const callbacks=await Promise.all([1,2].map(()=>call('/v1/webhooks/xendit/payment-sessions',event,'',{'x-callback-token':token})));assert.ok(callbacks.every(r=>r.status===200));
  const paid=(await db.query('SELECT payment_status,payment_provider,payment_reference,operational_status,operational_hold FROM product.orders WHERE id=$1',[first.order.id])).rows[0];assert.deepEqual(paid,{payment_status:'paid',payment_provider:'xendit',payment_reference:provider.payment_id,operational_status:'processing',operational_hold:false});
  assert.equal((await ok(first.path+'/reconcile',{})).orderPaidChanged,false);assert.equal((await db.query('SELECT count(*)::int n FROM product.xendit_live_payments WHERE order_id=$1',[first.order.id])).rows[0].n,1);assert.equal((await db.query("SELECT count(*)::int n FROM product.order_events WHERE order_id=$1 AND action='payment_confirmed'",[first.order.id])).rows[0].n,1);
  const late=await make();await db.query("UPDATE product.orders SET expires_at=now()-interval '1 minute',operational_status='cancelled',status='cancelled' WHERE id=$1",[late.order.id]);provider={...provider,status:'COMPLETED',payment_id:'py-'+randomUUID(),payment_request_id:'pr-'+randomUUID()};assert.equal((await ok(late.path+'/reconcile',{})).orderPaidChanged,true);
  assert.deepEqual((await db.query('SELECT payment_status,operational_status,operational_hold FROM product.orders WHERE id=$1',[late.order.id])).rows[0],{payment_status:'paid',operational_status:'on_hold',operational_hold:true});assert.equal((await db.query('SELECT payment_status FROM product.orders WHERE id=$1',[sandbox.id])).rows[0].payment_status,'not_initiated');
  console.log('CP55_LIVE_PAYMENT_PASS');
 }finally{for(const k of Object.keys(process.env)){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k];}await app.close();}
});
