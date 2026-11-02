import test from 'node:test';
import assert from 'node:assert/strict';
import {readCollection,settleCollection,CollectionReadError} from '../apps/web/src/lib/collection-read';
import {getProductsResult,getBrandsResult,getProduct} from '../apps/web/src/lib/api';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const fetcher=(fn:(input:any,init?:RequestInit)=>Promise<Response>)=>fn as typeof fetch;
test('empty is successful, but unavailable, timeout and malformed responses are errors',async()=>{
 const empty=await settleCollection(()=>readCollection('/v1/products',fetcher(async()=>json({items:[]}))));
 assert.equal(empty.ok,true);assert.deepEqual(empty.items,[]);
 for(const fn of [async()=>json({},503),async()=>{throw Error('timeout');},async()=>new Response('{broken'),async()=>json({items:'wrong'})]){
  const result=await settleCollection(()=>readCollection('/v1/products',fetcher(fn)));
  assert.equal(result.ok,false);assert.ok(result.error);assert.deepEqual(result.items,[]);
 }
});
test('pagination retrieves records beyond previous 48/100/150 caps and does not silently truncate',async()=>{
 const records=Array.from({length:205},(_,i)=>({id:'p-'+i}));let calls=0;
 const result=await readCollection<{id:string}>('/api/admin/products',fetcher(async input=>{
  calls++;const page=Number(new URL(String(input),'https://local.invalid').searchParams.get('page'));
  return json({items:records.slice((page-1)*100,page*100),total:205,page,pageSize:100,hasMore:page<3});
 }));
 assert.equal(calls,3);assert.equal(result.length,205);assert.equal(result[204].id,'p-204');
 await assert.rejects(()=>readCollection('/v1/products',fetcher(async()=>json({items:[],total:205,page:1,pageSize:100,hasMore:true}))),CollectionReadError);
});
test('a changing total or missing page is explicitly an incomplete read, never a partial successful catalog',async()=>{
 const items=Array.from({length:100},(_,i)=>({id:i}));let n=0;
 await assert.rejects(()=>readCollection('/v1/products',fetcher(async()=>{
  n++;return json({items,total:n===1?200:201,page:n,pageSize:100,hasMore:n===1});
 })),/DATA_CHANGED_RETRY/);
 await assert.rejects(()=>readCollection('/v1/products',fetcher(async()=>json({items:[],total:1,page:1,pageSize:100,hasMore:false}))),/INCOMPLETE_RESPONSE/);
});
test('actual server data adapters preserve error semantics and only genuine 404 returns not found',async()=>{
 const originalFetch=globalThis.fetch,originalBase=process.env.API_INTERNAL_URL;
 process.env.API_INTERNAL_URL='http://127.0.0.1:4100';
 try{
  globalThis.fetch=fetcher(async()=>json({items:[]}));assert.equal((await getProductsResult()).ok,true);assert.equal((await getBrandsResult()).ok,true);
  globalThis.fetch=fetcher(async()=>json({},503));assert.equal((await getProductsResult()).ok,false);assert.equal((await getBrandsResult()).ok,false);
  await assert.rejects(()=>getProduct('sample'),CollectionReadError);
  globalThis.fetch=fetcher(async()=>json({},404));assert.equal(await getProduct('missing'),null);
  globalThis.fetch=fetcher(async()=>json({items:[{broken:true}]}));assert.equal((await getProductsResult()).ok,false);
 }finally{globalThis.fetch=originalFetch;if(originalBase===undefined)delete process.env.API_INTERNAL_URL;else process.env.API_INTERNAL_URL=originalBase;}
});
