import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const WEB='https://vapmart.id',API='https://vapmart-api-staging.up.railway.app',OUT='artifacts/cp39-live';
await mkdir(OUT,{recursive:true});
const report={checkpoint:'CP39',observedAt:new Date().toISOString(),authenticatedWrites:0,checks:[]};
const get=async url=>{const r=await fetch(url,{cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(20000)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{}return{status:r.status,url:r.url,text,data};};
const [health,ready,hero,categories,products,shipping,checkout]=await Promise.all([
 get(WEB+'/api/health'),get(API+'/ready'),get(WEB+'/api/hero-banners'),get(WEB+'/api/catalog/categories'),get(WEB+'/api/products?page=1&pageSize=5'),get(WEB+'/api/shipping/config'),get(WEB+'/api/checkout/config')]);
assert.equal(health.status,200);assert.equal(ready.status,200);assert.equal(ready.data.database,'ready');
assert.equal(hero.status,200);assert.ok(Array.isArray(hero.data.items));assert.equal(categories.status,200);assert.ok(Array.isArray(categories.data.items));
assert.equal(products.status,200);assert.equal(products.data.pageSize,5);assert.ok(Number.isInteger(products.data.total));
for(const key of ['paymentEnabled','bookingEnabled','rateLookupEnabled'])assert.equal(shipping.data[key],false);
assert.equal(checkout.data.paymentEnabled,false);assert.equal(checkout.data.providerConnected,false);
report.checks.push({health:true,databaseReady:true,activeProducts:products.data.total,heroCount:hero.data.items.length,categories:categories.data.items.length,payment:false,booking:false,rateLookup:false});
for(const base of [API+'/v1',WEB+'/api']){
 for(const path of ['/admin/catalog/lookups','/admin/catalog/products','/admin/catalog/categories','/admin/catalog/reviews','/admin/catalog/orders','/customer/catalog/orders','/customer/catalog/review-eligible']){
  const r=await get(base+path);assert.equal(r.status,401,path);report.checks.push({url:base+path,status:r.status});
 }
 const c=await get(base+'/catalog/categories');assert.equal(c.status,200);assert.deepEqual(c.data.items.map(x=>x.id).sort(),categories.data.items.map(x=>x.id).sort());
 const empty=await get(base+'/catalog/selection?ids=39000000-0000-4000-8000-000000000001');assert.equal(empty.status,200);assert.deepEqual(empty.data.items,[]);
 const invalid=await get(base+'/catalog/selection?ids=invalid');assert.equal(invalid.status,400);
}
const invalidToken=await fetch(WEB+'/api/admin/catalog/products',{headers:{authorization:'Bearer invalid-token'},signal:AbortSignal.timeout(20000)});assert.equal(invalidToken.status,401);
const browser=await chromium.launch({headless:true});
try{
 const anon=await browser.newContext({viewport:{width:390,height:844}});anon.setDefaultTimeout(20000);const ap=await anon.newPage();
 for(const path of ['/admin/products','/admin/products/new','/admin/products/categories','/admin/products/reviews','/admin/products/import','/admin/orders']){await ap.goto(WEB+path);await ap.waitForURL(u=>u.pathname==='/admin');assert.equal(await ap.locator('.vc-root').count(),0);}
 await ap.goto(WEB+'/');await ap.locator('.vm-storefront-restored').waitFor();
 const homeGeo=await ap.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(homeGeo.scroll<=homeGeo.width+2);
 assert.equal(await ap.locator('.vm-carousel-slide').count(),hero.data.items.length);
 await ap.screenshot({path:OUT+'/homepage-mobile.png',fullPage:true,animations:'disabled'});await anon.close();
 // Positive admin rendering uses intercepted synthetic read-only data. No real admin token or write request is submitted.
 const user={id:'39000000-0000-4000-8000-000000009999',email:'cp39-ui@example.invalid',aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),app_metadata:{},user_metadata:{}};
 const session={access_token:'fixture-cp39-readonly-not-real',refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
 const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(20000);context.setDefaultNavigationTimeout(30000);await context.addInitScript(s=>localStorage.setItem('vapmart-customer-auth-v1',JSON.stringify(s)),session);
 const category={id:'39000000-0000-4000-8000-000000000010',name:'Workspace',slug:'workspace',parent_id:null,is_active:true,edit_version:1,description:'',image_url:null,product_count:1};
 const warehouse={id:'39000000-0000-4000-8000-000000000020',code:'QA-READONLY',name:'Gudang Preview',is_active:true,is_dispatch_enabled:true,is_system_hold:false};
 const product={id:'39000000-0000-4000-8000-000000000030',name:'Produk preview terisolasi',slug:'preview-only',sku:'QA-READONLY',description:'Data tampilan pengujian, bukan produk live.',category:'workspace',category_ids:[category.id],category_names:['Workspace'],brand_id:null,brand_name:null,fulfillment_owner_brand_id:null,product_type:'simple',parent_product_id:null,attributes:[],option_values:{},price_idr:100000,regular_price_idr:100000,sale_price_idr:80000,sale_starts_at:null,sale_ends_at:null,stock_qty:7,available_qty:7,variants_count:0,is_active:false,edit_version:1,weight_grams:500,length_cm:20,width_cm:15,height_cm:10,image_url:null,gallery_urls:[],created_at:new Date().toISOString()};
 // The fixture uses an existing public banner file only as a visual placeholder, not a new offer.
 product.image_url=hero.data.items[0]?.desktop||null;
 let mutations=0;const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const empty={items:[],total:0,page:1,pageSize:20,pages:0,hasMore:false};
 await context.route('**/api/admin/**',route=>{
  if(route.request().method()!=='GET'){mutations++;return route.abort();}
  const path=new URL(route.request().url()).pathname;let data;
  if(path==='/api/admin/status')data={admin:true};
  else if(path==='/api/admin/catalog/lookups')data={categories:[category],warehouses:[warehouse],brands:[],paymentEnabled:false};
  else if(path==='/api/admin/catalog/products')data={...empty,total:1,pageSize:24,items:[product]};
  else if(path==='/api/admin/catalog/products/'+product.id)data={product,variants:[],stock:[{product_id:product.id,warehouse_id:warehouse.id,on_hand:7,reserved:0,available:7}]};
  else if(path==='/api/admin/catalog/categories')data={items:[category]};
  else if(path==='/api/admin/catalog/reviews'||path==='/api/admin/catalog/orders')data=empty;
  else if(path==='/api/admin/product-records')data={items:[],matched:0,summary:{total:0,existing:0,managed:0,published:0},facets:{brands:[],categories:[],snapshots:[]},page:1,pageSize:24,pages:0,hasMore:false};
  else return route.abort();
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 async function shot(name){for(const img of await page.locator('.vc-root img:visible').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(async x=>{await Promise.race([x.decode(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Image decode timed out')),5000))])});}await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo(0,0)});await page.waitForTimeout(200);const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+2,name+JSON.stringify(size));await page.screenshot({path:OUT+'/'+name+'.png',fullPage:true,animations:'disabled'});return size;}
 await page.goto(WEB+'/admin/products');await page.locator('.vc-product').waitFor();assert.equal(await page.getByRole('navigation',{name:'Halaman produk'}).getByRole('link').count(),4);await shot('products-desktop');
 await page.getByRole('button',{name:'Edit Cepat',exact:true}).click();await page.getByRole('dialog').getByLabel('Harga promo',{exact:true}).waitFor();await page.getByRole('dialog').getByRole('button',{name:'Batal',exact:true}).click();
 await page.goto(WEB+'/admin/products/'+product.id);await page.getByRole('button',{name:'Simpan perubahan',exact:true}).waitFor();assert.equal(await page.getByLabel('Nama produk',{exact:true}).inputValue(),product.name);await shot('editor-desktop');
 for(const [path,heading] of [['/admin/products/categories','Tambah kategori'],['/admin/products/reviews','Review Pembeli'],['/admin/products/import','Impor Produk'],['/admin/orders','Semua Pesanan']]){await page.goto(WEB+path);await page.locator('.vc-root').waitFor();await page.getByRole('heading',{name:heading,exact:true}).waitFor();}
 await page.setViewportSize({width:390,height:844});await page.goto(WEB+'/admin/products/'+product.id);await page.getByRole('button',{name:'Simpan perubahan',exact:true}).waitFor();const mobile=await shot('editor-mobile');
 await page.getByRole('button',{name:'Buka navigasi',exact:true}).click();await page.locator('.vma27-sidebar.is-open').waitFor();await page.getByRole('button',{name:'Tutup menu',exact:true}).click();
 await page.goto(WEB+'/admin/products');await page.locator('.vc-product').waitFor();await shot('products-mobile');
 assert.equal(mutations,0);assert.deepEqual(errors,[]);report.checks.push({adminNewRoutes:true,anonymousRedirect:true,fixtureReadOnlyUI:true,fourProductPages:true,quickEditDialog:true,editor:true,categoryReviewImportOrders:true,mobile,realAdminLogin:false,mutations});
 await context.close();
}finally{await browser.close();}
await writeFile(OUT+'/live-report.json',JSON.stringify(report,null,2)+'\n');console.log('CP39_LIVE_READONLY_PASS',JSON.stringify(report));
