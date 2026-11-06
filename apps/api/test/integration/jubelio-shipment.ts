import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import sharp from 'sharp';
const {createFixture}=require(resolve('../../scripts/cp39-fixture-server.cjs'));
const {JubelioShipmentClient}=require(resolve('dist/jubelio-shipment'));
test('Jubelio rates persist through authenticated checkout with insurance, area and parcel integrity',async()=>{
 Object.assign(process.env,{SHIPPING_PROVIDER:'jubelio',SHIPPING_RATE_LOOKUP_ENABLED:'true',SHIPPING_ORIGIN_POSTAL_CODE:'10150',JUBELIO_SHIPMENT_ORIGIN_AREA_ID:'3171011002',JUBELIO_SHIPMENT_CLIENT_ID:'fixture-only',JUBELIO_SHIPMENT_CLIENT_SECRET:'fixture-only'});
 const {app,db,base}=await createFixture();
 const region={areaId:'3273091003',postalCode:'40115',label:'Citarum, Bandung',city:'KOTA BANDUNG',province:'JAWA BARAT',district:'Bandung Wetan',area:'Citarum'};
 const client=app.get(JubelioShipmentClient);let externalCalls=0;
 client.regions=async()=>[region];
 client.request=async(path:string,body:any)=>{
  if(path==='/courier-services/list')return [
   {courier_id:24,courier_name:'Lion Parcel',courier_service_id:2453,courier_service_name:'JAGOPACK'},
   {courier_id:24,courier_name:'Lion Parcel',courier_service_id:2454,courier_service_name:'REGULER'},
   {courier_id:31,courier_name:'Sentral Cargo',courier_service_id:3101,courier_service_name:'Regular'}];
  externalCalls++;assert.equal(path,'/webstore/rates/all');assert.equal(body.origin.area_id,'3171011002');assert.equal(body.weight,500);assert.equal(body.total_value,200000);
  return [{courier_id:24,courier_name:'Lion Parcel',courier_service_id:2453,courier_service_code:'jagopack',courier_service_name:'JAGOPACK',rates:9500,shipping_insurance:300,final_rates:5000},
   {courier_id:24,courier_name:'Lion Parcel',courier_service_id:2454,courier_service_code:'regular',courier_service_name:'REGULER',rates:10500,shipping_insurance:300},
   {courier_id:31,courier_name:'Sentral Cargo',courier_service_id:3101,courier_service_code:'NEDLL',courier_service_name:'Regular',rates:12500,shipping_insurance:300}];
 };
 const call=async(path:string,body?:any,token='fixture-admin')=>{
  const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json()};};
 const ok=async(path:string,body?:any,token='fixture-admin')=>{const r=await call(path,body,token);assert.ok(r.status>=200&&r.status<300,JSON.stringify(r));return r.data;};
 try{
  const cfg=await ok('/v1/shipping/config');assert.equal(cfg.provider,'jubelio');assert.equal(cfg.rateLookupEnabled,true);assert.equal(cfg.bookingEnabled,false);assert.equal(cfg.paymentEnabled,false);assert.ok(!JSON.stringify(cfg).includes('fixture-only'));
  assert.equal((await call('/v1/shipping/regions?q=40115',undefined,'')).status,401);
  assert.equal((await call('/v1/shipping/connection',undefined,'fixture-buyer')).status,403);
  const lookups=await ok('/v1/admin/catalog/lookups'),warehouse=lookups.warehouses.find((w:any)=>w.is_active&&!w.is_system_hold),category=lookups.categories.find((c:any)=>c.slug==='other');
  const png=await sharp({create:{width:96,height:96,channels:3,background:'#7842b8'}}).png().toBuffer();
  const asset=await ok('/v1/admin/media',{filename:'jubelio-fixture.png',mimeType:'image/png',base64:png.toString('base64')});
  const product={name:'Travel Pouch Shipping Test',slug:'travel-pouch-shipping-test',sku:'SHIP-TEST-POUCH',description:'Travel pouch for everyday accessories.',categoryIds:[category.id],brand_id:null,fulfillment_owner_brand_id:null,image_url:'/api/media/'+asset.id,gallery_urls:[],price_idr:100000,sale_price_idr:null,sale_starts_at:null,sale_ends_at:null,weight_grams:250,length_cm:20,width_cm:12,height_cm:4,product_type:'simple',attributes:[]};
  const saved=await ok('/v1/admin/catalog/products',{requestKey:randomUUID(),product,variants:[],warehouseStocks:[{warehouseId:warehouse.id,onHand:10,expectedOnHand:0,expectedReserved:0,notes:''}]});
  await ok('/v1/admin/catalog/products/'+saved.product.id+'/state',{expectedVersion:saved.product.edit_version,active:true});
  const carrierList=await ok('/v1/admin/shipping/couriers');
  assert.equal(carrierList.configured,false);
  assert.deepEqual(carrierList.available.map((x:any)=>x.code),['24','31']);
  assert.deepEqual(carrierList.availableServices.map((x:any)=>x.key).sort(),['24:2453','24:2454','31:3101']);
  assert.equal((await call('/v1/admin/shipping/couriers',undefined,'fixture-buyer')).status,403);
  const patchCouriers=async(selectedServices:string[])=>{
   const response=await fetch(base+'/v1/admin/shipping/couriers',{method:'PATCH',headers:{authorization:'Bearer fixture-admin','content-type':'application/json'},body:JSON.stringify({selectedServices})});
   const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;
  };
  const carrierPrefs=await patchCouriers(['24:2453']);assert.equal(carrierPrefs.configured,true);
  assert.deepEqual(carrierPrefs.selectedServices,['24:2453']);
  const basket={items:[{productId:saved.product.id,quantity:2}],destinationPostalCode:'40115',destinationAreaId:region.areaId};
  const quote=await ok('/v1/shipping/rates',basket,'fixture-buyer');assert.equal(quote.rates.length,1);assert.equal(quote.rates[0].courierCode,'24');assert.equal(quote.rates[0].priceIdr,9800);assert.equal(quote.rates[0].insuranceIdr,300);assert.equal(quote.canBook,false);
  const draft={items:basket.items,name:'Fixture Buyer',phone:'081234567890',address:'Jalan Test Paket Nomor 46',city:region.city,province:region.province,postalCode:'40115',destinationAreaId:region.areaId,paymentMethod:'bank_transfer',shippingQuoteId:quote.rates[0].quoteId,idempotencyKey:randomUUID()};
  await patchCouriers(['31:3101']);
  assert.equal((await call('/v1/checkout/orders',draft,'fixture-buyer')).status,409,'a deactivated courier quote cannot create a new order');
  const sentral=await ok('/v1/shipping/rates',basket,'fixture-buyer');
  assert.equal(sentral.rates.length,1);assert.equal(sentral.rates[0].courierName,'Sentral Cargo');
  await patchCouriers(['24:2453']);
  assert.equal((await call('/v1/checkout/orders',draft,'fixture-other')).status,409,'another user cannot use the quote');
  assert.equal((await call('/v1/checkout/orders',{...draft,destinationAreaId:'3273091004'},'fixture-buyer')).status,409);
  assert.equal((await call('/v1/checkout/orders',{...draft,city:'Different City'},'fixture-buyer')).status,409);
  await db.query('UPDATE product.products SET height_cm=5 WHERE id=$1',[saved.product.id]);
  assert.equal((await call('/v1/checkout/orders',draft,'fixture-buyer')).status,409,'dimensions invalidate volumetric quote');
  await db.query('UPDATE product.products SET height_cm=4 WHERE id=$1',[saved.product.id]);
  const order=await ok('/v1/checkout/orders',draft,'fixture-buyer');assert.equal(order.totalIdr,209800);assert.equal(order.paymentStatus,'pending');
  const row=(await db.query('SELECT shipping_provider,shipping_fee_idr::int,payment_status FROM product.orders WHERE id=$1',[order.id])).rows[0];assert.equal(row.shipping_provider,'jubelio');assert.equal(row.shipping_fee_idr,9800);assert.equal(row.payment_status,'pending');
  const replay=await ok('/v1/checkout/orders',draft,'fixture-buyer');assert.equal(replay.id,order.id);
  const expired=await ok('/v1/shipping/rates',basket,'fixture-buyer');await db.query("UPDATE product.shipping_rate_quotes SET created_at=now()-interval '30 minutes',expires_at=now()-interval '1 minute' WHERE id=$1",[expired.rates[0].quoteId]);
  assert.equal((await call('/v1/checkout/orders',{...draft,shippingQuoteId:expired.rates[0].quoteId,idempotencyKey:randomUUID()},'fixture-buyer')).status,409);
  assert.equal((await call('/v1/shipping/rates',basket,'fixture-unverified')).status,403);
  assert.equal((await call('/v1/admin/courier/batches/'+randomUUID()+'/book',{})).status,503);
  assert.equal(Number((await db.query("SELECT count(*) n FROM product.shipments WHERE provider='jubelio'")).rows[0].n),0);
  assert.equal(externalCalls,3);console.log('JUBELIO_COURIER_VISIBILITY_AND_CHECKOUT_PASS');
 }finally{await app.close();}
});
