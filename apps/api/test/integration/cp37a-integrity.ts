import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseService} from '../../src/database';
import {ProductsService} from '../../src/products';
import {BrandsService} from '../../src/brands';
import {BrandPortalService} from '../../src/brand-portal';
import {WarehouseService} from '../../src/warehouses';
import {CheckoutService} from '../../src/checkout';
import {AdminProductRecordsService} from '../../src/admin-product-records';
import {parsePage,parseEdit,publicationMissing} from '../../src/data-integrity';
test('CP37-A data integrity on disposable localhost PostgreSQL only',async()=>{
 if(!process.env.DATABASE_URL?.includes('127.0.0.1'))throw Error('Refuse non-local integration database');
 const db=new DatabaseService(),products=new ProductsService(db),brands=new BrandsService(db),portal=new BrandPortalService(db),warehouses=new WarehouseService(db),checkout=new CheckoutService(db),records=new AdminProductRecordsService(db);
 const actor={id:randomUUID(),email:'cp37a-admin@example.invalid',emailVerified:true};
 const partnerA={id:randomUUID(),email:'cp37a-brand-a@example.invalid',emailVerified:true};
 const partnerB={id:randomUUID(),email:'cp37a-brand-b@example.invalid',emailVerified:true};
 const suffix=randomUUID().slice(0,7).toUpperCase(),prefix='cp37a-'+suffix.toLowerCase();
 try{
  const baseline=await products.summary();
  const A=await brands.create({name:'Brand A '+suffix,slug:prefix+'-brand-a'},actor);
  const B=await brands.create({name:'Brand B '+suffix,slug:prefix+'-brand-b'},actor);
  for(const [brandId,partner] of [[A.id,partnerA],[B.id,partnerB]] as const)await db.query('INSERT INTO product.brand_memberships(brand_id,user_id,role,is_active,added_by) VALUES($1,$2,\'viewer\',true,$3)',[brandId,partner.id,actor.id]);
  let p=await products.create({name:'Desk Organizer '+suffix,slug:prefix+'-organizer',sku:'CP37A-'+suffix,description:'Household office organizer',category:'home',price_idr:100000,stock_qty:0,brand_id:A.id},actor);
  assert.equal(p.edit_version,1);
  await assert.rejects(()=>products.update(p.id,{is_active:true},actor),/Muat ulang/);
  const preAudit=await products.audit({entityType:'product',entityId:p.id});
  await assert.rejects(()=>products.update(p.id,{expected_version:1,is_active:true},actor),/Data belum lengkap/);
  assert.equal((await products.audit({entityType:'product',entityId:p.id})).total,preAudit.total,'failed publication must not leave audit or version mutation');
  const saleId=randomUUID();
  await db.query("INSERT INTO product.orders(id,customer_user_id,status,payment_status,payment_provider,payment_reference,idempotency_key,contact_name) VALUES($1,$2,'paid','paid','ci-fixture-only',$3,$4,$5)",[saleId,partnerA.id,'ci-'+suffix,randomUUID(),prefix+'-historic']);
  await db.query('INSERT INTO product.order_items(order_id,product_id,brand_id,quantity,unit_price_idr,product_name,sku) VALUES($1,$2,$3,2,100000,$4,$5)',[saleId,p.id,A.id,p.name,p.sku]);
  assert.equal((await portal.overview(partnerA,A.id)).sales.gross_item_sales_idr,'200000');
  p=await products.update(p.id,{expected_version:p.edit_version,brand_id:B.id,name:'Renamed Organizer '+suffix},actor);
  assert.equal((await portal.overview(partnerA,A.id)).sales.gross_item_sales_idr,'200000','historical ownership cannot follow current product brand');
  assert.equal((await portal.overview(partnerB,B.id)).sales.gross_item_sales_idr,'0');
  const history=await portal.sales(partnerA,A.id);assert.equal(history.items.length,1);assert.equal(history.items[0].name,'Desk Organizer '+suffix);
  assert.equal((await portal.sales(partnerB,B.id)).items.length,0);
  await assert.rejects(()=>portal.sales(partnerA,B.id),/Akses brand/);
  await assert.rejects(()=>products.update(p.id,{expected_version:1,description:'stale editor'},actor),/operator lain/);
  const concurrent=await Promise.allSettled([
   products.update(p.id,{expected_version:p.edit_version,description:'Concurrent editor one'},actor),
   products.update(p.id,{expected_version:p.edit_version,description:'Concurrent editor two'},actor)
  ]);
  assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);assert.equal(concurrent.filter(x=>x.status==='rejected').length,1);
  p=(await products.page({q:p.slug},true)).items[0];
  const wh=(await warehouses.create(actor,{code:'QA-'+suffix,name:'Integration warehouse',address:'Jalan Internal Test 12',city:'Bandung',province:'Jawa Barat',postalCode:'40115'})).warehouse;
  await warehouses.adjust(actor,{warehouseId:wh.id,productId:p.id,delta:3,reason:'receipt',notes:'Verified CI receiving document',idempotencyKey:randomUUID()});
  await warehouses.update(actor,wh.id,{dispatchEnabled:true});
  p=await products.update(p.id,{expected_version:p.edit_version,image_url:'https://example.invalid/organizer.png',weight_grams:200,length_cm:10,width_cm:10,height_cm:10,is_active:true},actor);
  assert.equal(p.is_active,true);
  const audit=await products.audit({entityType:'product',entityId:p.id});
  assert.equal(audit.items[0].action,'publish');assert.equal(audit.items[0].actor_id,actor.id);
  assert.equal(audit.items[0].after_data.edit_version,p.edit_version);
  const av=A.edit_version;const newA=await brands.update(A.id,{expected_version:av,name:'Revised Brand A '+suffix},actor);
  assert.equal(newA.edit_version,av+1);
  await assert.rejects(()=>brands.update(A.id,{expected_version:av,name:'Stale Brand A'},actor),/operator lain/);
  assert.equal((await brands.list()).items.find(x=>x.id===A.id)?.edit_version,newA.edit_version);
  // 205 non-commerce fixture records to exercise former 48/100/150 cutoffs.
  for(let i=0;i<205;i++){
   await db.query("INSERT INTO product.products(slug,sku,name,description,category,price_idr,stock_qty,is_active,brand_id) VALUES($1,$2,$3,'fixture','home',10000,0,true,$4)",[prefix+'-fixture-'+String(i).padStart(3,'0'),'Q-'+suffix+'-'+i,'Fixture '+prefix+' '+String(i).padStart(3,'0'),B.id]);
   await db.query("INSERT INTO product.orders(customer_user_id,idempotency_key,contact_name,status,payment_status) VALUES($1,$2,$3,'draft','not_initiated')",[partnerB.id,randomUUID(),prefix+'-order-'+String(i).padStart(3,'0')]);
  }
  const all:string[]=[];
  for(let page=1;page<=3;page++){
   const result=await products.page({q:'Fixture '+prefix,page:String(page),pageSize:'100'},true);
   assert.equal(result.total,205);all.push(...result.items.map(x=>x.id));
  }
  assert.equal(all.length,205);assert.equal(new Set(all).size,205);
  assert.equal((await products.page({q:prefix+'-fixture-204'},true)).items.length,1);
  assert.equal((await products.page({q:'Fixture '+prefix,page:'3',pageSize:'100'})).items.length,5);
  const orderPage=await checkout.adminOrders({q:prefix+'-order',page:'3',pageSize:'100'});
  assert.equal(orderPage.total,205);assert.equal(orderPage.items.length,5);
  const totals=await products.summary();assert.equal(totals.totals.managed,baseline.totals.managed+206);assert.equal(totals.totals.orders,baseline.totals.orders+206);
  assert.equal(totals.totals.published,baseline.totals.published+206);
  const index=await records.list({q:p.slug,source:'managed'});
  assert.equal((index.items[0].product as any).edit_version,p.edit_version);
  assert.throws(()=>parsePage({page:'0'}));assert.throws(()=>parsePage({pageSize:'10001'}));assert.throws(()=>parseEdit({expected_version:0,name:'wrong'}));
  assert.ok(publicationMissing({}).includes('sku'));
  assert.equal(checkout.config().paymentEnabled,false);
  assert.equal((await records.list({source:'existing'})).summary.existing,19,'historical references unchanged');
  console.log('CP37A_POSTGRES_PASS',{pagination:205,snapshotBrand:true,concurrentEdit:true,auditAtomic:true,historicalUnchanged:true,payment:false});
 }finally{await db.onModuleDestroy();}
});
