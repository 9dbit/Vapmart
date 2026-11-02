import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {verifyAdminCandidate} from './cp37a-admin-candidate.mjs';
let mode='empty';
const api=http.createServer((req,res)=>{
 res.setHeader('content-type','application/json');
 if(mode==='503'){res.statusCode=503;return res.end('{"code":"TEST_UPSTREAM_DOWN"}');}
 if(mode==='invalid')return res.end('{"items":"malformed"}');
 if(req.url.startsWith('/v1/products/')){res.statusCode=404;return res.end('{}');}
 return res.end('{"items":[]}');
});
await new Promise(resolve=>api.listen(4100,'127.0.0.1',resolve));
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3000'],{cwd:'apps/web',env:{...process.env,API_INTERNAL_URL:'http://127.0.0.1:4100'},detached:true,stdio:['ignore','pipe','pipe']});
let serverLog='';child.stdout.on('data',x=>serverLog+=x);child.stderr.on('data',x=>serverLog+=x);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ready=false;
for(let i=0;i<60;i++){try{const r=await fetch('http://127.0.0.1:3000/api/health');if(r.ok){ready=true;break;}}catch{}await sleep(500);}
let browser,page;
try{
 assert.ok(ready,'local Next must start: '+serverLog.slice(-2000));
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',route=>{const host=new URL(route.request().url()).hostname;return host==='127.0.0.1'||host==='localhost'?route.continue():route.abort();});
 page=await context.newPage();
 await mkdir('artifacts/cp37a',{recursive:true});
 await page.goto('http://127.0.0.1:3000/catalog',{waitUntil:'networkidle'});
 assert.equal(await page.locator('[data-catalog-state="unavailable"]').count(),0,'a real empty catalog is not an error');
 assert.equal(await page.locator('.vm-restored-reference-card').count(),19,'no historic imagery lost');
 for(const state of ['503','invalid']){
  mode=state;await page.reload({waitUntil:'networkidle'});
  const alert=page.locator('[data-catalog-state="unavailable"]');
  await alert.waitFor();
  assert.equal(await alert.getAttribute('role'),'alert');
  assert.ok((await alert.innerText()).includes('bukan berarti data kosong'));
  assert.equal(await page.locator('.vm-restored-catalog-status').count(),0,'API outage cannot masquerade as empty catalog');
  assert.equal(await page.locator('.vm-restored-reference-card').count(),19,'documentary references stay present during outage');
 }
 mode='empty';await page.getByRole('button',{name:'Coba lagi'}).click();
 await page.waitForFunction(()=>!document.querySelector('[data-catalog-state="unavailable"]'));
 mode='503';await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});
 assert.equal(await page.locator('.vm-carousel-slide').count(),3,'hero structure remains');
 assert.equal(await page.locator('.vm-trendora-category-image img').count(),5,'category structure remains');
 assert.equal(await page.locator('[data-catalog-state="unavailable"]').count(),2,'products and brands report their own failure');
 await page.screenshot({path:'artifacts/cp37a/upstream-failure-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://127.0.0.1:3000/catalog',{waitUntil:'networkidle'});
 const mobile=await page.evaluate(()=>({w:innerWidth,sw:document.documentElement.scrollWidth}));assert.ok(mobile.sw<=mobile.w+3);
 await page.screenshot({path:'artifacts/cp37a/upstream-failure-mobile.png',fullPage:true});
 mode='empty';await page.goto('http://127.0.0.1:3000/admin/login',{waitUntil:'networkidle'});
 await page.waitForURL(u=>u.pathname==='/admin');
 assert.equal(await page.locator('.vma27-sidebar').count(),0);
 assert.equal(await page.locator('.vma27-access-page').count(),1);
 console.log('CP37A_LOCAL_BROWSER_PASS',{empty:true,error503:true,invalid:true,retry:true,heroSlides:3,categories:5,historical:19,mobile,liveNetwork:false});
 await verifyAdminCandidate(browser);
 await context.close();
}catch(error){
 if(page&&!page.isClosed())await page.screenshot({path:'artifacts/cp37a/failure.png',fullPage:true}).catch(()=>{});
 console.error('CP37A_LOCAL_BROWSER_FAILURE',error);throw error;
}finally{
 if(browser)await browser.close();
 if(child.pid){try{process.kill(-child.pid,'SIGTERM');}catch{child.kill('SIGTERM');}}
 child.stdout.destroy();child.stderr.destroy();child.unref();
 api.closeAllConnections();await new Promise(resolve=>api.close(resolve));
 console.log('CP37A_LOCAL_SERVERS_STOPPED');
}
