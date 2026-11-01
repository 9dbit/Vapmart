import assert from 'node:assert/strict';
import {chromium} from 'playwright';
// All admin API reads below are MOCKED. No real admin account, token, product or order is used.
const BASE='https://vapmart-web-staging.up.railway.app';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const browser=await chromium.launch({headless:true});
const expiry=Math.floor(Date.now()/1000)+7200;
const user={id:'cda3d9af-66ab-474e-a9b5-df742b93cf61',aud:'authenticated',
 role:'authenticated',email:'ui-qa@example.invalid',email_confirmed_at:'2026-11-02T00:00:00.000Z',
 created_at:'2026-11-02T00:00:00.000Z',app_metadata:{provider:'email',providers:['email']},user_metadata:{}};
const session={access_token:'mock-access-token-not-real',token_type:'bearer',expires_in:7200,expires_at:expiry,
 refresh_token:'mock-refresh-token-not-real',user};
const context=await browser.newContext({viewport:{width:1440,height:900}});
try{
 await context.addInitScript(data=>{
  try{localStorage.setItem('vapmart-customer-auth-v1',JSON.stringify(data));}catch{}
 },session);
 const page=await context.newPage();
 await page.route('**/api/admin/status',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'admin_verified_mock'})}));
 for(const endpoint of ['products','brands','orders']){
  await page.route('**/api/admin/'+endpoint,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[]})}));
 }
 await page.route('**/api/admin/media-library',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[],readOnly:false})}));
 let ready=false;
 for(let attempt=0;attempt<60;attempt++){
  try{
   await page.goto(BASE+'/admin',{waitUntil:'domcontentloaded',timeout:20000});
   await page.waitForTimeout(350);
   if(await page.locator('.vma27-sidebar').count()===1&&await page.locator('.vma27-skip-link').count()===1){ready=true;break;}
  }catch(e){console.log('Waiting for admin UI mock route',attempt,String(e).slice(0,100));}
  await sleep(6000);
 }
 assert.ok(ready,'Admin workspace should render with simulated verified admin status');
 const sidebar=page.getByRole('navigation',{name:'Menu Control Panel'});
 assert.equal(await sidebar.getByRole('button').count(),9,'sidebar must show all 9 operational areas');
 assert.equal(await page.locator('.vma27-access-form').count(),0,'valid mock admin does not show login');
 assert.ok(await page.locator('.vma27-topbar').getByText('ui-qa@example.invalid').isVisible(),'verified identity is clear');
 await sidebar.getByRole('button',{name:'Produk & SKU'}).click();
 await page.waitForURL(u=>u.pathname==='/admin'&&u.searchParams.get('tab')==='products');
 assert.ok(await page.getByRole('heading',{name:'Produk & SKU'}).first().isVisible());
 const font=await page.locator('.vma26-editor>label').first().evaluate(n=>Number.parseFloat(getComputedStyle(n).fontSize));
 assert.ok(font>=14,'form labels must be at least 14px');
 await sidebar.getByRole('button',{name:'Media & Aset'}).click();
 await page.waitForURL(u=>u.pathname==='/admin/media',{timeout:15000});
 await page.locator('.vml-root').waitFor({timeout:15000});
 assert.ok(await page.getByRole('heading',{name:'Media & Aset'}).first().isVisible());
 assert.ok(await sidebar.getByRole('button',{name:'Media & Aset'}).getAttribute('aria-current')==='page','media navigation is active');
 await page.setViewportSize({width:390,height:844});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.vml-root').waitFor({timeout:15000});
 await page.getByRole('button',{name:'Buka navigasi'}).click();
 assert.ok(await page.locator('.vma27-sidebar.is-open').isVisible(),'mobile sidebar toggles open');
 await page.getByRole('navigation',{name:'Menu Control Panel'}).getByRole('button',{name:'Ringkasan'}).click();
 await page.waitForURL(u=>u.pathname==='/admin');
 await page.getByRole('heading',{name:'Dashboard'}).first().waitFor();
 assert.equal(await page.locator('.vma27-sidebar.is-open').count(),0,'drawer should close after navigation');
 const mobile=await page.evaluate(()=>({width:window.innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(mobile.scroll<=mobile.width+3,'mock admin mobile overflow '+JSON.stringify(mobile));
 const menuButton=page.getByRole('button',{name:'Buka navigasi'});
 await menuButton.click();
 assert.ok(await page.locator('.vma27-sidebar.is-open').isVisible());
 await page.locator('.vma27-close-nav').click();
 assert.equal(await page.locator('.vma27-sidebar.is-open').count(),0);
 console.log('VAPMART_ADMIN_WORKSPACE_UI_QA_PASS',{sections:9,media:true,labels:font,mobile});
}finally{await context.close();await browser.close();}
