import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {CatalogWorkspaceService,assertPublishable} from '../src/catalog-workspace';
import {ProductsService} from '../src/products';
import {DatabaseService} from '../src/database';
import type {Principal} from '../src/auth';

// Unit-only repository double. This is not a PostgreSQL or live HTTP test.
const actor:Principal={id:'40000000-0000-4000-8000-000000000001',email:'draft-test@example.invalid',emailVerified:true};
const category={id:'40000000-0000-4000-8000-000000000002',slug:'accessories',is_active:true};
const productId='40000000-0000-4000-8000-000000000003';
const input=()=>({name:'Tas aksesori',slug:'tas-aksesori',sku:'ACC-TEST',description:'Catatan internal: bukan produk vape.',categoryIds:[category.id],brand_id:null,fulfillment_owner_brand_id:null,image_url:null,gallery_urls:[],price_idr:0,sale_price_idr:null,sale_starts_at:null,sale_ends_at:null,weight_grams:null,length_cm:null,width_cm:null,height_cm:null,product_type:'simple',attributes:[]});
function repository(seed:any=null){
 const state={row:seed?structuredClone(seed):null as any,writes:[] as string[],calls:[] as string[]};
 const client={query:async(sql:string,values:any[]=[])=>{
  const s=sql.trim();state.calls.push(s);
  if(s.startsWith('SELECT pg_advisory_xact_lock'))return {rows:[]};
  if(s.startsWith('SELECT request_hash,response'))return {rows:[]};
  if(s.startsWith('SELECT id,slug,is_active FROM product.categories'))return {rows:[category]};
  if(s.startsWith('INSERT INTO product.products(')){
   const cols=s.match(/^INSERT INTO product.products\(([^)]+)\)/)![1].split(',');
   state.row={id:productId,edit_version:1,archived_at:null};
   cols.forEach((col,i)=>state.row[col]=col==='stock_qty'?0:values[i]);
   for(const key of ['attributes','option_values'])if(typeof state.row[key]==='string')state.row[key]=JSON.parse(state.row[key]);
   state.writes.push(s);return {rows:[structuredClone(state.row)]};
  }
  if(s.startsWith('UPDATE product.products SET stock_qty=COALESCE')){state.writes.push(s);return {rows:[]};}
  if(s.startsWith('UPDATE product.products SET sku=$2')){
   Object.assign(state.row,{sku:values[1],price_idr:values[2],sale_price_idr:values[3],sale_starts_at:values[4],sale_ends_at:values[5],edit_version:state.row.edit_version+1});
   state.writes.push(s);return {rows:[structuredClone(state.row)]};
  }
  if(s.startsWith('SELECT p.*,p.price_idr'))return {rows:[structuredClone(state.row)]};
  if(s.startsWith('SELECT *,price_idr::int AS price_idr,sale_price_idr::int AS sale_price_idr FROM product.products WHERE parent_product_id'))return {rows:[]};
  if(s.startsWith('SELECT s.product_id,s.warehouse_id'))return {rows:[]};
  if(s.startsWith('SELECT * FROM product.products WHERE id=')||s.startsWith('SELECT *,price_idr::integer AS price_idr FROM product.products WHERE id='))return {rows:state.row?[structuredClone(state.row)]:[]};
  if(/^INSERT INTO product\.(master_data_audit|catalog_audit|catalog_requests|product_categories)/.test(s)||s.startsWith('DELETE FROM product.product_categories')){state.writes.push(s);return {rows:[]};}
  throw Error('Unexpected query in unit repository: '+s);
 }};
 const db={...client,transaction:async(fn:any)=>{const before=structuredClone(state.row);try{return await fn(client);}catch(e){state.row=before;throw e;}}} as unknown as DatabaseService;
 return {state,db};
}
const payload=(product:any)=>({requestKey:randomUUID(),product,warehouseStocks:[],variants:[]});
const restricted=(e:any)=>e?.getStatus?.()===400&&/Konten/.test(e.message);

