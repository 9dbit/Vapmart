import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const db=new URL(process.env.DATABASE_URL||'http://invalid');
if(process.env.CP39_LOCAL_TEST!=='1'||db.hostname!=='127.0.0.1'||!db.pathname.startsWith('/vapmart_cp39_'))throw Error('Disposable loopback database required');
const BASE='http://127.0.0.1:3000',OUT='artifacts/cp43';
await mkdir(OUT,{recursive:true});
const session={access_token:'fixture-admin',refresh_token:'fixture-refresh',token_type:'bearer',expires_in:7200,expires_at:Math.floor(Date.now()/1000)+7200,user:{id:'39000000-0000-4000-8000-000000009999',aud:'authenticated',role:'authenticated',email:'catalog-admin@example.invalid',email_confirmed_at:'2026-11-04T00:00:00Z',created_at:'2026-11-03T00:00:00Z',app_metadata:{},user_metadata:{}}};
const browser=await chromium.launch({headless:true}),ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
ctx.setDefaultTimeout(20000);ctx.setDefaultNavigationTimeout(30000);
await ctx.addInitScript(s=>localStorage.setItem('vapmart-customer-auth-v1',JSON.stringify(s)),session);
const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
async function shot(name){await page.evaluate(()=>{scrollTo(0,0);document.activeElement?.blur?.()});const g=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(g.scroll<=g.width+2,JSON.stringify(g));await page.screenshot({path:OUT+'/'+name+'.png',fullPage:true,animations:'disabled'});return g;}
try{
 for(let i=0;i<45;i++){try{if((await fetch(BASE+'/api/health',{signal:AbortSignal.timeout(1000)})).ok)break}catch{}await new Promise(r=>setTimeout(r,1000));}
 await page.goto(BASE+'/admin/promotions');
 await page.getByRole('heading',{name:'Voucher & Promo'}).waitFor();
 assert.ok(await page.getByRole('link',{name:'Voucher',exact:true}).count());assert.ok(await page.getByRole('link',{name:'Campaign',exact:true}).count());
 await page.getByLabel('Judul',{exact:true}).fill('CP43 Browser Promo');
 await page.getByLabel('Nilai diskon',{exact:true}).fill('11');
 await page.getByRole('button',{name:'Simpan campaign',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Campaign tersimpan.'}).waitFor();
 let card=page.locator('.vc-promo-card').filter({hasText:'CP43 Browser Promo'});await card.waitFor();
 assert.ok((await card.innerText()).includes('Draft'));
 await card.getByRole('button',{name:'Publish',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Campaign dipublish.'}).waitFor();
 card=page.locator('.vc-promo-card').filter({hasText:'CP43 Browser Promo'});assert.ok((await card.innerText()).match(/Aktif|Terjadwal/));
 await card.getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByLabel('Nilai diskon',{exact:true}).fill('12');
 await page.getByRole('button',{name:'Simpan campaign',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Campaign tersimpan.'}).waitFor();
 card=page.locator('.vc-promo-card').filter({hasText:'CP43 Browser Promo'});assert.ok((await card.innerText()).includes('12%'));
 await shot('campaign-admin-desktop');
 await page.setViewportSize({width:390,height:844});await page.goto(BASE+'/admin/promotions');await page.getByRole('heading',{name:'Voucher & Promo'}).waitFor();const mobile=await shot('campaign-admin-mobile');
 assert.deepEqual(errors,[]);
 await writeFile(OUT+'/browser-report.json',JSON.stringify({pass:true,create:true,publish:true,edit:true,desktop:true,mobile,runtimeErrors:errors,productionWrites:false,paymentGatewayActivated:false},null,2));
 console.log('CP43_BROWSER_PASS',mobile);
}catch(e){await page.screenshot({path:OUT+'/failure.png',fullPage:true}).catch(()=>{});await writeFile(OUT+'/failure.txt',String(e));throw e;}finally{await ctx.close();await browser.close();}
