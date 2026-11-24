import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
const {createFixture}=require(resolve('../../scripts/cp39-fixture-server.cjs'));

test('admin category deletion and unpriced draft imports work safely over HTTP',async()=>{
 const {app,db,base}=await createFixture();
 const api='/v1/admin/catalog';
 const call=async(path:string,body?:any,method='POST',token='fixture-admin')=>{
  const result=await fetch(base+api+'/'+path,{method:body===undefined?'GET':method,
   headers:{authorization:'Bearer '+token,'content-type':'application/json'},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:result.status,data:await result.json()};
 };
 const ok=async(path:string,body?:any,method='POST')=>{
  const result=await call(path,body,method);
  assert.ok(result.status>=200&&result.status<300,JSON.stringify({path,...result}));
  return result.data;
 };
 const key='adrev-'+randomUUID().slice(0,8);
 try{
  const category=await ok('categories',{name:'Admin Revision Test',slug:key+'-unused',active:true,parentId:null,image_url:null,description:''});
  const wrong=await call('categories/'+category.id,{expectedVersion:category.edit_version+1,confirm:true},'DELETE');
  assert.equal(wrong.status,409,'must not delete stale category');
  assert.equal((await call('categories/'+category.id,{expectedVersion:category.edit_version,confirm:false},'DELETE')).status,400);
  assert.equal((await call('categories/'+category.id,{expectedVersion:category.edit_version,confirm:true},'DELETE','fixture-buyer')).status,403);
  const removed=await ok('categories/'+category.id,{expectedVersion:category.edit_version,confirm:true},'DELETE');
  assert.equal(removed.deleted,true);
  assert.ok(!(await ok('categories',undefined,'GET')).items.some((c:any)=>c.id===category.id));

  const linked=await ok('categories',{name:'Used Revision Test',slug:key+'-used',active:true,parentId:null,image_url:null,description:''});
  const product=await ok('products',{requestKey:randomUUID(),product:{
   name:'Admin Fixture Accessory',slug:key+'-product',sku:key.toUpperCase()+'-SKU',
   description:'Sample internal draft for category test',product_type:'simple',
   categoryIds:[linked.id],attributes:[],image_url:null,gallery_urls:[],price_idr:0,
   sale_price_idr:null,sale_starts_at:null,sale_ends_at:null,
   weight_grams:null,length_cm:null,width_cm:null,height_cm:null,
   brand_id:null,fulfillment_owner_brand_id:null
  },variants:[],warehouseStocks:[]});
  assert.equal(product.product.is_active,false);
  assert.equal((await call('categories/'+linked.id,{expectedVersion:linked.edit_version,confirm:true},'DELETE')).status,409);

  const csv=[
   'ID,Type,SKU,Name,Regular price,Parent,Attribute 1 name,Attribute 1 value(s)',
   'A,simple,'+key+'-A,Simple accessory,,,,',
   'B,variable,'+key+'-B,Variable accessory,,,Color,"Black, White"',
   'C,variation,'+key+'-C,Black accessory,,'+key+'-B,Color,Black'
  ].join('\n')+'\n';
  const sourceKey=key+'-import',body={csv,sourceKey,mode:'create'};
  const before=(await db.query('SELECT count(*)::int n FROM product.products')).rows[0].n;
  const preview=await ok('imports/preview',body);
  assert.equal(preview.summary.errors,0,JSON.stringify(preview.errors));
  assert.ok(preview.warnings.some((w:any)=>/Draft Rp0|Draft disimpan Rp0/.test(w.message)));
  assert.equal((await db.query('SELECT count(*)::int n FROM product.products')).rows[0].n,before);
  const applied=await ok('imports/'+preview.id+'/apply',{confirm:true});
  assert.equal(applied.report.productsCreated,2);
  assert.equal(applied.report.variantsCreated,1);
  const rows=(await db.query('SELECT sku,price_idr,is_active FROM product.products WHERE sku=ANY($1::text[])',[[key+'-A',key+'-B',key+'-C'].map(s=>s.toUpperCase())])).rows;
  assert.equal(rows.length,3);
  assert.ok(rows.every((p:any)=>Number(p.price_idr)===0));
  assert.ok(rows.every((p:any)=>p.is_active===false||p.sku.endsWith('-C')),'products remain private drafts');
  const root=(await db.query('SELECT id,edit_version FROM product.products WHERE sku=$1',[(key+'-A').toUpperCase()])).rows[0];
  const ready=await ok('products/bulk/preview',{items:[{id:root.id,expectedVersion:root.edit_version}]});
  assert.equal(ready.ready,0,'zero-price product cannot publish');
  assert.ok(ready.results[0].status==='blocked');
  console.log('ADMIN_REVISION_HTTP_PASS',{categoryDelete:true,categoryLinkedBlocked:true,unpricedImportDrafts:true,publishGate:true});
 }finally{await app.close();}
});
