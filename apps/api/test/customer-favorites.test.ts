import test from 'node:test';
import assert from 'node:assert/strict';
import {BadRequestException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {CustomerFavoritesService,parseFavorite} from '../src/customer-favorites';
import {CatalogWorkspaceService} from '../src/catalog-workspace';
import type {DatabaseService} from '../src/database';
import {readFileSync} from 'node:fs';
const user={id:'00000000-0000-4000-8000-000000000901',email:'buyer@vapmart.invalid',emailVerified:true};
const other='00000000-0000-4000-8000-000000000902';
const productId='00000000-0000-4000-8000-000000000903';
const brandId='00000000-0000-4000-8000-000000000904';
function db(query:(sql:string,params?:unknown[])=>Promise<any>){return {query} as unknown as DatabaseService;}
test('favorites validator rejects malformed and unexpected fields',()=>{
 assert.deepEqual(parseFavorite({type:'product',entityId:productId,saved:true}),{type:'product',entityId:productId,saved:true});
 assert.throws(()=>parseFavorite({type:'shop',entityId:brandId,saved:true}),BadRequestException);
 assert.throws(()=>parseFavorite({type:'brand',entityId:'../../etc',saved:true}),BadRequestException);
 assert.throws(()=>parseFavorite({type:'product',entityId:productId,saved:'yes'}),BadRequestException);
 assert.throws(()=>parseFavorite({type:'product',entityId:productId,saved:true,isAdmin:true}),BadRequestException);
});
test('favorites list is scoped to authenticated user and only active public entities',async()=>{
 let calls=0;
 const srv=new CustomerFavoritesService(db(async(sql,args)=>{
  calls++;assert.equal(args?.[0],user.id);
  assert.match(sql,/WHERE f.user_id=\$1/);
  assert.match(sql,/is_active=true/);
  if(sql.includes("entity_type='product'")){
   assert.match(sql,/archived_at IS NULL/);
   return {rows:[{id:productId,name:'Lampu',slug:'lampu',image_url:null,price_idr:'95000',stock_qty:1}]};
  }
  return {rows:[{id:brandId,name:'Brand',slug:'brand',logo_url:null,description:''}]};
 }));
 const result=await srv.list(user);
 assert.equal(calls,2);
 assert.deepEqual(result.productIds,[productId]);
 assert.deepEqual(result.brandIds,[brandId]);
 await assert.rejects(()=>srv.list({...user,emailVerified:false}),ForbiddenException);
});
test('saving checks product visibility and persists only under buyer user ID',async()=>{
 const queries:string[]=[];
 const srv=new CustomerFavoritesService(db(async(sql,args)=>{
  queries.push(sql);
  if(sql.startsWith('SELECT 1 FROM product.products')){
   assert.equal(args?.[0],productId);
   assert.match(sql,/archived_at IS NULL/);
   return {rows:[{one:1}]};
  }
  if(sql.includes('count(*)::int n'))return {rows:[{n:0}]};
  if(sql.startsWith('INSERT INTO public.customer_favorites')){
   assert.deepEqual(args,[user.id,'product',productId]);return {rowCount:1,rows:[]};
  }
  if(sql.startsWith('DELETE')){assert.deepEqual(args,[user.id,'product',productId]);return {rowCount:1,rows:[]};}
  throw Error(sql);
 }));
 assert.equal((await srv.set(user,{type:'product',entityId:productId,saved:true})).saved,true);
 assert.equal((await srv.set(user,{type:'product',entityId:productId,saved:false})).saved,false);
 assert.equal(queries.filter(q=>q.startsWith('INSERT')).length,1);
 await assert.rejects(()=>srv.set({...user,emailVerified:false},{type:'product',entityId:productId,saved:true}),ForbiddenException);
 const hidden=new CustomerFavoritesService(db(async()=>({rows:[]})));
 await assert.rejects(()=>hidden.set(user,{type:'product',entityId:productId,saved:true}),NotFoundException);
});
test('import only accepts verified UUID arrays, no other user may be targeted',async()=>{
 const seen:string[]=[];
 const srv=new CustomerFavoritesService(db(async(sql,args)=>{
  seen.push(sql);
  assert.equal(args?.[0],user.id);
  assert.equal(args?.[1],'brand');
  assert.deepEqual(args?.[2],[brandId]);return {rowCount:1,rows:[]};
 }));
 const result=await srv.set(user,{type:'brand',ids:[brandId]});
 assert.equal(result.imported,1);
 assert.ok(seen[0].includes("x.is_active=true"));
 await assert.rejects(()=>srv.set(user,{type:'brand',ids:[other],user_id:other}),BadRequestException);
 await assert.rejects(()=>srv.set(user,{type:'brand',ids:['wrong']}),BadRequestException);
});
test('order summaries derive item image, quantity and dates from backend, never mock revenue',()=>{
 const source=readFileSync('src/catalog-workspace.ts','utf8');
 assert.match(source,/preview\.image_url/);
 assert.match(source,/summary\.total_units/);
 assert.match(source,/o\.created_at>=now\(\)-\$4::interval/);
 assert.match(source,/AND \(\$1::uuid IS NULL OR o\.customer_user_id=\$1\)/);
});

test('order filters accept validated periods and item counts without weakening parsePage',async()=>{
 let captured:unknown[]|undefined;
 const service=new CatalogWorkspaceService(db(async(sql,params)=>{
  assert.match(sql,/preview.product_name/);
  assert.match(sql,/summary.item_count/);
  captured=params;return {rows:[{data:{items:[],total:0}}]};
 }));
 const x=await service.orders({page:'1',pageSize:'12',q:'Lampu',status:'processing',period:'30d',items:'multiple'},user.id);
 assert.equal(x.total,0);
 assert.deepEqual(captured,[user.id,'Lampu','processing','30 days','multiple',12,0]);
 await assert.rejects(()=>service.orders({period:'12 years'},user.id),BadRequestException);
 await assert.rejects(()=>service.orders({items:'SQL INJECTION'},user.id),BadRequestException);
 await assert.rejects(()=>service.orders({period:'all',unknown:'oops'},user.id),BadRequestException);
});
