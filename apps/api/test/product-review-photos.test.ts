import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {ForbiddenException,NotFoundException} from '@nestjs/common';
import {CatalogReviewsService} from '../src/catalog-reviews';
import type {DatabaseService} from '../src/database';

const user={id:'00000000-0000-4000-8000-000000000001',email:'buyer@example.invalid',emailVerified:true};
const line='00000000-0000-4000-8000-000000000002';
const imageId='00000000-0000-4000-8000-000000000003';
const reviewId='00000000-0000-4000-8000-000000000004';
const item='00000000-0000-4000-8000-000000000005';
const product='00000000-0000-4000-8000-000000000006';
const buildDb=(query:(sql:string,params?:unknown[])=>Promise<any>)=>
 ({query,transaction:async<T>(fn:(client:{query:typeof query})=>Promise<T>)=>fn({query})}) as unknown as DatabaseService;

test('buyer photo upload is owned, delivery-gated, normalized to WebP and never public on upload',async()=>{
 const image=await sharp({create:{width:80,height:80,channels:3,background:'#a6a6a6'}}).png().toBuffer();
 const calls:string[]=[];
 const service=new CatalogReviewsService(buildDb(async(sql,params)=>{
  calls.push(sql);
  if(sql.includes('SELECT oi.id FROM product.order_items')){
   assert.equal(params?.[0],user.id);assert.equal(params?.[1],line);
   assert.match(sql,/s.state='delivered'/);assert.match(sql,/o.payment_status='paid'/);
   return {rows:[{id:line}]};
  }
  if(sql.includes('count(*)::int n'))return {rows:[{n:0}]};
  if(sql.includes('INSERT INTO product.review_photos')){
   assert.equal(params?.[0],line);assert.equal(params?.[1],user.id);
   assert.ok(Buffer.isBuffer(params?.[2]));
   assert.equal((params?.[2] as Buffer).toString('ascii',0,4),'RIFF');
   assert.equal((params?.[2] as Buffer).length,params?.[3]);
   return {rows:[{id:imageId}]};
  }
  throw Error('Unexpected SQL: '+sql.slice(0,140));
 }));
 const data=await service.uploadPhoto(user,{orderItemId:line,filename:'lamp.png',mimeType:'image/png',base64:image.toString('base64')});
 assert.equal(data.id,imageId);
 assert.equal(data.visibility,'private_pending_review');
 assert.ok(calls.some(sql=>sql.includes('INSERT INTO product.review_photos')));
});

test('review photos reject unverified accounts and non-owner deliveries',async()=>{
 const image=await sharp({create:{width:80,height:80,channels:3,background:'#eeeeee'}}).jpeg().toBuffer();
 const service=new CatalogReviewsService(buildDb(async sql=>{
  if(sql.includes('SELECT oi.id FROM product.order_items'))return {rows:[]};
  throw Error('Unexpected query');
 }));
 const body={orderItemId:line,filename:'lamp.jpg',mimeType:'image/jpeg',base64:image.toString('base64')};
 await assert.rejects(()=>service.uploadPhoto({...user,emailVerified:false},body),ForbiddenException);
 await assert.rejects(()=>service.uploadPhoto(user,body),ForbiddenException);
});

test('unapproved photo bytes are never exposed by public media reader',async()=>{
 let seen='';
 const bytes=Buffer.from('RIFFwebp-test-image');
 const service=new CatalogReviewsService(buildDb(async(sql)=>{
  seen=sql;return {rows:[]};
 }));
 await assert.rejects(()=>service.photo(imageId),NotFoundException);
 assert.match(seen,/r.status='approved'/);
 assert.match(seen,/v.is_active/);
 const admin=new CatalogReviewsService(buildDb(async sql=>{
  assert.ok(!sql.includes("r.status='approved'"));
  return {rows:[{mime_type:'image/webp',content:bytes,size_bytes:bytes.length}]};
 }));
 const data=await admin.photo(imageId,true);
 assert.equal(data.content,bytes);
});

test('new review links only photos uploaded by the purchaser for the same order',async()=>{
 const commands:string[]=[];
 const service=new CatalogReviewsService(buildDb(async(sql,params)=>{
  commands.push(sql);
  if(sql.includes('SELECT oi.product_id'))return {rows:[{product_id:item,root_product_id:product}]};
  if(sql.includes('SELECT id,rating,body,display_name'))return {rows:[]};
  if(sql.includes('INSERT INTO product.product_reviews'))return {rows:[{id:reviewId,status:'pending'}]};
  if(sql.includes('UPDATE product.review_photos SET review_id=')){
   assert.equal(params?.[0],reviewId);
   assert.deepEqual(params?.[1],[imageId]);
   assert.equal(params?.[2],line);assert.equal(params?.[3],user.id);
   return {rowCount:1,rows:[{id:imageId}]};
  }
  if(sql.includes('INSERT INTO product.catalog_audit'))return {rows:[]};
  // internal audit might call append-only audit helper
  return {rows:[]};
 }));
 const result=await service.create(user,{orderItemId:line,rating:5,displayName:'Pembeli Valid',body:'Barang diterima dengan baik dan lengkap.',photoIds:[imageId]});
 assert.equal(result.photoCount,1);
 assert.ok(commands.some(sql=>sql.includes('AND uploaded_by=$4')));
});
