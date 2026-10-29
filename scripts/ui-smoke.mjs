import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const URL='https://vapmart-web-staging.up.railway.app';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
try{
  await page.goto(URL,{waitUntil:'networkidle',timeout:45000});
  await page.locator('.product-card').first().waitFor({timeout:30000});
  assert.ok(await page.locator('.product-card').count()>=4,'staging demo catalog must contain 4 products');
  const add=page.getByRole('button',{name:/Tambahkan DEMO/}).first();
  await add.click();
  await page.getByRole('dialog',{name:'Keranjang belanja'}).waitFor();
  assert.equal(await page.locator('.cart-row').count(),1,'cart should receive item');
  await page.getByRole('button',{name:'Tutup',exact:true}).click();
  await page.locator('#shop-search').fill('Ceramic');
  assert.equal(await page.locator('.product-card').count(),1,'search filter should reduce visible products');
  await page.locator('.product-card a').first().click();
  await page.waitForURL(/\/product\/demo-ceramic-accent-vase/,{timeout:15000});
  assert.match(await page.locator('h1').innerText(),/Ceramic Accent Vase/);
  assert.ok(await page.getByRole('button',{name:/Tambahkan ke keranjang/}).isEnabled());
  await page.setViewportSize({width:390,height:844});
  await page.goto(URL,{waitUntil:'networkidle',timeout:45000});
  await page.locator('.product-card').first().waitFor();
  const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:window.innerWidth}));
  assert.ok(overflow.scroll<=overflow.view+2,'unexpected horizontal page overflow '+JSON.stringify(overflow));
  console.log('VAPMART_UI_SMOKE_SUCCESS',{desktopCatalog:true,cart:true,search:true,detail:true,mobile:true,overflow});
}finally{await browser.close();}
