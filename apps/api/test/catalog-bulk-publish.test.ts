import test from 'node:test';
import assert from 'node:assert/strict';
import {CatalogWorkspaceService,parseBulkPublishItems,BULK_PUBLISH_LIMIT} from '../src/catalog-workspace';
import type {DatabaseService} from '../src/database';

const A='11111111-2222-4333-8444-000000000001';
const B='11111111-2222-4333-8444-000000000002';
const actor={id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',emailVerified:true} as any;
const images=['https://images.example.com/a.webp','https://images.example.com/b.webp','https://images.example.com/c.webp'];
const makeProduct=(id:string,override:Record<string,unknown>={})=>({
 id,name:'Accessory Charger',slug:'accessory-charger-'+id.slice(-1),sku:'ACC-'+id.slice(-4),
 description:'Aksesori untuk penggunaan sehari-hari.',product_type:'simple',
 is_active:false,archived_at:null,parent_product_id:null,edit_version:3,
 category:'accessories',brand_id:null,fulfillment_owner_brand_id:null,
 image_url:images[0],gallery_urls:images.slice(1),price_idr:65000,
 weight_grams:150,length_cm:12,width_cm:7,height_cm:4,...override
});
function store(products:Record<string,any>,warehouse=true){
 const logs:string[]=[];
 const query=async(sql:string,args:any[]=[]):Promise<{rows:any[]}>=>{
  if(sql.includes('pg_advisory_xact_lock'))return {rows:[]};
  if(sql.includes('FROM product.products WHERE id=$1 AND parent_product_id IS NULL')){
   const row=products[args[0]];
   return {rows:row?[{...row}]:[]};
  }
  if(sql.startsWith('WITH RECURSIVE ancestors'))return {rows:[{n:1,ok:true}]};
  if(sql.includes('FROM product.warehouse_stock s JOIN product.warehouses w')&&sql.includes('LIMIT 1'))
   return {rows:warehouse?[{ok:1}]:[]};
  if(sql.includes('UPDATE product.products SET is_active=')){
   const row=products[args[0]];
   if(!row)throw new Error('missing row');
   row.is_active=args[1];row.edit_version++;
   return {rows:[{...row}]};
  }
  if(sql.includes('INSERT INTO product.master_data_audit')){
   logs.push('publish-audit');return {rows:[]};
  }
  if(sql.includes('SELECT p.*,p.price_idr::int AS price_idr')){
   const row=products[args[0]];
   return {rows:row?[{...row,category_ids:[]}]:[]};
  }
  if(sql.includes('SELECT *,price_idr::int AS price_idr'))return {rows:[]};
  if(sql.includes('SELECT s.product_id,s.warehouse_id,s.on_hand,s.reserved'))return {rows:[]};
  throw new Error('Unmocked SQL query: '+sql.slice(0,120));
 };
 const db={query,transaction:async<T>(fn:(client:any)=>Promise<T>)=>fn({query})} as unknown as DatabaseService;
 return {service:new CatalogWorkspaceService(db),logs};
}
test('bulk inputs are versioned, bounded, unique, and strict',()=>{
 assert.equal(parseBulkPublishItems({items:[{id:A,expectedVersion:3}]}).length,1);
 assert.throws(()=>parseBulkPublishItems({items:[]}),/1 sampai 50/);
 assert.throws(()=>parseBulkPublishItems({items:[{id:A,expectedVersion:3},{id:A,expectedVersion:3}]}),/ganda/);
 assert.throws(()=>parseBulkPublishItems({items:[{id:A,expectedVersion:0}]}));
 assert.throws(()=>parseBulkPublishItems({items:[{id:A,expectedVersion:3,active:true}]}));
 const many=Array.from({length:BULK_PUBLISH_LIMIT+1},(_,i)=>({id:'11111111-2222-4333-8444-'+i.toString(16).padStart(12,'0'),expectedVersion:3}));
 assert.throws(()=>parseBulkPublishItems({items:many}),/50/);
});

test('preview never writes and reports incomplete draft without blocking valid products',async()=>{
 const data={[A]:makeProduct(A),[B]:makeProduct(B,{height_cm:null})};
 const {service,logs}=store(data);
 const result=await service.bulkPreview(actor,{items:[{id:A,expectedVersion:3},{id:B,expectedVersion:3}]});
 assert.equal(result.ready,1);assert.equal(result.blocked,1);
 assert.deepEqual(result.results.map(x=>x.status),['ready','blocked']);
 assert.match(result.results[1].message||'',/height_cm/);
 assert.equal(data[A].is_active,false);
 assert.deepEqual(logs,[]);
 const stale=await service.bulkPreview(actor,{items:[{id:A,expectedVersion:2}]});
 assert.equal(stale.ready,0);assert.match(stale.results[0].message||'',/operator lain/);
});

test('bulk publish uses audited state transitions and keeps invalid draft private',async()=>{
 const data={[A]:makeProduct(A),[B]:makeProduct(B,{gallery_urls:[images[1]]})};
 const {service,logs}=store(data);
 const result=await service.bulkPublish(actor,{items:[{id:A,expectedVersion:3},{id:B,expectedVersion:3}]});
 assert.equal(result.published,1);assert.equal(result.failed,1);
 assert.deepEqual(result.results.map(x=>x.status),['published','failed']);
 assert.equal(data[A].is_active,true);assert.equal(data[B].is_active,false);
 assert.equal(data[A].edit_version,4);assert.equal(data[B].edit_version,3);
 assert.deepEqual(logs,['publish-audit']);
 const repeat=await service.bulkPublish(actor,{items:[{id:A,expectedVersion:3}]});
 assert.equal(repeat.published,0);assert.equal(repeat.failed,1);
 assert.equal(logs.length,1,'repeat click must not double-publish or audit');
});

test('authorization and category/gudang gates are preserved',async()=>{
 const data={[A]:makeProduct(A)};
 const {service}=store(data,false);
 await assert.rejects(()=>service.bulkPreview({...actor,emailVerified:false},{items:[{id:A,expectedVersion:3}]}));
 await assert.rejects(()=>service.bulkPublish({...actor,emailVerified:false},{items:[{id:A,expectedVersion:3}]}));
 const report=await service.bulkPreview(actor,{items:[{id:A,expectedVersion:3}]});
 assert.equal(report.ready,0);
 assert.match(report.results[0].message||'',/verified_warehouse/);
 const applied=await service.bulkPublish(actor,{items:[{id:A,expectedVersion:3}]});
 assert.equal(applied.published,0);assert.equal(data[A].is_active,false);
});
