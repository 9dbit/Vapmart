import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const BASE='https://vapmart.id';
const OUTPUT='artifacts/admin-official-logo';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const browser=await chromium.launch({headless:true});
const anonymous=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
const expected=['/branding/vapmart-logo.png','/branding/vapmart-logo-dark.png'];
await mkdir(OUTPUT,{recursive:true});
let admin;
async function checkLogo(page,selector,theme){
 await page.evaluate(mode=>document.documentElement.setAttribute('data-vapmart-color-mode',mode),theme);
 const logo=page.locator(selector);
 await logo.waitFor({state:'visible',timeout:15000});
 await page.waitForFunction(sel=>[...document.querySelectorAll(sel+' img')].length===2&&
  [...document.querySelectorAll(sel+' img')].every(img=>img.complete&&img.naturalWidth>0),selector,{timeout:20000});
 const images=await logo.locator('img').evaluateAll(imgs=>imgs.map(img=>({
  src:img.getAttribute('src'),display:getComputedStyle(img).display,
  objectFit:getComputedStyle(img).objectFit,background:getComputedStyle(img).backgroundColor
 })));
 assert.deepEqual(images.map(i=>i.src),expected,'admin must use the exact ecommerce logo file paths');
 assert.equal(images[theme==='dark'?1:0].display,'block','correct theme image must be visible');
 assert.equal(images[theme==='dark'?0:1].display,'none','other theme image must be hidden');
 assert.ok(images.every(i=>i.objectFit==='contain'),'logo must never be cropped');
 const box=await logo.locator('.vm24-brand-logo').boundingBox();
 assert.ok(box&&box.width>=140&&Math.abs(box.width/box.height-400/79)<0.04,'official proportions retained');
 assert.equal(await page.locator('.vma27-brand-mark').count(),0,'text v imitation removed');
 assert.equal(await page.locator('.vma27-sidebar-brand-text').count(),0,'typed wordmark imitation removed');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 assert.ok(overflow<=3,'admin logo causes no horizontal overflow');
 return {theme,width:box.width,height:box.height};
}
try{
 const page=await anonymous.newPage();
 let ready=false;
 for(let attempt=0;attempt<65;attempt++){
  try{
   const r=await page.request.get(BASE+'/admin',{timeout:12000});
   if(r.status()===200&&(await r.text()).includes('data-vapmart-logo="official-storefront"')){ready=true;break;}
  }catch(e){console.log('Waiting for official admin logo',attempt,String(e).slice(0,100));}
  await sleep(5000);
 }
 assert.ok(ready,'new official logo must be deployed on vapmart.id');
 const storefront=await page.request.get(BASE+'/',{timeout:20000});
 const storefrontHtml=await storefront.text();
 for(const path of expected)assert.ok(storefrontHtml.includes(path),'asset must also be used by ecommerce homepage');
 const results=[];
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  await page.goto(BASE+'/admin',{waitUntil:'domcontentloaded',timeout:25000});
  for(const theme of ['light','dark']){
   results.push({view:'login',viewport:viewport.width,...await checkLogo(page,'.vma27-official-brand-access',theme)});
   await page.screenshot({path:OUTPUT+'/login-'+viewport.width+'-'+theme+'.png',fullPage:true});
  }
 }
 // Isolated browser-only session and API fixtures. No real credentials or production data mutations.
 admin=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 const user={id:'cda3d9af-66ab-474e-a9b5-df742b93cf61',aud:'authenticated',role:'authenticated',
  email:'logo-qa@example.invalid',email_confirmed_at:'2026-11-02T00:00:00Z',created_at:'2026-11-02T00:00:00Z',
  app_metadata:{provider:'email',providers:['email']},user_metadata:{}};
 const session={access_token:'mock-access-token-not-real',refresh_token:'mock-refresh-token-not-real',token_type:'bearer',
  expires_in:7200,expires_at:Math.floor(Date.now()/1000)+7200,user};
 await admin.addInitScript(data=>{localStorage.setItem('vapmart-customer-auth-v1',JSON.stringify(data));},session);
 await admin.route('**/api/admin/**',route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(request.method()!=='GET')return route.abort();
  if(path==='/api/admin/status')return route.fulfill({status:200,contentType:'application/json',body:'{"status":"mock-admin"}'});
  if(['/api/admin/products','/api/admin/brands','/api/admin/orders','/api/admin/media-library'].includes(path))
   return route.fulfill({status:200,contentType:'application/json',body:'{"items":[]}'});
  return route.fulfill({status:403,contentType:'application/json',body:'{"error":"fixture-only"}'});
 });
 const dashboard=await admin.newPage();
 await dashboard.goto(BASE+'/admin',{waitUntil:'domcontentloaded',timeout:25000});
 await dashboard.locator('.vma27-sidebar').waitFor({timeout:20000});
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  await dashboard.setViewportSize(viewport);
  if(viewport.width<1020)await dashboard.getByRole('button',{name:'Buka navigasi',exact:true}).click();
  for(const theme of ['light','dark']){
   results.push({view:'sidebar',viewport:viewport.width,...await checkLogo(dashboard,'.vma27-official-brand-sidebar',theme)});
   assert.equal(await dashboard.locator('.vma27-official-brand-caption').textContent(),'CONTROL PANEL');
   await dashboard.screenshot({path:OUTPUT+'/sidebar-'+viewport.width+'-'+theme+'.png',fullPage:true});
  }
  if(viewport.width<1020)await dashboard.locator('.vma27-close-nav').click();
 }
 await dashboard.setViewportSize({width:1440,height:900});
 await dashboard.getByRole('navigation',{name:'Menu Control Panel'}).getByRole('button',{name:'Media & Aset',exact:true}).click();
 await dashboard.waitForURL(url=>url.pathname==='/admin/media',{timeout:15000});
 await checkLogo(dashboard,'.vma27-official-brand-sidebar','light');
 console.log('VAPMART_OFFICIAL_ADMIN_LOGO_PASS',JSON.stringify({base:BASE,assets:expected,results,mediaLibrary:true}));
}finally{await admin?.close();await anonymous.close();await browser.close();}
