import assert from 'node:assert/strict';
const WEB='https://vapmart-web-staging.up.railway.app';
const API='https://vapmart-api-staging.up.railway.app';
const RETRIES=36;
const SLEEP_MS=8000;
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(url,options={}) {
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(12000),cache:'no-store'});
  const text=await response.text();
  let data;
  try{data=JSON.parse(text);}catch{}
  return {status:response.status,text,data};
}
async function awaitReady() {
  for(let i=1;i<=RETRIES;i++){
    try {
      const [api,web]=await Promise.all([request(API+'/ready'),request(WEB+'/api/health')]);
      console.log('readiness',i,api.status,web.status);
      if(api.status===200 && api.data?.database==='ready' && web.status===200) return;
    }catch(e){console.log('readiness retry',i,String(e?.message||e));}
    if(i<RETRIES)await sleep(SLEEP_MS);
  }
  throw new Error('Staging did not become ready within retry window');
}
await awaitReady();
const [apiHealth,catalog,webCatalog,home,unauthorized,adminProductsAnon,webAdminProductsAnon,adminPage,checkout]=await Promise.all([
  request(API+'/health'),
  request(API+'/v1/products'),
  request(WEB+'/api/products'),
  request(WEB+'/'),
  request(API+'/v1/admin/status'),
  request(API+'/v1/admin/products'),
  request(WEB+'/api/admin/products'),
  request(WEB+'/admin'),
  request(API+'/v1/orders',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})
]);
assert.equal(apiHealth.status,200);
assert.equal(apiHealth.data?.checkout,'disabled');
assert.equal(catalog.status,200);
assert.ok(Array.isArray(catalog.data?.items));
// Active catalog may contain newly published non-restricted products or be intentionally empty.
for (const product of catalog.data.items) {
  assert.ok(typeof product.name==='string' && product.name.length>=2, 'active product must have a name');
  assert.ok(Number.isInteger(product.price_idr) && product.price_idr>=0);
  assert.equal(product.is_active,true);
  assert.doesNotMatch(product.name,/vape|nicotine|nikotin|tobacco|rokok/i);
}
assert.equal(webCatalog.status,200);
assert.equal(webCatalog.data?.items?.length,catalog.data.items.length);
let storefront=home;
for(let attempt=0;attempt<36&&!(storefront.text.includes('data-vapmart-theme="member-cp22"')&&storefront.text.includes('data-vapmart-ui="cp22"'));attempt++){
  console.log('waiting for Vapmart CP22 ISO member card release',attempt+1);
  await sleep(8000);
  storefront=await request(WEB+'/');
}
assert.equal(storefront.status,200);
assert.match(storefront.text,/data-vapmart-theme="member-cp22"/,'Checkpoint 22 member theme not yet deployed');
assert.match(storefront.text,/data-vapmart-ui="cp22"/,'expected CP22 homepage');
assert.match(storefront.text,/Kategori/);
assert.match(storefront.text,/Brand Partner/i);
assert.match(storefront.text,/Featured Products|Produk Pilihan/i);
assert.equal(unauthorized.status,401,'Admin status must reject anonymous users');
assert.equal(adminProductsAnon.status,401,'Admin product inventory must reject anonymous users');
assert.equal(webAdminProductsAnon.status,401,'Admin web proxy must reject anonymous users');
assert.equal(adminPage.status,200,'Admin entry screen should render');
assert.match(adminPage.text,/Authentication not configured|Administrator sign in|Memeriksa sesi|Memvalidasi akses admin|Admin Studio/);
assert.equal(checkout.status,503,'Checkout must remain disabled');
const [packs,memberAnon,digitalAnon,login,memberPage,cartPage]=await Promise.all([
  request(API+'/v1/coin-packs'),
  request(API+'/v1/member/overview'),
  request(API+'/v1/digital-orders',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),
  request(WEB+'/login'),request(WEB+'/member-2'),request(WEB+'/keranjang-2')
]);
assert.equal(packs.status,200,'public coin catalog should be available');
assert.deepEqual(packs.data?.items?.map(x=>x.priceIdr),
  [100000,50000,100000,300000,500000,1000000,2000000],
  'activation and six coin packs must retain exact price levels');
