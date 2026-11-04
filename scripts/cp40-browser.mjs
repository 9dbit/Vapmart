import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const db=new URL(process.env.DATABASE_URL||'http://invalid');
if(process.env.CP39_LOCAL_TEST!=='1'||db.hostname!=='127.0.0.1'||!db.pathname.startsWith('/vapmart_cp39_'))throw Error('Disposable loopback database required');
const BASE='http://127.0.0.1:3000',API='http://127.0.0.1:4100',OUT='artifacts/cp40';
await mkdir(OUT,{recursive:true});
const req=createRequire(resolve('apps/api/package.json')),sharp=req('sharp');
await writeFile(OUT+'/accessory.png',await sharp({create:{width:200,height:200,channels:3,background:'#7050a0'}}).png().toBuffer());
const session={access_token:'fixture-admin',refresh_token:'fixture-refresh',token_type:'bearer',expires_in:7200,expires_at:Math.floor(Date.now()/1000)+7200,user:{id:'39000000-0000-4000-8000-000000009999',aud:'authenticated',role:'authenticated',email:'catalog-admin@example.invalid',email_confirmed_at:'2026-11-03T00:00:00Z',created_at:'2026-11-03T00:00:00Z',app_metadata:{},user_metadata:{}}};
const browser=await chromium.launch({headless:true}),ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
ctx.setDefaultTimeout(20000);ctx.setDefaultNavigationTimeout(30000);await ctx.addInitScript(s=>localStorage.setItem('vapmart-customer-auth-v1',JSON.stringify(s)),session);
const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const privateNote='Catatan internal: bukan produk vape.';
const detail=async id=>{const r=await fetch(API+'/v1/admin/catalog/products/'+id,{headers:{authorization:'Bearer fixture-admin'},signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.json();};
async function save(){await page.getByRole('button',{name:'Simpan perubahan',exact:true}).click();await page.getByRole('status').filter({hasText:'Produk dan stok tersimpan.'}).first().waitFor();}
async function shot(name){
 await page.evaluate(()=>{document.documentElement.style.setProperty('scroll-behavior','auto','important');window.scrollTo({top:0,left:0,behavior:'instant'});document.activeElement?.blur?.()});
 await page.waitForFunction(()=>scrollY===0);
 const geo=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(geo.scroll<=geo.width+2);
 await page.screenshot({path:OUT+'/'+name+'.png',fullPage:true,animations:'disabled'});return geo;
}
try{
 for(let i=0;i<45;i++){try{if((await fetch(BASE+'/api/health',{signal:AbortSignal.timeout(1000)})).ok)break}catch{}await new Promise(r=>setTimeout(r,1000));}
 await page.goto(BASE+'/admin/products/new');await page.getByLabel('Nama produk',{exact:true}).fill('Tas kain CP40 browser');
 await page.getByLabel('Slug',{exact:true}).fill('tas-kain-cp40-browser');await page.getByLabel('SKU',{exact:true}).fill('CP40-UI-BAG');
 await page.locator('label').filter({hasText:/^Deskripsi/}).locator('textarea').first().fill(privateNote);await page.getByLabel('Harga normal',{exact:true}).fill('0');
 await page.getByLabel('Upload gambar utama dan pendukung',{exact:true}).setInputFiles(OUT+'/accessory.png');await page.locator('.vc-photo img').first().waitFor();
 for(const [label,value] of [['Berat (gram)','100'],['Panjang (cm)','20'],['Lebar (cm)','10'],['Tinggi (cm)','5']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByLabel('Stok Gudang Uji A',{exact:true}).fill('2');await page.getByLabel('Catatan stok Gudang Uji A',{exact:true}).fill('CP40 disposable accessory receipt');
 await page.getByRole('button',{name:'Simpan draft',exact:true}).click();await page.waitForURL(u=>/^\/admin\/products\/[a-f0-9-]{36}$/.test(u.pathname));
 await page.getByRole('button',{name:'Simpan perubahan',exact:true}).waitFor();const id=new URL(page.url()).pathname.split('/').at(-1);
 await page.reload();await page.getByRole('button',{name:'Simpan perubahan',exact:true}).waitFor();
 assert.equal(await page.locator('label').filter({hasText:/^Deskripsi/}).locator('textarea').first().inputValue(),privateNote);assert.equal(await page.getByLabel('Harga normal',{exact:true}).inputValue(),'0');
 assert.equal((await detail(id)).product.is_active,false);
 assert.equal((await fetch(BASE+'/api/products/tas-kain-cp40-browser')).status,404);
 await page.getByRole('button',{name:'Publikasikan',exact:true}).click();await page.getByRole('alert').filter({hasText:'Konten'}).first().waitFor();
 assert.equal((await detail(id)).product.is_active,false);await shot('draft-desktop');
 await page.getByLabel('SKU',{exact:true}).fill('CP40-VAPE-NOTE');await save();
 await page.reload();await page.getByRole('button',{name:'Simpan perubahan',exact:true}).waitFor();assert.equal(await page.getByLabel('SKU',{exact:true}).inputValue(),'CP40-VAPE-NOTE');
 // Correct the private note for an ordinary accessory and verify the normal publish path.
 await page.getByLabel('SKU',{exact:true}).fill('CP40-UI-BAG');await page.locator('label').filter({hasText:/^Deskripsi/}).locator('textarea').first().fill('Tas kain untuk menyimpan aksesori perjalanan.');await page.getByLabel('Harga normal',{exact:true}).fill('25000');await save();
 await page.getByRole('button',{name:'Publikasikan',exact:true}).click();await page.getByRole('status').filter({hasText:'Produk dipublikasikan.'}).first().waitFor();assert.equal((await detail(id)).product.is_active,true);
 await page.getByRole('button',{name:'Nonaktifkan',exact:true}).click();await page.getByRole('status').filter({hasText:'Produk disembunyikan.'}).first().waitFor();
 await page.setViewportSize({width:390,height:844});await page.locator('label').filter({hasText:/^Deskripsi/}).locator('textarea').first().fill(privateNote);await page.getByLabel('Harga normal',{exact:true}).fill('0');await save();
 await page.reload();await page.getByRole('button',{name:'Simpan perubahan',exact:true}).waitFor();assert.equal(await page.getByLabel('Harga normal',{exact:true}).inputValue(),'0');assert.equal(await page.locator('label').filter({hasText:/^Deskripsi/}).locator('textarea').first().inputValue(),privateNote);const mobile=await shot('draft-mobile');
 const final=await detail(id);assert.equal(final.product.is_active,false);assert.equal(final.product.price_idr,0);assert.deepEqual(errors,[]);
 await writeFile(OUT+'/browser-report.json',JSON.stringify({pass:true,realLocalPostgres:true,fixtureIdentity:true,productionWrites:false,zeroPriceDraft:true,upload:true,reloadPersistence:true,publicationDeniedUntilValidated:true,ordinaryAccessoryPublication:true,deactivation:true,mobile,runtimeErrors:errors},null,2));console.log('CP40_BROWSER_PASS',mobile);
}catch(e){await page.screenshot({path:OUT+'/failure.png',fullPage:true}).catch(()=>{});await writeFile(OUT+'/failure.txt',String(e));throw e;}finally{await ctx.close();await browser.close();}
