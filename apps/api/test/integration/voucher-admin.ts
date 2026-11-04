import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
const {createFixture}=require(resolve('../../scripts/cp39-fixture-server.cjs'));

test('CP42 voucher admin creates, schedules, edits, deactivates and audits vouchers safely',async()=>{
 const {app,db,base}=await createFixture();
 const call=async(path:string,body?:unknown,method='POST')=>{
  const r=await fetch(base+path,{method:body===undefined?'GET':method,headers:{authorization:'Bearer fixture-admin','content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:r.status,data:await r.json().catch(()=>null)};
 };
 const ok=async(path:string,body?:unknown,method='POST')=>{const r=await call(path,body,method);assert.ok(r.status>=200&&r.status<300,JSON.stringify({path,...r}));return r.data;};
 try{
  const empty=await ok('/v1/admin/catalog/vouchers?pageSize=100');assert.equal(empty.total,0);
  const created=await ok('/v1/admin/catalog/vouchers',{
   code:'cp42save15',discountType:'percent',discountValue:15,maxDiscountIdr:30000,minSubtotalIdr:100000,usageLimit:25,
   startsAt:'2026-12-01T00:00:00.000Z',endsAt:'2026-12-31T23:59:59.000Z',isActive:true
  });
  assert.equal(created.code,'CP42SAVE15');assert.equal(created.lifecycle,'scheduled');assert.equal(created.editVersion,1);
  assert.equal(created.maxDiscountIdr,30000);assert.equal(created.usedPaid,0);assert.equal(created.pendingOrders,0);

  const scheduled=await ok('/v1/admin/catalog/vouchers?status=scheduled&pageSize=100');
  assert.equal(scheduled.total,1);assert.equal(scheduled.items[0].id,created.id);

  const disabled=await ok('/v1/admin/catalog/vouchers/'+created.id,{expectedVersion:1,isActive:false},'PATCH');
  assert.equal(disabled.lifecycle,'inactive');assert.equal(disabled.editVersion,2);
  assert.equal(new Date(disabled.startsAt).toISOString(),'2026-12-01T00:00:00.000Z');

  const stale=await call('/v1/admin/catalog/vouchers/'+created.id,{expectedVersion:1,isActive:true},'PATCH');
  assert.equal(stale.status,409);

  const active=await ok('/v1/admin/catalog/vouchers/'+created.id,{
   expectedVersion:2,isActive:true,startsAt:null,endsAt:null,discountValue:20
  },'PATCH');
  assert.equal(active.lifecycle,'active');assert.equal(active.discountValue,20);assert.equal(active.editVersion,3);

  const duplicate=await call('/v1/admin/catalog/vouchers',{
   code:'CP42SAVE15',discountType:'fixed',discountValue:10000,minSubtotalIdr:0,isActive:false
  });
  assert.equal(duplicate.status,409);

  const fixed=await ok('/v1/admin/catalog/vouchers',{
   code:'CP42FIXED',discountType:'fixed',discountValue:12000,maxDiscountIdr:5000,minSubtotalIdr:50000,usageLimit:null,isActive:false
  });
  assert.equal(fixed.discountType,'fixed');assert.equal(fixed.maxDiscountIdr,null);assert.equal(fixed.lifecycle,'inactive');

  const audit=await db.query("SELECT action FROM product.catalog_audit WHERE entity_type='voucher' ORDER BY id");
  assert.deepEqual(audit.rows.map((x:any)=>x.action),['create','deactivate','activate','create']);

  const columns=await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='product' AND table_name='vouchers' AND column_name IN ('edit_version','updated_by') ORDER BY column_name");
  assert.deepEqual(columns.rows.map((x:any)=>x.column_name),['edit_version','updated_by']);

  const orders=await db.query("SELECT count(*)::int n FROM product.orders WHERE voucher_id IS NOT NULL");
  assert.equal(orders.rows[0].n,0,'voucher administration must not create orders or payments');

  console.log('CP42_VOUCHER_ADMIN_PASS',JSON.stringify({create:true,schedule:true,deactivate:true,reactivate:true,staleConflict:true,duplicateGuard:true,audit:true,ordersCreated:0,paymentsCaptured:false}));
 }finally{await app.close();}
});
