import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const database=new URL(process.env.DATABASE_URL||'http://invalid');
if(process.env.CP39_LOCAL_TEST!=='1'||database.hostname!=='127.0.0.1'||!database.pathname.startsWith('/vapmart_cp39_'))
 throw Error('Only disposable CP39 loopback fixtures are allowed');
const BASE='http://127.0.0.1:3000',OUT='artifacts/admin-catalog-route';
const require=createRequire(resolve('apps/api/package.json')),sharp=require('sharp');
await mkdir(OUT,{recursive:true});
let readyForFixtures=false,startupStatus='No response';
for(let attempt=0;attempt<60;attempt++){
 try{
  const [web,api]=await Promise.all([
   fetch(BASE+'/api/health',{signal:AbortSignal.timeout(1000)}),
   fetch(BASE+'/api/admin/status',{headers:{authorization:'Bearer fixture-admin'},signal:AbortSignal.timeout(1500)})
  ]);
  startupStatus='web='+web.status+', admin API='+api.status;
  if(web.ok&&api.ok&&(await api.json()).admin===true){readyForFixtures=true;break;}
 }catch(error){startupStatus=String(error);}
 await new Promise(resolve=>setTimeout(resolve,500));
}
assert.ok(readyForFixtures,'Next and the authenticated fixture API did not become ready: '+startupStatus);
const call=async(path,body,method='POST',token='fixture-admin')=>{
 const r=await fetch(BASE+path,{method:body===undefined?'GET':method,
  headers:{authorization:'Bearer '+token,'content-type':'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
 return {status:r.status,data:await r.json()};
};
const ok=async(path,body,method='POST')=>{
 const r=await call(path,body,method);assert.ok(r.status>=200&&r.status<300,JSON.stringify({path,...r}));return r.data;
};
const API='/api/admin/catalog',key='route-'+randomUUID().slice(0,8);
const lookups=await ok(API+'/lookups');
const fallback=lookups.categories.find(c=>c.slug==='accessories');
const warehouse=lookups.warehouses.find(w=>w.code==='CP39-A');
assert.ok(fallback?.is_active&&warehouse);
const category=await ok(API+'/categories',{name:key+' Category',slug:key+'-category',active:true,parentId:null,image_url:null,description:''});
const images=[];
for(const color of ['#8310e8','#6d08c2','#8050bb']){
 const png=await sharp({create:{width:80,height:80,channels:3,background:color}}).png().toBuffer();
 const asset=await ok('/api/admin/media',{filename:'fixture.png',mimeType:'image/png',base64:png.toString('base64')});
 images.push('/api/media/'+asset.id);
}
const create=async(suffix,price=65000,stock=3)=>ok(API+'/products',{
 requestKey:randomUUID(),product:{name:key+' '+suffix,slug:key+'-'+suffix,sku:(key+'-'+suffix).toUpperCase(),
  description:'Aksesori meja untuk pengujian katalog lokal.',product_type:'simple',attributes:[],categoryIds:[category.id],
  brand_id:null,fulfillment_owner_brand_id:null,image_url:images[0],gallery_urls:images.slice(1),
  price_idr:price,sale_price_idr:null,sale_starts_at:null,sale_ends_at:null,
  weight_grams:100,length_cm:10,width_cm:8,height_cm:3},variants:[],
 warehouseStocks:stock?[{warehouseId:warehouse.id,onHand:stock,expectedOnHand:0,expectedReserved:0,notes:'Disposable local route test'}]:[]
});
const single=await create('single'),bulkA=await create('bulk-a'),bulkB=await create('bulk-b'),incomplete=await create('incomplete',0),convert=await create('convert',65000,0);
const session={access_token:'fixture-admin',refresh_token:'fixture-refresh',token_type:'bearer',expires_in:7200,
 expires_at:Math.floor(Date.now()/1000)+7200,user:{id:'39000000-0000-4000-8000-000000009999',aud:'authenticated',role:'authenticated',
 email:'catalog-admin@example.invalid',email_confirmed_at:'2026-11-24T00:00:00Z',created_at:'2026-11-24T00:00:00Z',app_metadata:{},user_metadata:{}}};
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
await context.addInitScript(value=>localStorage.setItem('vapmart-customer-auth-v1',JSON.stringify(value)),session);
context.setDefaultTimeout(20000);
const page=await context.newPage(),runtimeErrors=[],routeFailures=[],requests=[];
page.on('pageerror',e=>runtimeErrors.push(e.message));
page.on('dialog',d=>d.accept());
page.on('response',r=>{
 if(r.url().includes('/api/admin/catalog/')){
  const path=new URL(r.url()).pathname;requests.push({method:r.request().method(),path,status:r.status()});
  if(r.status()===404||r.status()===405)routeFailures.push({path,status:r.status()});
 }
});
const detail=async id=>ok(API+'/products/'+id);
const ready=async()=>page.locator('.vc-root[data-engine="cp39"]').waitFor();
const shot=async name=>{await page.screenshot({path:OUT+'/'+name+'.png',fullPage:true,animations:'disabled'});};
try{
 // The actual editor calls preflight through Next before the real Nest state transition.
 await page.goto(BASE+'/admin/products/'+single.product.id);await ready();
 const previewResponse=page.waitForResponse(r=>r.url().endsWith('/products/bulk/preview'));
 await page.getByRole('button',{name:'Publikasikan',exact:true}).click();
 assert.equal((await previewResponse).status(),201);
 await page.getByRole('status').filter({hasText:'Produk berhasil dipublikasikan.'}).first().waitFor();
 assert.equal((await detail(single.product.id)).product.is_active,true);

 // Bulk publish must publish valid items while leaving an incomplete draft private.
 await page.goto(BASE+'/admin/products');await ready();
 await page.getByLabel('Cari nama atau SKU').fill(key);
 await page.getByRole('button',{name:'Cari',exact:true}).click();
 for(const entry of [bulkA,bulkB,incomplete])await page.getByLabel('Pilih draft '+entry.product.name,{exact:true}).check();
 await page.getByRole('button',{name:'Publikasikan 3 terpilih',exact:true}).click();
 await page.getByRole('status').filter({hasText:'2 produk dipublikasikan; 1 produk belum terbit.'}).first().waitFor();
 assert.equal((await detail(bulkA.product.id)).product.is_active,true);
 assert.equal((await detail(bulkB.product.id)).product.is_active,true);
 assert.equal((await detail(incomplete.product.id)).product.is_active,false);
 await shot('bulk-publish-desktop');

 // An existing saved empty draft can change type and retain its ID and parent SKU.
 await page.goto(BASE+'/admin/products/'+convert.product.id);await ready();
 const type=page.getByLabel(/^Jenis produk/);
 assert.equal(await type.isEnabled(),true);
 await type.selectOption('variable');
 await page.getByRole('button',{name:'Tambah atribut',exact:true}).click();
 await page.getByLabel('Nama atribut 1',{exact:true}).fill('Warna');
 await page.getByLabel('Pilihan, pisahkan koma',{exact:true}).fill('Hitam, Putih');
 await page.getByRole('button',{name:'Buat / perbarui kombinasi',exact:true}).click();
 await type.selectOption('simple');await type.selectOption('variable');
 assert.equal(await page.locator('details.vc-variant-card').count(),2,'unsaved variants survive toggling');
 await page.getByRole('button',{name:'Simpan perubahan',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Produk dan stok tersimpan.'}).first().waitFor();
 await page.reload();await ready();
 assert.equal(await type.inputValue(),'variable');
 let converted=await detail(convert.product.id);
 assert.equal(converted.product.sku,convert.product.sku);assert.equal(converted.variants.length,2);
 await type.selectOption('simple');
 await page.getByRole('alert').filter({hasText:'SKU varian tersimpan'}).first().waitFor();
 assert.equal(await type.inputValue(),'variable');
 await page.setViewportSize({width:390,height:844});await shot('product-type-mobile');
 const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(geometry.scroll<=geometry.width+2,JSON.stringify(geometry));

 // Delete a populated category from UI, through Next DELETE and the real database.
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(BASE+'/admin/products/categories');await ready();
 const defaultRow=page.getByRole('row').filter({has:page.locator('strong',{hasText:/^Accessories$/})});
 await defaultRow.waitFor();
 assert.equal(await defaultRow.getByRole('button',{name:'Hapus',exact:true}).isDisabled(),true);
 assert.equal(await defaultRow.getByRole('button',{name:'Nonaktifkan',exact:true}).isDisabled(),true);
 const usedRow=page.getByRole('row').filter({has:page.locator('strong',{hasText:category.name})});
 assert.equal(await usedRow.getByRole('button',{name:'Hapus',exact:true}).isEnabled(),true);
 const deleteResponse=page.waitForResponse(r=>r.url().endsWith('/categories/'+category.id)&&r.request().method()==='DELETE');
 await usedRow.getByRole('button',{name:'Hapus',exact:true}).click();
 assert.equal((await deleteResponse).status(),200);
 await page.getByRole('status').filter({hasText:'Kategori berhasil dihapus. 5 produk dipindahkan ke Accessories.'}).waitFor();
 await usedRow.waitFor({state:'detached'});
 for(const original of [single,bulkA,bulkB,incomplete,convert]){
  const moved=await detail(original.product.id);
  assert.equal(moved.product.category,'accessories');assert.ok(moved.product.category_ids.includes(fallback.id));
  assert.equal(Number(moved.product.stock_qty),Number(original.product.stock_qty));
 }
 converted=await detail(convert.product.id);
 assert.ok(converted.variants.every(v=>v.category==='accessories'));
 await shot('default-category-desktop');
 assert.deepEqual(routeFailures,[]);assert.deepEqual(runtimeErrors,[]);
 assert.ok(requests.some(r=>r.path.endsWith('/bulk/publish')&&r.status===201));
 await writeFile(OUT+'/report.json',JSON.stringify({pass:true,productionWrites:false,realNextProxy:true,realNestApi:true,
  realPostgres:true,singlePublish:true,bulkPublish:true,incompleteDraftPreserved:true,typeChange:true,
  savedVariantsPreserved:true,deletePopulatedCategory:true,defaultProtected:true,geometry,requests},null,2));
 console.log('ADMIN_CATALOG_ROUTE_BROWSER_PASS');
}catch(error){
 await shot('failure').catch(()=>{});await writeFile(OUT+'/failure.txt',String(error)+'\n'+await page.locator('body').innerText().catch(()=>''));throw error;
}finally{await context.close();await browser.close();}
