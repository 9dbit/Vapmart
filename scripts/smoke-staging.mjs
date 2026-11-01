import assert from 'node:assert/strict';
const WEB='https://vapmart-web-staging.up.railway.app',API='https://vapmart-api-staging.up.railway.app';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(url,options={}){
 const r=await fetch(url,{...options,signal:AbortSignal.timeout(14000),cache:'no-store'});
 const text=await r.text();let data=null;try{data=JSON.parse(text);}catch{}
 return {status:r.status,text,data,url:r.url};
}
let ready=false;
for(let i=1;i<=42;i++){
 try{
  const [api,web,shipping]=await Promise.all([request(API+'/ready'),request(WEB+'/'),request(WEB+'/api/shipping/config')]);
  if(api.status===200&&api.data?.database==='ready'&&web.status===200&&web.text.includes('vm-commerce-home')&&shipping.status===200){ready=true;break;}
  console.log('Waiting for CP33 web/API',i,api.status,web.status,shipping.status);
 }catch(e){console.log('CP33 retry',i,String(e).slice(0,180));}
 await sleep(7000);
}
assert.ok(ready,'CP33 deployment required before smoke pass');
const [apiHealth,products,webProducts,brands,shipping,webShipping,adminAnon,brandAnon,brandWebAnon,assignAnon,shippingAnon,ordersAnon,paymentConfig,memberAnon,legacyAPI,brandLogin,adminLogin,legacyCategory]=await Promise.all([
 request(API+'/health'),request(API+'/v1/products'),request(WEB+'/api/products'),request(API+'/v1/brands'),
 request(API+'/v1/shipping/config'),request(WEB+'/api/shipping/config'),
 request(API+'/v1/admin/status'),request(API+'/v1/brand-portal/me'),request(WEB+'/api/brand-portal/me'),
 request(API+'/v1/admin/brand-access/25f397b8-564f-46f4-971e-bc1d333ac1d0'),
 request(API+'/v1/shipping/rates',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),
 request(API+'/v1/checkout/orders',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),
 request(API+'/v1/checkout/config'),request(API+'/v1/member/overview'),
 request(API+'/v1/archive'),request(WEB+'/brand/login'),request(WEB+'/admin/login'),request(WEB+'/product-category/pod')
]);
assert.equal(apiHealth.status,200);
assert.equal(apiHealth.data?.checkout,'disabled');
assert.equal(products.status,200);
assert.ok(Array.isArray(products.data?.items));
assert.ok(products.data.items.every(x=>x.is_active===true&&!x.slug.startsWith('demo-')),'no demo products in public catalog');
assert.equal(webProducts.status,200);
assert.equal(webProducts.data?.items?.length,products.data.items.length);
assert.equal(brands.status,200);
assert.ok(Array.isArray(brands.data?.items));
for(const [label,response] of Object.entries({adminAnon,brandAnon,brandWebAnon,assignAnon,shippingAnon,ordersAnon,memberAnon}))
 assert.equal(response.status,401,label+' must deny anonymous access');
assert.equal(legacyAPI.status,404,'public legacy archive endpoint should be removed');
assert.equal(brandLogin.status,200);
assert.equal(adminLogin.status,200);
assert.match(adminLogin.text,/Control Panel/);
assert.equal(legacyCategory.status,200,'legacy category should redirect to working catalog');
assert.ok(legacyCategory.url.includes('/catalog'));
for(const cfg of [shipping.data,webShipping.data]){
 assert.equal(cfg?.provider,'biteship');
 assert.equal(cfg?.bookingEnabled,false);
 assert.equal(cfg?.paymentEnabled,false);
}
assert.equal(paymentConfig.status,200);
assert.equal(paymentConfig.data?.paymentEnabled,false);
assert.equal(paymentConfig.data?.providerConnected,false);
// CP34: fail closed for all inventory, invitation, and brand-onboarding endpoints without bearer auth.
const example='25f397b8-564f-46f4-971e-bc1d333ac1d0';
const restricted=await Promise.all([
 request(API+'/v1/admin/inventory/'+example+'/movements'),
 request(API+'/v1/admin/inventory/adjust',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),
 request(WEB+'/api/admin/inventory/adjust',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),
 request(API+'/v1/admin/brand-invitations/'+example),
 request(API+'/v1/admin/brand-invitations/'+example,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),
 request(WEB+'/api/admin/brand-invitations/'+example),
 request(API+'/v1/brand-invitations/accept',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),
 request(WEB+'/api/brand-invitations/accept',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})
]);
for(const [i,x] of restricted.entries())assert.equal(x.status,401,'CP34 private endpoint '+i+' rejects unauthenticated access');
const acceptance=await request(WEB+'/brand/accept');
assert.equal(acceptance.status,200,'brand accept page available');
assert.match(acceptance.text,/Join your|PARTNER INVITATION/i);
assert.equal(shipping.data?.bookingEnabled,false);
assert.equal(shipping.data?.paymentEnabled,false);
assert.equal(shipping.data?.rateLookupEnabled,false,'Biteship paid rate lookup must remain disabled unless approved');
const draft=await request(API+'/v1/orders',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
assert.equal(draft.status,503,'no live checkout');
console.log('VAPMART_CP34_SMOKE_SUCCESS',{activeProducts:products.data.items.length,brands:brands.data.items.length,provider:'biteship',booking:'off',payment:'off'});
