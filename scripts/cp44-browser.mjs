import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const database=new URL(process.env.DATABASE_URL||'http://invalid');
if(process.env.CP39_LOCAL_TEST!=='1'||database.hostname!=='127.0.0.1'||!database.pathname.startsWith('/vapmart_cp39_'))
 throw Error('CP44 browser must use disposable loopback database');
const BASE='http://127.0.0.1:3000',OUT='artifacts/cp44';
await mkdir(OUT,{recursive:true});
const session={access_token:'fixture-admin',refresh_token:'fixture-refresh',token_type:'bearer',expires_in:7200,
 expires_at:Math.floor(Date.now()/1000)+7200,
 user:{id:'39000000-0000-4000-8000-000000009999',aud:'authenticated',role:'authenticated',
 email:'catalog-admin@example.invalid',email_confirmed_at:'2026-11-04T00:00:00Z',
 created_at:'2026-11-03T00:00:00Z',app_metadata:{},user_metadata:{}}};
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',acceptDownloads:true});
ctx.setDefaultTimeout(20000);ctx.setDefaultNavigationTimeout(30000);
await ctx.addInitScript(s=>localStorage.setItem('vapmart-customer-auth-v1',JSON.stringify(s)),session);
const page=await ctx.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
async function screenshot(name){
 await page.evaluate(()=>scrollTo(0,0));
 const dims=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(dims.scroll<=dims.viewport+2,'Horizontal overflow: '+JSON.stringify(dims));
 await page.screenshot({path:OUT+'/'+name+'.png',fullPage:true,animations:'disabled'});
 return dims;
}
try{
 for(let i=0;i<45;i++){try{if((await fetch(BASE+'/api/health',{signal:AbortSignal.timeout(1000)})).ok)break}catch{}await new Promise(r=>setTimeout(r,1000));}
 await page.goto(BASE+'/admin/promotions/analytics');
 await page.getByRole('heading',{name:'Promotion Analytics'}).waitFor();
 await page.getByText('GMV terverifikasi',{exact:true}).first().waitFor();
 await page.getByRole('heading',{name:'Finance ledger'}).waitFor();
 assert.equal(await page.getByRole('link',{name:'Analytics',exact:true}).getAttribute('aria-current'),'page');
 assert.ok(await page.getByText('Diskon terverifikasi',{exact:true}).count());
 assert.ok(await page.getByText('Reconciliation exceptions',{exact:true}).count());
 await screenshot('analytics-desktop');
 const from=await page.getByLabel('Tanggal mulai').inputValue();
 await page.getByRole('button',{name:'7 hari',exact:true}).click();
 await page.getByRole('heading',{name:'Promotion Analytics'}).waitFor();
 assert.notEqual(await page.getByLabel('Tanggal mulai').inputValue(),from);
 await page.getByRole('button',{name:'Terapkan',exact:true}).click();
 await page.getByRole('button',{name:'Export CSV',exact:true}).waitFor();
 const downloadPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'Export CSV',exact:true}).click();
 const download=await downloadPromise;
 assert.match(download.suggestedFilename(),/^vapmart-promotion-ledger-/);
 const filename=OUT+'/ledger-browser.csv';await download.saveAs(filename);
 const csv=await readFile(filename,'utf8');
 assert.ok(csv.startsWith('\uFEFF')&&csv.includes('Order ID'));
 await page.setViewportSize({width:390,height:844});await page.goto(BASE+'/admin/promotions/analytics');
 await page.getByRole('heading',{name:'Promotion Analytics'}).waitFor();
 const mobile=await screenshot('analytics-mobile');
 assert.deepEqual(errors,[]);
 await writeFile(OUT+'/browser-report.json',JSON.stringify({
  pass:true,desktop:true,mobile,filters:true,csvExport:true,financeLedger:true,
  javascriptErrors:errors,productionWrites:false,paymentCapture:false
 },null,2));
 console.log('CP44_BROWSER_PASS',mobile);
}catch(error){
 await page.screenshot({path:OUT+'/failure.png',fullPage:true}).catch(()=>{});
 await writeFile(OUT+'/failure.txt',String(error));
 throw error;
}finally{await ctx.close();await browser.close();}
