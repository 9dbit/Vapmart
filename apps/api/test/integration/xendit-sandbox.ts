import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';

test('CP53 Xendit tables isolate webhook events and enforce session uniqueness',async()=>{
 const url=process.env.DATABASE_URL||'';
 if(!url.includes('127.0.0.1')||!url.includes('vapmart_cp39_'))
  throw Error('Disposable PostgreSQL fixture required');
 const pool=new Pool({connectionString:url,max:1});
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const o=await client.query<{id:string}>('SELECT id FROM product.orders ORDER BY created_at DESC LIMIT 1');
  assert.ok(o.rows[0],'Checkout integration must seed an order first');
  const orderId=o.rows[0].id;
  const session='ps-'+'a'.repeat(24),ref='VM-0000000099-PAY1',key=randomUUID();
  const r=await client.query<{id:string}>(
   'INSERT INTO product.xendit_payment_sessions(order_id,attempt,reference_id,amount_idr,request_hash,request_idempotency_key,state,payment_session_id,provider_business_id) VALUES($1,1,$2,150000,$3,$4,\'active\',$5,$6) RETURNING id',
   [orderId,ref,'a'.repeat(64),key,session,'661f87c614802d6c402cd82d']);
  assert.ok(r.rows[0].id);
  const eventArgs=['b'.repeat(64),'payment_session.completed',session,ref,'661f87c614802d6c402cd82d',
   150000,'COMPLETED','2026-11-17T09:10:11Z'];
  const first=await client.query(
   'INSERT INTO product.xendit_webhook_inbox(event_hash,event_type,payment_session_id,reference_id,provider_business_id,amount_idr,provider_status,provider_created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING id',eventArgs);
  const duplicate=await client.query(
   'INSERT INTO product.xendit_webhook_inbox(event_hash,event_type,payment_session_id,reference_id,provider_business_id,amount_idr,provider_status,provider_created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING id',eventArgs);
  assert.equal(first.rowCount,1);assert.equal(duplicate.rowCount,0);
  const untouched=await client.query<{payment_status:string}>('SELECT payment_status FROM product.orders WHERE id=$1',[orderId]);
  assert.notEqual(untouched.rows[0].payment_status,'paid','inbox only must not credit order');
  const flags=await client.query<{relrowsecurity:boolean}>(
   "SELECT relrowsecurity FROM pg_class WHERE oid='product.xendit_webhook_inbox'::regclass");
  assert.equal(flags.rows[0].relrowsecurity,true);
 }finally{
  await client.query('ROLLBACK').catch(()=>{});
  client.release();await pool.end();
 }
});
