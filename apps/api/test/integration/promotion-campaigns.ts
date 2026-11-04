import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import sharp from 'sharp';
const {createFixture}=require(resolve('../../scripts/cp39-fixture-server.cjs'));

test('CP43 promotion campaigns auto-apply with scope, stacking, member and usage guards',async()=>{
 const {app,db,base,users}=await createFixture();
 const call=async(path:string,body?:any,method='POST',token:string|null='fixture-admin')=>{
  const headers:Record<string,string>={'content-type':'application/json'};if(token)headers.authorization='Bearer '+token;
  const r=await fetch(base+path,{method:body===undefined?'GET':method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:r.status,data:await r.json().catch(()=>null)};
 };
 const ok=async(path:string,body?:any,method='POST',token:string|null='fixture-admin')=>{const r=await call(path,body,method,token);assert.ok(r.status>=200&&r.status<300,JSON.stringify({path,...r}));return r.data;};
 const api='/v1/admin/catalog';
 try{
  const lookups=await ok(api+'/lookups'),warehouse=lookups.warehouses.find((w:any)=>w.is_active&&!w.is_system_hold),category=lookups.categories.find((c:any)=>c.slug==='accessories')||lookups.categories[0];
  assert.ok(warehouse&&category);
  const png=await sharp({create:{width:96,height:96,channels:3,background:'#7c3aed'}}).png().toBuffer();
  const asset=await ok('/v1/admin/media',{filename:'cp43.png',mimeType:'image/png',base64:png.toString('base64')});
  const product={name:'Organizer CP43',slug:'organizer-cp43',sku:'CP43-ORG',description:'Compact organizer for everyday accessories.',categoryIds:[category.id],brand_id:null,fulfillment_owner_brand_id:null,image_url:'/api/media/'+asset.id,gallery_urls:[],price_idr:100000,sale_price_idr:null,sale_starts_at:null,sale_ends_at:null,weight_grams:300,length_cm:20,width_cm:12,height_cm:5,product_type:'simple',attributes:[]};
  let saved=await ok(api+'/products',{requestKey:randomUUID(),product,variants:[],warehouseStocks:[{warehouseId:warehouse.id,onHand:8,expectedOnHand:0,expectedReserved:0,notes:''}]});
  saved=await ok(api+'/products/'+saved.product.id+'/state',{expectedVersion:saved.product.edit_version,active:true});

  const now=Date.now(),starts=new Date(now-3600000).toISOString(),ends=new Date(now+86400000).toISOString();
  let promo=await ok(api+'/promotions',{slug:'cp43-auto-15',title:'CP43 Auto 15',description:'Disposable integration campaign',startsAt:starts,endsAt:ends,status:'published',memberOnly:false,discountType:'percentage',discountValue:15,minimumSpendIdr:50000,maxUsesPerUser:0,autoApply:true,stackingRule:'exclusive',scopeMode:'all',maxDiscountIdr:50000,priority:20,productIds:[],categoryIds:[]});
  assert.equal(promo.lifecycle,'active');assert.equal(promo.editVersion,1);

  let quote=await ok('/v1/checkout/quote',{items:[{productId:saved.product.id,quantity:1}]},'POST',null);
  assert.equal(quote.subtotalIdr,100000);assert.equal(quote.promotionDiscountIdr,15000);assert.equal(quote.voucherDiscountIdr,0);assert.equal(quote.discountIdr,15000);assert.equal(quote.promotionTitle,'CP43 Auto 15');

  await db.query("INSERT INTO product.vouchers(code,discount_type,discount_value,min_subtotal_idr,is_active) VALUES('CP43SAVE10','percent',10,0,true)");
  quote=await ok('/v1/checkout/quote',{items:[{productId:saved.product.id,quantity:1}],voucherCode:'CP43SAVE10'},'POST',null);
  assert.equal(quote.voucherDiscountIdr,10000);assert.equal(quote.promotionDiscountIdr,0);assert.equal(quote.discountIdr,10000);

  promo=await ok(api+'/promotions/'+promo.id,{expectedVersion:1,stackingRule:'with_voucher'},'PATCH');
  assert.equal(promo.editVersion,2);
  quote=await ok('/v1/checkout/quote',{items:[{productId:saved.product.id,quantity:1}],voucherCode:'CP43SAVE10'},'POST',null);
  assert.equal(quote.voucherDiscountIdr,10000);assert.equal(quote.promotionDiscountIdr,15000);assert.equal(quote.discountIdr,25000);

  promo=await ok(api+'/promotions/'+promo.id,{expectedVersion:2,scopeMode:'products',productIds:[saved.product.id],categoryIds:[]},'PATCH');
  assert.equal(promo.scopeMode,'products');assert.equal(promo.products[0].id,saved.product.id);
  quote=await ok('/v1/checkout/quote',{items:[{productId:saved.product.id,quantity:1}]},'POST',null);assert.equal(quote.promotionDiscountIdr,15000);

  promo=await ok(api+'/promotions/'+promo.id,{expectedVersion:3,scopeMode:'categories',productIds:[],categoryIds:[category.id]},'PATCH');
  assert.equal(promo.scopeMode,'categories');assert.equal(promo.categories[0].id,category.id);
  quote=await ok('/v1/checkout/quote',{items:[{productId:saved.product.id,quantity:1}]},'POST',null);assert.equal(quote.promotionDiscountIdr,15000);

  await db.query('INSERT INTO public.customer_profiles(user_id,email) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING',[users['fixture-buyer'].id,users['fixture-buyer'].email]);
  await db.query("INSERT INTO membership.accounts(user_id,status,activated_at) VALUES($1,'ACTIVE',now()) ON CONFLICT(user_id) DO UPDATE SET status='ACTIVE',activated_at=now()",[users['fixture-buyer'].id]);
  promo=await ok(api+'/promotions/'+promo.id,{expectedVersion:4,memberOnly:true,maxUsesPerUser:1},'PATCH');

  const anonymous=await ok('/v1/checkout/quote',{items:[{productId:saved.product.id,quantity:1}]},'POST',null);assert.equal(anonymous.promotionDiscountIdr,0);
  const member=await ok('/v1/checkout/quote',{items:[{productId:saved.product.id,quantity:1}]},'POST','fixture-buyer');assert.equal(member.promotionDiscountIdr,15000);

  const order=await ok('/v1/checkout/orders',{items:[{productId:saved.product.id,quantity:1}],name:'CP43 Buyer',phone:'081234567890',address:'Jalan Test CP43 Nomor 1',city:'Bandung',province:'Jawa Barat',postalCode:'40115',paymentMethod:'bank_transfer',voucherCode:'CP43SAVE10',idempotencyKey:randomUUID()},'POST','fixture-buyer');
  assert.equal(order.paymentStatus,'pending');assert.equal(order.voucherDiscountIdr,10000);assert.equal(order.promotionDiscountIdr,15000);assert.equal(order.discountIdr,25000);assert.equal(order.promotionEventId,promo.id);
  const stored=(await db.query('SELECT discount_idr::int,voucher_discount_idr::int,promotion_discount_idr::int,promotion_event_id,promotion_title,payment_provider,payment_reference FROM product.orders WHERE id=$1',[order.id])).rows[0];
  assert.deepEqual({discount:stored.discount_idr,voucher:stored.voucher_discount_idr,promo:stored.promotion_discount_idr,event:stored.promotion_event_id,title:stored.promotion_title},{discount:25000,voucher:10000,promo:15000,event:promo.id,title:'CP43 Auto 15'});
  assert.equal(stored.payment_provider,null);assert.equal(stored.payment_reference,null);

  await db.query("UPDATE product.orders SET payment_status='paid' WHERE id=$1",[order.id]);
  const exhausted=await ok('/v1/checkout/quote',{items:[{productId:saved.product.id,quantity:1}]},'POST','fixture-buyer');assert.equal(exhausted.promotionDiscountIdr,0);

  const stale=await call(api+'/promotions/'+promo.id,{expectedVersion:4,title:'Stale write'},'PATCH');assert.equal(stale.status,409);
  const duplicate=await call(api+'/promotions',{slug:'cp43-auto-15',title:'Duplicate',description:'',startsAt:starts,endsAt:ends,status:'draft',memberOnly:false,discountType:'fixed',discountValue:1000,minimumSpendIdr:0,maxUsesPerUser:0,autoApply:false,stackingRule:'exclusive',scopeMode:'all',maxDiscountIdr:null,priority:100,productIds:[],categoryIds:[]});assert.equal(duplicate.status,409);

  const audit=await db.query("SELECT action FROM product.catalog_audit WHERE entity_type='promotion_event' AND entity_id=$1 ORDER BY id",[promo.id]);
  assert.deepEqual(audit.rows.map((x:any)=>x.action),['create','update','update','update','update']);
  console.log('CP43_PROMOTION_ENGINE_PASS',JSON.stringify({autoApply:true,exclusive:true,stacking:true,productScope:true,categoryScope:true,memberOnly:true,usageLimit:true,staleConflict:true,duplicateGuard:true,paymentCaptured:false,courierBooked:false,productionWrites:false}));
 }finally{await app.close();}
});
