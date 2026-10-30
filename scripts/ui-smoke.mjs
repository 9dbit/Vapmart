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
      if(response?.status()===200&&await page.locator('[data-vapmart-ui="cp21"]').count()===1 && await page.locator('[data-vapmart-theme="coin-cp21"]').count()===1 && await page.locator('.vm-footer-links h3',{hasText:'Jelajahi'}).count()===1 && await page.locator('.vm-header-main').evaluate(el=>getComputedStyle(el).backgroundColor==='rgba(0, 0, 0, 0)')){ready=true;break;}
    }catch(e){console.log('wait for staging revision',attempt,String(e).slice(0,100));}
    await sleep(6000);
  }
  assert.ok(ready,'Checkpoint21 coin store UI did not appear on staging within deployment retry window');
  // Font metrics can change for a few frames after DOMContentLoaded on GitHub Actions.
  // Settle network activity and web fonts before measuring WordPress pixel positions.
  await page.waitForLoadState('networkidle',{timeout:45000});
  await page.evaluate(async()=>{if(document.fonts)await document.fonts.ready;});

  await page.locator('.vm-reference-card').first().waitFor({timeout:15000});
  assert.equal(await page.locator('.vm-trendora-category img').count(),5,'five original Vapmart category images');
  const categoryImages=await page.locator('.vm-trendora-category img').evaluateAll(imgs=>imgs.map(img=>({src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0})));
  assert.ok(categoryImages.every(img=>img.src?.startsWith('/legacy/categories/')&&img.loaded),'category thumbnails must come from original Vapmart assets: '+JSON.stringify(categoryImages));
  assert.equal(await page.locator('.vm-home-intro').count(),0,'intro/search block removed');
  const merchandising=await page.evaluate(()=>({
    hero:document.querySelector('.vm-hero-stage').getBoundingClientRect().top+scrollY,
    categories:document.querySelector('.vm-trendora-categories').getBoundingClientRect().top+scrollY,
    products:document.querySelector('.vm-trendora-featured').getBoundingClientRect().top+scrollY,
    pageBg:getComputedStyle(document.body).backgroundColor
  }));
  assert.ok(merchandising.hero<merchandising.categories&&merchandising.categories<merchandising.products,'homepage order must be hero > category thumbnails > featured products');
  assert.match(merchandising.pageBg,/rgb\(24[0-9], 24[0-9], 23[0-9]\)/,'light ivory theme expected');
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
  const brandSources=await page.locator('.vm-trendora-brands .vm-brand-card img').evaluateAll(images=>images.map(img=>img.getAttribute('src')));
  assert.deepEqual(brandSources,Array.from({length:12},(_,i)=>'/legacy/brands/brand-'+String(i+1).padStart(2,'0')+'.png'));
  const brandStageColor=await page.locator('.vm-trendora-brands .vm-brand-stage').first().evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.equal(brandStageColor,'rgb(24, 19, 31)','white legacy logo must have a dark contrast stage');
  assert.equal(await page.locator('.vm-trendora-category').count(),5,'Original category rail should have five tiles');
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
  assert.equal(visual.headerHeight,79,'Trendora desktop header is 79px');
  assert.ok(Math.abs(visual.bannerWidth-1296)<=4,'desktop banner should use 90% at 1440px');
  assert.equal(visual.productColumns,4,'Trendora featured grid should have four columns desktop');
  assert.ok(visual.firstCardTop>520&&visual.firstCardTop<1800,'desktop featured card location unreasonable: '+visual.firstCardTop);
  assert.equal(visual.newsColumns,5,'original news grid should have five columns desktop');
  assert.match(visual.headerBg,/rgba?\(/,'light glass header expected');
  assert.ok(visual.logoLoaded,'Vapmart original logo should load');
  const headerInner=await page.locator('.vm-header-main').evaluate(el=>({
    background:getComputedStyle(el).backgroundColor,
    logoFilter:getComputedStyle(el.querySelector('.legacy-logo img')).filter
  }));
  assert.match(headerInner.background,/rgba\(0, 0, 0, 0\)/,'legacy header inner must be transparent on white header');
  assert.equal(headerInner.logoFilter,'none','attached logo should not have CSS filter');
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
  await page.locator('.vm-detail-hero-image img').first().waitFor({state:'visible',timeout:15000});
  await page.waitForFunction(()=>{const image=document.querySelector('.vm-detail-hero-image img');return Boolean(image&&image.complete&&image.naturalWidth>0);},null,{timeout:15000});
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
  await page.locator('.vm21-auth-card').waitFor();
  assert.ok(await page.locator('.vm21-auth-tabs').isVisible(),'real sign in/sign up tabs');
  assert.ok(await page.locator('.vm21-auth-form input[type="email"]').isVisible(),'email input');
  await page.getByRole('button',{name:'Daftar',exact:true}).click();
  assert.ok(await page.locator('.vm21-auth-form input[autocomplete="name"]').isVisible(),'signup name');
  await page.getByRole('button',{name:'Masuk',exact:true}).first().click();
  assert.ok(await page.locator('.vm21-auth-form input[type="password"]').isVisible(),'password input');
  if(await page.locator('.vm21-config-warning').count()){
    assert.ok(await page.locator('.vm21-auth-form button[type="submit"]').isDisabled(),'auth disabled only when dedicated Supabase is not configured');
  }
  await page.goto(BASE+'/member-2',{waitUntil:'networkidle',timeout:45000});
  await page.locator('.vm-new-member-card').waitFor();
  assert.ok(await page.locator('.vm-new-member-card').isVisible(),'Vapmart Member Card');
  assert.equal(await page.locator('.vm21-member-tabs button').count(),4,'all member tabs');
  await page.getByRole('tab',{name:'Top Up'}).click();
  const coinVisuals=await page.locator('.vm21-coin-pack').evaluateAll(cards=>cards.map(card=>card.querySelectorAll('.vm-gold-coin').length));
  assert.deepEqual(coinVisuals,[3,5,9,13,19,26],'larger Coin pack must show more gold coins');
  assert.equal(await page.locator('.vm21-coin-pack').count(),6,'six fixed value coin packs');
  await page.getByRole('button',{name:/Masukkan Keranjang/}).click();
  assert.equal(await page.locator('.vm21-drawer-item').count(),1,'Coin pack enters cart as a digital product');
  assert.match(await page.locator('.vm21-drawer-item').innerText(),/DIGITAL PRODUCT/);
  await page.getByRole('button',{name:'Tutup keranjang',exact:true}).last().click();
  await page.goto(BASE+'/keranjang-2',{waitUntil:'networkidle',timeout:45000});
  assert.equal(await page.locator('.vm21-cart-product').count(),1,'digital SKU stays in cart');
  await page.getByRole('button',{name:/Tinjau Pembelian Coin/}).click();
  assert.match(await page.locator('.vm21-checkout-review').innerText(),/Coin baru masuk saldo setelah webhook/);
  await page.getByRole('button',{name:/Hapus/}).first().click();
  assert.equal(await page.locator('.vm21-cart-product').count(),0,'digital pack removal works');
  await page.goto(BASE+'/catalog',{waitUntil:'networkidle',timeout:45000});
  await page.locator('.product-card').first().waitFor({timeout:30000});
  assert.ok(await page.locator('.product-card').count()>=4,'four DEMO items should remain in a separate catalog');
  // CP17: wait for the released favorite controls and confirm persistence across routes.
  let favoritesReleaseReady=false;
  for(let attempt=0;attempt<40;attempt++){
    if(await page.locator('.vm-cp17-card-favorite').count()>=4){favoritesReleaseReady=true;break;}
    await sleep(5000);
    await page.reload({waitUntil:'networkidle',timeout:45000});
  }
  assert.ok(favoritesReleaseReady,'Checkpoint17 wishlist UI did not reach staging');
  const savedDetailHref=await page.locator('.product-card .product-art').first().getAttribute('href');
  assert.ok(savedDetailHref?.startsWith('/product/'),'favorite must map to product detail');
  const favToggle=page.locator('.vm-cp17-card-favorite').first();
  assert.equal(await favToggle.getAttribute('aria-pressed'),'false','first product should start unsaved in new test browser');
  await favToggle.click();
  assert.equal(await favToggle.getAttribute('aria-pressed'),'true','heart should mark product as saved');
  await page.getByRole('button',{name:'Tampilkan hanya produk favorit'}).click();
  assert.equal(await page.locator('.product-card').count(),1,'favorites filter must show only saved products');
  await page.reload({waitUntil:'networkidle',timeout:45000});
  assert.equal(await page.locator('.vm-cp17-favorites-number').innerText(),'1','saved count should persist after reload');
  await page.getByRole('button',{name:'Tampilkan hanya produk favorit'}).click();
  assert.equal(await page.locator('.product-card').count(),1,'favorite should still be in browser storage');
  await page.getByRole('button',{name:'Tampilkan hanya produk favorit'}).click();
  await page.goto(BASE+savedDetailHref,{waitUntil:'networkidle',timeout:45000});
  assert.equal(await page.locator('.vm-cp17-detail-favorite').getAttribute('aria-pressed'),'true','detail page must share saved wishlist state');
  await page.locator('.vm-cp17-detail-favorite').click();
  assert.equal(await page.locator('.vm-cp17-detail-favorite').getAttribute('aria-pressed'),'false','detail page heart should remove saved item');
  await page.goto(BASE+'/catalog',{waitUntil:'networkidle',timeout:45000});
  assert.equal(await page.locator('.vm-cp17-favorites-number').innerText(),'0','wishlist should be cleared after unfavorite');

  await page.getByRole('button',{name:/Tambahkan DEMO/}).first().click();
  await page.getByRole('dialog',{name:/Keranjang/}).waitFor();
  assert.equal(await page.locator('.vm21-drawer-item').count(),1);
  await page.getByRole('button',{name:'Tutup keranjang',exact:true}).last().click();
  assert.equal(await page.getByRole('dialog',{name:/Keranjang/}).count(),0,'closing cart drawer must dismiss modal');
  await page.goto(BASE+'/keranjang-2',{waitUntil:'networkidle',timeout:45000});
  assert.equal(await page.locator('.vm21-cart-product').count(),1,'DEMO cart should persist across routes');
  assert.ok(await page.getByRole('button',{name:'Checkout produk belum tersedia'}).isDisabled());
  const beforeQty=await page.locator('.vm21-cart-product .vm21-drawer-qty span').first().innerText();
  await page.locator('.vm21-cart-product .vm21-drawer-qty button').last().click();
  assert.equal(Number(await page.locator('.vm21-cart-product .vm21-drawer-qty span').first().innerText()),Number(beforeQty)+1,'Cart quantity should increment');
  await page.getByRole('button',{name:'Hapus'}).first().click();
  assert.equal(await page.locator('.vm21-cart-product').count(),0,'Delete should remove cart item');
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
  assert.equal(await page.locator('.vm-home-intro').count(),0);
  const mobileHero=await page.locator('.vm-hero-stage .vm-carousel-shell').boundingBox();
  assert.ok(mobileHero&&Math.abs(mobileHero.x)<=1&&Math.abs(mobileHero.width-390)<=2,
    'mobile hero must span full viewport: '+JSON.stringify(mobileHero));
  const mobileRadius=await page.locator('.vm-hero-stage .vm-carousel-shell')
    .evaluate(el=>({radius:parseFloat(getComputedStyle(el).borderTopLeftRadius),border:parseFloat(getComputedStyle(el).borderTopWidth)}));
  assert.equal(mobileRadius.radius,0,'full-bleed banner must have no rounded corners');
  assert.equal(mobileRadius.border,0,'full-bleed banner must have no card border');
  assert.equal(await page.locator('.vm-trendora-category').count(),5,'five categories visible on mobile');
  const mobilePalette=await page.evaluate(()=>({
    nav:getComputedStyle(document.querySelector('.vm-modern-mobile-nav')).backgroundColor,
    header:getComputedStyle(document.querySelector('.vm-modern-header')).backgroundColor
  }));
  assert.match(mobilePalette.nav,/rgba?\(/,'frosted light bottom nav should render');
  await page.locator('.vm-search-disclosure summary').click();
  await page.locator('#vm-popover-search').fill('Ceramic');
  await page.locator('.vm-search-disclosure form button').click();
  await page.waitForURL(/\/catalog\?q=Ceramic/,{timeout:15000});
  assert.equal(await page.locator('.product-card').count(),1,'home search should filter catalog');
  await page.goto(BASE+'/',{waitUntil:'networkidle',timeout:45000});
  const mobilePill=await page.locator('.vm-reference-mobile-nav').evaluate(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius));
  assert.ok(mobilePill>=30,'mobile nav should be a floating pill');
  const labelFont=await page.locator('.vm-modern-mobile-nav a span').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  assert.ok(labelFont<=11,'mobile navigation label must not overlap: '+labelFont+'px');
  const tapTarget=await page.locator('.vm-reference-mobile-nav a').first().boundingBox();
  assert.ok(tapTarget&&tapTarget.height>=44,'mobile nav touch target must be at least 44px');
  const nav=page.locator('.vm-modern-mobile-nav');
  assert.equal(await nav.locator('a').count(),5,'mobile bar contains five route links');
  assert.equal(await nav.locator('.vm-liquid-active-pill').count(),1,'only one animated liquid active pill');
  const glass=await nav.evaluate(el=>({
    background:getComputedStyle(el).backgroundColor,
    filter:getComputedStyle(el).backdropFilter||getComputedStyle(el).webkitBackdropFilter
  }));
  assert.match(glass.filter,/blur/,'floating nav must be frosted glass');
  assert.equal(await nav.getAttribute('data-active-index'),'0','home is active');
  const start=await nav.locator('.vm-liquid-active-pill').boundingBox();
  await nav.locator('a[href="/brand-partner"]').click();
  await page.waitForURL(/\/brand-partner(?:#.*)?$/,{timeout:15000});
  assert.equal(await nav.getAttribute('data-active-index'),'2','Brand tab must activate');
  assert.equal(await page.locator('.vm-partner-card img').count(),12,'directory must use 12 authentic logo images');
  await page.waitForTimeout(650);
  const end=await nav.locator('.vm-liquid-active-pill').boundingBox();
  assert.ok(start&&end&&end.x>start.x+70,'liquid pill must slide toward Brand tab');
  await nav.locator('a[href="/member-2"]').click();
  await page.waitForURL(/\/member-2$/,{timeout:15000});
  assert.equal(await nav.getAttribute('data-active-index'),'3','Member tab must activate');
  await nav.locator('a[href="/keranjang-2"]').click();
  await page.waitForURL(/\/keranjang-2$/,{timeout:15000});
  assert.equal(await nav.getAttribute('data-active-index'),'4','Cart tab must activate and navigate to cart');
  await nav.locator('a[href="/catalog"]').click();
  await page.waitForURL(/\/catalog$/,{timeout:15000});
  assert.equal(await nav.getAttribute('data-active-index'),'1','Catalog tab must activate');
  await nav.locator('a[href="/"]').click();
  await page.waitForURL(BASE+'/',{timeout:15000});
  assert.equal(await nav.getAttribute('data-active-index'),'0','Home tab must reactivate');
  await page.setViewportSize({width:360,height:780});
  const small=await page.evaluate(()=>({
    hero:document.querySelector('.vm-carousel-shell').getBoundingClientRect().width,
    overflow:document.documentElement.scrollWidth-window.innerWidth,
    width:window.innerWidth
  }));
  assert.ok(Math.abs(small.hero-small.width)<=2&&small.overflow<=2,'360px edge-to-edge layout overflow: '+JSON.stringify(small));
  await page.setViewportSize({width:390,height:844});
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
  console.log('VAPMART_UI_SMOKE_SUCCESS',JSON.stringify({visual,mobile,merchandising,archiveProducts:12,news:10,cart:'tested-on-catalog',checkout:'disabled',theme:'coin-cp21'}));
}finally{await browser.close();}
