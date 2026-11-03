import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const BASE=process.env.CP39R1_BASE||'http://127.0.0.1:3000';
const live=BASE==='https://vapmart.id';
assert.ok(BASE==='http://127.0.0.1:3000'||(live&&process.env.CP39R1_LIVE_READONLY==='1'),'Only loopback or explicitly read-only live verification');
const OUT=live?'artifacts/cp39r1-live':'artifacts/cp39r1';
await mkdir(OUT,{recursive:true});
const report={checkpoint:'CP39-R1',base:BASE,observedAt:new Date().toISOString(),checks:[],authenticatedWrites:0};
for(let n=0;n<60;n++){try{if((await fetch(BASE+'/api/health',{signal:AbortSignal.timeout(2000)})).ok)break;}catch{}if(n===59)throw Error('Web not ready');await new Promise(r=>setTimeout(r,1000));}
const browser=await chromium.launch({headless:true});
try{
 const publicContext=await browser.newContext({reducedMotion:'reduce'});publicContext.setDefaultTimeout(20000);const page=await publicContext.newPage();
 for(const [name,width,height,theme] of [['mobile-light',390,844,'light'],['desktop-light',1440,1000,'light'],['mobile-dark',390,844,'dark']]){
  await page.setViewportSize({width,height});await page.goto(BASE+'/');
  await page.evaluate(mode=>{document.documentElement.setAttribute('data-theme',mode);document.documentElement.style.setProperty('scroll-behavior','auto','important');},theme);
  const cards=page.locator('.vm-reference-card');await cards.first().waitFor();
  const count=await cards.count();assert.ok(count>0);
  assert.equal(await cards.locator('[data-price-status="unset"][data-price-idr="0"]').count(),count);
  for(const amount of await cards.locator('.vm-reference-placeholder-price strong').allTextContents())assert.equal(amount.replace(/\s/g,''),'Rp0');
  for(const label of await cards.locator('.vm-reference-placeholder-price span').allTextContents())assert.equal(label,'Harga belum ditetapkan');
  assert.equal(await cards.locator('button, a[href*="checkout"], a[href*="product/"], [itemprop="offers"]').count(),0);
  await cards.first().scrollIntoViewIfNeeded();
  const firstImage=cards.first().locator('img');await firstImage.evaluate(async img=>{await Promise.race([img.decode(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Reference image decode timeout')),10000))]);});
  const geo=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(geo.scroll<=width+2);
  await page.screenshot({path:OUT+'/price-'+name+'.png',animations:'disabled'});
  report.checks.push({view:name,cards:count,placeholderZero:true,readOnly:true,geometry:geo});
 }
 await page.goto(BASE+'/catalog');await page.locator('.vm-reference-card').first().waitFor();assert.equal(await page.locator('.vm-reference-card [data-price-status="unset"]').count(),await page.locator('.vm-reference-card').count());
 await publicContext.close();
 // Intercepted admin reads exercise actual frontend code without any live credentials or writes.
 const user={id:'39000000-0000-4000-8000-000000009999',email:'price-ui@example.invalid',aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),app_metadata:{},user_metadata:{}};
 const session={access_token:'fixture-price-readonly-not-real',refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});context.setDefaultTimeout(20000);await context.addInitScript(s=>localStorage.setItem('vapmart-customer-auth-v1',JSON.stringify(s)),session);
 const product={id:'39000000-0000-4000-8000-000000000040',name:'Harga existing uji',slug:'existing-price-fixture',sku:'PRICE-TEST',description:'Synthetic read-only fixture',product_type:'simple',price_idr:125000,sale_price_idr:null,sale_starts_at:null,sale_ends_at:null,category_ids:[],attributes:[],brand_id:null,fulfillment_owner_brand_id:null,image_url:null,gallery_urls:[],is_active:false,edit_version:1,weight_grams:null,length_cm:null,width_cm:null,height_cm:null};
 let writes=0;
 await context.route('**/api/admin/**',route=>{
  if(route.request().method()!=='GET'){writes++;return route.abort();}
  const path=new URL(route.request().url()).pathname;let data;
  if(path==='/api/admin/status')data={admin:true};
  else if(path==='/api/admin/catalog/lookups')data={categories:[],warehouses:[],brands:[],paymentEnabled:false};
  else if(path==='/api/admin/catalog/products/'+product.id)data={product,variants:[],stock:[]};
  else return route.abort();
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 const admin=await context.newPage();const errors=[];admin.on('pageerror',e=>errors.push(e.message));
 await admin.goto(BASE+'/admin/products/new');const price=admin.getByLabel('Harga normal',{exact:true});await price.waitFor();assert.equal(await price.inputValue(),'0');await admin.locator('[data-price-status="unset"]').waitFor();
 await price.fill('125000');assert.equal(await admin.locator('[data-price-status="unset"]').count(),0);await price.fill('0');await admin.locator('[data-price-status="unset"]').waitFor();
 await price.scrollIntoViewIfNeeded();await admin.screenshot({path:OUT+'/admin-zero-price.png',animations:'disabled'});
 admin.on('dialog',dialog=>dialog.accept());await admin.goto(BASE+'/admin/products/'+product.id);await admin.getByRole('button',{name:'Simpan perubahan',exact:true}).waitFor();assert.equal(await admin.getByLabel('Harga normal',{exact:true}).inputValue(),'125000');assert.equal(await admin.locator('[data-price-status="unset"]').count(),0);
 assert.equal(writes,0);assert.deepEqual(errors,[]);report.checks.push({newDraftDefault:0,existingPricePreserved:125000,adminNotice:true,fixtureIdentity:true,realAdminLogin:false,writes});
 await context.close();
 const checkout=await(await fetch(BASE+'/api/checkout/config',{signal:AbortSignal.timeout(10000)})).json();assert.equal(checkout.paymentEnabled,false);report.checks.push({paymentEnabled:false});
}finally{await browser.close();}
await writeFile(OUT+'/report.json',JSON.stringify(report,null,2)+'\n');console.log('CP39R1_PRICE_PASS',JSON.stringify(report));
