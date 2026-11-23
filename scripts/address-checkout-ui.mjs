// Actual storefront/checkout UI against disposable, loopback-only fixtures.
// No production account, database, shipping provider, order or payment is used.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const BASE='http://127.0.0.1:3000',API='http://127.0.0.1:4100';
const OUTPUT=ROOT+'artifacts/address-checkout-ui';
if(process.env.ADDRESS_UI_FIXTURES!=='1'||process.env.NEXT_PUBLIC_SUPABASE_URL!==API)
 throw Error('Address UI tests require explicit loopback fixture configuration.');
const product={id:'99000000-0000-4000-8000-000000000001',slug:'address-ui-organizer',
 name:'Organizer Uji Alamat',description:'Produk sintetis untuk pengujian lokal.',category:'accessories',
 sku:'QA-ADDRESS-ONLY',price_idr:75000,stock_qty:12,weight_grams:250,
 image_url:'/branding/vapmart-logo.png',gallery_urls:[],is_active:true,available:true,product_type:'simple'};
const labels=['Rumah','Kantor','Apartment','Sementara'];
let user={id:'99000000-0000-4000-8000-000000009999',aud:'authenticated',role:'authenticated',
 email:'address-ui@example.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',
 created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email',providers:['email']},
 user_metadata:{display_name:'Pelanggan Uji',whatsapp_number:'081234567890'}};
const session={access_token:'fixture-address-access',refresh_token:'fixture-address-refresh',
 token_type:'bearer',expires_in:7200,expires_at:Math.floor(Date.now()/1000)+7200,user};
