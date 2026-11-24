import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import sharp from 'sharp';
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

  const lookups=await ok('lookups');
  const fallback=lookups.categories.find((c:any)=>c.slug==='accessories');
  const other=lookups.categories.find((c:any)=>c.slug==='other');
  const warehouse=lookups.warehouses.find((w:any)=>w.code==='CP39-A');
  assert.ok(fallback?.is_default&&fallback.is_active&&!fallback.parent_id);
  assert.ok(other&&warehouse);
  assert.equal((await call('categories/'+fallback.id,{expectedVersion:fallback.edit_version,confirm:true},'DELETE')).status,409);
  assert.equal((await call('categories/'+fallback.id+'/archive',{expectedVersion:fallback.edit_version,confirm:true})).status,409);
  const fallbackBody={name:fallback.name,slug:fallback.slug,active:true,parentId:null,image_url:null,description:'',expectedVersion:fallback.edit_version};
  for(const patch of [{name:'Another name'},{slug:key+'-renamed'},{active:false},{parentId:other.id}]){
   assert.equal((await call('categories/'+fallback.id,{...fallbackBody,...patch},'PATCH')).status,409);
  }
  await assert.rejects(()=>db.query('DELETE FROM product.categories WHERE id=$1',[fallback.id]),(e:any)=>e.code==='23514');
  await assert.rejects(()=>db.query('UPDATE product.categories SET is_active=false WHERE id=$1',[fallback.id]),(e:any)=>e.code==='23514');
  const customized=await ok('categories/'+fallback.id,{...fallbackBody,description:'Default category for retained products'},'PATCH');
  assert.equal(customized.description,'Default category for retained products');

  const linked=await ok('categories',{name:'Used Revision Test',slug:key+'-used',active:true,parentId:other.id,image_url:null,description:''});
  const child=await ok('categories',{name:'Retained Child',slug:key+'-child',active:true,parentId:linked.id,image_url:null,description:''});
  const product=await ok('products',{requestKey:randomUUID(),product:{
   name:'Admin Fixture Accessory',slug:key+'-product',sku:key.toUpperCase()+'-SKU',
   description:'Sample internal draft for category test',product_type:'simple',
   categoryIds:[linked.id,other.id,fallback.id],attributes:[],image_url:null,gallery_urls:[],price_idr:0,
   sale_price_idr:null,sale_starts_at:null,sale_ends_at:null,
   weight_grams:null,length_cm:null,width_cm:null,height_cm:null,
   brand_id:null,fulfillment_owner_brand_id:null
  },variants:[],warehouseStocks:[]});
  assert.equal(product.product.is_active,false);
  // Use the editor's writable shape, not the server's metadata fields.
  const draft=(suffix:string,categoryIds:string[])=>({
   name:'Category Retention '+suffix,slug:key+'-'+suffix,sku:key.toUpperCase()+'-'+suffix.toUpperCase(),
   description:'Disposable category reassignment fixture',product_type:'simple',categoryIds,attributes:[],
   image_url:null,gallery_urls:[],price_idr:50000,sale_price_idr:null,sale_starts_at:null,sale_ends_at:null,
   weight_grams:100,length_cm:5,width_cm:5,height_cm:5,brand_id:null,fulfillment_owner_brand_id:null
  });
  const family=await ok('products',{requestKey:randomUUID(),product:{...draft('family',[linked.id]),product_type:'variable',price_idr:0,attributes:[{name:'Color',values:['Black']}]},warehouseStocks:[],variants:[{
   sku:key.toUpperCase()+'-BLACK',price_idr:55000,sale_price_idr:null,option_values:{Color:'Black'},enabled:true,
   warehouseStocks:[{warehouseId:warehouse.id,onHand:3,expectedOnHand:0,expectedReserved:0,notes:'Disposable category fixture'}]
  }]});
  const legacy=await ok('products',{requestKey:randomUUID(),product:draft('legacy',[linked.id]),variants:[],warehouseStocks:[]});
  await db.query('DELETE FROM product.product_categories WHERE product_id=$1',[legacy.product.id]);
  await db.query('UPDATE product.products SET archived_at=now() WHERE id=$1',[legacy.product.id]);
  const retainedChild=await ok('products',{requestKey:randomUUID(),product:draft('child-product',[child.id]),variants:[],warehouseStocks:[]});
  const affected=[product.product.id,family.product.id,family.variants[0].id,legacy.product.id];
  const invariant=async()=>({
   products:(await db.query('SELECT id,sku,price_idr,stock_qty,is_active,archived_at FROM product.products WHERE id=ANY($1::uuid[]) ORDER BY id',[affected])).rows,
   stock:(await db.query('SELECT product_id,warehouse_id,on_hand,reserved FROM product.warehouse_stock WHERE product_id=ANY($1::uuid[]) ORDER BY product_id,warehouse_id',[affected])).rows,
   events:(await db.query('SELECT count(*)::int n FROM product.warehouse_stock_events WHERE product_id=ANY($1::uuid[])',[affected])).rows[0].n
  });
  const beforeMove=await invariant();
  const promo=(await db.query("INSERT INTO promotion.events(slug,title,starts_at,ends_at,scope_mode) VALUES($1,'Category Guard',now(),now()+interval '1 day','categories') RETURNING id",[key+'-promo'])).rows[0];
  await db.query('INSERT INTO promotion.event_categories(event_id,category_id) VALUES($1,$2)',[promo.id,linked.id]);
  const blocked=await call('categories/'+linked.id,{expectedVersion:linked.edit_version,confirm:true},'DELETE');
  assert.equal(blocked.status,409);
  assert.match(blocked.data.message,/1 promosi/);
  assert.deepEqual(await invariant(),beforeMove);
  await db.query('DELETE FROM promotion.event_categories WHERE event_id=$1',[promo.id]);

  // A late FK rejection must roll back transfers, versions and child reparenting together.
  const guard='product.category_delete_guard_'+key.replaceAll('-','_');
  const versions=()=>db.query('SELECT id,category,edit_version FROM product.products WHERE id=ANY($1::uuid[]) ORDER BY id',[affected]);
  const beforeVersions=(await versions()).rows;
  await db.query('CREATE TABLE '+guard+' (category_id uuid REFERENCES product.categories(id))');
  try{
   await db.query('INSERT INTO '+guard+' VALUES($1)',[linked.id]);
   const rejected=await call('categories/'+linked.id,{expectedVersion:linked.edit_version,confirm:true},'DELETE');
   assert.equal(rejected.status,409);
   assert.deepEqual((await versions()).rows,beforeVersions);
   assert.equal((await db.query('SELECT parent_id FROM product.categories WHERE id=$1',[child.id])).rows[0].parent_id,linked.id);
  }finally{await db.query('DROP TABLE '+guard);}

  const deleted=await ok('categories/'+linked.id,{expectedVersion:linked.edit_version,confirm:true},'DELETE');
  assert.equal(deleted.movedProducts,3);
  assert.equal(deleted.movedVariants,1);
  assert.equal(deleted.movedSubcategories,1);
  assert.equal(deleted.defaultCategoryId,fallback.id);
  assert.deepEqual(await invariant(),beforeMove,'no product, inventory, price, publication or archive state is lost');
  assert.equal((await db.query('SELECT count(*)::int n FROM product.categories WHERE id=$1',[linked.id])).rows[0].n,0);
  const moved=(await db.query('SELECT id,category,edit_version FROM product.products WHERE id=ANY($1::uuid[])',[affected])).rows;
  assert.ok(moved.every((row:any)=>row.category==='accessories'));
  const original=new Map([product.product,family.product,...family.variants,legacy.product].map((row:any)=>[row.id,row.edit_version]));
  assert.ok(moved.every((row:any)=>row.edit_version===Number(original.get(row.id))+1));
  const memberships=(await db.query('SELECT product_id,category_id FROM product.product_categories WHERE product_id=ANY($1::uuid[])',[affected])).rows;
  for(const id of affected)assert.equal(memberships.filter((row:any)=>row.product_id===id&&row.category_id===fallback.id).length,1);
  assert.ok(memberships.some((row:any)=>row.product_id===product.product.id&&row.category_id===other.id),'other memberships survive');
  assert.ok(!memberships.some((row:any)=>row.category_id===linked.id));
  const savedChild=(await ok('categories')).items.find((c:any)=>c.id===child.id);
  assert.equal(savedChild.parent_id,other.id);
  assert.equal(savedChild.edit_version,child.edit_version+1);
  assert.equal((await ok('products/'+retainedChild.product.id)).product.category,child.slug);
  const audit=(await db.query("SELECT before_data FROM product.catalog_audit WHERE entity_id=$1 AND action='delete'",[linked.id])).rows[0];
  assert.equal(audit.before_data.reassignment.movedProducts,3);
  assert.equal((await call('products/'+product.product.id+'/quick',{expectedVersion:product.product.edit_version,price_idr:60000,warehouseStocks:[]})).status,409,'stale product edit cannot undo a category move');

  // Removing the former fallback must not break new drafts or later imports.
  await ok('categories/'+other.id,{expectedVersion:other.edit_version,confirm:true},'DELETE');
  const archiveSlug=key+'-archive',imagePath='/qa/'+archiveSlug+'.png';
  const png=await sharp({create:{width:128,height:128,channels:3,background:'#8310e8'}}).png().toBuffer();
  await db.query(`INSERT INTO content.media_library_assets(original_path,filename,title,kind,mime_type,size_bytes,sha256,content)
   VALUES($1,'fixture-accessory.png','Fixture accessory','product_image','image/png',$2,$3,$4)`,
   ['apps/web/public'+imagePath,png.length,createHash('sha256').update(png).digest('hex'),png]);
  await db.query(`INSERT INTO product.legacy_archive(slug,name,brand,category,image_path,historical_price,source_snapshot)
   VALUES($1,'Canvas accessory pouch','Fixture','accessories',$2,'Rp 30.000','disposable-category-test')`,[archiveSlug,imagePath]);
  const convertedResponse=await fetch(base+'/v1/admin/product-records/'+archiveSlug+'/convert',{
   method:'POST',headers:{authorization:'Bearer fixture-admin','content-type':'application/json'},body:JSON.stringify({confirm:true})
  });
  const converted=await convertedResponse.json();
  assert.equal(convertedResponse.status,201,JSON.stringify(converted));
  const archiveDraft=await ok('products/'+converted.productId);
  assert.equal(archiveDraft.product.category,'accessories');
  assert.equal(archiveDraft.product.is_active,false);
  assert.equal(archiveDraft.product.price_idr,0);

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
  const rows=(await db.query('SELECT sku,price_idr,is_active,category FROM product.products WHERE sku=ANY($1::text[])',[[key+'-A',key+'-B',key+'-C'].map(s=>s.toUpperCase())])).rows;
  assert.equal(rows.length,3);
  assert.ok(rows.every((p:any)=>Number(p.price_idr)===0));
  assert.ok(rows.every((p:any)=>p.category==='accessories'),'new imports without a category use the protected default');
  assert.ok(rows.every((p:any)=>p.is_active===false||p.sku.endsWith('-C')),'products remain private drafts');
  const root=(await db.query('SELECT id,edit_version FROM product.products WHERE sku=$1',[(key+'-A').toUpperCase()])).rows[0];
  const ready=await ok('products/bulk/preview',{items:[{id:root.id,expectedVersion:root.edit_version}]});
  assert.equal(ready.ready,0,'zero-price product cannot publish');
  assert.ok(ready.results[0].status==='blocked');
  console.log('ADMIN_REVISION_HTTP_PASS',{categoryDelete:true,categoryProductsReassigned:true,defaultProtected:true,variantsAndLegacyRetained:true,promotionConflictExplained:true,unpricedImportDrafts:true,publishGate:true});
 }finally{await app.close();}
});
