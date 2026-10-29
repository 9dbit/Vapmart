import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE='https://vapmart-web-staging.up.railway.app';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
try{
  let ready=false;
  for(let attempt=0;attempt<45;attempt++){
    try{
      const response=await page.goto(BASE+'/',{waitUntil:'domcontentloaded',timeout:20000});
      if(response?.status()===200&&await page.locator('[data-vapmart-ui="cp09"]').count()===1){ready=true;break;}
    }catch(e){console.log('wait for staging revision',attempt,String(e).slice(0,100));}
    await sleep(6000);
  }
  assert.ok(ready,'Checkpoint09 UI did not appear on staging within deployment retry window');
  await page.locator('.vm-reference-card').first().waitFor({timeout:15000});
  assert.equal(await page.locator('.vm-carousel-slide').count(),3,'Original carousel should contain three slides');
  assert.equal(await page.locator('.vm-brand-logo').count(),12,'Original brand slider should contain 12 logos');
  assert.equal(await page.locator('.vm-feature-category').count(),5,'Original category rail should have five tiles');
  assert.equal(await page.locator('.vm-reference-card').count(),12,'Original reference has twelve product cards');
  assert.equal(await page.locator('.vm-reference-news-card').count(),10,'Original reference has ten article cards');
  for(const id of ['categories','promo','brand','shop','news'])assert.equal(await page.locator('#'+id).count(),1,'missing section '+id);
  const visual=await page.evaluate(()=>{
    const px=selector=>document.querySelector(selector).getBoundingClientRect();
    const rgb=value=>(value.match(/\d+(?:\.\d+)?/g)||[]).slice(0,3).map(Number);
    const luminance=value=>rgb(value).reduce((sum,c,i)=>{
      const x=c/255;return sum+[0.2126,0.7152,0.0722][i]*(x<=0.04045?x/12.92:Math.pow((x+0.055)/1.055,2.4));
    },0);
    const contrast=(fg,bg)=>{
      const x=luminance(fg),y=luminance(bg);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
    };
    const header=getComputedStyle(document.querySelector('.vm-reference-header'));
    const pairs=[
      ['Product reference','.vm-reference-card h3','.vm-reference-card'],
      ['News article','.vm-reference-news-card>div','.vm-reference-news-card']
    ];
    return {
      headerHeight:Math.round(px('.vm-reference-header').height),
      bannerWidth:Math.round(px('.vm-original-banner').width),
      productColumns:getComputedStyle(document.querySelector('.vm-reference-grid')).gridTemplateColumns.trim().split(/\s+/).length,
      newsColumns:getComputedStyle(document.querySelector('.vm-reference-news-grid')).gridTemplateColumns.trim().split(/\s+/).length,
      headerBg:header.backgroundColor,
      logoLoaded:document.querySelector('.legacy-logo img').naturalWidth>0,
      bannerSrc:document.querySelector('.vm-carousel-slide img').currentSrc,
      pairs:pairs.map(([name,fg,bg])=>({
        name,ratio:contrast(getComputedStyle(document.querySelector(fg)).color,getComputedStyle(document.querySelector(bg)).backgroundColor)
      }))
    };
  });
  assert.equal(visual.headerHeight,72,'original desktop header is 72px');
  assert.ok(Math.abs(visual.bannerWidth-1296)<=4,'desktop banner should use 90% at 1440px');
  assert.equal(visual.productColumns,6,'original featured grid should have six columns desktop');
  assert.equal(visual.newsColumns,5,'original news grid should have five columns desktop');
  assert.equal(visual.headerBg,'rgb(18, 18, 18)');
  assert.ok(visual.logoLoaded,'Vapmart original logo should load');
  assert.match(visual.bannerSrc,/desktop-01\.png/);
  for(const x of visual.pairs)assert.ok(x.ratio>=4.5,'Unreadable '+x.name+' contrast '+x.ratio);
  assert.equal(await page.locator('.vm-reference-card button').count(),0,'archival products must not have purchase buttons');
  await page.goto(BASE+'/catalog',{waitUntil:'networkidle',timeout:45000});
  await page.locator('.product-card').first().waitFor({timeout:30000});
  assert.ok(await page.locator('.product-card').count()>=4,'four DEMO items should remain in a separate catalog');
  await page.getByRole('button',{name:/Tambahkan DEMO/}).first().click();
  await page.getByRole('dialog',{name:'Keranjang belanja'}).waitFor();
  assert.equal(await page.locator('.cart-row').count(),1);
  await page.getByRole('button',{name:'Tutup',exact:true}).click();
  await page.locator('#shop-search').fill('Ceramic');
  assert.equal(await page.locator('.product-card').count(),1);
  await page.locator('.product-card a').first().click();
  await page.waitForURL(/\/product\/demo-ceramic-accent-vase/,{timeout:15000});
  assert.match(await page.locator('h1').innerText(),/Ceramic Accent Vase/);
  await page.goto(BASE+'/catalog?category=decor#shop',{waitUntil:'networkidle',timeout:45000});
  assert.equal(await page.locator('.product-card').count(),1,'decor filter should be respected');
  await page.setViewportSize({width:390,height:844});
  await page.goto(BASE+'/',{waitUntil:'networkidle',timeout:45000});
  const mobile=await page.evaluate(()=>({
    headerHeight:Math.round(document.querySelector('.vm-reference-header').getBoundingClientRect().height),
    bannerSrc:document.querySelector('.vm-carousel-slide img').currentSrc,
    columns:getComputedStyle(document.querySelector('.vm-reference-grid')).gridTemplateColumns.trim().split(/\s+/).length,
    scroll:document.documentElement.scrollWidth,view:window.innerWidth
  }));
  assert.equal(mobile.headerHeight,64);
  assert.equal(mobile.columns,2);
  assert.match(mobile.bannerSrc,/mobile-01\.png/);
  assert.ok(mobile.scroll<=mobile.view+2,'horizontal overflow '+JSON.stringify(mobile));
  assert.ok(await page.locator('.vm-reference-mobile-nav').isVisible(),'mobile navigation visible');
  console.log('VAPMART_UI_SMOKE_SUCCESS',JSON.stringify({visual,mobile,archiveProducts:12,news:10,cart:'tested-on-catalog',checkout:'disabled'}));
}finally{await browser.close();}
