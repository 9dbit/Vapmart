import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAddressOptions,provinceForCourierCity,courierRecipientAddress} from '../src/shipping-address';
import {JubelioShipmentClient} from '../src/jubelio-shipment';
import {regionFromPath,resetAddressPath,pathFromLocation,uniqueRegionMatch,type AddressPath} from '../../web/src/lib/address-location';
const path:AddressPath={provinces:[{id:'32',name:'JAWA BARAT'}],cities:[{id:'3273',name:'KOTA BANDUNG',parentId:'32'}],districts:[{id:'327309',name:'Bandung Wetan',parentId:'3273'}],areas:[{id:'3273091003',name:'Citarum',parentId:'327309',postalCode:'40115'}],provinceId:'32',cityId:'3273',districtId:'327309',areaId:'3273091003'};
test('province changes clear children and postcode; a village cannot belong to another parent',()=>{
 assert.equal(regionFromPath(path)?.postalCode,'40115');const next=resetAddressPath(path,'provinceId','51');assert.equal(next.cityId,'');assert.equal(next.districtId,'');assert.equal(next.areaId,'');assert.equal(regionFromPath(next),null);assert.deepEqual(next.cities,[]);assert.equal(resetAddressPath(path,'districtId','327305').areaId,'');assert.equal(regionFromPath({...path,cities:[{...path.cities[0],parentId:'51'}]}),null);
});
test('Papua split preserves courier IDs while assigning each city to the current province',()=>{
 for(const [id,province] of [['9101','93'],['9104','94'],['9112','95'],['9271','96']])assert.equal(provinceForCourierCity(id),province);
 assert.equal(normalizeAddressOptions([{province_id:'91',name:'PAPUA'},{province_id:'92',name:'PAPUA BARAT'}],'provinces').length,6);
 const cities=[{city_id:'9101',province_id:'91',name:'KAB. MERAUKE'},{city_id:'9171',province_id:'91',name:'KOTA JAYAPURA'}];assert.deepEqual(normalizeAddressOptions(cities,'cities','93').map(x=>x.id),['9101']);assert.deepEqual(normalizeAddressOptions(cities,'cities','91').map(x=>x.id),['9171']);
});
test('server resolves postcode from hierarchy and rejects a mismatched province',async()=>{
 const c:any=new JubelioShipmentClient();c.json=async(p:string)=>({status:200,data:p==='/region/provinces'?[{province_id:'32',name:'JAWA BARAT'},{province_id:'51',name:'BALI'}]:p==='/region/cities/32'?[{city_id:'3273',province_id:'32',name:'KOTA BANDUNG'}]:p==='/region/districts/3273'?[{district_id:'327309',city_id:'3273',name:'Bandung Wetan'}]:p==='/region/areas/327309'?[{area_id:'3273091003',district_id:'327309',name:'Citarum',zipcode:'40115'}]:[]});
 const r=await c.addressRegion('32','3273091003');assert.equal(r.postalCode,'40115');assert.equal(r.district,'Bandung Wetan');await assert.rejects(()=>c.addressRegion('51','3273091003'),/Urutan wilayah/);await assert.rejects(()=>c.hierarchy('areas','..\/admin'),/Induk wilayah/);
 assert.equal(courierRecipientAddress({address_line:'Jalan Merdeka 1 RT 02 RW 03',city:r.city,province:r.province,postal_code:r.postalCode,address_region:r}),'Jalan Merdeka 1 RT 02 RW 03, Citarum, Bandung Wetan, KOTA BANDUNG, JAWA BARAT, 40115');
});
test('GPS uses Indonesia and unambiguous hierarchy; a city and regency with the same name do not interchange',async()=>{
 const list:any=async(level:string)=>path[level as keyof AddressPath];const gps={countryCode:'ID',principalSubdivision:'Jawa Barat',city:'Bandung',locality:'Citarum',localityInfo:{administrative:[{adminLevel:5,name:'Kota Bandung'},{adminLevel:6,name:'Bandung Wetan'},{adminLevel:7,name:'Citarum'}]}};
 assert.equal(regionFromPath(await pathFromLocation(gps,list))?.areaId,'3273091003');await assert.rejects(()=>pathFromLocation({...gps,countryCode:'MY'},list),/luar Indonesia/);
 const similar=[{id:'3273',name:'KOTA BANDUNG'},{id:'3204',name:'KAB. BANDUNG'}];assert.equal(uniqueRegionMatch(similar,['Bandung']),null);assert.equal(uniqueRegionMatch(similar,['Kota Bandung'])?.id,'3273');
 const partial=await pathFromLocation({...gps,city:'Unknown',localityInfo:{}},list);assert.equal(partial.provinceId,'32');assert.equal(partial.cityId,'');assert.equal(regionFromPath(partial),null);
});
