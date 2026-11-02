import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseService} from '../../src/database';
import {AdminProductRecordsService} from '../../src/admin-product-records';
import {ProductsService} from '../../src/products';
import {allArchiveItems} from '../../../web/src/lib/archive-catalog';

test('sync every existing reference and its private photo without publishing or copying product data',async()=>{
 const url=new URL(process.env.DATABASE_URL||'http://invalid');
 if(!['localhost','127.0.0.1'].includes(url.hostname)||!url.pathname.endsWith('_test'))throw Error('Disposable localhost test DB required');
 const db=new DatabaseService(),records=new AdminProductRecordsService(db),publicProducts=new ProductsService(db);
 try{
  const before=await db.query("SELECT (SELECT count(*)::integer FROM product.products) AS products,(SELECT count(*)::integer FROM product.legacy_archive) AS existing,(SELECT count(*)::integer FROM product.brands) AS brands,(SELECT count(*)::integer FROM product.warehouse_stock_events) AS movements");
  const result=await records.list({source:'existing',pageSize:'100'});
  assert.equal(result.items.length,19);assert.equal(result.summary.existing,allArchiveItems.length);
  assert.equal(result.summary.existing_media_linked,19);assert.equal(result.summary.existing_media_missing,0);
  assert.equal(result.summary.existing_brands,5);assert.equal(result.fullWooCommerceExportVerified,false);
  const map=new Map(allArchiveItems.map(x=>[x.slug,x]));
  for(const row of result.items){
   const original=map.get(String(row.slug));assert.ok(original);
   assert.equal(row.name,original.name);assert.equal(row.brand,original.brand);assert.equal(row.category,original.category);
   assert.equal(row.historical_price,original.price);assert.equal(row.original_path,original.image);
   assert.equal(row.read_only,true);assert.equal(row.is_active,false);assert.equal(row.sku,null);
   assert.equal(row.stock_qty,null);assert.equal(row.price_idr,null);assert.equal(row.product_id,null);assert.equal(row.product,null);
   assert.ok(typeof row.media_id==='string');
   const media=await db.query('SELECT original_path,visibility FROM content.media_library_assets WHERE id=$1',[row.media_id]);
   assert.equal(media.rows[0].original_path,'apps/web/public'+original.image);assert.equal(media.rows[0].visibility,'internal');
   await assert.rejects(()=>publicProducts.bySlug(String(row.slug)),/Product not found/);
  }
  const identifiers:string[]=[];
  for(let page=1;page<=3;page++){
   const part=await records.list({source:'existing',pageSize:'7',page:String(page)});
   identifiers.push(...part.items.map(x=>String(x.record_id)));assert.equal(part.matched,19);
  }
  assert.equal(new Set(identifiers).size,19);
  assert.equal((await records.list({q:'EMKAY'})).matched,4);
  assert.equal((await records.list({category:'cartridge'})).matched,2);
  assert.equal((await records.list({brand:'SP2S',source:'existing'})).matched,7);
  assert.equal((await records.list({q:"'; DROP TABLE product.products; --"})).matched,0);
  for(let i=0;i<3;i++)assert.equal((await records.list({source:'existing'})).items.length,19);
  const after=await db.query("SELECT (SELECT count(*)::integer FROM product.products) AS products,(SELECT count(*)::integer FROM product.legacy_archive) AS existing,(SELECT count(*)::integer FROM product.brands) AS brands,(SELECT count(*)::integer FROM product.warehouse_stock_events) AS movements");
  assert.deepEqual(after.rows,before.rows,'sync only reads; no new products, brands, stock or reference duplicates');
  // Fixtures only in the ephemeral CI database. Verify pagination is not limited to old 150-row admin list.
  await db.query("INSERT INTO product.products(slug,name,category,price_idr,stock_qty,is_active) SELECT 'qa-office-'||g,'QA Office Supply '||g,'home',10000,0,false FROM generate_series(1,151) g");
  const first=await records.list({source:'managed',pageSize:'100'}),second=await records.list({source:'managed',pageSize:'100',page:'2'});
  assert.equal(first.items.length,100);assert.equal(second.items.length,51);assert.equal(first.hasMore,true);assert.equal(second.hasMore,false);
  assert.equal(first.summary.total,170);assert.equal(first.summary.existing,19);
  assert.equal(new Set([...first.items,...second.items].map(x=>x.record_id)).size,151);
  assert.ok(first.items.every(x=>x.read_only===false&&x.product!==null&&x.stock_qty===0));
  const missing=result.items[0].media_id;
  await db.query("UPDATE content.media_library_assets SET kind='article_image' WHERE id=$1",[missing]);
  const unmatched=await records.list({source:'existing'});
  assert.equal(unmatched.summary.existing_media_missing,1);assert.equal(unmatched.summary.existing_media_linked,18);
  assert.ok(unmatched.items.some(x=>x.media_id===null&&(x.missing_fields as string[]).includes('photo')));
  console.log('VAPMART_EXISTING_RECORDS_INTEGRATION_PASS',JSON.stringify({existing:19,linked:19,brands:5,managedPagination:151,mutationsDuringSync:0}));
 }finally{await db.onModuleDestroy();}
});
