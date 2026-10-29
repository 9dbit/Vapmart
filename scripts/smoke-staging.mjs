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
assert.equal(home.status,200);
assert.match(home.text,/Kategori Produk/i);
assert.match(home.text,/Brand Partner/i);
assert.match(home.text,/Produk Pilihan/i);
assert.equal(unauthorized.status,401,'Admin status must reject anonymous users');
assert.equal(adminProductsAnon.status,401,'Admin product inventory must reject anonymous users');
assert.equal(webAdminProductsAnon.status,401,'Admin web proxy must reject anonymous users');
assert.equal(adminPage.status,200,'Admin entry screen should render');
assert.match(adminPage.text,/Authentication not configured|Administrator sign in|Memeriksa sesi/);
assert.equal(checkout.status,503,'Checkout must remain disabled');
console.log('VAPMART_STAGING_SMOKE_SUCCESS',{items:catalog.data.items.length,web:WEB,api:API,checkout:'disabled',admin_anon:'denied'});
