import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const db=new URL(process.env.DATABASE_URL||'http://invalid');
if(process.env.CP39_LOCAL_TEST!=='1'||db.hostname!=='127.0.0.1'||!db.pathname.startsWith('/vapmart_cp39_'))throw Error('Disposable loopback database required');
const BASE='http://127.0.0.1:3000',OUT='artifacts/cp42';
await mkdir(OUT,{recursive:true});
const session={access_token:'fixture-admin',refresh_token:'fixture-refresh',token_type:'bearer',expires_in:7200,expires_at:Math.floor(Date.now()/1000)+7200,user:{id:'39000000-0000-4000-8000-000000009999',aud:'authenticated',role:'authenticated',email:'catalog-admin@example.invalid',email_confirmed_at:'2026-11-03T00:00:00Z',created_at:'2026-11-03T00:00:00Z',app_metadata:{},user_metadata:{}}};
const browser=await chromium.launch({headless:true}),ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
ctx.setDefaultTimeout(20000);ctx.setDefaultNavigationTimeout(30000);
await ctx.addInitScript(s=>localStorage.setItem('vapmart-customer-auth-v1',JSON.stringify(s)),session);
const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
async function shot(name){await page.evaluate(()=>{scrollTo(0,0);document.activeElement?.blur?.()});const geo=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(geo.scroll<=geo.width+2,JSON.stringify(geo));await page.screenshot({path:OUT+'/'+name+'.png',fullPage:true,animations:'disabled'});return geo;}
try{
 for(let i=0;i<45;i++){try{if((await fetch(BASE+'/api/health',{signal:AbortSignal.timeout(1000)})).ok)break}catch{}await new Promise(r=>setTimeout(r,1000));}
 await page.goto(BASE+'/admin/vouchers');
 await page.locator('.vc-heading h1').filter({hasText:'Voucher & Promo'}).waitFor();
 await page.getByLabel('Kode voucher',{exact:true}).fill('CP42WEB10');
 await page.getByLabel('Diskon (%)',{exact:true}).fill('10');
 await page.getByLabel('Minimum belanja (IDR)',{exact:true}).fill('75000');
 await page.getByLabel(/Maksimum diskon/).fill('25000');
 await page.getByLabel(/Kuota penggunaan/).fill('5');
 await page.getByRole('button',{name:'Buat voucher',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Voucher dibuat.'}).waitFor();
 const card=page.locator('.vc-voucher-card').filter({hasText:'CP42WEB10'});await card.waitFor();
 assert.ok((await card.innerText()).includes('10%'));
 await shot('voucher-admin-desktop');

 await card.getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByLabel('Diskon (%)',{exact:true}).fill('12');
 await page.getByRole('button',{name:'Simpan perubahan',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Voucher diperbarui.'}).waitFor();
 const updated=page.locator('.vc-voucher-card').filter({hasText:'CP42WEB10'});assert.ok((await updated.innerText()).includes('12%'));

 await updated.getByRole('button',{name:'Nonaktifkan',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Voucher dinonaktifkan.'}).waitFor();
 const inactive=page.locator('.vc-voucher-card').filter({hasText:'CP42WEB10'});assert.ok((await inactive.innerText()).includes('Nonaktif'));

 await page.getByLabel('Filter status voucher',{exact:true}).selectOption('inactive');
 await page.getByRole('button',{name:'Terapkan',exact:true}).click();
 await inactive.waitFor();

 await page.setViewportSize({width:390,height:844});await page.goto(BASE+'/admin/vouchers');
 await page.locator('.vc-heading h1').filter({hasText:'Voucher & Promo'}).waitFor();
 const mobile=await shot('voucher-admin-mobile');
 assert.deepEqual(errors,[]);
 await writeFile(OUT+'/browser-report.json',JSON.stringify({pass:true,create:true,edit:true,deactivate:true,filter:true,mobile,runtimeErrors:errors,productionWrites:false,paymentGatewayActivated:false},null,2));
 console.log('CP42_BROWSER_PASS',mobile);
}catch(e){await page.screenshot({path:OUT+'/failure.png',fullPage:true}).catch(()=>{});await writeFile(OUT+'/failure.txt',String(e));throw e;}finally{await ctx.close();await browser.close();}
