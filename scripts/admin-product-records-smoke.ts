import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {allArchiveItems} from '../apps/web/src/lib/archive-catalog';

// Browser fixture session only. Reads are intercepted; no production admin account or data mutation.
const BASE='https://vapmart.id',API='https://vapmart-api-staging.up.railway.app';
const sleep=(n:number)=>new Promise(r=>setTimeout(r,n));
const user={id:'bca49deb-d128-4d41-a3ab-8f8e019f095e',aud:'authenticated',role:'authenticated',email:'catalog-qa@example.invalid',email_confirmed_at:'2026-11-02T00:00:00Z',created_at:'2026-11-02T00:00:00Z',app_metadata:{provider:'email',providers:['email']},user_metadata:{}};
const session={access_token:'not-a-real-token-records-qa',refresh_token:'not-a-real-refresh-token',token_type:'bearer',expires_in:7200,expires_at:Math.floor(Date.now()/1000)+7200,user};
const records=allArchiveItems.map((p,i)=>({record_id:'existing:'+p.slug,record_kind:'existing',product_id:null,slug:p.slug,name:p.name,brand:p.brand,category:p.category,sku:null,price_idr:null,stock_qty:null,is_active:false,historical_price:p.price,historical_original_price:p.originalPrice||null,image_url:null,original_path:p.image,media_id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),source_snapshot:p.source,source_updated_at:'2026-11-02T00:00:00Z',read_only:true,missing_fields:['sku','stock','current_price','description','variants','weight'],product:null}));
const summary={total:records.length,existing:records.length,managed:0,published:0,drafts:0,existing_media_linked:records.length,existing_media_missing:0,existing_brands:new Set(records.map(r=>r.brand)).size};
const facets={brands:[...new Set(records.map(r=>r.brand))].sort(),categories:[...new Set(records.map(r=>r.category))].sort(),snapshots:[...new Set(records.map(r=>r.source_snapshot))]};
async function main(){
 let protectedReady=false;
 for(let i=0;i<65;i++){
  try{
   const [web,api]=await Promise.all([fetch(BASE+'/api/admin/product-records',{signal:AbortSignal.timeout(12000)}),fetch(API+'/v1/admin/product-records',{signal:AbortSignal.timeout(12000)})]);
   if(web.status===401&&api.status===401){protectedReady=true;break;}
  }catch{}
  await sleep(4000);
 }
 assert.ok(protectedReady,'both admin endpoints must deploy and reject anonymous requests');
 assert.equal((await fetch(BASE+'/api/admin/product-records',{headers:{authorization:'Bearer invalid-token'},signal:AbortSignal.timeout(12000)})).status,401);
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 let failNext=false;let writeRequests=0;
 try{
  await context.addInitScript(data=>localStorage.setItem('vapmart-customer-auth-v1',JSON.stringify(data)),session);
  const page=await context.newPage();
  await page.route('**/api/admin/status',r=>r.fulfill({status:200,contentType:'application/json',body:'{"admin":true}'}));
  for(const name of ['products','brands','orders'])await page.route('**/api/admin/'+name,r=>r.fulfill({status:200,contentType:'application/json',body:'{"items":[]}'}));
  await page.route('**/api/admin/product-records**',async route=>{
   if(route.request().method()!=='GET'){writeRequests++;await route.abort();return;}
   if(failNext){await route.fulfill({status:503,contentType:'application/json',body:'{"message":"Koneksi uji terputus"}'});return;}
   const f=new URL(route.request().url()).searchParams,q=(f.get('q')||'').toLowerCase();
   const filtered=records.filter(r=>(!q||[r.name,r.slug,r.brand,r.category].some(v=>v.toLowerCase().includes(q)))&&
    (!f.get('brand')||r.brand===f.get('brand'))&&(!f.get('category')||r.category===f.get('category'))&&
    f.get('source')!=='managed'&&!['published','draft'].includes(f.get('status')||''));
   const size=Number(f.get('pageSize')||24),p=Number(f.get('page')||1);
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:filtered.slice((p-1)*size,p*size),matched:filtered.length,summary,facets,page:p,pageSize:size,pages:Math.ceil(filtered.length/size),hasMore:p*size<filtered.length,syncedAt:new Date().toISOString(),existingReadOnly:true,fullWooCommerceExportVerified:false})});
  });
  await page.route('**/api/admin/media-library/*/content',async route=>{
   const id=new URL(route.request().url()).pathname.split('/').at(-2);const row=records.find(r=>r.media_id===id);
   assert.ok(row);assert.equal(route.request().headers().authorization,'Bearer '+session.access_token);
   const path=resolve('apps/web/public'+row.original_path),ext=path.split('.').at(-1);
   await route.fulfill({status:200,contentType:ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg',body:await readFile(path)});
  });
  let rendered=false;
  for(let i=0;i<35;i++){
   try{
    await page.goto(BASE+'/admin?tab=products',{waitUntil:'domcontentloaded',timeout:20000});
    // /admin first renders a closed auth gate. Wait for session hydration and role check.
    await page.locator('.vpr-panel').waitFor({state:'visible',timeout:6000});
    rendered=true;break;
   }catch(e){console.log('Waiting for product records workspace',i,String(e).slice(0,150));}
   await sleep(4000);
  }
  assert.ok(rendered,'new source-aware product list must be deployed');
  await page.waitForFunction(()=>document.querySelectorAll('.vpr-row').length===19);
  assert.equal(await page.locator('.vpr-row').count(),19);
  assert.equal(await page.locator('.vpr-row').getByRole('button',{name:'Publish',exact:true}).count(),0);
  assert.equal(await page.locator('.vpr-row').getByRole('button',{name:'Edit',exact:true}).count(),0);
  assert.ok((await page.locator('.vma26-kpis').innerText()).includes('19 existing + 0 operasional'));
  await page.waitForFunction(()=>{const i=document.querySelector('.vpr-row .vpr-image img');return i instanceof HTMLImageElement&&i.complete&&i.naturalWidth>0;});
  await mkdir('artifacts/product-records',{recursive:true});
  await page.screenshot({path:'artifacts/product-records/products-desktop.png',fullPage:true});
  const search=page.locator('.vpr-panel').getByLabel('Cari produk');
  await search.fill('EMKAY');await page.waitForFunction(()=>document.querySelectorAll('.vpr-row').length===4);
  await page.locator('.vpr-row').first().getByRole('button',{name:'Lihat data'}).click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  assert.ok((await dialog.innerText()).includes('Belum diverifikasi'));
  assert.ok((await dialog.innerText()).includes('Harga historis'));
  assert.equal(await dialog.getByRole('button',{name:'Publish',exact:true}).count(),0);
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  await search.fill('');await page.waitForFunction(()=>document.querySelectorAll('.vpr-row').length===19);
  await page.locator('.vpr-panel').getByLabel('Brand',{exact:true}).selectOption('SP2S');
  await page.waitForFunction(()=>document.querySelectorAll('.vpr-row').length===7);
  await page.locator('.vpr-panel').getByLabel('Brand',{exact:true}).selectOption('');
  await page.waitForFunction(()=>document.querySelectorAll('.vpr-row').length===19);
  failNext=true;await page.getByRole('button',{name:'Sinkronkan ulang',exact:false}).click();
  await page.getByRole('alert').filter({hasText:'Data tidak dianggap kosong'}).waitFor();
  failNext=false;await page.getByRole('button',{name:'Coba lagi',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.vpr-row').length===19);
  await page.setViewportSize({width:390,height:844});
  const mobile=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(mobile.scroll<=mobile.width+3,'no mobile horizontal overflow '+JSON.stringify(mobile));
  await page.screenshot({path:'artifacts/product-records/products-mobile.png',fullPage:true});
  assert.equal(writeRequests,0);
  console.log('VAPMART_PRODUCT_RECORDS_UI_PASS',JSON.stringify({sourceRecords:19,mediaLoaded:true,search:true,brandFilter:true,details:true,noPublication:true,retry:true,mobile,fixtureOnly:true}));
 }finally{await context.close();await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
