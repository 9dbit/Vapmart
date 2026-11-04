import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const db=new URL(process.env.DATABASE_URL||'http://invalid');
if(process.env.CP39_LOCAL_TEST!=='1'||db.hostname!=='127.0.0.1'||!db.pathname.startsWith('/vapmart_cp39_'))
 throw Error('CP45 browser may only run on disposable loopback database');
const OUT='artifacts/cp45',BASE='http://127.0.0.1:3000';
await mkdir(OUT,{recursive:true});
const session={access_token:'fixture-admin',refresh_token:'fixture-refresh',token_type:'bearer',expires_in:7200,
 expires_at:Math.floor(Date.now()/1000)+7200,
 user:{id:'39000000-0000-4000-8000-000000009999',aud:'authenticated',role:'authenticated',
 email:'catalog-admin@example.invalid',email_confirmed_at:'2026-11-04T00:00:00Z',
 created_at:'2026-11-03T00:00:00Z',app_metadata:{},user_metadata:{}}};
const browser=await chromium.launch({headless:true}),ctx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
ctx.setDefaultTimeout(25000);ctx.setDefaultNavigationTimeout(35000);
await ctx.addInitScript(s=>localStorage.setItem('vapmart-customer-auth-v1',JSON.stringify(s)),session);
const page=await ctx.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('dialog',async dialog=>dialog.accept());
try{
 await page.goto(BASE+'/admin/products/arsip');
 await page.getByRole('heading',{name:'Arsip & Konversi Produk',exact:true}).waitFor();
 const legacy=page.locator('.vpr-row[data-kind=existing]').first();
 await legacy.waitFor();
 const name=await legacy.locator('.vpr-row-info strong').innerText();
 await legacy.getByRole('button',{name:'Jadikan draft',exact:true}).click();
 const modal=page.locator('dialog.vpr-dialog');
 await modal.waitFor();
 assert.equal(await modal.getByText(name,{exact:true}).count(),1);
 await modal.getByRole('button',{name:'Jadikan draft operasional'}).click();
 await page.waitForURL(u=>/^\/admin\/products\/[a-f0-9-]{36}$/.test(u.pathname),{timeout:40000});
 await page.getByLabel('Harga normal',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Harga normal',{exact:true}).inputValue(),'0');
 assert.equal(await page.getByLabel('SKU',{exact:true}).inputValue(),'');
 assert.equal(await page.getByRole('button',{name:'Publikasikan',exact:true}).count(),1);
 await page.screenshot({path:OUT+'/converted-private-draft-desktop.png',fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:390,height:844});
 await page.reload();await page.getByLabel('Harga normal',{exact:true}).waitFor();
 const dims=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(dims.scroll<=dims.viewport+2,'Mobile horizontal overflow: '+JSON.stringify(dims));
 await page.screenshot({path:OUT+'/converted-private-draft-mobile.png',fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:1440,height:900});
 await page.goto(BASE+'/admin');await page.getByRole('button',{name:'Produk & SKU',exact:true}).first().click();
 await page.waitForURL(u=>u.pathname==='/admin/products');
 await page.getByRole('heading',{name:'Semua Produk',exact:false}).first().waitFor();
 assert.deepEqual(errors,[]);
 await writeFile(OUT+'/browser-report.json',JSON.stringify({pass:true,convertedArchive:true,noAutoPublication:true,zeroInitialPrice:true,blankSku:true,canonicalAdminNavigation:true,mobile:dims,jsErrors:errors,paymentCaptured:false,productionWrites:false},null,2));
 console.log('CP45_BROWSER_PASS',JSON.stringify(dims));
}catch(e){
 await page.screenshot({path:OUT+'/failure.png',fullPage:true}).catch(()=>{});
 await writeFile(OUT+'/failure.txt',String(e));
 throw e;
}finally{await ctx.close();await browser.close()}
