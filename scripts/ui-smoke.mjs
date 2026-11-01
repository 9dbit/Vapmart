import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE='https://vapmart-web-staging.up.railway.app';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 let deployed=false;
 for(let i=0;i<42;i++){
  try{
   const r=await page.goto(BASE+'/',{waitUntil:'domcontentloaded',timeout:20000});
   const login=await page.request.get(BASE+'/brand/login',{timeout:10000});
   if(r?.status()===200&&await page.locator('.vm-storefront-restored').count()===1&&login.status()===200){deployed=true;break;}
  }catch(e){console.log('Waiting for restored storefront',i,String(e).slice(0,120));}
  await sleep(7000);
 }
 assert.ok(deployed,'Restored homepage and brand login not deployed');
 await page.locator('.vm-carousel-shell').waitFor();
 assert.equal(await page.locator('.vm-carousel-slide').count(),3,'restore three original hero slides');
 assert.equal(await page.locator('.vm-trendora-category-image img').count(),5,'restore all original category thumbnails');
 assert.equal(await page.locator('.vm-reference-news-card').count(),10,'restore historic editorial grid');
 assert.ok(await page.locator('.vm-restored-archived-brands .vm-brand-card').count()===12
  ||await page.locator('.vm-brand-rail .vm-brand-card').count()>0,'restore brand rail and original logo references');
 const refCards=page.locator('.vm-restored-reference-card');
 assert.ok(await refCards.count()>0,'restore historical visual product cards when live catalog is empty');
 assert.equal(await refCards.locator('button').count(),0,'historical cards must have no buy button');
 assert.equal(await refCards.locator('a').count(),0,'historical cards must not link to checkout');
 assert.ok(await page.locator('.vm-trendora-categories .vm-trendora-see-all').isVisible(),'catalog entry available');
 await page.goto(BASE+'/brand-partner',{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(await page.locator('.vm-reference-card').count(),0,'brand page must not display archived products');
 await page.goto(BASE+'/catalog',{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(await page.locator('.product-card').filter({hasText:'DEMO'}).count(),0,'seed demo products must not appear in public catalog');
 assert.equal(await page.locator('.vm-restored-catalog-reference .vm-restored-reference-card').count(),19,'read-only gallery preserves all 19 historic product references');
 await page.goto(BASE+'/product-category/pod',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForURL(/\/catalog(?:\?|$)/,{timeout:15000});
 await page.goto(BASE+'/asset-review',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForURL(/\/catalog(?:\?|$)/,{timeout:15000});
 await page.goto(BASE+'/brand/login',{waitUntil:'domcontentloaded',timeout:30000});
 await page.getByText('Brand Partner',{exact:false}).first().waitFor();
 await page.locator('.vm-brand-portal-root').waitFor();
 assert.equal(await page.locator('.legacy-header').count(),0,'brand login must be separate from customer storefront');
 assert.equal(await page.locator('.legacy-footer').count(),0,'brand login must hide storefront footer');
 await page.goto(BASE+'/brand/accept',{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('.vm-brand-portal-root').waitFor();
 assert.equal(await page.locator('.legacy-header').count(),0,'brand invitation page must have isolated shell');
 assert.ok(await page.getByText('Join your', {exact:false}).first().isVisible(),'brand invite acceptance entry renders');
 await page.goto(BASE+'/admin/login',{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('.vma26-root').waitFor();
 assert.equal(await page.locator('.legacy-header').count(),0,'admin login must hide customer header');
 const [config,anonBrand,anonAccess,anonCourier,archive]=await Promise.all([
  page.request.get(BASE+'/api/shipping/config'),
  page.request.get(BASE+'/api/brand-portal/me'),
  page.request.get(BASE+'/api/admin/brand-access/25f397b8-564f-46f4-971e-bc1d333ac1d0'),
  page.request.post(BASE+'/api/shipping/rates',{data:{destinationPostalCode:'40115',items:[]}}),
  page.request.get(BASE+'/api/archive')
 ]);
 assert.equal(config.status(),200,'shipping config route must work');
 const cfg=await config.json();assert.equal(cfg.paymentEnabled,false);assert.equal(cfg.bookingEnabled,false);
 assert.equal(anonBrand.status(),401,'brand data must require authenticated session');
 assert.equal(anonAccess.status(),401,'admin brand assignments must require admin token');
 assert.equal(anonCourier.status(),401,'courier rate requests must require authenticated session');
 assert.equal(archive.status(),404,'legacy archive API must not be publicly exposed');
 await page.setViewportSize({width:390,height:844});
 await page.goto(BASE+'/',{waitUntil:'domcontentloaded',timeout:30000});
 const mobile=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth:window.innerWidth}));
 assert.ok(mobile.scrollWidth<=mobile.innerWidth+3,'homepage mobile overflow '+JSON.stringify(mobile));
 await page.goto(BASE+'/brand/login',{waitUntil:'domcontentloaded',timeout:30000});
 const brandMobile=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth:window.innerWidth}));
 assert.ok(brandMobile.scrollWidth<=brandMobile.innerWidth+3,'brand login mobile overflow');
 console.log('VAPMART_STOREFRONT_LAYOUT_RESTORED_UI_SMOKE_SUCCESS',{mobile,brandMobile,banners:3,categories:5,archivePreview:'read-only',booking:false});
}finally{await browser.close();}
