import test from 'node:test';
import assert from 'node:assert/strict';
import {CatalogWorkspaceService} from '../src/catalog-workspace';
import type {DatabaseService} from '../src/database';
import {suggestImportMapping} from '../../web/src/lib/catalog-import-mapping';
import {publicationHints} from '../../web/src/lib/catalog-publish-hints';

const categoryId='11111111-2222-4333-8444-000000000004';
const defaultId='11111111-2222-4333-8444-000000000005';
const actor={id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',emailVerified:true} as any;

function createCategoryStore(options:{isDefault?:boolean;promotions?:number;failFK?:boolean}={}){
 const queries:string[]=[];
 const category={id:categoryId,slug:options.isDefault?'accessories':'accessories-qa',name:options.isDefault?'Accessories':'Accessories QA',edit_version:2,is_active:true,parent_id:null};
 const query=async(sql:string,values:any[]=[]):Promise<{rows:any[]}>=>{
  queries.push(sql.trim().slice(0,90));
  if(sql.includes('pg_advisory_xact_lock'))return {rows:[]};
  if(sql.includes('SELECT * FROM product.categories WHERE id=$1 FOR UPDATE'))return {rows:[category]};
  if(sql.includes('SELECT * FROM product.categories WHERE slug=$1 FOR UPDATE'))return {rows:[{id:defaultId,slug:'accessories',name:'Accessories',is_active:true,parent_id:null}]};
  if(sql.includes('SELECT count(*)::int n FROM promotion.event_categories'))return {rows:[{n:options.promotions??0}]};
  if(sql.includes('FROM product.products p WHERE p.category=$2'))return {rows:[]};
  if(sql.includes('SELECT * FROM product.categories WHERE parent_id=$1'))return {rows:[]};
  if(sql.includes('DELETE FROM product.categories WHERE id=$1')){
   if(options.failFK)throw Object.assign(new Error('FK'),{code:'23503'});
   return {rows:[]};
  }
  if(sql.includes('INSERT INTO product.catalog_audit'))return {rows:[]};
  throw Error('Unexpected database query '+sql.slice(0,110));
 };
 const db={query,transaction:async<T>(fn:(client:any)=>Promise<T>)=>fn({query})} as unknown as DatabaseService;
 return {service:new CatalogWorkspaceService(db),queries,category};
}
test('empty category deletion is versioned, authorized and audited',async()=>{
 const {service,queries}=createCategoryStore();
 const result=await service.categoryDelete(actor,categoryId,{expectedVersion:2,confirm:true});
 assert.equal(result.deleted,true);
 assert.equal(result.defaultCategoryId,defaultId);
 assert.equal(result.movedProducts,0);
 assert.equal(result.movedSubcategories,0);
 assert.ok(queries.some(q=>q.startsWith('DELETE FROM product.categories')));
 assert.ok(queries.some(q=>q.startsWith('INSERT INTO product.catalog_audit')));
});
test('Accessories cannot be deleted or archived, even when empty',async()=>{
 const {service,queries}=createCategoryStore({isDefault:true});
 await assert.rejects(()=>service.categoryDelete(actor,categoryId,{expectedVersion:2,confirm:true}),/kategori default/);
 await assert.rejects(()=>service.categoryArchive(actor,categoryId,{expectedVersion:2,confirm:true}),/kategori default/);
 assert.ok(!queries.some(q=>q.startsWith('DELETE FROM product.categories')));
});
test('Accessories identity cannot be changed to bypass default protection',async()=>{
 const {service,category}=createCategoryStore({isDefault:true});
 const body={name:category.name,slug:category.slug,active:true,parentId:null,image_url:null,description:'Updated content',expectedVersion:2};
 for(const edit of [{name:'Other name'},{slug:'renamed-default'},{active:false},{parentId:defaultId}]){
  await assert.rejects(()=>service.categorySave(actor,categoryId,{...body,...edit}),/kategori default/);
 }
});
test('category deletion explains linked promotion rather than expanding discount scope',async()=>{
 const {service,queries}=createCategoryStore({promotions:2});
 await assert.rejects(()=>service.categoryDelete(actor,categoryId,{expectedVersion:2,confirm:true}),/2 promosi/);
 assert.ok(!queries.some(q=>q.startsWith('DELETE FROM product.categories')));
});
test('category deletion requires confirmation, correct version and authenticated actor',async()=>{
 const {service,queries}=createCategoryStore();
 await assert.rejects(()=>service.categoryDelete(actor,categoryId,{expectedVersion:2,confirm:false}),/Konfirmasi/);
 await assert.rejects(()=>service.categoryDelete(actor,categoryId,{expectedVersion:1,confirm:true}));
 await assert.rejects(()=>service.categoryDelete({...actor,emailVerified:false},categoryId,{expectedVersion:2,confirm:true}));
 assert.ok(!queries.some(q=>q.startsWith('DELETE FROM product.categories')));
});
test('unknown database FK references still block deletion without losing safety',async()=>{
 const {service}=createCategoryStore({failFK:true});
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
