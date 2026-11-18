import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDeliveryPin,pointFromMapInput,pinCoordinate,resolveMapPin,samePin} from '../src/shipping-pin';
import {buildJubelioRatePayload,normalizeJubelioRates} from '../src/jubelio-shipment';
import {parseDraftOrder} from '../src/checkout';
import {editBinding,parseOrderEdit} from '../src/order-policy';
const pin={latitude:-6.2,longitude:106.816666,confirmed:true as const};
test('Map pins accept explicit Google point or coordinates; camera position is not treated as delivery point',()=>{
 assert.deepEqual(pointFromMapInput('-6.2, 106.816666'),pin);
 assert.deepEqual(pointFromMapInput('https://www.google.com/maps/search/?api=1&query=-6.2%2C106.816666'),pin);
 assert.deepEqual(pointFromMapInput('https://www.google.com/maps/place/X/data=!3d-6.2!4d106.816666'),pin);
 assert.equal(pointFromMapInput('https://www.google.com/maps/@-6.2,106.816666,18z'),null);
 assert.throws(()=>pointFromMapInput('https://google.com.attacker.test/maps?q=-6.2,106.8'));
 assert.throws(()=>pointFromMapInput('https://user@www.google.com/maps?q=-6.2,106.8'));
 assert.throws(()=>pointFromMapInput('https://www.google.com:4433/maps?q=-6.2,106.8'));
 assert.throws(()=>pointFromMapInput('https://www.google.com/maps/%xx'));
 assert.throws(()=>parseDeliveryPin({...pin,confirmed:false}));
 assert.throws(()=>parseDeliveryPin({...pin,latitude:51}));
 assert.throws(()=>parseDeliveryPin({...pin,longitude:NaN}));
 assert.equal(samePin(undefined,null),true);
 assert.equal(pinCoordinate(pin),'(-6.2,106.816666)');
});
test('Map resolver never fetches arbitrary links and only emits canonical Google Maps links',async()=>{
 const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected network');};
 try{await assert.rejects(()=>resolveMapPin({input:'https://127.0.0.1/admin'}));assert.equal(calls,0);
 const result=await resolveMapPin({input:'-6.2,106.816666'});assert.deepEqual(result.pin,pin);assert.ok(result.googleMapsUrl.startsWith('https://www.google.com/maps/search/?api=1&query='));
 globalThis.fetch=async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://evil.test/steal'}});};
 await assert.rejects(()=>resolveMapPin({input:'https://maps.app.goo.gl/fixture'}));assert.equal(calls,1,'redirect outside Google is not fetched');
 }finally{globalThis.fetch=old;}
});
test('Instant rates require confirmed origin and destination pins; ordinary rates remain available without pins',()=>{
 const region={areaId:'3273091003',postalCode:'40115',label:'Citarum',city:'Bandung',province:'Jawa Barat',district:'Bandung Wetan',area:'Citarum'},goods=[{quantity:1,value:100000,weight:150,length:15,width:20,height:8}];
 const payload=buildJubelioRatePayload({areaId:'3171011002',postalCode:'10150'},region,goods,{origin:pin,destination:pin});assert.equal(payload.destination.coordinate,'(-6.2,106.816666)');
 const noOrigin=buildJubelioRatePayload({areaId:'3171011002',postalCode:'10150'},region,goods,{origin:null,destination:pin});assert.equal(noOrigin.destination.coordinate,undefined);
 const raw=[{courier_id:1,courier_service_id:2,courier_service_code:'instant',courier_name:'GoSend',courier_service_name:'Instant',courier_service_category:'INSTANT',rates:25000,shipping_insurance:500},{courier_id:3,courier_service_id:4,courier_service_code:'reg',courier_name:'Regular',courier_service_name:'REG',courier_service_category:'REGULAR',rates:12000,shipping_insurance:0}];
 assert.equal(normalizeJubelioRates(raw).length,1);assert.equal(normalizeJubelioRates(raw,Date.now(),true).length,2);
 assert.equal(normalizeJubelioRates(raw,Date.now(),true)[1].requiresPin,true);
});
test('A changed pin changes order edit binding and malformed pin cannot enter an order',()=>{
 const edit={expectedVersion:1,notes:'Koreksi alamat sesuai pelanggan',contact:{name:'Buyer Test',phone:'081234567890',address:'Jalan Contoh Nomor 123',city:'Bandung',province:'Jawa Barat',postalCode:'40115',destinationPin:pin},items:[{productId:'11111111-1111-4111-8111-111111111111',quantity:1,unitPriceIdr:100000}],fees:[]};
 assert.notEqual(editBinding(parseOrderEdit(edit)),editBinding(parseOrderEdit({...edit,contact:{...edit.contact,destinationPin:{...pin,latitude:-6.21}}})));
 assert.throws(()=>parseDraftOrder({...edit.contact,items:edit.items.map(({productId,quantity})=>({productId,quantity})),paymentMethod:'bank_transfer',idempotencyKey:'22222222-2222-4222-8222-222222222222',destinationPin:{...pin,confirmed:false}}));
});