const hierarchy={
 provinces:[{id:'31',name:'DKI JAKARTA'}],
 cities:[{id:'3171',name:'KOTA ADM. JAKARTA PUSAT',parentId:'31'}],
 districts:[{id:'317101',name:'GAMBIR',parentId:'3171'}],
 areas:[{id:'3171011002',name:'PETOJO UTARA',parentId:'317101',postalCode:'10130'},
        {id:'3171011003',name:'PETOJO SELATAN',parentId:'317101',postalCode:'10160'}]
};
const state={authUpdates:0,orderAttempts:0,shippingRequests:[],unexpectedExternal:[],runtimeErrors:[]};
const book=()=>user.user_metadata.vapmart_address_book_v1;
const saved=label=>book().addresses.find(a=>a.label===label);
const forbidden=path=>/checkout\/orders|payment-session|confirm-payment|bookings|shipments/.test(path);
const server=createServer(async(req,res)=>{
 const url=new URL(req.url||'/',API),path=url.pathname;
 const send=(data,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',
  'access-control-allow-origin':BASE,'access-control-allow-methods':'GET,PUT,POST,OPTIONS',
  'access-control-allow-headers':'authorization,apikey,content-type,x-client-info,x-supabase-api-version'});
  res.end(JSON.stringify(data));};
 try{
  if(req.method==='OPTIONS')return send({},200);
  if(forbidden(path)){state.orderAttempts++;return send({message:'Order/payment writes prohibited in UI fixtures'},403);}
  let body={};
  if(req.method!=='GET'){let raw='';for await(const chunk of req)raw+=chunk;body=raw?JSON.parse(raw):{};}
  if(path==='/auth/v1/user'){
   assert.equal(req.headers.authorization,'Bearer fixture-address-access');
   if(req.method==='PUT'){
    assert.deepEqual(Object.keys(body.data||{}),['vapmart_address_book_v1']);
    user={...user,user_metadata:{...user.user_metadata,...body.data}};state.authUpdates++;
   }else assert.equal(req.method,'GET');
   return send(user);
  }
  if(path==='/v1/products/'+product.slug)return send(product);
  if(path==='/v1/products'||path==='/v1/catalog/selection')return send({items:[product]});
  if(path==='/v1/brands'||path==='/v1/hero-banners'||path==='/v1/catalog/categories')return send({items:[]});
  if(path.startsWith('/v1/catalog/reviews/'))return send({items:[],average:0,total:0,hasMore:false});
  if(path==='/v1/checkout/config')return send({paymentEnabled:false,providerConnected:false,
   methods:['bank_transfer'],gateway:{provider:null,status:'fixture',environment:'sandbox'}});
  if(path==='/v1/shipping/config')return send({rateLookupEnabled:true,bookingEnabled:false,paymentEnabled:false,
   requiresArea:true,provider:'fixture',rateType:'fixture',originLabel:'Gudang Uji Lokal'});
  if(path==='/v1/shipping/areas'){
   const level=url.searchParams.get('level'),parent=url.searchParams.get('parentId');
   return send({items:(hierarchy[level]||[]).filter(item=>!item.parentId||item.parentId===parent)});
  }
  if(path==='/v1/checkout/quote'){
   assert.deepEqual(body.items,[{productId:product.id,quantity:1}]);
   return send({items:[{productId:product.id,sku:product.sku,name:product.name,unitPriceIdr:75000,
    quantity:1,lineTotalIdr:75000,stockQty:12}],subtotalIdr:75000,discountIdr:0,voucherDiscountIdr:0,
    voucherCode:null,promotionDiscountIdr:0,promotionEventId:null,promotionTitle:null,
    shippingFeeIdr:null,totalIdr:null,shippingEstimate:true,paymentEnabled:false,paymentMethods:['bank_transfer']});
  }
  if(path==='/v1/shipping/rates'||path==='/v1/shipping/estimate'){
   state.shippingRequests.push(body);
   return send({rates:[{quoteId:'fixture-'+body.destinationAreaId,expiresAt:new Date(Date.now()+900000).toISOString(),
    courierCode:'fixture',courierName:'Kurir Uji',serviceCode:'REG',serviceName:'Reguler',
    priceIdr:12000,duration:'2 hari',category:'regular',estimateOnly:true}]});
  }
  return send({message:'No fixture for '+path},404);
 }catch(error){state.runtimeErrors.push(String(error));send({message:String(error)},500);}
});
await mkdir(OUTPUT,{recursive:true});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4100,'127.0.0.1',resolve);});
let webOutput='',browser,context,page,other;
const web=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3000'],{
 cwd:ROOT+'apps/web',env:{...process.env,API_INTERNAL_URL:API,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
for(const stream of [web.stdout,web.stderr])stream.on('data',chunk=>{webOutput=(webOutput+chunk).slice(-150000);});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function selected(page,label){
 await page.locator('.vpd-address-destination-copy > strong').filter({hasText:label+','}).waitFor();
 assert.equal(await page.getByLabel('Nama lengkap',{exact:true}).inputValue(),'Penerima '+label);
 assert.equal(await page.getByLabel('Nomor telepon',{exact:true}).inputValue(),'081234567890');
 assert.ok((await page.locator('.vco26-form > label').filter({hasText:'Detail alamat'}).locator('textarea').inputValue()).includes('Jalan Uji '+label));
}
async function openBook(page){
 if(!(await page.locator('.vpd-address-book').isVisible()))await page.locator('.vpd-address-toggle').click();
 await page.getByRole('region',{name:'Alamat tersimpan',exact:true}).waitFor();
}
const card=(page,label)=>page.locator('.vpd-address-option').filter({has:page.getByText(label,{exact:true})});
async function addAddress(page,label,{first=false,makeDefault=false,keyboard=false}={}){
 if(first)await page.getByRole('button',{name:'Tambah alamat pertama',exact:true}).click();
 else{await openBook(page);await page.getByRole('button',{name:'+ Tambah alamat lain',exact:true}).click();}
 const form=page.getByRole('region',{name:'Tambah alamat baru',exact:true});
 await form.waitFor();
 assert.deepEqual(await form.locator('.vpd-address-label-options input').evaluateAll(inputs=>inputs.map(input=>input.value)),labels);
 for(const choice of labels){
  await form.getByRole('radio',{name:choice,exact:true}).check();
  assert.equal(await form.getByRole('radio',{name:choice,exact:true}).isChecked(),true);
 }
 await form.getByRole('radio',{name:label,exact:true}).check();
 await form.getByRole('combobox',{name:'Provinsi',exact:true}).selectOption('31');
 await form.getByRole('combobox',{name:'Kota / Kabupaten',exact:true}).selectOption('3171');
 await form.getByRole('combobox',{name:'Kecamatan / Distrik',exact:true}).selectOption('317101');
 const area=label==='Kantor'?'3171011003':'3171011002';
 await form.getByRole('combobox',{name:'Kelurahan / Desa',exact:true}).selectOption(area);
 assert.equal(await form.getByLabel('Kode pos',{exact:true}).inputValue(),label==='Kantor'?'10160':'10130');
 await form.getByLabel('Nama penerima',{exact:true}).fill('Penerima '+label);
 await form.getByLabel('Kontak person',{exact:true}).fill('Penerima '+label);
 await form.getByLabel('No. telepon penerima',{exact:true}).fill('081234567890');
 await form.getByLabel('Detail alamat',{exact:true}).fill('Jalan Uji '+label+' Nomor 11');
 await form.getByLabel('Nomor rumah / unit / lantai',{exact:false}).fill(label==='Apartment'?'Tower A, Unit 09':'');
 const defaultControl=form.getByRole('checkbox',{name:'Jadikan alamat utama (default)',exact:true});
 assert.equal(await defaultControl.isChecked(),first);
 assert.equal(await defaultControl.isDisabled(),first);
 if(makeDefault&&!first)await defaultControl.check();
 if(keyboard){
  // The enclosing order form is valid by now: Enter in an address draft must
  // not create an order, while Enter on its type=button save action must work.
  await page.getByRole('button',{name:'Buat pesanan ↗',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Buat pesanan ↗',exact:true}).isEnabled(),true);
  assert.equal(await page.locator('.vco26-form').evaluate(form=>form.checkValidity()),true);
  await form.getByLabel('Nama penerima',{exact:true}).press('Enter');
  await delay(150);
  assert.equal(state.orderAttempts,0,'Enter in address inputs must never submit the checkout order');
  assert.equal(await form.isVisible(),true);
 }
 const save=form.getByRole('button',{name:'Simpan & gunakan alamat',exact:true});
 assert.equal(await save.evaluate(button=>getComputedStyle(button).backgroundColor),'rgb(131, 16, 232)');
 const updated=page.waitForResponse(response=>response.url()===API+'/auth/v1/user'&&response.request().method()==='PUT');
 if(keyboard)await save.press('Enter');else await save.click();
 assert.equal((await updated).status(),200);
 await form.waitFor({state:'hidden'});
 await selected(page,label);
 assert.equal(saved(label).region.areaId,area);
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('vapmart-customer-auth-v1')));
 assert.equal(stored.user.user_metadata.vapmart_address_book_v1.addresses.length,book().addresses.length);
}
try{
 let ready=false;
 for(let i=0;i<60;i++){
  if(web.exitCode!==null||web.signalCode!==null)throw Error('Next.js exited before UI tests: '+webOutput);
  try{if((await fetch(BASE+'/checkout',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}
  await delay(500);
 }
 assert.ok(ready,'local Next.js server did not start');
 browser=await chromium.launch({headless:true});
 context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 context.setDefaultTimeout(15000);
 await context.addInitScript(({data,origin})=>{
  // New tabs start on about:blank, where storage is unavailable. Seed only
  // the disposable storefront origin, and preserve later SDK updates.
  if(location.origin!==origin)return;
  if(!localStorage.getItem('vapmart-customer-auth-v1'))localStorage.setItem('vapmart-customer-auth-v1',JSON.stringify(data));
 },{data:session,origin:BASE});
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(forbidden(url.pathname)){state.orderAttempts++;return route.abort();}
  // Stub the optional support widget; never contact its production service.
  if(url.origin==='https://chatvice.app'&&url.pathname==='/api/widget/chatvice.js')
   return route.fulfill({status:200,contentType:'application/javascript',body:'/* disabled in isolated UI tests */'});
  // The storefront imports Google Fonts; use its system-font fallback offline.
  if(url.origin==='https://fonts.googleapis.com'&&url.pathname==='/css2')
   return route.fulfill({status:200,contentType:'text/css',body:'/* system fonts in isolated UI tests */'});
  if(![BASE,API].includes(url.origin)){state.unexpectedExternal.push(url.origin+url.pathname);return route.abort();}
  return route.continue();
 });
 context.on('page',tab=>tab.on('pageerror',error=>state.runtimeErrors.push(error.message)));
 page=await context.newPage();
 await page.goto(BASE+'/product/'+product.slug);
 await page.getByRole('button',{name:'Beli Sekarang',exact:true}).click();
 await page.waitForURL(url=>url.pathname==='/checkout'&&url.searchParams.get('buyNow')===product.id);
 const checkoutUrl=page.url();
 assert.equal(new URL(checkoutUrl).searchParams.get('qty'),'1');
 await page.getByRole('heading',{name:'Ringkasan pesanan',exact:true}).waitFor();
 assert.equal(await page.locator('.vco26-summary .vco26-line').count(),1);
 await addAddress(page,'Rumah',{first:true});
 const homeId=saved('Rumah').id;
 assert.equal(book().defaultId,homeId);
 await page.getByRole('combobox',{name:'Pilih kurir dan layanan',exact:true}).waitFor();
 await addAddress(page,'Kantor',{keyboard:true});
 const officeId=saved('Kantor').id;
 assert.equal(book().defaultId,homeId,'save another destination must preserve default');
 await openBook(page);
 await card(page,'Rumah').getByRole('button',{name:'Pilih alamat',exact:true}).click();
 await selected(page,'Rumah');
 await openBook(page);
 const defaultUpdate=page.waitForResponse(response=>response.url()===API+'/auth/v1/user'&&response.request().method()==='PUT');
 await card(page,'Kantor').getByRole('button',{name:'Jadikan utama',exact:true}).click();
 await defaultUpdate;
 await card(page,'Kantor').getByText('Utama',{exact:true}).waitFor();
 assert.equal(book().defaultId,officeId);
 await selected(page,'Rumah');
 await page.reload();
 await selected(page,'Rumah');
 await openBook(page);
 await card(page,'Kantor').getByText('Utama',{exact:true}).waitFor();
 assert.equal(await page.locator('.vpd-address-option').count(),2,'saved addresses survive reload');
 other=await context.newPage();
 await other.goto(checkoutUrl);
 await selected(other,'Kantor');
 await addAddress(other,'Apartment',{makeDefault:true});
 const apartmentId=saved('Apartment').id;
 assert.equal(book().defaultId,apartmentId);
 await addAddress(other,'Sementara');
 assert.equal(book().defaultId,apartmentId);
 assert.deepEqual(book().addresses.map(address=>address.label),labels);
 await other.reload();
 await selected(other,'Sementara');
 await openBook(other);
 await card(other,'Apartment').getByText('Utama',{exact:true}).waitFor();
 await card(other,'Sementara').getByRole('button',{name:'Edit',exact:true}).click();
 const edit=other.getByRole('region',{name:'Edit alamat',exact:true});
 for(const theme of ['light','dark']){
  await other.locator('.vm23-theme-trigger').click();
  await other.getByRole('button',{name:theme==='light'?'Light Tema terang':'Dark Hitam & ungu',exact:true}).click();
  assert.equal(await other.locator('html').getAttribute('data-vapmart-color-mode'),theme);
  await edit.getByRole('radio',{name:'Apartment',exact:true}).check();
  const controls=await edit.locator('.vpd-address-label-options input').evaluateAll(inputs=>inputs.map(input=>{
   const box=input.getBoundingClientRect(),label=getComputedStyle(input.parentElement);
   return {width:box.width,height:box.height,accent:getComputedStyle(input).accentColor,
    checked:input.checked,border:label.borderColor,color:label.color,background:label.backgroundColor};
  }));
  assert.ok(controls.every(control=>control.width===14&&control.height===14&&control.accent==='rgb(131, 16, 232)'));
  assert.equal(controls.find(control=>control.checked).border,'rgb(131, 16, 232)');
  assert.ok(controls.every(control=>control.color!==control.background),'label text remains distinct in '+theme);
  assert.equal(await edit.getByRole('button',{name:'Simpan & gunakan alamat',exact:true}).evaluate(button=>getComputedStyle(button).backgroundColor),'rgb(131, 16, 232)');
 }
 await edit.getByRole('button',{name:'Batal',exact:true}).last().click();
 const geometry=await other.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}));
 assert.ok(geometry.width<=geometry.viewport+2,'address cards must fit a 390px mobile viewport');
 assert.ok(state.shippingRequests.some(request=>request.destinationAreaId==='3171011003'&&request.destinationPostalCode==='10160'));
 assert.ok(state.shippingRequests.some(request=>request.destinationAreaId==='3171011002'&&request.destinationPostalCode==='10130'));
 assert.equal(state.orderAttempts,0);
 assert.deepEqual(state.unexpectedExternal,[]);
 assert.deepEqual(state.runtimeErrors,[]);
 await other.screenshot({path:OUTPUT+'/checkout-mobile.png',fullPage:true});
 await writeFile(OUTPUT+'/report.json',JSON.stringify({pass:true,fixtureOnly:true,productionWrites:false,
  buyNow:true,addressLabels:labels,addAndSave:true,checkoutSync:true,defaultVsSelected:true,
  reloadPersistence:true,newTabUsesDefault:true,enterDoesNotSubmitOrder:true,authUpdates:state.authUpdates,
  orderAttempts:state.orderAttempts,mobile:geometry,themes:['light','dark']},null,2));
 console.log('ADDRESS_CHECKOUT_UI_PASS: Buy Now, four labels, add/save, default/selection, persistence and keyboard safety.');
}catch(error){
 console.error('ADDRESS_CHECKOUT_UI_FAILURE',JSON.stringify({authUpdates:state.authUpdates,
  orderAttempts:state.orderAttempts,unexpectedExternal:state.unexpectedExternal,runtimeErrors:state.runtimeErrors}));
 if(other||page)await (other||page).screenshot({path:OUTPUT+'/failure.png',fullPage:true}).catch(()=>{});
 await writeFile(OUTPUT+'/failure.txt',String(error));
 throw error;
}finally{
 await context?.close();await browser?.close();
 web.kill('SIGTERM');
 await new Promise(resolve=>{if(web.exitCode!==null||web.signalCode!==null)resolve();else web.once('exit',resolve);});
 await new Promise(resolve=>server.close(resolve));
 await writeFile(OUTPUT+'/web.log',webOutput);
}