assert.equal(packs.data?.checkoutEnabled,false,'real payment must remain disabled');
assert.equal(memberAnon.status,401,'anonymous wallet reads must be rejected');
assert.equal(digitalAnon.status,401,'anonymous digital order must be rejected');
assert.equal(login.status,200);
assert.equal(memberPage.status,200);
assert.equal(cartPage.status,200);
assert.match(memberPage.text,/Vapmart Member Card/,'real member card component should render');
assert.match(memberPage.text,/vm22-card-charcoal-panel/,'solid charcoal card panel should render');
assert.match(memberPage.text,/Buka benefit member/,'member quick actions should be interactive');


/* CP26 commerce smoke: wait for the NEW storefront build (not merely /ready) and verify payment is still disabled. */
let cp26Ready=false;
for(let attempt=1;attempt<=36;attempt++){
  const [checkoutPage,adminStudio]=await Promise.all([request(WEB+'/checkout'),request(WEB+'/admin')]);
  cp26Ready=checkoutPage.status===200 && adminStudio.status===200 &&
    checkoutPage.text.includes('SECURE CHECKOUT PREVIEW') &&
    adminStudio.text.includes('Studio.');
  if(cp26Ready)break;
  console.log('Waiting for CP26 checkout/admin web deployment',attempt);
  if(attempt<36)await sleep(SLEEP_MS);
}
assert.equal(cp26Ready,true,'CP26 Checkout + Admin Studio must actually be deployed');
const [paymentConfig,webPaymentConfig,brands,adminBrandsAnon,adminOrdersAnon,webAdminBrandsAnon,webAdminOrdersAnon,orderAnon,webOrderAnon,invalidQuote]=await Promise.all([
  request(API+'/v1/checkout/config'),
  request(WEB+'/api/checkout/config'),
  request(API+'/v1/brands'),
  request(API+'/v1/admin/brands'),
  request(API+'/v1/admin/orders'),
  request(WEB+'/api/admin/brands'),
  request(WEB+'/api/admin/orders'),
  request(API+'/v1/checkout/orders',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),
  request(WEB+'/api/checkout/orders',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),
  request(API+'/v1/checkout/quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({items:[]})})
]);
assert.equal(paymentConfig.status,200,'payment config endpoint must work');
assert.equal(webPaymentConfig.status,200,'payment config web bridge must work');
for(const config of [paymentConfig.data,webPaymentConfig.data]){
 assert.equal(config?.paymentEnabled,false,'real payment must stay disabled');
 assert.equal(config?.providerConnected,false,'no payment gateway may be declared connected');
 assert.equal(config?.ordersMode,'draft_only');
}
assert.equal(brands.status,200);
assert.ok(Array.isArray(brands.data?.items),'brand directory must be an array');
for(const [key,response] of Object.entries({adminBrandsAnon,adminOrdersAnon,webAdminBrandsAnon,webAdminOrdersAnon,orderAnon,webOrderAnon}))
 assert.equal(response.status,401,key+' must be restricted to an authenticated user');
assert.equal(invalidQuote.status,400,'empty cart cannot be quoted');
const quoteProduct=catalog.data.items.find(product=>product.stock_qty>0);
if(quoteProduct){
 const serverQuote=await request(API+'/v1/checkout/quote',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({items:[{productId:quoteProduct.id,quantity:1}]})});
 assert.equal(serverQuote.status,200);
 assert.equal(serverQuote.data?.subtotalIdr,quoteProduct.price_idr,'unit price must come from server-side catalog');
 assert.equal(serverQuote.data?.paymentEnabled,false,'quote may not enable payment');
 assert.equal(serverQuote.data?.items?.[0]?.stockQty,quoteProduct.stock_qty);
}
console.log('CP26_CHECKOUT_ADMIN_SMOKE_SUCCESS',{payment:'disabled',auth:'required',brandCount:brands.data.items.length});

console.log('VAPMART_STAGING_SMOKE_SUCCESS',{items:catalog.data.items.length,web:WEB,api:API,checkout:'disabled',admin_anon:'denied'});
