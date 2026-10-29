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
      if(response?.status()===200&&await page.locator('[data-vapmart-ui="cp12"]').count()===1 && await page.locator('.vm-footer-links h3',{hasText:'Jelajahi'}).count()===1){ready=true;break;}
    }catch(e){console.log('wait for staging revision',attempt,String(e).slice(0,100));}
    await sleep(6000);
  }
  assert.ok(ready,'Checkpoint12 final UI did not appear on staging within deployment retry window');
  // Font metrics can change for a few frames after DOMContentLoaded on GitHub Actions.
  // Settle network activity and web fonts before measuring WordPress pixel positions.
  await page.waitForLoadState('networkidle',{timeout:45000});
  await page.evaluate(async()=>{if(document.fonts)await document.fonts.ready;});

  await page.locator('.vm-reference-card').first().waitFor({timeout:15000});
  assert.equal(await page.locator('.vm-carousel-slide').count(),3,'Original carousel should contain three slides');
  assert.equal(await page.locator('.vm-carousel-dots button').count(),3,'three pill dots');
  await page.locator('.vm-carousel-dots button').nth(1).click();
  assert.equal(await page.locator('.vm-carousel-dots button').nth(1).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.vm-carousel-pause').getAttribute('aria-label'),'Lanjutkan putaran banner');
  await page.locator('.vm-carousel-pause').click();
  assert.ok(await page.locator('#vm-header-query').isVisible(),'desktop pill search');
  assert.equal(await page.locator('.vm-desktop-links a').count(),4,'new desktop nav pills');
  const shell=await page.evaluate(()=>{
    const radius=s=>parseFloat(getComputedStyle(document.querySelector(s)).borderTopLeftRadius);
    return {nav:radius('.vm-desktop-links'),card:radius('.vm-reference-card'),hero:radius('.vm-carousel-shell')};
  });
  assert.ok(shell.nav>=20&&shell.card>=14&&shell.hero>=20,'pill theme missing: '+JSON.stringify(shell));
  assert.ok(await page.locator('.vm-parallax-atmosphere').count()===1,'decorative parallax layer');
  const shiftBefore=await page.locator('.vm-parallax-atmosphere').evaluate(e=>e.style.getPropertyValue('--vm-parallax-y'));
  await page.evaluate(()=>window.scrollTo({top:240,behavior:'instant'}));
  await page.waitForTimeout(350);
  const shiftAfter=await page.locator('.vm-parallax-atmosphere').evaluate(e=>e.style.getPropertyValue('--vm-parallax-y'));
  assert.notEqual(shiftBefore,shiftAfter,'desktop decorative parallax should respond to scrolling');
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.waitForTimeout(200);
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
      firstCardTop:Math.round(px('.vm-reference-card').top),
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
  assert.equal(visual.headerHeight,82,'modern desktop header is 82px');
  assert.ok(Math.abs(visual.bannerWidth-1296)<=4,'desktop banner should use 90% at 1440px');
  assert.equal(visual.productColumns,6,'original featured grid should have six columns desktop');
  assert.ok(visual.firstCardTop>650&&visual.firstCardTop<1650,'desktop featured card location unreasonable: '+visual.firstCardTop);
  assert.equal(visual.newsColumns,5,'original news grid should have five columns desktop');
  assert.match(visual.headerBg,/rgba?\(/,'dark glass header expected');
  assert.ok(visual.logoLoaded,'Vapmart original logo should load');
  assert.match(visual.bannerSrc,/desktop-01\.png/);
  for(const x of visual.pairs)assert.ok(x.ratio>=4.5,'Unreadable '+x.name+' contrast '+x.ratio);
  assert.equal(await page.locator('.vm-reference-card button').count(),0,'archival products must not have purchase buttons');
  // Archive category snapshot: actual WordPress Pod order, read-only.
  await page.goto(BASE+'/product-category/pod',{waitUntil:'networkidle',timeout:45000});
  assert.equal(await page.locator('.vm-category-page[data-legacy-category="pod"]').count(),1);
  assert.equal(await page.locator('.vm-category-page .vm-archive-link').count(),12);
  assert.equal(await page.locator('.vm-category-page .vm-archive-link button').count(),0);
  assert.match(await page.locator('.vm-category-page .vm-archive-link').first().innerText(),/Into Earth Mission/);
  const categoryMetrics=await page.locator('.vm-category-page .vm-archive-link').first().boundingBox();
  assert.ok(categoryMetrics&&categoryMetrics.y>90&&categoryMetrics.y<440,'Pod desktop card position unreasonable');
  await page.locator('.vm-category-page .vm-archive-link').first().click();
  await page.waitForURL(/\/product\/into-earth-mission-1100mah-pod-system-kit/,{timeout:15000});
  assert.equal(await page.locator('.vm-detail-hero-image img').count(),1);
  assert.ok(await page.locator('.vm-detail-hero-image img').evaluate(img=>img.complete&&img.naturalWidth>0));
  assert.ok(await page.locator('.vm-detail-disabled-actions button').first().isDisabled());
  // GitHub Actions can start before Railway finishes deploying the corresponding source.
  // Wait for the exact original INTO badge introduced in this release.
  let partnerReleaseReady=false;
  for(let attempt=0;attempt<48;attempt++){
    await page.goto(BASE+'/product/into-mission-replacement-pods',{waitUntil:'domcontentloaded',timeout:30000});
    if(await page.locator('.vm-detail-partner-icon img').count()===1){partnerReleaseReady=true;break;}
    console.log('Waiting for storefront release logo',attempt);
    await sleep(5000);
  }
  assert.ok(partnerReleaseReady,'Railway staging has not activated Checkpoint 10 logo revision');
  await page.waitForLoadState('networkidle',{timeout:45000});
  assert.equal(await page.locator('.vm-detail-thumb').count(),2,'Original cartridge gallery should have two images');
  const detailMetrics=await page.locator('.vm-detail-hero-image').boundingBox();
  assert.ok(detailMetrics&&detailMetrics.y>75&&detailMetrics.y<390,'desktop product image position unreasonable');
  assert.ok(await page.getByRole('button',{name:'Tampilkan foto 2'}).isEnabled());
  await page.getByRole('button',{name:'Tampilkan foto 2'}).click();
  assert.match(await page.locator('.vm-detail-hero-image img').getAttribute('src'),/mission-gallery-02\.png/);
  assert.ok(await page.locator('.vm-detail-hero-image img').evaluate(img=>img.complete&&img.naturalWidth===600),'Correct archived secondary product photo should load');
  assert.ok(await page.locator('.vm-detail-partner-icon img').evaluate(img=>img.complete&&img.naturalWidth===100),'Original Into brand image should load');
  assert.ok(await page.getByRole('button',{name:'Beli Sekarang'}).isDisabled());
  await page.goto(BASE+'/brand-partner',{waitUntil:'networkidle',timeout:45000});
  assert.equal(await page.locator('.vm-partner-logos img').count(),12);
  await page.goto(BASE+'/login',{waitUntil:'networkidle',timeout:45000});
  assert.ok(await page.locator('#customer-identity').isDisabled());
  assert.ok(await page.getByRole('button',{name:'Login belum tersedia'}).isDisabled());
  await page.goto(BASE+'/member-2',{waitUntil:'networkidle',timeout:45000});
  assert.match(await page.locator('.vm-member-tiles').innerText(),/0 Points/);
  await page.goto(BASE+'/catalog',{waitUntil:'networkidle',timeout:45000});
  await page.locator('.product-card').first().waitFor({timeout:30000});
  assert.ok(await page.locator('.product-card').count()>=4,'four DEMO items should remain in a separate catalog');
  await page.getByRole('button',{name:/Tambahkan DEMO/}).first().click();
  await page.getByRole('dialog',{name:'Keranjang belanja'}).waitFor();
  assert.equal(await page.locator('.cart-row').count(),1);
  await page.getByRole('button',{name:'Tutup',exact:true}).click();
  assert.equal(await page.getByRole('dialog',{name:'Keranjang belanja'}).count(),0,'closing cart drawer must dismiss modal');
  await page.goto(BASE+'/keranjang-2',{waitUntil:'networkidle',timeout:45000});
  assert.equal(await page.locator('.vm-cart-item').count(),1,'DEMO cart should persist across routes');
  assert.ok(await page.getByRole('button',{name:'Checkout belum tersedia'}).isDisabled());
  const beforeQty=await page.locator('.vm-cart-qty span').first().innerText();
  await page.locator('.vm-cart-qty button').last().click();
  assert.equal(Number(await page.locator('.vm-cart-qty span').first().innerText()),Number(beforeQty)+1,'Cart quantity should increment');
  await page.getByRole('button',{name:'Hapus'}).first().click();
  assert.equal(await page.locator('.vm-cart-item').count(),0,'Delete should remove cart item');
  await page.goto(BASE+'/catalog',{waitUntil:'networkidle',timeout:45000});
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
    firstCardTop:Math.round(document.querySelector('.vm-reference-card').getBoundingClientRect().top+window.scrollY),
    bannerSrc:document.querySelector('.vm-carousel-slide img').currentSrc,
    columns:getComputedStyle(document.querySelector('.vm-reference-grid')).gridTemplateColumns.trim().split(/\s+/).length,
    scroll:document.documentElement.scrollWidth,view:window.innerWidth
  }));
  assert.equal(mobile.headerHeight,66,'modern mobile header is 66px');
  assert.ok(mobile.firstCardTop>400&&mobile.firstCardTop<1500,'mobile first-card position unreasonable');
  assert.equal(mobile.columns,2);
  assert.match(mobile.bannerSrc,/mobile-01\.png/);
  assert.ok(mobile.scroll<=mobile.view+2,'horizontal overflow '+JSON.stringify(mobile));
  assert.ok(await page.locator('.vm-reference-mobile-nav').isVisible(),'mobile navigation visible');
  const mobilePill=await page.locator('.vm-reference-mobile-nav').evaluate(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius));
  assert.ok(mobilePill>=30,'mobile nav should be a floating pill');
  const labelFont=await page.locator('.vm-modern-mobile-nav a span').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  assert.ok(labelFont<=11,'mobile navigation label must not overlap: '+labelFont+'px');
  const tapTarget=await page.locator('.vm-reference-mobile-nav a').first().boundingBox();
  assert.ok(tapTarget&&tapTarget.height>=44,'mobile nav touch target must be at least 44px');
  await page.goto(BASE+'/product-category/pod',{waitUntil:'networkidle',timeout:45000});
  const mobileCategory=await page.locator('.vm-category-page .vm-archive-link').first().boundingBox();
  assert.ok(mobileCategory&&mobileCategory.y>80&&mobileCategory.y<470,'mobile Pod first card position unreasonable');
  assert.equal(await page.locator('.vm-category-page .vm-archive-link').count(),12);
  await page.goto(BASE+'/product/into-mission-replacement-pods',{waitUntil:'networkidle',timeout:45000});
  const mobileDetail=await page.locator('.vm-detail-hero-image').boundingBox();
  assert.ok(mobileDetail&&mobileDetail.y>50&&mobileDetail.y<230,'mobile product hero position unreasonable');
  assert.ok(await page.locator('.vm-detail-disabled-actions button').first().isDisabled());
  assert.ok(await page.locator('.vm-modern-mobile-nav').isVisible(),'mobile detail navigation visible');
  await page.goto(BASE+'/keranjang-2',{waitUntil:'networkidle',timeout:45000});
  const cartOverflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:window.innerWidth}));
  assert.ok(cartOverflow.scroll<=cartOverflow.view+2,'mobile cart horizontal overflow '+JSON.stringify(cartOverflow));
  const reduced=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  try{
    await reduced.goto(BASE+'/',{waitUntil:'networkidle',timeout:45000});
    const motion=await reduced.evaluate(()=>({
      prefer:matchMedia('(prefers-reduced-motion: reduce)').matches,
      display:getComputedStyle(document.querySelector('.vm-parallax-atmosphere')).display
    }));
    assert.equal(motion.prefer,true);
    assert.equal(motion.display,'none','reduced-motion setting must disable parallax');
  }finally{await reduced.close();}
  console.log('VAPMART_UI_SMOKE_SUCCESS',JSON.stringify({visual,mobile,archiveProducts:12,news:10,cart:'tested-on-catalog',checkout:'disabled'}));
}finally{await browser.close();}
