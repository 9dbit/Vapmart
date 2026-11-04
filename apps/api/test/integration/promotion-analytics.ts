import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import sharp from 'sharp';
const {createFixture}=require(resolve('../../scripts/cp39-fixture-server.cjs'));

test('CP44 analytics reconciles paid GMV and split discount costs across periods, campaigns, categories and ledger',async()=>{
 const {app,db,base}=await createFixture();
 const request=async(path:string,body?:any,method='POST',token='fixture-admin')=>{
  const r=await fetch(base+path,{method:body===undefined?'GET':method,
   headers:{authorization:'Bearer '+token,'content-type':'application/json'},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:r.status,contentType:r.headers.get('content-type'),body:await r.text()};
 };
 const json=async(path:string,body?:any,method='POST',token='fixture-admin')=>{
  const r=await request(path,body,method,token);
  const data=JSON.parse(r.body);
  assert.ok(r.status>=200&&r.status<300,JSON.stringify({path,status:r.status,data}));
  return data;
 };
 const api='/v1/admin/catalog';
 const now=new Date(),day=new Date(now.getTime()+7*3600000).toISOString().slice(0,10);
 const dayBefore=new Date(Date.parse(day+'T00:00:00+07:00')-86400000+7*3600000).toISOString().slice(0,10);
 const range='from='+dayBefore+'&to='+day;
 try{
  const lookups=await json(api+'/lookups'),warehouse=lookups.warehouses.find((x:any)=>x.is_active&&!x.is_system_hold);
  const categoryA=lookups.categories.find((x:any)=>x.slug==='accessories')||lookups.categories[0],categoryB=lookups.categories.find((x:any)=>x.id!==categoryA.id);
  assert.ok(warehouse&&categoryA&&categoryB);
  const png=await sharp({create:{width:96,height:96,channels:3,background:'#6932ad'}}).png().toBuffer();
  const asset=await json('/v1/admin/media',{filename:'cp44.png',mimeType:'image/png',base64:png.toString('base64')});
  async function product(name:string,sku:string,slug:string,cat:string,price:number){
   const item={name,sku,slug,description:'Everyday carry organizer accessories.',categoryIds:[cat],brand_id:null,
    fulfillment_owner_brand_id:null,image_url:'/api/media/'+asset.id,gallery_urls:[],price_idr:price,
    sale_price_idr:null,sale_starts_at:null,sale_ends_at:null,weight_grams:250,length_cm:22,width_cm:12,height_cm:5,product_type:'simple',attributes:[]};
   let x=await json(api+'/products',{requestKey:randomUUID(),product:item,variants:[],
    warehouseStocks:[{warehouseId:warehouse.id,onHand:12,expectedOnHand:0,expectedReserved:0,notes:''}]});
   x=await json(api+'/products/'+x.product.id+'/state',{expectedVersion:x.product.edit_version,active:true});
   return x.product.id;
  }
  const a=await product('Carry Case CP44','CP44-CASE','carry-case-cp44',categoryA.id,100000);
  const b=await product('Key Organizer CP44','CP44-KEY','key-organizer-cp44',categoryB.id,50000);
  await db.query("INSERT INTO product.vouchers(code,discount_type,discount_value,is_active) VALUES('CP44SAVE10','percent',10,true)");
  const promo=await json(api+'/promotions',{
   slug:'cp44-analytics',title:'=SUM(1,1) CP44 Audit',description:'Disposable analytical fixture',
   startsAt:new Date(now.getTime()-3600000).toISOString(),endsAt:new Date(now.getTime()+86400000).toISOString(),
   status:'published',memberOnly:false,discountType:'percentage',discountValue:15,
   minimumSpendIdr:0,maxUsesPerUser:0,autoApply:true,stackingRule:'with_voucher',
   scopeMode:'all',maxDiscountIdr:null,priority:15,productIds:[],categoryIds:[]
  });
  const buyer={name:'CP44 Buyer',phone:'081234567890',address:'Jalan Uji CP44 10',city:'Bandung',province:'Jawa Barat',postalCode:'40115',paymentMethod:'bank_transfer'};
  const stacked=await json('/v1/checkout/orders',{items:[{productId:a,quantity:1},{productId:b,quantity:1}],voucherCode:'CP44SAVE10',...buyer,idempotencyKey:randomUUID()},'POST','fixture-buyer');
  assert.equal(stacked.discountIdr,37500);
  const onlyPromo=await json('/v1/checkout/orders',{items:[{productId:a,quantity:1}],...buyer,idempotencyKey:randomUUID()},'POST','fixture-buyer');
  assert.equal(onlyPromo.promotionDiscountIdr,15000);assert.equal(onlyPromo.voucherDiscountIdr,0);
  const updated=await json(api+'/promotions/'+promo.id,{status:'draft',expectedVersion:1},'PATCH');
  assert.equal(updated.status,'draft');
  const pending=await json('/v1/checkout/orders',{items:[{productId:b,quantity:1}],voucherCode:'CP44SAVE10',...buyer,idempotencyKey:randomUUID()},'POST','fixture-buyer');
  assert.equal(pending.voucherDiscountIdr,5000);assert.equal(pending.promotionDiscountIdr,0);
  await db.query("UPDATE product.orders SET payment_status='paid' WHERE id=ANY($1::uuid[])",[[stacked.id,onlyPromo.id]]);
  await db.query('UPDATE product.orders SET created_at=$2 WHERE id=$1',[stacked.id,dayBefore+'T23:59:59+07:00']);
  await db.query('UPDATE product.orders SET created_at=$2 WHERE id=$1',[pending.id,day+'T00:00:01+07:00']);
  await db.query('UPDATE product.orders SET discount_idr=discount_idr+1 WHERE id=$1',[pending.id]);

  const report=await json(api+'/analytics/summary?'+range);
  assert.equal(report.summary.appliedOrders,3);
  assert.equal(report.summary.paidOrders,2);
  assert.equal(report.summary.pendingOrders,1);
  assert.equal(report.summary.anomalyOrders,1);
  assert.equal(report.summary.paidGmvIdr,'250000');
  assert.equal(report.summary.voucherDiscountIdr,'15000');
  assert.equal(report.summary.promotionDiscountIdr,'37500');
  assert.equal(report.summary.paidDiscountIdr,'52500');
  assert.equal(report.summary.netMerchandiseIdr,'197500');
  assert.equal(report.summary.paidRatePct,66.67);
  assert.equal(report.summary.stackedPaidOrders,1);
  assert.equal(report.daily.length,2);
  assert.equal(report.daily[0].day,dayBefore);
  assert.equal(report.daily[0].paidGmvIdr,'150000');
  assert.equal(report.daily[1].paidGmvIdr,'100000');
  assert.equal(report.anomalies[0].orderId,pending.id);
  assert.equal(report.anomalies[0].discountDeltaIdr,'1');
  const campaign=report.campaigns.find((x:any)=>x.id===promo.id);
  assert.ok(campaign);assert.equal(campaign.paidOrders,2);
  assert.equal(campaign.paidGmvIdr,'250000');assert.equal(campaign.promotionDiscountIdr,'37500');
  const sum=(rows:any[],key:string)=>rows.reduce((n,x)=>n+BigInt(x[key]),0n).toString();
  for(const rows of [report.products,report.categories]){
   assert.equal(sum(rows,'paidGmvIdr'),report.summary.paidGmvIdr);
   assert.equal(sum(rows,'promotionDiscountIdr'),report.summary.promotionDiscountIdr);
   assert.equal(sum(rows,'voucherDiscountIdr'),report.summary.voucherDiscountIdr);
  }
  assert.equal(sum(report.segments,'paidGmvIdr'),report.summary.paidGmvIdr);
  const isolated=await json(api+'/analytics/summary?'+range+'&campaignId='+promo.id);
  assert.equal(isolated.summary.appliedOrders,2);
  assert.equal(isolated.summary.pendingOrders,0);
  assert.equal(isolated.summary.paidGmvIdr,'250000');
  const todayReport=await json(api+'/analytics/summary?from='+day+'&to='+day);
  assert.equal(todayReport.summary.appliedOrders,2);
  assert.equal(todayReport.summary.paidGmvIdr,'100000');

  const pageOne=await json(api+'/analytics/ledger?'+range+'&limit=2');
  assert.equal(pageOne.items.length,2);assert.equal(pageOne.hasMore,true);assert.ok(pageOne.nextCursor);
  const pageTwo=await json(api+'/analytics/ledger?'+range+'&limit=2&cursor='+encodeURIComponent(pageOne.nextCursor));
  assert.equal(pageTwo.items.length,1);assert.equal(pageTwo.hasMore,false);
  assert.equal(new Set([...pageOne.items,...pageTwo.items].map((x:any)=>x.id)).size,3);

  const csv=await request(api+'/analytics/ledger.csv?'+range);
  assert.equal(csv.status,200);assert.match(csv.contentType||'',/text\/csv/);
  assert.match(csv.body,/Order ID/);
  assert.ok(csv.body.includes("'=SUM(1,1) CP44 Audit"),'formula-injection protection required');
  assert.equal((csv.body.match(new RegExp(stacked.id,'g'))||[]).length,1);
  assert.equal(csv.body.includes('CP44 Buyer'),false,'CSV must exclude customer PII');
  const unauthorized=await request(api+'/analytics/summary?'+range,undefined,'GET','fixture-buyer');
  assert.equal(unauthorized.status,403);
  const invalid=await request(api+'/analytics/summary?from=2026-02-30&to=2026-03-01',undefined,'GET');
  assert.equal(invalid.status,400);
  const unknown=await request(api+'/analytics/ledger?'+range+'&limit=99999',undefined,'GET');
  assert.equal(unknown.status,400);
  await db.query("UPDATE product.orders SET payment_status='refunded' WHERE id=$1",[onlyPromo.id]);
  const refunded=await json(api+'/analytics/summary?'+range);
  assert.equal(refunded.summary.refundedOrders,1);
  assert.equal(refunded.summary.paidGmvIdr,'150000');
  assert.equal(refunded.summary.promotionDiscountIdr,'22500');
  assert.equal(refunded.summary.voucherDiscountIdr,'15000');
  console.log('CP44_ANALYTICS_RECONCILED_PASS',JSON.stringify({paidBasis:true,periodWIB:true,
   campaignFilter:true,voucherVsPromo:true,exactProductAndCategoryAllocation:true,
   membershipSegments:true,ledgerPagination:true,csvExport:true,csvFormulaProtection:true,
   noPII:true,adminGuard:true,anomalyDetection:true,refundsExcluded:true,paymentCaptured:false,productionWrites:false}));
 }finally{await app.close()}
});
