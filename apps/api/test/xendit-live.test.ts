import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import {xenditSandboxReadiness,parseXenditSession} from '../src/xendit-sandbox';
import {applyXenditLivePayment} from '../src/xendit-live-settlement';
const business='661f87c614802d6c402cd82d';
const env={XENDIT_ENVIRONMENT:'live',XENDIT_SECRET_KEY:'xnd_production_fixture_only_12345678',XENDIT_BUSINESS_ID:business,XENDIT_LIVE_WEBHOOK_TOKEN:'fixture_live_callback_1234567',XENDIT_WEBHOOK_ENABLED:'true',XENDIT_LIVE_ENABLED:'true',XENDIT_LIVE_ORDER_ENABLED:'true',XENDIT_LIVE_ALLOWED_CHANNELS:'QRIS,BCA_VIRTUAL_ACCOUNT,DANA'};
const provider:any={payment_session_id:'ps-'+'b'.repeat(24),reference_id:'VM-0000000001-PAY1',amount:115000,currency:'IDR',country:'ID',status:'COMPLETED',business_id:business,session_type:'PAY',mode:'PAYMENT_LINK',capture_method:'AUTOMATIC',payment_link_url:'https://xen.to/fixture',payment_id:'py-11111111-1111-4111-8111-111111111111',payment_request_id:'pr-11111111-1111-4111-8111-111111111111'};
test('live requires separate credentials, callback token, channels and both live flags',()=>{
 assert.equal(xenditSandboxReadiness(env).livePaymentEnabled,true);assert.equal(xenditSandboxReadiness(env).sandboxEnabled,false);
 for(const field of ['XENDIT_SECRET_KEY','XENDIT_LIVE_WEBHOOK_TOKEN','XENDIT_LIVE_ALLOWED_CHANNELS','XENDIT_LIVE_ENABLED','XENDIT_LIVE_ORDER_ENABLED'])assert.equal(xenditSandboxReadiness({...env,[field]:''}).livePaymentEnabled,false,field);
 assert.equal(xenditSandboxReadiness({...env,XENDIT_SECRET_KEY:'xnd_development_fixture_only_1234567'}).paymentEnabled,false);
 assert.equal(xenditSandboxReadiness({...env,XENDIT_ENVIRONMENT:'test',XENDIT_SANDBOX_ENABLED:'true',XENDIT_SANDBOX_ORDER_ENABLED:'true'}).paymentEnabled,false);
});
test('live parser rejects sandbox URLs, manual capture and alternate flows',()=>{
 assert.equal(parseXenditSession(provider,'live').status,'COMPLETED');
 for(const patch of [{payment_link_url:'https://dev.xen.to/fixture'},{capture_method:'MANUAL'},{mode:'COMPONENTS'},{session_type:'SAVE'},{payment_link_url:'https://xen.to.evil.invalid/pay'}])assert.throws(()=>parseXenditSession({...provider,...patch},'live'));
});
test('live receipt is unique, invalid proof cannot pay, late payment held and already-paid reviewed',async()=>{
 const old=process.env.XENDIT_BUSINESS_ID;process.env.XENDIT_BUSINESS_ID=business;
 try{
  const order:any={payment_environment:'live',total_idr:'115000',currency:'IDR',payment_status:'not_initiated',status:'draft',operational_status:'draft',payment_provider:null,expires_at:new Date(Date.now()+3600000).toISOString()};
  const stored={id:'record',order_id:'order',environment:'live',amount_idr:'115000',provider_business_id:business,payment_session_id:provider.payment_session_id,reference_id:provider.reference_id};
  const writes:any[]=[];let inserted=false;
  const client:any={query:async(sql:string,args:any[])=>{writes.push([sql,args]);if(sql.startsWith('INSERT INTO product.xendit_live_payments')){if(inserted)return{rows:[]};inserted=true;return{rows:[{id:'receipt'}]};}if(sql.startsWith('SELECT order_id'))return{rows:[{order_id:'order',session_record_id:'record',disposition:'applied'}]};return{rows:[],rowCount:1};}};
  for(const patch of [{amount:1},{business_id:'wrong-business-123456789'},{payment_id:null},{status:'ACTIVE'}])await assert.rejects(()=>applyXenditLivePayment(client,order,stored,{...provider,...patch}));
  await assert.rejects(()=>applyXenditLivePayment(client,{...order,payment_environment:'test'},stored,provider));assert.equal(writes.length,0);
  assert.deepEqual(await applyXenditLivePayment(client,order,stored,provider),{changed:true,review:false});
  assert.equal(writes.find(x=>x[0].startsWith('UPDATE product.orders'))[1][2],'processing');
  assert.equal((await applyXenditLivePayment(client,{...order,payment_status:'paid',payment_provider:'xendit'},stored,provider)).changed,false);
  assert.equal(writes.filter(x=>x[0].startsWith('UPDATE product.orders')).length,1);assert.equal(writes.filter(x=>x[0].startsWith('INSERT INTO product.order_events')).length,1);
  inserted=false;writes.length=0;await applyXenditLivePayment(client,{...order,expires_at:new Date(Date.now()-10000).toISOString()},stored,provider);
  const update=writes.find(x=>x[0].startsWith('UPDATE product.orders'));assert.equal(update[1][2],'on_hold');assert.equal(update[1][3],true);
  inserted=false;writes.length=0;assert.deepEqual(await applyXenditLivePayment(client,{...order,payment_status:'paid',payment_provider:'manual_bank_transfer'},stored,provider),{changed:false,review:true});assert.equal(writes.some(x=>x[0].startsWith('UPDATE product.orders')),false);
 }finally{if(old===undefined)delete process.env.XENDIT_BUSINESS_ID;else process.env.XENDIT_BUSINESS_ID=old;}
});
