import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {paymentGatewayReadiness,verifyMidtransSignature,gatewayAmountMatches} from '../src/payment-gateway-readiness';

test('gateway stays off until provider integration is actually completed',()=>{
 const original=process.env.VAPMART_PAYMENT_PROVIDER;
 try{
  process.env.VAPMART_PAYMENT_PROVIDER='midtrans';
  const cfg=paymentGatewayReadiness();
  assert.equal(cfg.provider,'midtrans');
  assert.equal(cfg.connected,false);
  assert.equal(cfg.paymentEnabled,false);
  assert.deepEqual(cfg.availableMethods,['bank_transfer']);
  process.env.VAPMART_PAYMENT_PROVIDER='unknown';
  assert.equal(paymentGatewayReadiness().provider,null);
 }finally{
  if(original===undefined)delete process.env.VAPMART_PAYMENT_PROVIDER;
  else process.env.VAPMART_PAYMENT_PROVIDER=original;
 }
});
test('future Midtrans signed callback rejects tampering and ambiguous amounts',()=>{
 const key='test-only-private-key',order_id='VM-1234',status_code='200',gross_amount='150000.00';
 const signature_key=createHash('sha512').update(order_id+status_code+gross_amount+key).digest('hex');
 const input={order_id,status_code,gross_amount,signature_key};
 assert.equal(verifyMidtransSignature(input,key),true);
 assert.equal(verifyMidtransSignature({...input,gross_amount:'150001.00'},key),false);
 assert.equal(verifyMidtransSignature({...input,order_id:'different'},key),false);
 assert.equal(verifyMidtransSignature({...input,signature_key:'a'.repeat(128)},key),false);
 assert.equal(verifyMidtransSignature({...input,signature_key:'invalid'},key),false);
 assert.equal(gatewayAmountMatches(gross_amount,150000),true);
 assert.equal(gatewayAmountMatches('150000.01',150000),false);
 assert.equal(gatewayAmountMatches('1e5',100000),false);
 assert.equal(gatewayAmountMatches('0.00',0),false);
});
