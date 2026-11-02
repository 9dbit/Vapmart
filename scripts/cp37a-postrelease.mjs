import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const WEB='https://vapmart.id',API='https://vapmart-api-staging.up.railway.app';
const report={checkpoint:'CP37-A',observedAt:new Date().toISOString(),checks:[],productionWrites:false};
async function get(url){
 const r=await fetch(url,{cache:'no-store',redirect:'follow',signal:AbortSignal.timeout(15000)});
 const text=await r.text();let data;try{data=JSON.parse(text);}catch{}
 return {status:r.status,url:r.url,data,text};
}
for(const base of [API+'/v1',WEB+'/api']){
 const x=await get(base+'/products?page=1&pageSize=1');
 assert.equal(x.status,200);assert.ok(Array.isArray(x.data.items));
 assert.equal(x.data.page,1);assert.equal(x.data.pageSize,1);assert.ok(Number.isInteger(x.data.total));
 assert.equal(typeof x.data.hasMore,'boolean');
 assert.ok(x.data.items.length<=1);report.checks.push({url:base+'/products',status:200,total:x.data.total,pagination:true});
 assert.equal((await get(base+'/products?page=0')).status,400,'invalid page fails explicitly');
 for(const path of ['/admin/summary','/admin/audit-log?entityType=product&entityId=25f397b8-564f-46f4-971e-bc1d333ac1d0','/admin/product-records']){
  const p=await get(base+path);assert.equal(p.status,401,'private API must reject anonymous access');
  report.checks.push({url:base+path,status:p.status});
 }
}
const [home,catalog,admin,legacy,shipping,checkout]=await Promise.all([
 get(WEB+'/'),get(WEB+'/catalog'),get(WEB+'/admin'),get(WEB+'/admin/login'),get(WEB+'/api/shipping/config'),get(WEB+'/api/checkout/config')]);
assert.equal(home.status,200);assert.ok(home.text.includes('vm-storefront-restored')&&home.text.includes('vm-carousel-shell'));
assert.ok(home.text.includes('/legacy/banners/desktop-01.png'));
assert.equal(catalog.status,200);assert.ok(catalog.text.includes('archive-gallery'));
assert.equal(admin.status,200);assert.ok(admin.text.includes('vma27-access-page'));assert.equal(admin.text.includes('vma27-side-link'),false);
assert.equal(new URL(legacy.url).pathname,'/admin');
assert.equal(shipping.status,200);assert.equal(shipping.data.paymentEnabled,false);assert.equal(shipping.data.bookingEnabled,false);assert.equal(shipping.data.rateLookupEnabled,false);
assert.equal(checkout.status,200);assert.equal(checkout.data.paymentEnabled,false);
report.checks.push({homepage:200,restoredStructure:true,catalog:200,adminCanonical:true,payment:false,booking:false,rateLookup:false});
await mkdir('artifacts/cp37a-live',{recursive:true});
await writeFile('artifacts/cp37a-live/read-only-live-report.json',JSON.stringify(report,null,2)+'\n');
console.log('CP37A_LIVE_READONLY_PASS',JSON.stringify(report));
