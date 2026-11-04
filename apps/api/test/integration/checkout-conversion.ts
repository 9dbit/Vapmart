import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import sharp from 'sharp';
const {createFixture}=require(resolve('../../scripts/cp39-fixture-server.cjs'));

test('CP41 voucher, optional stock note and manual bank-transfer order reach admin dashboard',async()=>{
 const {app,db,base}=await createFixture();
 const call=async(path:string,body?:any,method='POST',token='fixture-admin')=>{
  const r=await fetch(base+path,{method:body===undefined?'GET':method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:r.status,data:await r.json().catch(()=>null)};
 };
 const ok=async(path:string,body?:any,method='POST',token='fixture-admin')=>{const r=await call(path,body,method,token);assert.ok(r.status>=200&&r.status<300,JSON.stringify({path,...r}));return r.data;};
 const api='/v1/admin/catalog';
 try{
  const lookups=await ok(api+'/lookups'),warehouse=lookups.warehouses.find((w:any)=>w.is_active&&!w.is_system_hold),category=lookups.categories.find((c:any)=>c.slug==='other');
  assert.ok(warehouse&&category);
  const png=await sharp({create:{width:96,height:96,channels:3,background:'#7842b8'}}).png().toBuffer();
  const asset=await ok('/v1/admin/media',{filename:'cp41.png',mimeType:'image/png',base64:png.toString('base64')});
  const image='/api/media/'+asset.id;
  const product={name:'Travel Pouch CP41',slug:'travel-pouch-cp41',sku:'CP41-POUCH',description:'Travel pouch for everyday accessories.',categoryIds:[category.id],brand_id:null,fulfillment_owner_brand_id:null,image_url:image,gallery_urls:[],price_idr:100000,sale_price_idr:null,sale_starts_at:null,sale_ends_at:null,weight_grams:250,length_cm:20,width_cm:12,height_cm:4,product_type:'simple',attributes:[]};
  let saved=await ok(api+'/products',{requestKey:randomUUID(),product,variants:[],warehouseStocks:[{warehouseId:warehouse.id,onHand:6,expectedOnHand:0,expectedReserved:0,notes:''}]});
  assert.equal(saved.product.stock_qty,6,'blank stock note must not block an audited stock update');
  const event=(await db.query('SELECT notes FROM product.warehouse_stock_events WHERE product_id=$1 ORDER BY id DESC LIMIT 1',[saved.product.id])).rows[0];
  assert.equal(event.notes,'Penyesuaian stok dari editor produk');
  saved=await ok(api+'/products/'+saved.product.id+'/state',{expectedVersion:saved.product.edit_version,active:true});
  await db.query("INSERT INTO product.vouchers(code,discount_type,discount_value,min_subtotal_idr,usage_limit,is_active) VALUES('CP41SAVE10','percent',10,50000,20,true)");
  const quote=await ok('/v1/checkout/quote',{items:[{productId:saved.product.id,quantity:2}],voucherCode:'cp41save10'});
  assert.equal(quote.subtotalIdr,200000);assert.equal(quote.discountIdr,20000);assert.equal(quote.voucherCode,'CP41SAVE10');assert.equal(quote.totalIdr,195000);
  const invalid=await call('/v1/checkout/quote',{items:[{productId:saved.product.id,quantity:1}],voucherCode:'NOTEXIST'});assert.equal(invalid.status,409);
  const order=await ok('/v1/checkout/orders',{items:[{productId:saved.product.id,quantity:2}],name:'CP41 Buyer',phone:'081234567890',address:'Jalan Test CP41 Nomor 1',city:'Bandung',province:'Jawa Barat',postalCode:'40115',paymentMethod:'bank_transfer',voucherCode:'CP41SAVE10',idempotencyKey:randomUUID()},'POST','fixture-buyer');
  assert.equal(order.paymentStatus,'pending');assert.equal(order.paymentMethod,'bank_transfer');assert.equal(order.discountIdr,20000);assert.equal(order.totalIdr,195000);
  const stored=(await db.query('SELECT payment_status,payment_method,voucher_code,discount_idr::int,total_idr::int,payment_provider,payment_reference FROM product.orders WHERE id=$1',[order.id])).rows[0];
  assert.equal(stored.payment_status,'pending');assert.equal(stored.payment_method,'bank_transfer');assert.equal(stored.voucher_code,'CP41SAVE10');assert.equal(stored.discount_idr,20000);assert.equal(stored.total_idr,195000);assert.equal(stored.payment_provider,null);assert.equal(stored.payment_reference,null);
  const dashboard=await ok(api+'/orders?status=pending');assert.ok(dashboard.items.some((x:any)=>x.id===order.id&&x.payment_method==='bank_transfer'&&x.voucher_code==='CP41SAVE10'));
  const detail=await ok(api+'/orders/'+order.id);assert.equal(detail.order.discount_idr,'20000');assert.equal(detail.order.voucher_code,'CP41SAVE10');
  const customer=await ok('/v1/checkout/orders/'+order.id,undefined,'GET','fixture-buyer');assert.equal(customer.order.payment_status,'pending');assert.equal(customer.order.voucher_code,'CP41SAVE10');
  const variable={...product,name:'Travel Case CP41',slug:'travel-case-cp41',sku:'CP41-CASE',product_type:'variable',price_idr:0,attributes:[{name:'Color',values:['Black','Blue']}],weight_grams:300,length_cm:22,width_cm:14,height_cm:5};
  const variant=(color:string,sku:string)=>({sku,price_idr:120000,sale_price_idr:null,option_values:{Color:color},enabled:true,weight_grams:'',length_cm:'',width_cm:'',height_cm:'',warehouseStocks:[{warehouseId:warehouse.id,onHand:2,expectedOnHand:0,expectedReserved:0,notes:''}]});
  const family=await ok(api+'/products',{requestKey:randomUUID(),product:variable,warehouseStocks:[],variants:[variant('Black','CP41-CASE-BLK'),variant('Blue','CP41-CASE-BLU')]});
  assert.equal(family.variants[0].weight_grams,300);assert.equal(family.variants[0].length_cm,22);
  console.log('CP41_COMMERCE_FLOW_PASS',JSON.stringify({voucher:true,bankTransferPending:true,adminDashboard:true,optionalStockNote:true,variantDimensionInheritance:true,paymentCaptured:false,courierBooked:false,productionWrites:false}));
 }finally{await app.close();}
});
