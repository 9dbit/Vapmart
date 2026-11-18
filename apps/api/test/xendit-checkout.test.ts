import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentGatewayReadiness} from '../src/payment-gateway-readiness';
import {xenditSandboxReadiness,xenditChannelsForMethod} from '../src/xendit-sandbox';
import {XenditPaymentSessionsService} from '../src/xendit-payment-sessions';
const env={VAPMART_PAYMENT_PROVIDER:'xendit',XENDIT_ENVIRONMENT:'test',XENDIT_TEST_SECRET_KEY:'xnd_development_fixture_secret_123456789',
 XENDIT_BUSINESS_ID:'661f87c614802d6c402cd82d',XENDIT_WEBHOOK_TOKEN:'fixture_token_for_webhook_1234',XENDIT_WEBHOOK_ENABLED:'true',
 XENDIT_SANDBOX_ENABLED:'true',XENDIT_SANDBOX_ORDER_ENABLED:'true',XENDIT_ALLOWED_CHANNELS:'BCA_VIRTUAL_ACCOUNT'};
function configure(){const old={...process.env};Object.assign(process.env,env);return()=>{for(const k of Object.keys(env)){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}};}
test('configured sandbox enables only configured methods; live secrets never enable checkout',()=>{
 const restore=configure();try{
  assert.equal(paymentGatewayReadiness().status,'sandbox_active');assert.equal(paymentGatewayReadiness().connected,true);
  assert.deepEqual(paymentGatewayReadiness().availableMethods,['bank_transfer','virtual_account']);
  assert.equal(xenditSandboxReadiness().paymentEnabled,true);assert.equal(xenditSandboxReadiness().liveEnabled,false);
  assert.equal(xenditSandboxReadiness().settlementEnabled,false);
  process.env.XENDIT_SANDBOX_ORDER_ENABLED='false';assert.equal(paymentGatewayReadiness().status,'sandbox_connected');
  assert.deepEqual(paymentGatewayReadiness().availableMethods,['bank_transfer']);
  process.env.XENDIT_SANDBOX_ORDER_ENABLED='true';process.env.XENDIT_TEST_SECRET_KEY='xnd_production_bad_key_1234567890';
  assert.equal(paymentGatewayReadiness().paymentEnabled,false);
  process.env.XENDIT_TEST_SECRET_KEY=env.XENDIT_TEST_SECRET_KEY;process.env.XENDIT_ENVIRONMENT='live';
  assert.equal(paymentGatewayReadiness().paymentEnabled,false);
 }finally{restore();}
});
test('channel families cannot cross payment methods',()=>{
 const channels=['BCA_VIRTUAL_ACCOUNT','DANA','QRIS','CARDS'];
 assert.deepEqual(xenditChannelsForMethod('virtual_account',channels),['BCA_VIRTUAL_ACCOUNT']);
 assert.deepEqual(xenditChannelsForMethod('qris',channels),['QRIS']);assert.deepEqual(xenditChannelsForMethod('ewallet',channels),['DANA']);
});
test('provider must match ledger and current order; completed never regresses and real orders never become paid',async()=>{
 const restore=configure();try{
  let row:any={id:'record',order_id:'order',amount_idr:'150000',reference_id:'VM-0000000001-PAY1',state:'active',
   provider_business_id:env.XENDIT_BUSINESS_ID,payment_session_id:'ps-'+'a'.repeat(24)};
  let provider:any={payment_session_id:row.payment_session_id,reference_id:row.reference_id,amount:150000,currency:'IDR',country:'ID',
   status:'COMPLETED',business_id:env.XENDIT_BUSINESS_ID,payment_id:'py-fixture',payment_request_id:'pr-fixture'};
  const writes:string[]=[];
  const client={query:async(sql:string,args:any[])=>{
   if(sql.startsWith('SELECT total_idr'))return {rows:[{total_idr:'150000',status:'draft',payment_status:'not_initiated'}]};
   if(sql.startsWith('SELECT *'))return {rows:[{...row}]};
   writes.push(sql);
   if(sql.startsWith('UPDATE product.xendit_payment_sessions')){row={...row,state:args[1],payment_id:args[3]};return {rows:[row]};}
   return {rows:[],rowCount:1};
  }};
  const service=new XenditPaymentSessionsService({query:client.query,transaction:async(fn:any)=>fn(client)} as never,{readSession:async()=>provider} as never);
  provider={...provider,amount:150001};await assert.rejects(()=>service.verifySandboxSession(row.payment_session_id),/Data provider/);assert.equal(writes.length,0);
  provider={...provider,amount:150000,business_id:'another-business-12345678'};await assert.rejects(()=>service.verifySandboxSession(row.payment_session_id),/Data provider/);
  provider={...provider,business_id:env.XENDIT_BUSINESS_ID,payment_id:null};await assert.rejects(()=>service.verifySandboxSession(row.payment_session_id),/Data provider/);
  provider={...provider,payment_id:'py-fixture'};const result=await service.verifySandboxSession(row.payment_session_id);
  assert.equal(result?.session.state,'completed');assert.equal(result?.orderPaidChanged,false);
  provider={...provider,status:'ACTIVE'};await service.verifySandboxSession(row.payment_session_id);
  assert.equal(row.state,'completed');assert.ok(!writes.some(s=>s.includes('UPDATE product.orders')));
 }finally{restore();}
});
