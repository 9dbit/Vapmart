import test from 'node:test';
import assert from 'node:assert/strict';
import {paidOrderVerified,parseFulfillmentRequest,parseFulfillmentStatus} from '../src/fulfillment';
const key='97544bf9-7b9e-46ac-8cc5-d6f1aa747df8';
test('only verified paid orders are eligible for a reservation',()=>{
 assert.equal(paidOrderVerified({status:'draft',payment_status:'not_initiated',payment_provider:null,payment_reference:null}),false);
 assert.equal(paidOrderVerified({status:'paid',payment_status:'paid',payment_provider:null,payment_reference:'ref'}),false);
 assert.equal(paidOrderVerified({status:'pending',payment_status:'paid',payment_provider:'provider',payment_reference:'ref'}),false);
 assert.equal(paidOrderVerified({status:'paid',payment_status:'paid',payment_provider:'provider',payment_reference:'ref'}),true);
});
test('fulfillment prepare is idempotent and rejects extra fields',()=>{
 assert.equal(parseFulfillmentRequest({idempotencyKey:key}).idempotencyKey,key);
 assert.throws(()=>parseFulfillmentRequest({idempotencyKey:key,paymentOverride:true}));
 assert.throws(()=>parseFulfillmentRequest({}));
});
test('status transitions cannot mark delivered, paid or carrier accepted',()=>{
 assert.equal(parseFulfillmentStatus({state:'picking',notes:'Operator started picking'}).state,'picking');
 assert.throws(()=>parseFulfillmentStatus({state:'delivered',notes:'Faked delivery'}));
 assert.throws(()=>parseFulfillmentStatus({state:'ready_for_carrier',notes:'x'}));
 assert.throws(()=>parseFulfillmentStatus({state:'packed',notes:'Packing checked',booking:true}));
});
