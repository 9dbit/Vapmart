import assert from 'node:assert/strict';
const WEB='https://vapmart-web-staging.up.railway.app',API='https://vapmart-api-staging.up.railway.app';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function request(url,options={}){
 const r=await fetch(url,{...options,signal:AbortSignal.timeout(14000),cache:'no-store'});
 const text=await r.text();let data=null;try{data=JSON.parse(text);}catch{}
 return {status:r.status,text,data,url:r.url};
}
let ready=false;
for(let i=1;i<=70;i++){
 try{
  const [api,web,shipping,brandState,courierReady]=await Promise.all([
   request(API+'/ready'),request(WEB+'/'),request(WEB+'/api/shipping/config'),
   request(WEB+'/api/brand-portal/25f397b8-564f-46f4-971e-bc1d333ac1d0/fulfillment/25f397b8-564f-46f4-971e-bc1d333ac1d0/state',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),
   request(WEB+'/api/admin/courier/config')
  ]);
  if(api.status===200&&api.data?.database==='ready'&&web.status===200&&web.text.includes('vm-storefront-restored')&&web.text.includes('vm-carousel-shell')&&web.text.includes('/legacy/banners/desktop-01.png')&&web.text.includes('vm-trendora-category-grid')&&shipping.status===200&&brandState.status===401&&courierReady.status===401){ready=true;break;}
  console.log('Waiting for CP36 web/API and Courier Ops routes',i,api.status,web.status,shipping.status);
 }catch(e){console.log('CP33 retry',i,String(e).slice(0,180));}
 await sleep(7000);
}
assert.ok(ready,'CP36 deployment required before smoke pass');
// Confirm the real custom domain is serving the same restored design, not a stale generic homepage.
let liveReady=false;
for(let i=0;i<12;i++){
 try{
  const [home,catalog]=await Promise.all([request('https://vapmart.id/'),request('https://vapmart.id/catalog')]);
  if(home.status===200&&home.text.includes('vm-storefront-restored')&&home.text.includes('vm-carousel-shell')&&
     catalog.status===200&&catalog.text.includes('archive-gallery')){liveReady=true;break;}
 }catch(e){console.log('Waiting for custom-domain storefront',i,String(e).slice(0,130));}
 await sleep(6000);
}
assert.ok(liveReady,'vapmart.id must serve the restored layout and read-only reference catalog');

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
const restoredCatalog=await request(WEB+'/catalog');
assert.equal(restoredCatalog.status,200,'Catalog route must remain available');
assert.ok(restoredCatalog.text.includes('archive-gallery')&&restoredCatalog.text.includes('vm-restored-reference-grid'),
 'Read-only historic visual gallery must remain visible even when active catalog is empty');
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
// CP35: warehouse, fulfillment and brand location data must be inaccessible anonymously.
const sample='25f397b8-564f-46f4-971e-bc1d333ac1d0';
const privateEndpoints=[
 [API+'/v1/admin/warehouses','GET'],
 [WEB+'/api/admin/warehouses','GET'],
 [API+'/v1/admin/warehouses/stock/adjust','POST'],
 [WEB+'/api/admin/warehouses/stock/transfer','POST'],
 [API+'/v1/admin/fulfillment/batches','GET'],
 [WEB+'/api/admin/fulfillment/batches','GET'],
 [API+'/v1/admin/fulfillment/orders/'+sample+'/plan','GET'],
 [API+'/v1/admin/fulfillment/orders/'+sample+'/prepare','POST'],
 [WEB+'/api/admin/fulfillment/orders/'+sample+'/prepare','POST'],
 [API+'/v1/admin/fulfillment/batches/'+sample+'/timeline','GET'],
 [API+'/v1/brand-portal/'+sample+'/warehouses','GET'],
 [WEB+'/api/brand-portal/'+sample+'/fulfillment','GET'],
 [API+'/v1/brand-portal/'+sample+'/fulfillment/'+sample+'/state','POST'],
 [WEB+'/api/brand-portal/'+sample+'/fulfillment/'+sample+'/state','POST'],
 [API+'/v1/customer-fulfillment/orders/'+sample+'/tracking','GET'],
 [WEB+'/api/customer-fulfillment/orders/'+sample+'/tracking','GET']
];
for(const [url,method] of privateEndpoints){
 const response=await request(url,{method,headers:method==='POST'?{'content-type':'application/json'}:{},
  ...(method==='POST'?{body:'{}'}:{})});
 assert.equal(response.status,401,'CP35 private scope must reject unauthenticated '+method+' '+url);
}
// CP36: no public manifest, return admin mutations, carrier booking or unsigned webhook.
const cp36Private=[
 [API+'/v1/admin/courier/config','GET'],[WEB+'/api/admin/courier/config','GET'],
 [API+'/v1/admin/courier/batches','GET'],[WEB+'/api/admin/courier/batches','GET'],
 [API+'/v1/admin/courier/batches/'+sample+'/preview','GET'],
 [API+'/v1/admin/courier/batches/'+sample+'/manifest','POST'],
 [WEB+'/api/admin/courier/batches/'+sample+'/manifest','POST'],
 [API+'/v1/admin/courier/batches/'+sample+'/packing-slip','GET'],
 [API+'/v1/admin/courier/batches/'+sample+'/events','GET'],
 [API+'/v1/admin/courier/batches/'+sample+'/book','POST'],
 [WEB+'/api/admin/courier/batches/'+sample+'/book','POST'],
 [API+'/v1/admin/courier-returns','GET'],[WEB+'/api/admin/courier-returns','GET'],
 [API+'/v1/admin/courier-returns/'+sample+'/review','POST'],
 [API+'/v1/admin/courier-returns/'+sample+'/receive','POST'],
 [API+'/v1/admin/courier-returns/'+sample+'/restock','POST'],
 [API+'/v1/customer-returns','GET'],[WEB+'/api/customer-returns','GET'],
 [API+'/v1/customer-returns','POST'],[WEB+'/api/customer-returns','POST'],
 [API+'/v1/customer-courier/orders/'+sample,'GET'],
 [WEB+'/api/customer-courier/orders/'+sample,'GET']
];
for(const [url,method] of cp36Private){
 const response=await request(url,{method,headers:method==='POST'?{'content-type':'application/json'}:{},
  ...(method==='POST'?{body:'{}'}:{})});
 assert.equal(response.status,401,'CP36 scoped endpoint '+method+' '+url+' must require login');
}
const unsignedWeb=await request(WEB+'/api/webhooks/biteship',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
assert.equal(unsignedWeb.status,401,'web Biteship relay rejects missing shared secret header');
const unsignedApi=await request(API+'/v1/webhooks/biteship',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
assert.ok([401,503].includes(unsignedApi.status),'API webhook must never accept unsigned callbacks');
const draft=await request(API+'/v1/orders',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
assert.equal(draft.status,503,'no live checkout');
console.log('VAPMART_STOREFRONT_RESTORED_SMOKE_SUCCESS',{activeProducts:products.data.items.length,brands:brands.data.items.length,provider:'biteship',booking:'off',payment:'off'});
