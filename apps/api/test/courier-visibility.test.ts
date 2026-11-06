import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeProviderServices,filterVisibleShippingRates,serviceVisibilityKey} from '../src/courier-visibility';

test('provider service catalog preserves each service and its parent courier',()=>{
 const options=normalizeProviderServices([
  {courier_id:24,courier_service_id:2453,courier_name:'Lion Parcel',courier_service_name:'JAGOPACK',courier_service_code:'jagopack'},
  {courier_id:24,courier_service_id:2454,courier_name:'Lion Parcel',courier_service_name:'Reguler',courier_service_code:'regular'},
  {courier_id:31,courier_service_id:3101,courier_name:'Sentral Cargo',courier_service_name:'Regular',courier_service_code:'NEDLL'},
  {courier_id:31,courier_service_id:3102,courier_name:'Sentral Cargo',courier_service_name:'Cargo',courier_service_code:'NDK'},
  {courier_service_id:99,name:'Service without parent courier ID'}
 ]);
 assert.equal(options.length,4);
 assert.deepEqual(options.map(x=>x.key).sort(),['24:2453','24:2454','31:3101','31:3102']);
 assert.equal(options.find(x=>x.key==='31:3101')?.serviceName,'Regular');
 assert.deepEqual(normalizeProviderServices({data:[{courier_id:24,courier_service_id:2453,courier_name:'Lion Parcel'}]}).map(x=>x.key),['24:2453']);
 assert.deepEqual(normalizeProviderServices(null),[]);
});
test('Instant and Same Day requiring coordinates cannot be toggled for postal-only checkout',()=>{
 const services=normalizeProviderServices([
  {courier_id:11,courier_service_id:101,courier_service_category:'INSTANT'},
  {courier_id:11,courier_service_id:102,courier_service_category:'SAME DAY'},
  {courier_id:11,courier_service_id:103,courier_service_category:'REGULER'}
 ]);
 assert.deepEqual(services.map(x=>x.supportsPostalCheckout),[false,false,true]);
});
test('checked service only appears, even when other services share a courier',()=>{
 const input=[
  {courierCode:'24',serviceCode:'jagopack',providerServiceId:2453},
  {courierCode:'24',serviceCode:'regular',providerServiceId:2454},
  {courierCode:'31',serviceCode:'NEDLL',providerServiceId:3101}
 ];
 assert.equal(serviceVisibilityKey('24',2453),'24:2453');
 assert.deepEqual(filterVisibleShippingRates(input,null),input);
 assert.deepEqual(filterVisibleShippingRates(input,{courierCodes:['24'],serviceKeys:null}),input.slice(0,2),'carrier only legacy setting');
 assert.deepEqual(filterVisibleShippingRates(input,{courierCodes:['24'],serviceKeys:['24:2453']}),input.slice(0,1),'only JAGOPACK, not regular');
 assert.deepEqual(filterVisibleShippingRates(input,{courierCodes:['24','31'],serviceKeys:['24:2454','31:3101']}),input.slice(1));
 assert.deepEqual(filterVisibleShippingRates(input,{courierCodes:['24','31'],serviceKeys:[]}),[]);
 assert.equal(input.length,3);
});
