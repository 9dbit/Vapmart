import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE='https://vapmart-web-staging.up.railway.app';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark'});
const page=await context.newPage();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const mode=()=>page.locator('html').getAttribute('data-vapmart-color-mode');
const choose=async(label)=>{
 await page.locator('.vm23-theme-trigger').click();
 await page.locator('.vm23-theme-menu button',{hasText:label}).click();
};
try{
 let ready=false;
 for(let i=0;i<45;i++){
   try{
     const response=await page.goto(BASE+'/member-2',{waitUntil:'domcontentloaded',timeout:20000});
     if(response?.status()===200
       &&await page.locator('body[data-vapmart-theme-options="cp23"]').count()
       &&await page.locator('.vm23-theme-switcher').count()){ready=true;break;}
   }catch(e){console.log('wait theme',i,String(e).slice(0,90));}
   await sleep(6000);
 }
 assert.ok(ready,'CP23 theme release did not reach Railway');
 await page.waitForLoadState('networkidle',{timeout:45000});
 assert.equal(await mode(),'light','new visitors keep existing light mode even on dark OS');
 assert.equal(await page.locator('.vm23-theme-menu button').count(),3,'light, dark and system are required');
 const lightBg=await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.ok(lightBg!=='rgb(14, 14, 18)','light palette must remain enabled by default');
 await choose('Dark');
 await page.waitForFunction(()=>document.documentElement.dataset.vapmartColorMode==='dark');
 assert.equal(await page.evaluate(()=>localStorage.getItem('vapmart.color-mode.v1')),'dark','choice persists');
 assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(14, 14, 18)');
 await page.waitForFunction(()=>{const el=document.querySelector('.vm22-member-shortcut.is-lilac');return el&&getComputedStyle(el).backgroundColor==='rgb(48, 34, 63)';},null,{timeout:6000});
 assert.equal(await page.locator('.vm22-member-shortcut.is-lilac').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(48, 34, 63)','benefit cards must be solid dark after transition');
 const card=await page.locator('.vm22-member-card').evaluate(el=>{
   const r=el.getBoundingClientRect();
   return {ratio:r.width/r.height,purple:getComputedStyle(el.querySelector('.vm22-card-purple-panel')).backgroundColor,
      grey:getComputedStyle(el.querySelector('.vm22-card-charcoal-panel')).backgroundColor,
      overflow:document.documentElement.scrollWidth-window.innerWidth};
 });
 assert.ok(Math.abs(card.ratio-85.6/53.98)<.025,'Member Card ISO dimensions are unchanged');
 assert.equal(card.purple,'rgb(128, 16, 230)');
 assert.equal(card.grey,'rgb(32, 32, 38)');
 assert.ok(card.overflow<=2,'no mobile horizontal overflow on member');
 const popup=await page.locator('.vm23-theme-switcher').evaluate(el=>{
   const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width}
 });
 assert.ok(popup.right<=390&&popup.left>=0,'theme button must fit mobile header');
 const firstLogo=await page.locator('.legacy-logo').boundingBox();
 await page.goto(BASE+'/catalog',{waitUntil:'networkidle',timeout:45000});
 assert.equal(await mode(),'dark','dark theme persists across navigation');
 await page.reload({waitUntil:'networkidle',timeout:45000});
 assert.equal(await mode(),'dark','dark theme must paint before hydration on refresh');
 const headerBg=await page.locator('.vm-modern-header').evaluate(el=>getComputedStyle(el).backgroundColor);
 assert.equal(headerBg,'rgb(19, 19, 23)','sticky header turns solid graphite');
 assert.ok(await page.locator('.legacy-logo img').evaluate(el=>el.complete&&el.naturalWidth>0),'authentic logo still loads');
 const newLogo=await page.locator('.legacy-logo').boundingBox();
 assert.ok(firstLogo&&newLogo&&Math.abs(firstLogo.x-newLogo.x)<2,'logo stays fixed between member and catalog');
 await page.goto(BASE+'/keranjang-2',{waitUntil:'networkidle',timeout:45000});
 assert.equal(await mode(),'dark');
 assert.equal(await page.locator('.vm21-cart-empty-page').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(25, 25, 30)','cart empty state is dark');
 await choose('Ikuti Sistem');
 await page.waitForFunction(()=>document.documentElement.dataset.vapmartColorMode==='dark');
 assert.equal(await page.evaluate(()=>localStorage.getItem('vapmart.color-mode.v1')),'system');
 await page.emulateMedia({colorScheme:'light'});
 await page.waitForFunction(()=>document.documentElement.dataset.vapmartColorMode==='light');
 await page.emulateMedia({colorScheme:'dark'});
 await page.waitForFunction(()=>document.documentElement.dataset.vapmartColorMode==='dark');
 await choose('Light');
 await page.waitForFunction(()=>document.documentElement.dataset.vapmartColorMode==='light');
 assert.equal(await page.evaluate(()=>localStorage.getItem('vapmart.color-mode.v1')),'light');
 await page.reload({waitUntil:'networkidle',timeout:45000});
 assert.equal(await mode(),'light','user light override wins over dark OS after reload');
 assert.equal(await page.locator('html').evaluate(el=>el.style.colorScheme),'light');
 assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),'#ffffff');
 await page.setViewportSize({width:360,height:780});
 await choose('Dark');
 const compact=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,menuRight:document.querySelector('.vm23-theme-switcher').getBoundingClientRect().right}));
 assert.ok(compact.overflow<=2,'360px screen overflow '+JSON.stringify(compact));
 assert.ok(compact.menuRight<=360,'theme switcher must not overflow 360px header');
 console.log('VAPMART_THEME_SMOKE_SUCCESS',JSON.stringify({initial:lightBg,card,headerBg,modes:['light','dark','system'],compact}));
}finally{await context.close();await browser.close();}
