// Exercise the built Next.js route, not a mocked browser request or a copied regex.
// The upstream is loopback-only and synthetic: this checks proxy wiring, while
// API integration tests independently check publication/category data integrity.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const A='99000000-0000-4000-8000-000000000001';
const B='99000000-0000-4000-8000-000000000002';
const CATEGORY='99000000-0000-4000-8000-000000000003';
const authorization='Bearer fixture-catalog-admin';
const calls=[],fixtureErrors=[];
const listen=server=>new Promise((resolve,reject)=>{
 server.once('error',reject);
 server.listen(0,'127.0.0.1',()=>resolve(server.address().port));
});
const close=server=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

const api=createServer(async(req,res)=>{
 const reply=(status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));};
 try{
  let raw='';for await(const chunk of req)raw+=chunk;
  const body=raw?JSON.parse(raw):null;
  const call={method:req.method,path:req.url,authorization:req.headers.authorization,body};
  calls.push(call);
  if(req.headers.authorization==='Bearer fixture-catalog-nonadmin')return reply(403,{message:'Akses admin diperlukan'});
  assert.equal(req.headers.authorization,authorization);
  if(req.method==='POST'&&req.url.split('?')[0]==='/v1/admin/catalog/products/bulk/preview'){
   return reply(201,{ready:body.items.length,blocked:0,results:body.items.map(({id})=>({id,status:'ready'}))});
  }
  if(req.method==='POST'&&req.url==='/v1/admin/catalog/products/bulk/publish'){
   if(body.items.some(item=>item.expectedVersion===1))return reply(409,{message:'Data telah berubah. Muat ulang sebelum publish.'});
   return reply(201,{published:body.items.length,failed:0,skipped:0,results:body.items.map(({id})=>({id,status:'published'}))});
  }
  if(req.method==='POST'&&req.url==='/v1/admin/catalog/products/'+A+'/state'){
   return reply(201,{product:{id:A,is_active:body.active,edit_version:body.expectedVersion+1}});
  }
  if(req.method==='DELETE'&&req.url==='/v1/admin/catalog/categories/'+CATEGORY){
   return reply(200,{deleted:true,id:CATEGORY,movedProducts:2});
  }
  throw Error('Unexpected upstream route: '+req.method+' '+req.url);
 }catch(error){fixtureErrors.push(String(error));reply(500,{message:String(error)});}
});

await access(ROOT+'apps/web/.next/BUILD_ID');
const apiPort=await listen(api);
const reserve=createServer();const webPort=await listen(reserve);await close(reserve);
const base='http://127.0.0.1:'+webPort;
let logs='';
const web=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(webPort)],{
 cwd:ROOT+'apps/web',env:{...process.env,API_INTERNAL_URL:'http://127.0.0.1:'+apiPort,NEXT_TELEMETRY_DISABLED:'1'},
 stdio:['ignore','pipe','pipe']
});
for(const stream of [web.stdout,web.stderr])stream.on('data',chunk=>{logs=(logs+String(chunk)).slice(-12000);});
let spawnError;
web.once('error',error=>{spawnError=error;});

