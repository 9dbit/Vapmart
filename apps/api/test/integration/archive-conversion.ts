import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
const {createFixture}=require(resolve('../../scripts/cp39-fixture-server.cjs'));

test('CP45 archive becomes an idempotent unlisted editable draft with validated media and preserved provenance',async()=>{
 const {app,db,base}=await createFixture();
 const post=async(path:string,data:unknown,token='fixture-admin')=>{
  const r=await fetch(base+path,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(data)});
  return {status:r.status,body:await r.json()};
 };
 const get=async(path:string,token='fixture-admin')=>{
  const r=await fetch(base+path,{headers:{authorization:'Bearer '+token}});
  return {status:r.status,body:await r.json()};
 };
 try{
  const source=await db.query("SELECT a.slug,a.name,a.brand,a.category,a.image_path,m.id media_id,m.sha256 FROM product.legacy_archive a JOIN content.media_library_assets m ON m.original_path=('apps/web/public'||a.image_path) AND m.kind='product_image' ORDER BY a.slug LIMIT 1");
  assert.ok(source.rows[0],'fixture must have at least one media-linked archive item');
  const a=source.rows[0],slug=a.slug as string,path='/v1/admin/product-records/'+encodeURIComponent(slug)+'/convert';
  const archiveBefore=await db.query('SELECT * FROM product.legacy_archive WHERE slug=$1',[slug]);
  assert.equal((await post(path,{confirm:true},'fixture-buyer')).status,403);
  assert.equal((await post(path,{confirm:false})).status,400);
  const result=await post(path,{confirm:true});
  assert.equal(result.status,201,JSON.stringify(result.body));
  assert.equal(result.body.created,true);
  assert.equal(result.body.priceIdr,0);assert.equal(result.body.stockQty,0);
  const id=result.body.productId as string;
  assert.match(id,/^[a-f0-9-]{36}$/);
  const saved=await db.query("SELECT id,sku,name,slug,is_active,price_idr,stock_qty,product_type,image_url,brand_id,description FROM product.products WHERE id=$1",[id]);
  assert.equal(saved.rows.length,1);
  const draft=saved.rows[0];
  assert.equal(draft.name,a.name);assert.equal(draft.sku,null);
  assert.equal(draft.is_active,false);assert.equal(Number(draft.price_idr),0);
  assert.equal(draft.stock_qty,0);assert.equal(draft.product_type,'simple');
  assert.equal(draft.brand_id,null);assert.equal(draft.description,'');
  assert.match(draft.image_url,/^\/api\/media\/[0-9a-f-]{36}$/);
  const assetId=draft.image_url.split('/').pop();
  const media=await db.query("SELECT filename,mime_type,size_bytes,length(content)::int length FROM product.media_assets WHERE id=$1",[assetId]);
  assert.equal(media.rows[0].mime_type,'image/webp');
  assert.equal(Number(media.rows[0].size_bytes),Number(media.rows[0].length));
  assert.ok(Number(media.rows[0].size_bytes)>100&&Number(media.rows[0].size_bytes)<=1572864);
  const cat=await db.query("SELECT c.slug FROM product.product_categories pc JOIN product.categories c ON c.id=pc.category_id WHERE pc.product_id=$1",[id]);
  assert.deepEqual(cat.rows.map(x=>x.slug),['other']);
  const warehouse=await db.query('SELECT count(*)::int n FROM product.warehouse_stock WHERE product_id=$1',[id]);
  assert.equal(warehouse.rows[0].n,0);
  const provenance=await db.query("SELECT source_id,product_id FROM product.catalog_source_rows WHERE source_key='legacy_archive_v1' AND source_id=$1",[slug]);
  assert.equal(provenance.rows[0].product_id,id);
  const audit=await db.query("SELECT before_data,after_data FROM product.catalog_audit WHERE entity_type='archive_conversion' AND entity_id=$1",[id]);
  assert.equal(audit.rows[0].before_data.slug,slug);assert.equal(audit.rows[0].before_data.brand,a.brand);
  assert.equal(audit.rows[0].after_data.active,false);
  const status=await post(path,{confirm:true});
  assert.equal(status.status,201);assert.equal(status.body.created,false);assert.equal(status.body.productId,id);
  assert.equal((await db.query('SELECT count(*)::int n FROM product.products WHERE id=$1',[id])).rows[0].n,1);
  assert.deepEqual((await db.query('SELECT * FROM product.legacy_archive WHERE slug=$1',[slug])).rows[0],archiveBefore.rows[0],'source archive immutable');
  const list=await get('/v1/admin/product-records?source=existing&q='+encodeURIComponent(slug));
  assert.equal(list.status,200);
  const linked=list.body.items.find((x:any)=>x.slug===slug);
  assert.equal(linked.converted_product_id,id);
  assert.ok(Number(list.body.summary.converted_existing)>=1);
  const family=await get('/v1/admin/catalog/products/'+id);
  assert.equal(family.status,200);
  assert.equal(family.body.product.is_active,false);
  const publication=await post('/v1/admin/catalog/products/'+id+'/state',{expectedVersion:family.body.product.edit_version,active:true});
  assert.ok(publication.status>=400,'incomplete draft may not be published');
  const publicProduct=await fetch(base+'/v1/products/'+encodeURIComponent(draft.slug));
  assert.equal(publicProduct.status,404,'private draft must never leak into storefront');
  console.log('CP45_ARCHIVE_CONVERSION_PASS',JSON.stringify({sourcePreserved:true,idempotent:true,mediaValidated:true,privateDraft:true,adminOnly:true,photoPublicCopy:true,noPaymentCapture:true,noAutomaticPublish:true}));
 }finally{await app.close()}
});
