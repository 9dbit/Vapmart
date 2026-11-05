import assert from 'node:assert/strict';
import test from 'node:test';
import {JubelioShipmentClient,buildJubelioRatePayload,normalizeJubelioRates,normalizeJubelioRegions} from '../src/jubelio-shipment';
import {shippingParcelFingerprint} from '../src/shipping-fingerprint';
import {shippingConfig} from '../src/shipping-config';
import {parseShippingRequest} from '../src/shipping';
const rawRegion={area_id:'3273091003',zipcode:'40115',name:'Citarum, Bandung Wetan, KOTA BANDUNG, JAWA BARAT. 40115',province:'JAWA BARAT',city:'KOTA BANDUNG',district:'Bandung Wetan',area:'Citarum'};
const region=normalizeJubelioRegions([rawRegion])[0];
const rate={courier_id:24,courier_name:'Lion Parcel',courier_service_id:2453,courier_service_code:'jagopack',courier_service_name:'Lion Parcel JAGOPACK',courier_service_category:'EKONOMI',rates:9500,shipping_insurance:300,final_rates:0,eta_from:'2026-11-07T07:00:00Z',eta_to:'2026-11-10T07:00:00Z'};
test('Jubelio quote includes insurance without promising an unreserved promotion',()=>{
 const [r]=normalizeJubelioRates([rate,rate],Date.parse('2026-11-05T07:00:00Z'));
 assert.equal(r.priceIdr,9800);assert.equal(r.basePriceIdr,9500);assert.equal(r.insuranceIdr,300);assert.equal(r.duration,'2–5 hari');
 assert.equal(normalizeJubelioRates([rate,rate]).length,1);
 for(const bad of [null,'',true,-1,NaN,1.1,10000001])assert.equal(normalizeJubelioRates([{...rate,rates:bad}]).length,0);
 assert.equal(normalizeJubelioRates([{...rate,shipping_insurance:-1}]).length,0);
 assert.equal(normalizeJubelioRates([{...rate,courier_service_category:'INSTANT'}]).length,0);
 assert.throws(()=>normalizeJubelioRates({error:'failure'}));
});
test('regions reject malformed IDs and postal codes; package payload uses grams and totals quantities',()=>{
 assert.equal(normalizeJubelioRegions([rawRegion,{...rawRegion,area_id:'x'}]).length,1);
 assert.equal(normalizeJubelioRegions([{...rawRegion,zipcode:40115}]).length,0);
 const payload=buildJubelioRatePayload({areaId:'3171011002',postalCode:'10150'},region,[{weight:250,quantity:3,value:100000,length:20,width:12,height:4}]);
 assert.equal(payload.weight,750);assert.equal(payload.total_value,300000);assert.equal(payload.items[0].weight,250);
 assert.throws(()=>buildJubelioRatePayload({areaId:'3171011002',postalCode:'10150'},region,[{weight:250,quantity:1,value:100000}]));
});
test('parcel fingerprint changes when dimensions change without mutating the basket',()=>{
 const a={productId:'25f397b8-564f-46f4-971e-bc1d333ac1d0',quantity:1,unitPriceIdr:100000,weightGrams:250,lengthCm:20,widthCm:12,heightCm:4};
 assert.notEqual(shippingParcelFingerprint([a]),shippingParcelFingerprint([{...a,heightCm:30}]));
 assert.throws(()=>parseShippingRequest({items:[{productId:a.productId,quantity:1}],destinationPostalCode:'40115',destinationAreaId:'bad'}));
});
test('Jubelio refreshes expired credentials once, coalesces token requests and never leaks tokens',async t=>{
 const prior={...process.env};Object.assign(process.env,{JUBELIO_SHIPMENT_CLIENT_ID:'fixture-client',JUBELIO_SHIPMENT_CLIENT_SECRET:'fixture-secret',SHIPPING_PROVIDER:'jubelio',SHIPPING_RATE_LOOKUP_ENABLED:'true',SHIPPING_ORIGIN_POSTAL_CODE:'10150',JUBELIO_SHIPMENT_ORIGIN_AREA_ID:'3171011002'});
 let authentications=0,requests=0;
 const calls:string[]=[];
 t.mock.method(globalThis,'fetch',async(url:string,init:RequestInit)=>{
  calls.push(url);assert.equal(init.redirect,'error');
  if(url.endsWith('/auth/webstore')){authentications++;const b=JSON.parse(String(init.body));assert.equal(b.store_domain,'vapmart.id');return Response.json({token:'token-'+authentications,expires_in:86400});}
  requests++;
  if((init.headers as Record<string,string>).authorization==='Bearer token-1')return Response.json({error:'expired'},{status:401});
  return Response.json([{courier_service_id:1}]);
 });
 try{
  const client=new JubelioShipmentClient(),status=await client.status();assert.equal(status.connected,true);assert.equal(authentications,2);assert.equal(requests,2);
  await Promise.all([client.status(),client.status()]);assert.equal(authentications,2);
  assert.ok(!JSON.stringify(shippingConfig()).includes('fixture-secret'));assert.equal(shippingConfig().bookingEnabled,false);
  await assert.rejects(client.request('/shipments/create',{}));assert.ok(calls.every(x=>!x.includes('/shipments/')));
 }finally{for(const k of Object.keys(process.env))if(!(k in prior))delete process.env[k];Object.assign(process.env,prior);}
});
test('authentication errors and ambiguous postcode do not leak provider response or pick an arbitrary area',async t=>{
 const prior={...process.env};Object.assign(process.env,{JUBELIO_SHIPMENT_CLIENT_ID:'fixture',JUBELIO_SHIPMENT_CLIENT_SECRET:'sensitive-fixture'});
 t.mock.method(globalThis,'fetch',async(url:string)=>url.includes('/regions?')?Response.json([rawRegion,{...rawRegion,area_id:'3273091004'}]):Response.json({error:'sensitive-fixture'},{status:401}));
 try{const client=new JubelioShipmentClient();await assert.rejects(client.status(),e=>!JSON.stringify(e).includes('sensitive-fixture'));
  await assert.rejects(client.destination('40115'));await assert.rejects(client.destination('40115','3171011002'));
  assert.equal((await client.destination('40115','3273091003')).areaId,'3273091003');
 }finally{for(const k of Object.keys(process.env))if(!(k in prior))delete process.env[k];Object.assign(process.env,prior);}
});
