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
assert.ok(catalog.data.items.length>=4,'expected staging demo items');
for (const product of catalog.data.items) {
  assert.ok(product.name.startsWith('DEMO'), 'only labeled demo products should appear in initial staging');
  assert.ok(Number.isInteger(product.price_idr) && product.price_idr>0);
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
assert.match(adminPage.text,/Authentication not configured|Administrator sign in|Memeriksa sesi/);
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

console.log('VAPMART_STAGING_SMOKE_SUCCESS',{items:catalog.data.items.length,web:WEB,api:API,checkout:'disabled',admin_anon:'denied'});