test('private draft retains review-keyword text and zero price without publishing',async()=>{
 const {db,state}=repository();const result=await new CatalogWorkspaceService(db).save(actor,null,payload(input()));
 assert.equal(result.product.description,input().description);assert.equal(result.product.price_idr,0);assert.equal(result.product.is_active,false);assert.equal(state.row.is_active,false);
 assert.ok(!state.calls.some(s=>s.includes('SET is_active=$2')));
});

test('private draft quick edit accepts unreviewed SKU while preserving draft state',async()=>{
 const seed={...input(),id:productId,edit_version:1,is_active:false,parent_product_id:null};const {db,state}=repository(seed);
 const result=await new CatalogWorkspaceService(db).quick(actor,productId,{expectedVersion:1,sku:'ACC-VAPE-NOTE',price_idr:0,warehouseStocks:[]});
 assert.equal(result.product.sku,'ACC-VAPE-NOTE');assert.equal(state.row.is_active,false);
});

test('private draft cannot bypass publication through any stored descriptive field',async()=>{
 for(const key of ['name','description','slug','sku','attributes','option_values']){
  let queries=0;const reader={query:async()=>{queries++;throw Error('Publication guard must execute before database readiness checks');}};
  const p:any={...input(),description:'Tas kain biasa',attributes:[],option_values:{},[key]:key==='attributes'?[{name:'note',values:['vape']}]:key==='option_values'?{note:'vape'}:'vape'};
  await assert.rejects(()=>assertPublishable(reader,p),restricted);assert.equal(queries,0);
 }
});

test('variable parent publication checks parent text before examining enabled variants',async()=>{
 const seed={...input(),id:productId,edit_version:1,is_active:false,product_type:'variable'};const {db,state}=repository(seed);
 await assert.rejects(()=>new CatalogWorkspaceService(db).state(actor,productId,{expectedVersion:1,active:true}),restricted);
 assert.equal(state.row.is_active,false);assert.equal(state.writes.length,0);
});

test('an active product cannot receive unreviewed text through family save',async()=>{
 const seed={...input(),description:'Tas kain biasa',id:productId,edit_version:1,is_active:true};const {db,state}=repository(seed);
 await assert.rejects(()=>new CatalogWorkspaceService(db).save(actor,productId,{...payload(input()),expectedVersion:1}),restricted);
 assert.equal(state.row.description,'Tas kain biasa');assert.equal(state.writes.length,0);
});

test('legacy activation-only requests cannot publish restricted text saved by the new draft editor',async()=>{
 const seed={...input(),id:productId,edit_version:1,is_active:false};const {db,state}=repository(seed);
 await assert.rejects(()=>new ProductsService(db).update(productId,{expected_version:1,is_active:true},actor),restricted);
 assert.equal(state.row.is_active,false);assert.equal(state.writes.length,0);
});

test('ordinary accessory publication still accepts complete validated data',async()=>{
 const p={...input(),id:productId,description:'Tas kain untuk aksesori perjalanan.',price_idr:100000,image_url:'https://example.invalid/bag.png',weight_grams:500,length_cm:20,width_cm:15,height_cm:10};
 const reader={query:async(sql:string)=>sql.includes('WITH RECURSIVE ancestors')?{rows:[{n:1,ok:true}]}:sql.includes('warehouse_stock')?{rows:[{exists:1}]}:Promise.reject(Error('Unexpected query'))};
 await assertPublishable(reader,p);
});

test('private draft flexibility does not remove SKU, price or actor validation',async()=>{
 for(const change of [{sku:'bad!code'},{price_idr:-1},{price_idr:0.5}]){
  const {db,state}=repository();await assert.rejects(()=>new CatalogWorkspaceService(db).save(actor,null,payload({...input(),...change})));assert.equal(state.row,null);
 }
 const {db}=repository();await assert.rejects(()=>new CatalogWorkspaceService(db).save({...actor,emailVerified:false},null,payload(input())),(e:any)=>e.getStatus()===403);
});
