import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
const {createFixture}=require(resolve('../../scripts/cp39-fixture-server.cjs'));

test('draft type conversion preserves IDs, versions and stock through the real admin API',async()=>{
 const {app,db,base}=await createFixture();
 const api='/v1/admin/catalog/';
 const call=async(path:string,body?:any,method='POST',token='fixture-admin')=>{
  const result=await fetch(base+api+path,{method:body===undefined?'GET':method,
   headers:{authorization:'Bearer '+token,'content-type':'application/json'},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:result.status,data:await result.json()};
 };
 const ok=async(path:string,body?:any,method='POST')=>{
  const result=await call(path,body,method);
  assert.ok(result.status>=200&&result.status<300,JSON.stringify({path,...result}));
  return result.data;
 };
 const key='type-'+randomUUID().slice(0,8);
 try{
  const lookups=await ok('lookups');
  const category=lookups.categories.find((c:any)=>c.slug==='accessories');
  const warehouse=lookups.warehouses.find((w:any)=>w.code==='CP39-A');
  assert.ok(category&&warehouse);
  const product={name:'Type Conversion Fixture',slug:key,sku:key.toUpperCase(),
   description:'Isolated test of safe draft editing',product_type:'simple',categoryIds:[category.id],attributes:[],
   image_url:null,gallery_urls:[],price_idr:0,sale_price_idr:null,sale_starts_at:null,sale_ends_at:null,
   weight_grams:null,length_cm:null,width_cm:null,height_cm:null,brand_id:null,fulfillment_owner_brand_id:null};
  const create=(suffix:string,warehouseStocks:any[]=[])=>ok('products',{
   requestKey:randomUUID(),product:{...product,slug:key+suffix,sku:(key+suffix).toUpperCase()},variants:[],warehouseStocks});
  let draft=await create('');
  const id=draft.product.id;
  const variable={...product,product_type:'variable',attributes:[{name:'Warna',values:['Ungu']}]};
  const conversion={requestKey:randomUUID(),expectedVersion:draft.product.edit_version,product:variable,variants:[],warehouseStocks:[]};
  const unauthorized=await call('products/'+id,conversion,'PATCH','fixture-buyer');
  assert.equal(unauthorized.status,403);
  draft=await ok('products/'+id,conversion,'PATCH');
  assert.equal(draft.product.id,id);
  assert.equal(draft.product.sku,product.sku);
  assert.equal(draft.product.product_type,'variable');
  assert.equal(draft.product.is_active,false);
  assert.equal((await ok('products/'+id,conversion,'PATCH')).replayed,true);
  assert.equal((await call('products/'+id,{...conversion,requestKey:randomUUID()},'PATCH')).status,409);
  draft=await ok('products/'+id,{requestKey:randomUUID(),expectedVersion:draft.product.edit_version,product,variants:[],warehouseStocks:[]},'PATCH');
  assert.equal(draft.product.id,id);
  assert.equal(draft.product.product_type,'simple');
  assert.deepEqual(draft.product.attributes,[]);
  const audit=(await db.query("SELECT before_data->>'product_type' previous,after_data->>'product_type' next FROM product.catalog_audit WHERE entity_type='product' AND entity_id=$1 AND action='save_family' ORDER BY id DESC LIMIT 1",[id])).rows[0];
  assert.deepEqual(audit,{previous:'variable',next:'simple'});

  draft=await ok('products/'+id,{requestKey:randomUUID(),expectedVersion:draft.product.edit_version,product:variable,
   variants:[{sku:key.toUpperCase()+'-UNGU',price_idr:0,sale_price_idr:null,sale_starts_at:null,sale_ends_at:null,option_values:{Warna:'Ungu'},enabled:true,warehouseStocks:[]}],warehouseStocks:[]},'PATCH');
  const variantId=draft.variants[0].id,version=draft.product.edit_version;
  const blocked=await call('products/'+id,{requestKey:randomUUID(),expectedVersion:version,product,variants:[],warehouseStocks:[]},'PATCH');
  assert.equal(blocked.status,409);
  assert.match(blocked.data.message,/SKU varian tersimpan/);
  const unchanged=await ok('products/'+id);
  assert.equal(unchanged.variants[0].id,variantId,'saved variants must never be discarded by type conversion');
  assert.equal(unchanged.product.edit_version,version);

  const stocked=await create('-stock',[{warehouseId:warehouse.id,onHand:3,expectedOnHand:0,expectedReserved:0,notes:'Fixture physical count'}]);
  const stockAttempt=await call('products/'+stocked.product.id,{requestKey:randomUUID(),expectedVersion:stocked.product.edit_version,
   product:{...variable,slug:stocked.product.slug,sku:stocked.product.sku},variants:[],warehouseStocks:[]},'PATCH');
  assert.equal(stockAttempt.status,409);
  assert.match(stockAttempt.data.message,/stok atau reservasi/);
  const remaining=await ok('products/'+stocked.product.id);
  assert.equal(remaining.product.product_type,'simple');
  assert.equal(remaining.product.edit_version,stocked.product.edit_version);
  assert.equal(remaining.stock.find((s:any)=>s.warehouse_id===warehouse.id).on_hand,3);
  console.log('CATALOG_PRODUCT_TYPE_HTTP_PASS',{draftConversion:true,preservedIds:true,versioning:true,audit:true,stockProtected:true,variantsProtected:true,productionWrites:false});
 }finally{await app.close();}
});
