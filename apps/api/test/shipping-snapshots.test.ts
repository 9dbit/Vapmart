import assert from 'node:assert/strict';import test from 'node:test';
import {shippingFingerprint} from '../src/shipping-fingerprint';
import {parseDraftOrder} from '../src/checkout';
const id='25f397b8-564f-46f4-971e-bc1d333ac1d0';
const key='97544bf9-7b9e-46ac-8cc5-d6f1aa747df8';
const basic={items:[{productId:id,quantity:1}],name:'Pembeli Test',phone:'081234567890',address:'Jalan Merdeka 12',city:'Bandung',province:'Jawa Barat',postalCode:'40115',paymentMethod:'qris',idempotencyKey:key};
test('shipping basket fingerprint is stable across ordering, reacts to live price & weight changes',()=>{
 const a={productId:id,quantity:1,unitPriceIdr:120000,weightGrams:350};
 const b={productId:'137e4cd0-d66f-4fc7-a739-06e59513a3e8',quantity:2,unitPriceIdr:30000,weightGrams:150};
 assert.equal(shippingFingerprint([a,b]),shippingFingerprint([b,a]));
 assert.notEqual(shippingFingerprint([a,b]),shippingFingerprint([{...a,weightGrams:100},b]));
 assert.notEqual(shippingFingerprint([a,b]),shippingFingerprint([{...a,unitPriceIdr:90000},b]));
});
test('checkout accepts only UUID shipping quote reference, never arbitrary shipping prices',()=>{
 assert.equal(parseDraftOrder({...basic,shippingQuoteId:id}).details.shippingQuoteId,id);
 assert.throws(()=>parseDraftOrder({...basic,shippingQuoteId:'not-valid'}));
 assert.throws(()=>parseDraftOrder({...basic,shippingFeeIdr:0}));
});
