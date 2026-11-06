import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import test from 'node:test';
const {createFixture}=require(resolve('../../scripts/cp39-fixture-server.cjs'));
test('Store profile and manual transfers: authorization, immutable invoices, exact amounts, concurrency and replay',async()=>{
 const {app,db,base,users}=await createFixture();
 const call=async(path:string,body?:unknown,method='POST',token='fixture-admin')=>{const r=await fetch(base+'/v1/admin/catalog'+path,{method:body===undefined?'GET':method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json()};};
 const ok=async(path:string,body?:unknown,method='POST')=>{const r=await call(path,body,method);assert.ok(r.status<300,JSON.stringify(r));return r.data;};
 const paymentTestBuyer=randomUUID();
 const makeOrder=async(method='bank_transfer',state='pending')=>{const id=randomUUID();await db.query("INSERT INTO product.orders(id,customer_user_id,status,payment_method,payment_status,total_idr,subtotal_idr,contact_name) VALUES($1,$2,'draft',$3,$4,100000,100000,'Payment test')",[id,paymentTestBuyer,method,state]);return id;};
 try{
  const initial=await ok('/store-profile'),id=await makeOrder(),path='/orders/'+id;
  assert.equal((await call('/store-profile',undefined,'GET','fixture-buyer')).status,403);
  const original=await ok(path+'/invoice',{});
  const profile={name:'Test Store',address:'Jalan Uji Nomor 27',city:'Bandung',province:'Jawa Barat',postalCode:'40115',phone:'081234567890',email:'shop@example.invalid',expectedVersion:initial.version};
  assert.equal((await call('/store-profile',profile,'PATCH','fixture-unverified')).status,403);
  assert.equal((await call('/store-profile',{...profile,postalCode:'ABC'},'PATCH')).status,400);
  const saved=await ok('/store-profile',profile,'PATCH');assert.equal(saved.version,initial.version+1);
  assert.equal((await call('/store-profile',profile,'PATCH')).status,409);
  assert.deepEqual((await ok(path+'/invoice',{})).snapshot,original.snapshot);
  const second=await makeOrder(),fresh=await ok('/orders/'+second+'/invoice',{});assert.equal(fresh.snapshot.store.name,profile.name);assert.match(fresh.snapshot.store.address,/Bandung/);
  let d=await ok(path);assert.match(d.statusBlockers.processing,/pembayaran/);assert.equal(d.manualPaymentBlocker,null);
  const body={expectedVersion:d.order.edit_version,idempotencyKey:randomUUID(),amountIdr:100000,paidAt:new Date().toISOString(),bankName:'BCA',accountNumber:'1234567890',accountName:'Test Store',reference:'TRX-'+randomUUID(),notes:'Checked incoming bank statement',verified:true};
  assert.equal((await call(path+'/confirm-payment',body,'POST','fixture-buyer')).status,403);
  assert.equal((await call(path+'/confirm-payment',{...body,verified:false})).status,400);
  assert.equal((await call(path+'/confirm-payment',{...body,paidAt:'2099-01-01T00:00:00Z'})).status,400);
  for(const amountIdr of [99000,101000]){const r=await call(path+'/confirm-payment',{...body,amountIdr});assert.equal(r.status,409);assert.equal(r.data.differenceIdr,amountIdr-100000);}
  assert.equal((await ok(path)).order.payment_status,'pending');
  assert.equal((await call(path+'/confirm-payment',{...body,expectedVersion:99})).status,409);
  const writes=await Promise.all([call(path+'/confirm-payment',body),call(path+'/confirm-payment',body)]);assert.ok(writes.every(r=>r.status===201));assert.equal(writes.filter(r=>r.data.replayed).length,1);
  d=await ok(path);assert.equal(d.order.payment_status,'paid');assert.equal(d.order.operational_status,'processing');assert.equal(d.order.payment_provider,'manual_bank_transfer');assert.equal(d.paymentConfirmations.length,1);assert.equal(d.events.filter((e:any)=>e.action==='payment_confirmed').length,1);assert.equal(d.paymentConfirmations[0].actor_id,users['fixture-admin'].id);assert.ok(d.editBlocker);
  assert.equal((await call(path+'/confirm-payment',{...body,idempotencyKey:randomUUID()})).status,409);
  assert.equal((await call('/orders/'+second+'/confirm-payment',{...body,idempotencyKey:randomUUID(),expectedVersion:1})).status,409);assert.equal((await ok('/orders/'+second)).order.payment_status,'pending');
  const paidInvoice=await ok(path+'/invoice',{});assert.equal(paidInvoice.snapshot.order.payment_status,'paid');assert.equal(paidInvoice.snapshot.store.name,profile.name);assert.equal((await ok(path+'/invoice',{revision:original.order_version})).snapshot.order.payment_status,'pending');
  assert.match(d.statusBlockers.completed,/paket/);
  for(const [method,state] of [['qris','pending'],['bank_transfer','refunded'],['bank_transfer','paid']]){const invalid=await makeOrder(method,state);assert.equal((await call('/orders/'+invalid+'/confirm-payment',{...body,idempotencyKey:randomUUID(),reference:randomUUID(),expectedVersion:1})).status,409);}
  const closed=await makeOrder();await db.query("UPDATE product.orders SET status='cancelled',operational_status='cancelled' WHERE id=$1",[closed]);const closedDetail=await ok('/orders/'+closed);assert.equal((await call('/orders/'+closed+'/confirm-payment',{...body,idempotencyKey:randomUUID(),reference:randomUUID(),expectedVersion:closedDetail.order.edit_version})).status,409);

  const quick=await makeOrder(),quickPath='/orders/'+quick,approve={approve:true,expectedVersion:1,idempotencyKey:randomUUID()};
  assert.equal((await call(quickPath+'/confirm-payment',approve,'POST','fixture-buyer')).status,403);
  assert.equal((await call(quickPath+'/confirm-payment',{...approve,amountIdr:1})).status,400,'approval cannot override server amount');
  assert.equal((await call(quickPath+'/confirm-payment',{...approve,expectedVersion:99})).status,409);
  const approvals=await Promise.all([call(quickPath+'/confirm-payment',approve),call(quickPath+'/confirm-payment',approve)]);
  assert.ok(approvals.every(r=>r.status===201));assert.equal(approvals.filter(r=>r.data.replayed).length,1);
  const approved=await ok(quickPath);assert.equal(approved.order.payment_status,'paid');assert.equal(approved.order.operational_status,'processing');
  assert.equal(approved.paymentConfirmations.length,1);const receipt=approved.paymentConfirmations[0];assert.equal(Number(receipt.amount_idr),100000);assert.equal(receipt.verification_method,'admin_approval');assert.equal(receipt.paid_at,null);assert.equal(receipt.bank_name,null);assert.equal(receipt.account_number,null);assert.match(receipt.reference,/^ADMIN-/);assert.equal(receipt.actor_id,users['fixture-admin'].id);
  assert.equal((await call(quickPath+'/confirm-payment',{...approve,idempotencyKey:randomUUID()})).status,409);
  const stale=await makeOrder();await db.query('UPDATE product.orders SET total_idr=110000 WHERE id=$1',[stale]);assert.equal((await call('/orders/'+stale+'/confirm-payment',{...approve,idempotencyKey:randomUUID()})).status,409);
  console.log('ORDER_APPROVAL_PASS');
  console.log('STORE_MANUAL_PAYMENT_PASS');
 }finally{await app.close()}
});
