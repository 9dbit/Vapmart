import test from 'node:test';
import assert from 'node:assert/strict';
import {CatalogWorkspaceService} from '../src/catalog-workspace';
import type {DatabaseService} from '../src/database';
import {suggestImportMapping} from '../../web/src/lib/catalog-import-mapping';
import {publicationHints} from '../../web/src/lib/catalog-publish-hints';

const categoryId='11111111-2222-4333-8444-000000000004';
const actor={id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',emailVerified:true} as any;

function createCategoryStore(used=false,failFK=false){
 const queries:string[]=[];
 const query=async(sql:string,values:any[]=[]):Promise<{rows:any[]}>=>{
  queries.push(sql.trim().slice(0,90));
  if(sql.includes('pg_advisory_xact_lock'))return {rows:[]};
  if(sql.includes('SELECT * FROM product.categories WHERE id=$1 FOR UPDATE'))
   return {rows:[{id:categoryId,slug:'accessories-qa',name:'Accessories QA',edit_version:2,is_active:true}]};
  if(sql.includes('SELECT 1 FROM product.product_categories WHERE category_id=$1'))
   return {rows:used?[{used:1}]:[]};
  if(sql.includes('DELETE FROM product.categories WHERE id=$1')){
   if(failFK)throw Object.assign(new Error('FK'),{code:'23503'});
   return {rows:[]};
  }
  if(sql.includes('INSERT INTO product.catalog_audit'))return {rows:[]};
  throw Error('Unexpected database query '+sql.slice(0,110));
 };
 const db={query,transaction:async<T>(fn:(client:any)=>Promise<T>)=>fn({query})} as unknown as DatabaseService;
 return {service:new CatalogWorkspaceService(db),queries};
}
test('empty category deletion is versioned, authorized and audited',async()=>{
 const {service,queries}=createCategoryStore();
 const result=await service.categoryDelete(actor,categoryId,{expectedVersion:2,confirm:true});
 assert.equal(result.deleted,true);
 assert.ok(queries.some(q=>q.startsWith('DELETE FROM product.categories')));
 assert.ok(queries.some(q=>q.startsWith('INSERT INTO product.catalog_audit')));
});
test('category deletion fails safely on assigned products, children or legacy links',async()=>{
 const {service,queries}=createCategoryStore(true);
 await assert.rejects(()=>service.categoryDelete(actor,categoryId,{expectedVersion:2,confirm:true}),/Pindahkan produk/);
 assert.ok(!queries.some(q=>q.startsWith('DELETE FROM product.categories')));
});
test('category deletion requires confirmation, correct version and authenticated actor',async()=>{
 const {service,queries}=createCategoryStore();
 await assert.rejects(()=>service.categoryDelete(actor,categoryId,{expectedVersion:2,confirm:false}),/Konfirmasi/);
 await assert.rejects(()=>service.categoryDelete(actor,categoryId,{expectedVersion:1,confirm:true}));
 await assert.rejects(()=>service.categoryDelete({...actor,emailVerified:false},categoryId,{expectedVersion:2,confirm:true}));
 assert.ok(!queries.some(q=>q.startsWith('DELETE FROM product.categories')));
});
test('database FK references block deletion without losing safety',async()=>{
 const {service}=createCategoryStore(false,true);
 await assert.rejects(()=>service.categoryDelete(actor,categoryId,{expectedVersion:2,confirm:true}),/direferensikan/);
});
test('CSV aliases map Indonesian headers without inventing unmapped fields',()=>{
 const fields={id:'ID',sku:'SKU',name:'Name',regularPrice:'Regular price',stock:'Stock',images:'Images',description:'Description',weight:'Weight (g)'};
 const headers=['Nama Produk','Kode Barang','Harga Jual','Stok','Link Gambar','Deskripsi','Berat'];
 const mapping=suggestImportMapping(headers,fields);
 assert.equal(mapping.name,'Nama Produk');
 assert.equal(mapping.sku,'Kode Barang');
 assert.equal(mapping.regularPrice,'Harga Jual');
 assert.equal(mapping.stock,'Stok');
 assert.equal(mapping.images,'Link Gambar');
 assert.equal(mapping.description,'Deskripsi');
 assert.equal(mapping.weight,'Berat');
 assert.equal(mapping.id,'');
 assert.equal(new Set(Object.values(mapping).filter(Boolean)).size,Object.values(mapping).filter(Boolean).length);
});
test('publish technical errors provide actionable Indonesian section anchors',()=>{
 const hints=publicationHints('Lengkapi price_idr, gallery_urls, height_cm, active_category, verified_warehouse');
 assert.ok(hints.some(x=>x.anchor==='#catalog-pricing'));
 assert.ok(hints.some(x=>x.anchor==='#catalog-images'));
 assert.ok(hints.some(x=>x.anchor==='#catalog-dimensions'));
 assert.ok(hints.some(x=>x.anchor==='#catalog-categories'));
 assert.ok(hints.some(x=>x.anchor==='#catalog-stock'));
});
