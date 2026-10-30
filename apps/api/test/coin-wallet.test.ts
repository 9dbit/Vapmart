import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import test from 'node:test';
import {BadRequestException} from '@nestjs/common';
import {PACKS,validateOrder,digitalEnabled} from '../src/member-commerce';
import {verifySandboxSignature,validateSandboxEvent} from '../src/sandbox-payments';

const uuid='d7e2a5b2-c7d5-43c0-8c5a-291a4bd8631b';
test('six coin packs and one activation are fixed-price in rupiah',()=>{
 const coins=PACKS.filter(p=>p.type==='coin_pack');
 assert.deepEqual(coins.map(p=>p.priceIdr),[50000,100000,300000,500000,1000000,2000000]);
 assert.ok(PACKS.every(p=>p.coinCredit===p.priceIdr));
 assert.equal(PACKS.filter(p=>p.type==='membership_activation').length,1);
});
test('rejects browser-submitted amount and unknown digital SKU',()=>{
 assert.throws(()=>validateOrder({sku:'COIN-100',idempotencyKey:uuid,priceIdr:1}),BadRequestException);
 assert.throws(()=>validateOrder({sku:'COIN-999',idempotencyKey:uuid}),BadRequestException);
 assert.throws(()=>validateOrder({sku:'COIN-100',idempotencyKey:'not-a-uuid'}),BadRequestException);
 assert.deepEqual(validateOrder({sku:'COIN-300',idempotencyKey:uuid}),{sku:'COIN-300',idempotencyKey:uuid});
});
test('digital order creation is disabled unless explicitly sandbox enabled',()=>{
 const env=process.env.DIGITAL_COMMERCE_ENABLED;
 delete process.env.DIGITAL_COMMERCE_ENABLED;
 try{assert.equal(digitalEnabled(),false);}finally{
   if(env===undefined)delete process.env.DIGITAL_COMMERCE_ENABLED;
   else process.env.DIGITAL_COMMERCE_ENABLED=env;
 }
});
test('verifies webhook using raw body signature rather than trusting JSON status',()=>{
 const raw=Buffer.from(JSON.stringify({eventId:'event-1234',orderId:uuid,status:'paid',amountIdr:100000}));
 const secret='test-secret-32-characters-long-unique-001';
 const digest=createHmac('sha256',secret).update(raw).digest('hex');
 assert.equal(verifySandboxSignature(raw,'sha256='+digest,secret),true);
 assert.equal(verifySandboxSignature(Buffer.from(raw.toString()+' '),'sha256='+digest,secret),false);
 assert.equal(verifySandboxSignature(raw,'sha256='+digest,'incorrect-secret-32-characters-long'),false);
 assert.equal(verifySandboxSignature(raw,undefined,secret),false);
 assert.equal(verifySandboxSignature(raw,'sha256=garbage',secret),false);
});
test('sandbox rejects mismatch amount, unknown status or invalid order ID',()=>{
 assert.deepEqual(validateSandboxEvent({eventId:'event-1234',orderId:uuid,status:'paid',amountIdr:100000}),{
   eventId:'event-1234',orderId:uuid,status:'paid',amountIdr:100000
 });
 assert.throws(()=>validateSandboxEvent({eventId:'event-1234',orderId:uuid,status:'paid',amountIdr:-1}),BadRequestException);
 assert.throws(()=>validateSandboxEvent({eventId:'event-1234',orderId:uuid,status:'paid',amountIdr:1.5}),BadRequestException);
 assert.throws(()=>validateSandboxEvent({eventId:'event-1234',orderId:uuid,status:'winning',amountIdr:100000}),BadRequestException);
 assert.throws(()=>validateSandboxEvent({eventId:'event-1234',orderId:'bad',status:'paid',amountIdr:100000}),BadRequestException);
});
