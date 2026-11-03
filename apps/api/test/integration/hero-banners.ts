import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {Module,UnauthorizedException} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
// Compiled classes retain constructor metadata. Fixture auth exists only in this local integration test.
import {DatabaseService} from '../../dist/database';
import {AdminGuard,SupabaseAuthService} from '../../dist/auth';
import {HeroBannersService} from '../../dist/hero-banners';
import {HeroBannersAdminController,HeroBannersPublicController} from '../../dist/hero-banners-controller';
test('hero manager full HTTP lifecycle on disposable localhost PostgreSQL',async()=>{
 const database=new URL(process.env.DATABASE_URL||'http://invalid');
 if(process.env.HERO_LOCAL_TEST!=='1'||database.hostname!=='127.0.0.1'||!database.pathname.startsWith('/vapmart_cp38_'))throw Error('Refuse any database except disposable CP38 localhost test database');
 const admin={id:randomUUID(),email:'hero-admin@example.invalid',emailVerified:true};
 const customer={id:randomUUID(),email:'hero-reader@example.invalid',emailVerified:true};
 class FixtureModule{}
 Module({controllers:[HeroBannersAdminController,HeroBannersPublicController],providers:[DatabaseService,HeroBannersService,AdminGuard,{provide:SupabaseAuthService,useValue:{verify:async(a:string)=>{
  if(a==='Bearer fixture-admin')return admin;if(a==='Bearer fixture-customer')return customer;throw new UnauthorizedException();
 }}}]})(FixtureModule);
 const app=await NestFactory.create(FixtureModule,{logger:false});const db=app.get(DatabaseService);
 await db.query("INSERT INTO public.staff_roles(user_id,role,is_active) VALUES($1,'admin',true)",[admin.id]);
 await app.listen(0,'127.0.0.1');const base=await app.getUrl();
 const call=async(path:string,method='GET',data?:unknown,token='fixture-admin')=>{
  const form=data instanceof FormData;
  const r=await fetch(base+path,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),...(data&&!form?{'content-type':'application/json'}:{})},...(data?{body:form?data:JSON.stringify(data)}:{})});
  const raw=await r.text();let body;try{body=JSON.parse(raw);}catch{}return {status:r.status,body,raw,type:r.headers.get('content-type')};
 };
 const post='/v1/admin/hero-banners',pub='/v1/hero-banners';
 try{
  const originalCount=(await db.query('SELECT count(*)::int AS n FROM content.media_library_assets')).rows[0].n;
  assert.equal((await call(pub)).body.items.length,3);
  assert.equal((await call(post,'GET',undefined,'')).status,401);
  assert.equal((await call(post,'GET',undefined,'fixture-customer')).status,403);
  assert.equal((await call(post,'POST',{},'')).status,401);
  const png=await sharp({create:{width:1024,height:448,channels:3,background:'#7250aa'}}).png().toBuffer();
  const upload=()=>{const f=new FormData();f.append('file',new Blob([png],{type:'image/png'}),'information.png');return f;};
  const uploaded=await call(post+'/assets','POST',upload());assert.equal(uploaded.status,201,uploaded.raw);const assetId=uploaded.body.id;
  assert.equal((await call(post+'/assets','POST',upload())).body.id,assetId,'duplicate content is not stored twice');
  assert.equal((await call(pub+'/assets/'+assetId)).status,404,'unpublished assets must stay private');
  assert.equal((await call(post+'/assets/'+assetId+'/content')).type,'image/webp');
  const input={title:'Service information',alt:'Service hours',desktopAssetId:assetId,mobileAssetId:assetId,idempotencyKey:randomUUID()};
  const created=await call(post,'POST',input);assert.equal(created.status,201,created.raw);let b=created.body;const id=b.id;
  assert.equal(b.active,false);assert.equal((await call(post,'POST',input)).body.id,id);
  assert.equal((await call(post)).body.items.length,4,'idempotent create');
  assert.equal((await call(pub)).body.items.length,3,'draft does not change public hero');
  assert.equal((await call(post+'/'+id,'PATCH',{title:'Wrong',alt:'Wrong'})).status,400);
  const edit=await call(post+'/'+id,'PATCH',{title:'Hours revised',alt:'Opening hours',expectedVersion:b.editVersion});assert.equal(edit.status,200,edit.raw);b=edit.body;
  assert.equal((await call(post+'/'+id,'PATCH',{title:'Stale',alt:'Stale',expectedVersion:1})).status,409);
  const activated=await call(post+'/'+id+'/state','POST',{active:true,expectedVersion:b.editVersion});assert.equal(activated.status,201,activated.raw);b=activated.body;
  assert.equal((await call(pub)).body.items.length,4);assert.equal((await call(pub+'/assets/'+assetId)).type,'image/webp');
  const list=(await call(post)).body;const ids=list.items.filter((x:any)=>!x.deletedAt).map((x:any)=>x.id).reverse();
  assert.equal((await call(post+'/reorder','POST',{ids,expectedRevision:list.revision})).status,201);
  assert.equal((await call(pub)).body.items[0].key,id);
  assert.equal((await call(post+'/reorder','POST',{ids,expectedRevision:list.revision})).status,409);
  let fresh=(await call(post)).body;b=fresh.items.find((x:any)=>x.id===id);
  assert.equal((await call(post+'/reorder','POST',{ids:[id],expectedRevision:fresh.revision})).status,409);
  const results=await Promise.all(['A','B'].map(s=>call(post+'/'+id,'PATCH',{title:'Concurrent '+s,alt:'Concurrent edit',expectedVersion:b.editVersion})));
  assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
  b=(await call(post)).body.items.find((x:any)=>x.id===id);
  const disabled=await call(post+'/'+id+'/state','POST',{active:false,expectedVersion:b.editVersion});b=disabled.body;
  assert.equal((await call(pub+'/assets/'+assetId)).status,404,'disabled asset has no anonymous route');
  assert.equal((await call(post+'/'+id+'/trash','POST',{expectedVersion:b.editVersion})).status,400);
  b=(await call(post+'/'+id+'/trash','POST',{expectedVersion:b.editVersion,confirm:true})).body;assert.ok(b.deletedAt);assert.equal(b.active,false);
  const stored=(await db.query('SELECT original_content FROM content.hero_banner_assets WHERE id=$1',[assetId])).rows[0];assert.ok(stored.original_content.equals(png));
  b=(await call(post+'/'+id+'/restore','POST',{expectedVersion:b.editVersion})).body;assert.equal(b.deletedAt,null);assert.equal(b.active,false);
  for(const row of (await call(post)).body.items.filter((x:any)=>x.active))assert.equal((await call(post+'/'+row.id+'/state','POST',{expectedVersion:row.editVersion,active:false})).status,201);
  assert.equal((await call(pub)).body.items.length,0);
  execFileSync(process.execPath,['dist/migrate.js'],{env:process.env});assert.equal((await call(pub)).body.items.length,0,'redeploy must not resurrect disabled banners');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM content.media_library_assets')).rows[0].n,originalCount);
  const audit=(await db.query('SELECT count(*)::int AS n FROM content.hero_banner_audit WHERE actor_id=$1',[admin.id])).rows[0].n;assert.ok(audit>=10);
  const bad=new FormData();bad.append('file',new Blob(['<svg><script>alert(1)</script></svg>'],{type:'image/png'}),'bad.png');assert.equal((await call(post+'/assets','POST',bad)).status,400);
  const large=new FormData();large.append('file',new Blob([Buffer.alloc(5242881)],{type:'image/png'}),'large.png');assert.equal((await call(post+'/assets','POST',large)).status,413);
  console.log('CP38_HERO_HTTP_PASS',{draft:true,upload:true,anonymousDenied:true,customerDenied:true,reorder:true,conflict:true,trashRestore:true,noResurrection:true,originals:originalCount});
 }finally{
  await db.query('DELETE FROM content.hero_banner_audit WHERE actor_id=$1',[admin.id]);
  await db.query('DELETE FROM content.hero_banners WHERE created_by=$1',[admin.id]);
  await db.query('DELETE FROM content.hero_banner_assets WHERE uploaded_by=$1',[admin.id]);
  await db.query("UPDATE content.hero_banners SET is_active=true,deleted_at=NULL WHERE id::text LIKE '38000000-%'");
  await db.query('DELETE FROM public.staff_roles WHERE user_id=$1',[admin.id]);await app.close();
 }
});