async function request(path,body,{method='POST',token=authorization,contentType='application/json'}={}){
 const response=await fetch(base+path,{method,headers:{...(token?{authorization:token}:{}),'content-type':contentType},
  ...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
 const raw=await response.text();
 return {status:response.status,body:raw?JSON.parse(raw):null,headers:response.headers};
}
try{
 let ready=false;
 for(let i=0;i<60;i++){
  if(spawnError||web.exitCode!==null)throw Error('Next exited before proxy tests: '+String(spawnError||'')+' '+logs);
  try{const r=await fetch(base+'/api/admin/catalog/lookups',{signal:AbortSignal.timeout(750)});if(r.status===401){ready=true;break;}}catch{}
  await delay(250);
 }
 assert.ok(ready,'Next did not become ready: '+logs);

 // The editor previews one product, then submits its existing state transition.
 const one={items:[{id:A,expectedVersion:3}]};
 let result=await request('/api/admin/catalog/products/bulk/preview?source=proxy-smoke',one);
 assert.equal(result.status,201);assert.equal(result.body.ready,1);
 assert.deepEqual(calls.at(-1),{method:'POST',path:'/v1/admin/catalog/products/bulk/preview?source=proxy-smoke',authorization,body:one});
 assert.equal(result.headers.get('cache-control'),'private, no-store');
 assert.equal(result.headers.get('x-content-type-options'),'nosniff');
 result=await request('/api/admin/catalog/products/'+A+'/state',{expectedVersion:3,active:true});
 assert.equal(result.status,201);assert.equal(result.body.product.is_active,true);

 // The selected-products toolbar previews and publishes several versioned IDs.
 const many={items:[{id:A,expectedVersion:3},{id:B,expectedVersion:4}]};
 result=await request('/api/admin/catalog/products/bulk/preview',many);
 assert.equal(result.status,201);assert.equal(result.body.ready,2);
 result=await request('/api/admin/catalog/products/bulk/publish',many);
 assert.equal(result.status,201);assert.equal(result.body.published,2);
 assert.deepEqual(calls.at(-1),{method:'POST',path:'/v1/admin/catalog/products/bulk/publish',authorization,body:many});

 // Category deletion needs an exported Next DELETE handler as well as API support.
 const deletion={expectedVersion:3,confirm:true};
 result=await request('/api/admin/catalog/categories/'+CATEGORY,deletion,{method:'DELETE'});
 assert.equal(result.status,200);assert.equal(result.body.deleted,true);
 assert.deepEqual(calls.at(-1),{method:'DELETE',path:'/v1/admin/catalog/categories/'+CATEGORY,authorization,body:deletion});

 // Upstream authorization and concurrency errors must reach the UI unchanged.
 result=await request('/api/admin/catalog/products/bulk/publish',one,{token:'Bearer fixture-catalog-nonadmin'});
 assert.equal(result.status,403);assert.equal(result.body.message,'Akses admin diperlukan');
 result=await request('/api/admin/catalog/products/bulk/publish',{items:[{id:A,expectedVersion:1}]});
 assert.equal(result.status,409);assert.match(result.body.message,/Data telah berubah/);

 const beforeRejected=calls.length;
 for(const path of ['products/bulk/delete','products/bulk/publish/extra','products/not-a-uuid/state','products/https%3A%2F%2Fexample.invalid']){
  assert.equal((await request('/api/admin/catalog/'+path,one)).status,404,path);
 }
 assert.equal((await request('/api/catalog/products/bulk/publish',undefined,{method:'GET'})).status,404);
 assert.equal((await request('/api/catalog/products/bulk/publish',one)).status,405);
 assert.equal((await request('/api/customer/catalog/products/bulk/publish',one)).status,404);
 for(const token of ['', 'Basic invalid']){
  assert.equal((await request('/api/admin/catalog/products/bulk/preview',one,{token})).status,401);
  assert.equal((await request('/api/admin/catalog/categories/'+CATEGORY,deletion,{method:'DELETE',token})).status,401);
 }
 assert.equal((await request('/api/admin/catalog/products/bulk/preview',one,{contentType:'text/plain'})).status,415);
 assert.equal((await request('/api/admin/catalog/products/bulk/publish',{padding:'x'.repeat(2900001)})).status,413);
 assert.equal(calls.length,beforeRejected,'Rejected requests must not contact the upstream API');
 assert.deepEqual(fixtureErrors,[]);
 console.log('CATALOG_PROXY_HTTP_PASS: single preflight/state, bulk preview/publish, category DELETE, auth, errors, scope and payload limits; loopback fixtures only.');
}finally{
 web.kill('SIGTERM');
 await Promise.race([new Promise(resolve=>web.once('exit',resolve)),delay(3000)]);
 if(web.exitCode===null)web.kill('SIGKILL');
 await close(api);
}
