import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
const {createFixture}=require(resolve('../../scripts/cp39-fixture-server.cjs'));

test('CSV legacy identifiers, decimal measurements and negative stock survive preview/apply/replay safely',async()=>{
 const {app,db,base}=await createFixture();
 const call=async(path:string,body?:any)=>{const r=await fetch(base+'/v1/admin/catalog/'+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer fixture-admin','content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json()};};
 const ok=async(path:string,body?:any)=>{const r=await call(path,body);assert.ok(r.status>=200&&r.status<300,JSON.stringify(r));return r.data;};
 const key='compat-'+randomUUID().slice(0,8),name='Travel organizer '.repeat(10).trim();
 const csv=(stock:string,extra='')=>'ID,Type,SKU,Name,Regular price,Stock,Length (cm),Width (cm),Height (cm),Weight (g),Parent,Attribute 1 name,Attribute 1 value(s),Second Stock,Images\n'+
  `A,simple,${key} A / B,${name},10000,${stock},34.6,36.2,70.5,500,,,,${extra},"https://example.invalid/main.png, https://example.invalid/main.png, https://example.invalid/side.png"\n`+
  `B,variable,${key} P / Q,${'Q'.repeat(71)} Family,,,,,,,,Color,"Blue, Red",,\n`+
  `C,variation,${key} BLUE / 1,Blue organizer,12000,-5,23.5,18.9,23.5,300,${key} P / Q,Color,Blue,,\n`+
  `D,variation,${key} RED 2,Red organizer,13000,0,32,32.8,59,400,${key} P / Q,Color,Red,,\n`;
 try{
  const l=await ok('lookups'),w=l.warehouses.find((w:any)=>w.code==='CP39-A'),w2=l.warehouses.find((w:any)=>w.code==='CP39-B');
  const body={csv:csv('7'),sourceKey:key,mode:'create',warehouseId:w.id};
  const before=(await db.query('SELECT count(*)::int n FROM product.products')).rows[0].n;
  const p=await ok('imports/preview',body);assert.equal(p.summary.errors,0,JSON.stringify(p.errors));assert.equal(p.summary.create,4);assert.equal(p.summary.skippedStocks,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM product.products')).rows[0].n,before);
  const a=await ok('imports/'+p.id+'/apply',{confirm:true});assert.equal(a.report.productsCreated,2);assert.equal(a.report.variantsCreated,2);assert.equal(a.report.skippedStocks[0].sourceValue,-5);
  const rows=(await db.query('SELECT s.source_id,p.* FROM product.catalog_source_rows s JOIN product.products p ON p.id=s.product_id WHERE s.source_key=$1',[key])).rows;
  const main=rows.find((r:any)=>r.source_id==='A'),blue=rows.find((r:any)=>r.source_id==='C'),red=rows.find((r:any)=>r.source_id==='D');
  assert.equal(main.sku,(key+' A / B').toUpperCase());assert.equal(main.name,name);assert.equal(main.length_cm,34.6);assert.equal(main.width_cm,36.2);assert.equal(main.height_cm,70.5);assert.deepEqual(main.gallery_urls,['https://example.invalid/side.png']);assert.equal(main.stock_qty,7);assert.equal(main.is_active,false);
  assert.match(blue.slug,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);assert.equal(blue.length_cm,23.5);assert.equal(blue.parent_product_id,red.parent_product_id);
  assert.equal((await db.query('SELECT count(*)::int n FROM product.warehouse_stock WHERE product_id=$1',[blue.id])).rows[0].n,0,'negative stock is not a verified zero balance');
  assert.equal((await db.query('SELECT on_hand FROM product.warehouse_stock WHERE product_id=$1 AND warehouse_id=$2',[red.id,w.id])).rows[0].on_hand,0,'explicit zero creates a counted balance');
  assert.equal((await ok('imports/'+p.id+'/apply',{confirm:true})).replayed,true);
  assert.equal((await ok('imports/preview',body)).state,'applied');
  assert.equal((await db.query('SELECT count(*)::int n FROM product.products')).rows[0].n,before+4);
  // Negative main and extra warehouse values must leave physical balances untouched.
  const events=(await db.query('SELECT count(*)::int n FROM product.warehouse_stock_events WHERE product_id=$1',[main.id])).rows[0].n;
  const update=await ok('imports/preview',{...body,mode:'upsert',csv:csv('-27','-2'),warehouseColumns:{'Second Stock':w2.id}});
  assert.equal(update.summary.errors,0,JSON.stringify(update.errors));assert.equal(update.summary.skippedStocks,3);
  const result=await ok('imports/'+update.id+'/apply',{confirm:true});assert.equal(result.report.stockChanges,0);assert.equal(result.report.skippedStocks.length,3);
  assert.equal((await db.query('SELECT stock_qty FROM product.products WHERE id=$1',[main.id])).rows[0].stock_qty,7);
  assert.equal((await db.query('SELECT count(*)::int n FROM product.warehouse_stock_events WHERE product_id=$1',[main.id])).rows[0].n,events);
  assert.equal((await db.query('SELECT count(*)::int n FROM product.warehouse_stock WHERE product_id=$1 AND warehouse_id=$2',[main.id,w2.id])).rows[0].n,0);
  const zero=await ok('imports/preview',{...body,mode:'upsert',csv:csv('0')});assert.equal(zero.summary.errors,0);
  await ok('imports/'+zero.id+'/apply',{confirm:true});assert.equal((await db.query('SELECT stock_qty FROM product.products WHERE id=$1',[main.id])).rows[0].stock_qty,0);
  // Reject malformed quantities, oversized dimensions, duplicate identifiers and names before apply.
  for(const invalid of [csv('1.5'),csv('1').replace('34.6','1000.1'),csv('1').replace(name,'X'.repeat(256)),csv('1').replace(key+' RED 2',key+' BLUE / 1')]){
   const rejected=await ok('imports/preview',{...body,mode:'upsert',csv:invalid});assert.ok(rejected.summary.errors>0);assert.equal((await call('imports/'+rejected.id+'/apply',{confirm:true})).status,409);
  }
  console.log('CSV_COMPATIBILITY_PASS',JSON.stringify({legacySkuPreserved:true,longNamePreserved:true,decimalMeasurementsPreserved:true,parentVariants:true,negativeStockUnchanged:true,explicitZeroApplied:true,replayNoDuplicates:true,productionWrites:false}));
 }finally{await app.close();}
});
