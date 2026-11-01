import test from 'node:test';
import assert from 'node:assert/strict';
import {BadRequestException,ServiceUnavailableException,UnauthorizedException} from '@nestjs/common';
import {normalizeBiteshipWebhook,providerEventHash,verifyWebhookHeader,courierState,
 parseManifestRequest,parseReturnRequest,parseReturnReview,parseReturnReceipt,parseRestockRequest} from '../src/courier-protocol';
import {manifestBlockers} from '../src/courier-manifests';
import {trackingDecision} from '../src/courier-events';
const id='25f397b8-564f-46f4-971e-bc1d333ac1d0';
test('Webhook shared-secret header is required and compared without revealing the token',()=>{
 const before={enabled:process.env.BITESHIP_WEBHOOK_ENABLED,name:process.env.BITESHIP_WEBHOOK_HEADER_NAME,
  secret:process.env.BITESHIP_WEBHOOK_HEADER_SECRET};
 try{
  process.env.BITESHIP_WEBHOOK_ENABLED='true';
  process.env.BITESHIP_WEBHOOK_HEADER_NAME='x-vapmart-biteship-secret';
  process.env.BITESHIP_WEBHOOK_HEADER_SECRET='test-fixture-secret-which-is-at-least-32-characters';
  assert.throws(()=>verifyWebhookHeader({}),UnauthorizedException);
  assert.throws(()=>verifyWebhookHeader({'x-vapmart-biteship-secret':'wrong'}),UnauthorizedException);
  assert.doesNotThrow(()=>verifyWebhookHeader({'x-vapmart-biteship-secret':process.env.BITESHIP_WEBHOOK_HEADER_SECRET}));
  process.env.BITESHIP_WEBHOOK_ENABLED='false';
  assert.throws(()=>verifyWebhookHeader({'x-vapmart-biteship-secret':process.env.BITESHIP_WEBHOOK_HEADER_SECRET}),ServiceUnavailableException);
 }finally{
  if(before.enabled===undefined)delete process.env.BITESHIP_WEBHOOK_ENABLED;else process.env.BITESHIP_WEBHOOK_ENABLED=before.enabled;
  if(before.name===undefined)delete process.env.BITESHIP_WEBHOOK_HEADER_NAME;else process.env.BITESHIP_WEBHOOK_HEADER_NAME=before.name;
  if(before.secret===undefined)delete process.env.BITESHIP_WEBHOOK_HEADER_SECRET;else process.env.BITESHIP_WEBHOOK_HEADER_SECRET=before.secret;
 }
});
test('Provider payload rejects unsupported status, invalid waybill and fake price',()=>{
 const evt=normalizeBiteshipWebhook({event:'order.status',order_id:'biteshipOrder123',status:'picked',courier_waybill_id:'JNE12345'});
 assert.equal(evt.status,'picked');assert.equal(courierState('picked'),'picked_up');
 assert.equal(providerEventHash(evt),providerEventHash({...evt}));
 assert.throws(()=>normalizeBiteshipWebhook({event:'order.status',order_id:'biteshipOrder123',status:'we_delivered'}),BadRequestException);
 assert.throws(()=>normalizeBiteshipWebhook({event:'order.waybill_id',order_id:'biteshipOrder123',courier_waybill_id:'https://evil.com'}));
 assert.throws(()=>normalizeBiteshipWebhook({event:'order.price',order_id:'biteshipOrder123',price:-1}));
 assert.equal(trackingDecision(6,'in_transit').canAdvance,false);
 assert.equal(trackingDecision(2,'picked').canAdvance,true);
});
test('Internal manifest and return validation reject hidden booking and payment flags',()=>{
 const man={idempotencyKey:id,notes:'Package checked for pickup',pickupMethod:'pickup' as const,pickupDate:null,pickupTime:null};
 assert.equal(parseManifestRequest(man).pickupMethod,'pickup');
 assert.throws(()=>parseManifestRequest({...man,charge:true}));
 assert.throws(()=>parseManifestRequest({...man,pickupDate:'2026-11-03'}));
 assert.equal(parseReturnRequest({batchId:id,idempotencyKey:id,reason:'Box arrived damaged'}).batchId,id);
 assert.throws(()=>parseReturnReview({decision:'paid',notes:'Unauthorized finance change'}));
 assert.throws(()=>parseReturnReceipt({warehouseId:'invalid',notes:'Inspected box'}));
 assert.throws(()=>parseRestockRequest({idempotencyKey:id,notes:'x'}));
});
test('Manifest booking gate fails closed for global-origin or split-shipment quotes',()=>{
 const batch={status:'paid',payment_status:'paid',payment_provider:'fixture',payment_reference:'r',
  state:'ready_for_carrier',is_active:true,is_dispatch_enabled:true,is_system_hold:false,origin_postal_code:'40115',origin_address:'Jalan Warehouse 1',
  origin_city:'Bandung',origin_contact_name:'Warehouse',origin_contact_phone:'081234567890',
  contact_name:'Buyer',contact_phone:'081234567890',address_line:'Jalan Buyer 2',postal_code:'40115',
  shipping_courier_code:'jne',shipping_service_code:'reg'} as Parameters<typeof manifestBlockers>[0];
 const goods=[{weight_grams:300,length_cm:10,width_cm:10,height_cm:10,quantity:1}] as Parameters<typeof manifestBlockers>[1];
 const quote={origin_postal_code:'40115',destination_postal_code:'40115',provider:'biteship_test'};
 assert.deepEqual(manifestBlockers(batch,goods,1,quote),['EXTERNAL_BOOKING_DISABLED']);
 assert.ok(manifestBlockers(batch,goods,2,quote).includes('SPLIT_ORIGIN_RATES_REQUIRED'));
 assert.ok(manifestBlockers(batch,goods,1,{...quote,origin_postal_code:'99999'}).includes('WAREHOUSE_SPECIFIC_COURIER_QUOTE_REQUIRED'));
});
