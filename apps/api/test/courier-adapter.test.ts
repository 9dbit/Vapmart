import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBiteshipOrderPayload} from '../src/courier-adapter';
const valid={referenceId:'vapmart-batch-0000000000000001',
 origin:{contactName:'Warehouse Operator',contactPhone:'081234567890',address:'Jalan Gudang 5',postalCode:'40115'},
 destination:{contactName:'Recipient Test',contactPhone:'081299988877',address:'Jalan Tujuan 7',postalCode:'40255'},
 courierCompany:'jne',courierType:'reg',
 items:[{name:'Office Organizer',valueIdr:50000,quantity:2,weightGrams:300,lengthCm:10,widthCm:10,heightCm:5}]};
test('Pure Biteship adapter maps only verified server-side parcel information, no provider HTTP',()=>{
 const p=buildBiteshipOrderPayload(valid);
 assert.equal(p.origin_postal_code,40115);
 assert.equal(p.destination_postal_code,40255);
 assert.equal(p.items[0].weight,300);
 assert.equal(p.courier_company,'jne');
 assert.equal(p.reference_id,'vapmart-batch-0000000000000001');
 assert.equal('destination_cash_on_delivery' in p,false);
});
test('Biteship payload builder rejects incomplete products, unverified postcodes and injected courier names',()=>{
 assert.throws(()=>buildBiteshipOrderPayload({...valid,courierCompany:'../../danger'}));
 assert.throws(()=>buildBiteshipOrderPayload({...valid,origin:{...valid.origin,postalCode:'123'}}));
 assert.throws(()=>buildBiteshipOrderPayload({...valid,items:[{...valid.items[0],weightGrams:0}]}));
});
