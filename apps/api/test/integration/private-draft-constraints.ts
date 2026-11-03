import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const {createFixture}=require(resolve('../../scripts/cp39-fixture-server.cjs'));
const denied=(e:any)=>e?.code==='23514';
const pause=()=>new Promise(r=>setTimeout(r,100));

test('CP40 database-level publication guards and parent-child concurrency',async()=>{
 const {app,db}=await createFixture();
 const make=async(type='simple',parent:string|null=null,active=false,description='A fabric accessory bag.')=>{
  const id=randomUUID(),slug='guard-'+id;
  const r=await db.query('INSERT INTO product.products(id,name,slug,description,category,price_idr,stock_qty,product_type,parent_product_id,is_active) VALUES($1,$2,$3,$4,$5,25000,0,$6,$7,$8) RETURNING *',[id,'Accessory guard fixture',slug,description,'accessories',type,parent,active]);return r.rows[0];
 };
 try{
  const single=await make('simple',null,false,'Private note: not a vape product.');
  await assert.rejects(()=>db.query('UPDATE product.products SET is_active=true WHERE id=$1',[single.id]),denied);
  await db.query('UPDATE product.products SET description=$2,is_active=true WHERE id=$1',[single.id,'A fabric accessory bag.']);
  await assert.rejects(()=>db.query('UPDATE product.products SET sku=$2 WHERE id=$1',[single.id,'GUARD-VAPE-NOTE']),denied);
  await assert.rejects(()=>db.query('UPDATE product.products SET price_idr=-1 WHERE id=$1',[single.id]),denied);
  await db.query('UPDATE product.products SET is_active=false WHERE id=$1',[single.id]);
  await db.query('UPDATE product.products SET description=$2,price_idr=0 WHERE id=$1',[single.id,'Private review note: vape.']);
  const parent=await make('variable'),child=await make('variation',parent.id,true,'Private review note: vape.');
  await assert.rejects(()=>db.query('UPDATE product.products SET is_active=true WHERE id=$1',[parent.id]),denied);
  await db.query('UPDATE product.products SET description=$2 WHERE id=$1',[child.id,'A fabric accessory bag.']);
  await db.query('UPDATE product.products SET is_active=true WHERE id=$1',[parent.id]);
  await assert.rejects(()=>db.query('UPDATE product.products SET description=$2 WHERE id=$1',[child.id,'Private review note: vape.']),denied);
  await db.query('UPDATE product.products SET is_active=false,description=$2 WHERE id=$1',[child.id,'Private review note: vape.']);
  await assert.rejects(()=>db.query('UPDATE product.products SET is_active=true WHERE id=$1',[child.id]),denied);
  await db.query('UPDATE product.products SET is_active=false WHERE id=$1',[parent.id]);
  await db.query('UPDATE product.products SET is_active=true WHERE id=$1',[child.id]);
  await assert.rejects(()=>db.query('UPDATE product.products SET is_active=true WHERE id=$1',[parent.id]),denied);
  await db.query('UPDATE product.products SET description=$2 WHERE id=$1',[child.id,'A fabric accessory bag.']);
  // Child draft edit first: parent activation waits and then rejects the stored child text.
  let release!:()=>void,started!:()=>void;
  const hold=new Promise<void>(r=>release=r),ready=new Promise<void>(r=>started=r);
  const childWrite=db.transaction(async(q:any)=>{await q.query("SET LOCAL lock_timeout='5s'");await q.query('UPDATE product.products SET description=$2 WHERE id=$1',[child.id,'Private review note: vape.']);started();await hold;});
  await ready;
  const activation=db.transaction(async(q:any)=>{await q.query("SET LOCAL lock_timeout='5s'");await q.query('UPDATE product.products SET is_active=true WHERE id=$1',[parent.id]);}).then(()=>({ok:true}),((e:any)=>({ok:false,code:e.code??e.cause?.code})));
  await pause();release();await childWrite;assert.deepEqual(await activation,{ok:false,code:'23514'});
  await db.query('UPDATE product.products SET description=$2 WHERE id=$1',[child.id,'A fabric accessory bag.']);
  // Parent activation first: child edit waits and then rejects publication of unreviewed text.
  let releaseParent!:()=>void,parentStarted!:()=>void;
  const parentHold=new Promise<void>(r=>releaseParent=r),parentReady=new Promise<void>(r=>parentStarted=r);
  const parentWrite=db.transaction(async(q:any)=>{await q.query("SET LOCAL lock_timeout='5s'");await q.query('UPDATE product.products SET is_active=true WHERE id=$1',[parent.id]);parentStarted();await parentHold;});
  await parentReady;
  const childEdit=db.transaction(async(q:any)=>{await q.query("SET LOCAL lock_timeout='5s'");await q.query('UPDATE product.products SET description=$2 WHERE id=$1',[child.id,'Private review note: vape.']);}).then(()=>({ok:true}),((e:any)=>({ok:false,code:e.code??e.cause?.code})));
  await pause();releaseParent();await parentWrite;assert.deepEqual(await childEdit,{ok:false,code:'23514'});
  console.log('CP40_DATABASE_GUARDS_PASS',JSON.stringify({directSqlPublication:true,activeEditRollback:true,zeroPrivateDraft:true,childPrivacy:true,parentChildRaces:2,isolation:'READ COMMITTED',productionWrites:false}));
 }finally{await app.close();}
});
