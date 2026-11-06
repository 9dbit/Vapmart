import assert from 'node:assert/strict';
import test from 'node:test';
import {filterVisibleCouriers,normalizeProviderCarriers} from '../src/courier-visibility';

test('provider catalog groups multiple shipping services by their courier ID',()=>{
 const options=normalizeProviderCarriers([
  {courier_id:24,courier_service_id:2453,courier_name:'Lion Parcel',courier_service_name:'JAGOPACK'},
  {courier_id:31,courier_service_id:3101,courier_name:'Sentral Cargo',courier_service_name:'Regular'},
  {courier_id:31,courier_service_id:3102,courier_name:'Sentral Cargo',courier_service_name:'Cargo'},
  {courier_service_id:42,name:'Unknown service without carrier ID'}
 ]);
 assert.deepEqual(options,[{code:'24',name:'Lion Parcel'},{code:'31',name:'Sentral Cargo'}]);
 assert.deepEqual(normalizeProviderCarriers({data:[{courier_id:24,courier_name:'Lion Parcel'}]}),[{code:'24',name:'Lion Parcel'}]);
 assert.deepEqual(normalizeProviderCarriers(null),[]);
});
test('only checked couriers remain in customer rates, without mutating rates',()=>{
 const input=[{courierCode:'24',serviceCode:'JAGOPACK'},{courierCode:'31',serviceCode:'NEDLL'},{courierCode:'31',serviceCode:'Cargo'}];
 assert.equal(filterVisibleCouriers(input,null).length,3,'unconfigured store retains backwards compatibility');
 assert.deepEqual(filterVisibleCouriers(input,['31']),input.slice(1));
 assert.deepEqual(filterVisibleCouriers(input,['24']),input.slice(0,1));
 assert.deepEqual(filterVisibleCouriers(input,[]),[]);
 assert.equal(input.length,3);
});
