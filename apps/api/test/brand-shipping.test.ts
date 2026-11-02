import assert from 'node:assert/strict';
import test from 'node:test';
import {parseBrandMembership} from '../src/brand-portal';
import {parseShippingRequest,normalizeCourierRates} from '../src/shipping';
const id='25f397b8-564f-46f4-971e-bc1d333ac1d0';
test('brand membership whitelists role, UUID and status',()=>{
 assert.deepEqual(parseBrandMembership({userId:id,role:'viewer'}),{userId:id,role:'viewer',isActive:true});
 assert.throws(()=>parseBrandMembership({userId:id,role:'admin'}));
 assert.throws(()=>parseBrandMembership({userId:id,role:'viewer',paymentPermission:true}));
 assert.throws(()=>parseBrandMembership({userId:'wrong',role:'owner'}));
});
test('shipping rate request never accepts customer prices, weights or arbitrary provider',()=>{
 assert.deepEqual(parseShippingRequest({items:[{productId:id,quantity:1}],destinationPostalCode:'40115'}),{items:[{productId:id,quantity:1}],destinationPostalCode:'40115'});
 assert.throws(()=>parseShippingRequest({items:[{productId:id,quantity:1,weight:1}],destinationPostalCode:'40115'}));
 assert.throws(()=>parseShippingRequest({items:[{productId:id,quantity:1}],destinationPostalCode:'401'}));
 assert.throws(()=>parseShippingRequest({items:[{productId:id,quantity:1}],destinationPostalCode:'40115',courier:'fake'}));
});
test('provider rates are normalized and invalid prices dropped',()=>{
 assert.deepEqual(normalizeCourierRates({pricing:[{courier_code:'jne',courier_name:'JNE',courier_service_code:'reg',courier_service_name:'Regular',duration:'2 days',price:12000}]}),
  [{courierCode:'jne',courierName:'JNE',serviceCode:'reg',serviceName:'Regular',duration:'2 days',priceIdr:12000}]);
 assert.equal(normalizeCourierRates({pricing:[{courier_code:'jne',courier_service_code:'reg',price:-1}]}).length,0);
});
