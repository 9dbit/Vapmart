import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import sharp from 'sharp';
const {createFixture}=require(resolve('../../scripts/cp39-fixture-server.cjs'));

test('CP40 private drafts persist, remain private, and require publication validation',async()=>{
 const {app,db,base}=await createFixture();
 const api='/v1/admin/catalog';
 const call=async(path:string,body?:any,method='POST',token='fixture-admin')=>{
  const r=await fetch(base+path,{method:body===undefined?'GET':method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
  return {status:r.status,data:await r.json().catch(()=>null)};
 };
 const ok=async(path:string,body?:any,method='POST')=>{const r=await call(path,body,method);assert.ok(r.status>=200&&r.status<300,JSON.stringify({path,...r}));return r.data;};
 try{
  const l=await ok(api+'/lookups'),cat=l.categories.find((c:any)=>c.slug==='accessories'),wh=l.warehouses.find((w:any)=>w.code==='CP39-A');assert.ok(cat&&wh);
  const png=await sharp({create:{width:128,height:128,channels:3,background:'#7050a0'}}).png().toBuffer();
  const asset=await ok('/v1/admin/media',{filename:'accessory-test.png',mimeType:'image/png',base64:png.toString('base64')});
  const product={name:'Tas aksesori CP40',slug:'tas-aksesori-cp40',sku:'CP40-BAG',description:'Catatan internal: bukan produk vape.',product_type:'simple',attributes:[],categoryIds:[cat.id],brand_id:null,fulfillment_owner_brand_id:null,image_url:'/api/media/'+asset.id,gallery_urls:[],price_idr:0,sale_price_idr:null,sale_starts_at:null,sale_ends_at:null,weight_grams:100,length_cm:20,width_cm:10,height_cm:5};
  const create={requestKey:randomUUID(),product,variants:[],warehouseStocks:[{warehouseId:wh.id,onHand:2,expectedOnHand:0,expectedReserved:0,notes:'Disposable accessory fixture count'}]};
  assert.equal((await call(api+'/products',create,'POST','invalid')).status,401);
  assert.equal((await call(api+'/products',create,'POST','fixture-buyer')).status,403);
  let d=await ok(api+'/products',create);const id=d.product.id;
  assert.equal(d.product.price_idr,0);assert.equal(d.product.is_active,false);assert.equal(d.product.description,product.description);
  const replay=await ok(api+'/products',create);assert.equal(replay.replayed,true);assert.equal(replay.product.id,id);
  d=await ok(api+'/products/'+id);assert.equal(d.product.description,product.description);
  assert.equal((await call('/v1/products/'+product.slug)).status,404);
  assert.deepEqual((await ok('/v1/catalog/selection?ids='+id)).items,[]);
  assert.ok((await call('/v1/checkout/quote',{items:[{productId:id,quantity:1}]})).status>=400);
  d=await ok(api+'/products/'+id+'/quick',{expectedVersion:d.product.edit_version,sku:'CP40-VAPE-NOTE',price_idr:0,warehouseStocks:[]});
  assert.equal(d.product.is_active,false);assert.equal(d.product.sku,'CP40-VAPE-NOTE');
  const deniedVersion=d.product.edit_version;
  assert.equal((await call(api+'/products/'+id+'/state',{expectedVersion:deniedVersion,active:true})).status,400);
  assert.equal((await call('/v1/admin/products/'+id,{expected_version:deniedVersion,is_active:true},'PATCH')).status,400);
  d=await ok(api+'/products/'+id);assert.equal(d.product.edit_version,deniedVersion);assert.equal(d.product.is_active,false);
  // A complete ordinary accessory still follows the normal publication path.
  const clean={...product,description:'Tas kain untuk menyimpan aksesori perjalanan.',price_idr:25000};
  d=await ok(api+'/products/'+id,{requestKey:randomUUID(),expectedVersion:d.product.edit_version,product:clean,variants:[],warehouseStocks:[]},'PATCH');
  d=await ok(api+'/products/'+id+'/state',{expectedVersion:d.product.edit_version,active:true});
  assert.equal(d.product.is_active,true);assert.equal((await ok('/v1/products/'+product.slug)).price_idr,25000);
  const activeVersion=d.product.edit_version;
  assert.equal((await call(api+'/products/'+id,{requestKey:randomUUID(),expectedVersion:activeVersion,product:{...clean,description:product.description},variants:[],warehouseStocks:[]},'PATCH')).status,400);
  assert.equal((await call(api+'/products/'+id+'/quick',{expectedVersion:activeVersion,sku:'CP40-VAPE-NOTE',price_idr:25000,warehouseStocks:[]})).status,400);
  d=await ok(api+'/products/'+id);assert.equal(d.product.edit_version,activeVersion);assert.equal(d.product.description,clean.description);assert.equal(d.product.sku,clean.sku);
  assert.equal(d.stock[0].reserved,0);assert.equal(d.product.stock_qty,2);
  // Deactivation restores a private workspace, not a purchasable free product.
  d=await ok(api+'/products/'+id+'/state',{expectedVersion:d.product.edit_version,active:false});
  d=await ok(api+'/products/'+id,{requestKey:randomUUID(),expectedVersion:d.product.edit_version,product,variants:[],warehouseStocks:[]},'PATCH');
  assert.equal(d.product.is_active,false);assert.equal(d.product.price_idr,0);assert.equal((await call('/v1/products/'+product.slug)).status,404);
  // Enabled variant flags cannot expose a child while the parent is a private draft.
  const root={...clean,name:'Tas variasi CP40',slug:'tas-variasi-cp40',sku:'CP40-ROOT',product_type:'variable',price_idr:0,attributes:[{name:'Label internal',values:['vape-note']}]};
  const variable=await ok(api+'/products',{requestKey:randomUUID(),product:root,warehouseStocks:[],variants:[{sku:'CP40-CHILD',price_idr:25000,sale_price_idr:null,option_values:{'Label internal':'vape-note'},enabled:true,warehouseStocks:[]}]});
  assert.equal(variable.product.is_active,false);assert.equal(variable.variants.length,1);
  assert.deepEqual((await ok('/v1/catalog/selection?ids='+variable.variants[0].id)).items,[]);
  assert.equal((await call('/v1/products/'+root.slug)).status,404);
  assert.equal((await call(api+'/products/'+variable.product.id+'/state',{expectedVersion:variable.product.edit_version,active:true})).status,400);
  const stored=(await db.query('SELECT is_active FROM product.products WHERE id=$1',[variable.product.id])).rows[0];assert.equal(stored.is_active,false);
  const flags=await ok('/v1/shipping/config');for(const key of ['paymentEnabled','bookingEnabled','rateLookupEnabled'])assert.equal(flags[key],false);
  console.log('CP40_HTTP_PASS',JSON.stringify({realLocalPostgres:true,privateDraftPersistence:true,zeroDraftPrice:true,idempotentReplay:true,anonymous401:true,customer403:true,privateSelection:true,legacyPublicationDenied:true,ordinaryAccessoryPublication:true,activeEditRollback:true,variantParentPrivacy:true,productionWrites:false}));
 }finally{await app.close();}
});
