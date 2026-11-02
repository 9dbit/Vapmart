#!/usr/bin/env python3
"""Deterministic CP37-A source preparation. Never connects to a database or provider.
CI materializes this on the isolated work branch and commits only after tests pass.
"""
from pathlib import Path
import hashlib,json,re
ROOT=Path.cwd()
MARKER=ROOT/'sources/cp37a-source-manifest.json'
if MARKER.exists():
 print('CP37A source already materialized; verify without reapplying.')
 raise SystemExit(0)
changes={};before={}
def read(path):
 if path in changes:return changes[path]
 s=(ROOT/path).read_text();before[path]=hashlib.sha256(s.encode()).hexdigest();return s
def write(path,text):
 if path not in before:
  p=ROOT/path;before[path]=hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None
 changes[path]=text
def replace(path,old,new,count=1):
 s=read(path)
 if s.count(old)!=count:raise RuntimeError(f'Anchor mismatch: {path}: {s.count(old)} != {count}: {old[:100]}')
 write(path,s.replace(old,new))

write('apps/api/sql/015_cp37a_integrity.sql','''-- CP37-A additive metadata only. No historical, inventory or payment mutation.
BEGIN;
ALTER TABLE product.products ADD COLUMN IF NOT EXISTS edit_version integer NOT NULL DEFAULT 1 CHECK(edit_version>0);
ALTER TABLE product.brands ADD COLUMN IF NOT EXISTS edit_version integer NOT NULL DEFAULT 1 CHECK(edit_version>0);
CREATE TABLE IF NOT EXISTS product.master_data_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 entity_type text NOT NULL CHECK(entity_type IN ('product','brand')),
 entity_id uuid NOT NULL,actor_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('create','update','publish','unpublish')),
 before_data jsonb,after_data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS master_data_audit_entity ON product.master_data_audit(entity_type,entity_id,id DESC);
REVOKE ALL ON product.master_data_audit FROM PUBLIC;
COMMIT;
''')
replace('apps/api/src/migrate.ts',"'014_private_media_library.sql'] as const","'014_private_media_library.sql','015_cp37a_integrity.sql'] as const")
write('apps/api/src/data-integrity.ts',r'''import {BadRequestException,ConflictException,ForbiddenException} from '@nestjs/common';
import type {PoolClient} from 'pg';
import type {Principal} from './auth';
export function requireActor(actor?:Principal):string {
 if(!actor?.id||!actor.emailVerified)throw new ForbiddenException('Verified operator required');
 return actor.id;
}
export function parseEdit(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Object required');
 const {expected_version,...fields}=raw as Record<string,unknown>;
 if(!Number.isSafeInteger(expected_version)||Number(expected_version)<1)
  throw new BadRequestException({code:'EDIT_VERSION_REQUIRED',message:'Muat ulang record sebelum menyimpan perubahan.'});
 return {version:Number(expected_version),fields};
}
export function assertVersion(actual:number,expected:number){
 if(actual!==expected)throw new ConflictException({code:'EDIT_CONFLICT',message:'Data telah diubah operator lain. Draft Anda belum ditimpa; muat ulang record dan tinjau perbedaannya.',currentVersion:actual});
}
export async function recordAudit(client:PoolClient,type:'product'|'brand',actor:string,before:Record<string,unknown>|null,after:Record<string,unknown>){
 const action=!before?'create':before.is_active!==after.is_active?(after.is_active?'publish':'unpublish'):'update';
 await client.query('INSERT INTO product.master_data_audit(entity_type,entity_id,actor_id,action,before_data,after_data) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',
  [type,after.id,actor,action,before?JSON.stringify(before):null,JSON.stringify(after)]);
}
export function publicationMissing(p:Record<string,unknown>):string[]{
 const missing:string[]=[];
 for(const k of ['sku','brand_id','description'])if(typeof p[k]!=='string'||!String(p[k]).trim())missing.push(k);
 if(typeof p.image_url!=='string'||!/^https:\/\//i.test(p.image_url))missing.push('image_url');
 if(!Number.isSafeInteger(Number(p.price_idr))||Number(p.price_idr)<=0)missing.push('price_idr');
 for(const k of ['weight_grams','length_cm','width_cm','height_cm'])if(!Number.isSafeInteger(p[k])||Number(p[k])<=0)missing.push(k);
 return missing;
}
export function parsePage(raw:Record<string,unknown>={}){
 const allowed=['page','pageSize','q','category','brand','status'];
 if(Object.keys(raw).some(k=>!allowed.includes(k)))throw new BadRequestException('Unknown list filter');
 function number(k:string,n:number,max:number){const v=raw[k]===undefined?String(n):raw[k];
  if(typeof v!=='string'||!/^\d{1,6}$/.test(v)||Number(v)<1||Number(v)>max)throw new BadRequestException('Invalid '+k);return Number(v);}
 function text(k:string,max:number){const v=raw[k]??'';if(typeof v!=='string'||v.length>max)throw new BadRequestException('Invalid '+k);return v.trim();}
 return {page:number('page',1,100000),pageSize:number('pageSize',100,100),q:text('q',120),category:text('category',50),brand:text('brand',80),status:text('status',40)};
}
export function pageResult<T>(items:T[],total:number,page:number,pageSize:number){
 return {items,total,page,pageSize,pages:Math.ceil(total/pageSize),hasMore:page*pageSize<total};
}
''')
p='apps/api/src/products.ts';s=read(p)
s=s.replace('BadRequestException, Injectable, NotFoundException','BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException')
s=s.replace("import type {Principal} from './auth';","import type {Principal} from './auth';\nimport {requireActor,parseEdit,assertVersion,recordAudit,publicationMissing,parsePage,pageResult} from './data-integrity';")
s=s.replace('  id: string;','  id: string;\n  edit_version: number;',1)
pos=s.index('@Injectable()\nexport class ProductsService')
s=s[:pos]+r'''@Injectable()
export class ProductsService {
 constructor(private readonly db:DatabaseService){}
 async page(raw:Record<string,unknown>={},admin=false){
  if(!this.db.configured)throw new ServiceUnavailableException('Database unavailable');
  const f=parsePage(raw);
  const result=await this.db.query<{result:{items:Product[];total:number}}>(
   `WITH filtered AS (
     SELECT p.*,b.name AS brand_name FROM product.products p LEFT JOIN product.brands b ON b.id=p.brand_id
     WHERE p.slug NOT LIKE 'demo-%' AND ($1::boolean OR p.is_active)
      AND ($2::text='' OR strpos(lower(concat_ws(' ',p.name,p.slug,p.sku,b.name)),lower($2))>0)
      AND ($3::text='' OR p.category=$3) AND ($4::text='' OR p.brand_id::text=$4)
      AND ($5::text='' OR ($5='published' AND p.is_active) OR ($5='draft' AND NOT p.is_active))
    ), selected AS (SELECT * FROM filtered ORDER BY created_at DESC,id DESC LIMIT $6 OFFSET $7)
    SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC,s.id DESC) FROM selected s),'[]'::jsonb),
      'total',(SELECT count(*)::integer FROM filtered)) AS result`,
   [admin,f.q,f.category,f.brand,f.status,f.pageSize,(f.page-1)*f.pageSize]);
  const d=result.rows[0].result;return pageResult(d.items,d.total,f.page,f.pageSize);
 }
 async list():Promise<Product[]>{return (await this.page()).items;}
 async listAdmin():Promise<Product[]>{return (await this.page({},true)).items;}
 async bySlug(slug:string):Promise<Product>{
  if(!this.db.configured)throw new ServiceUnavailableException('Database unavailable');
  const r=await this.db.query<Product>("SELECT p.*,p.price_idr::integer AS price_idr,b.name AS brand_name FROM product.products p LEFT JOIN product.brands b ON b.id=p.brand_id WHERE p.slug=$1 AND p.is_active AND p.slug NOT LIKE 'demo-%'",[slug]);
  if(!r.rows[0])throw new NotFoundException('Product not found');return r.rows[0];
 }
 async create(body:unknown,actor?:Principal):Promise<Product>{
  const operator=requireActor(actor),product=cleanProduct(body);
  if(product.stock_qty!==0)throw new BadRequestException('Stok awal harus 0. Catat stok di Warehouse Ledger dan pilih gudang fisik.');
  if(product.is_active)throw new BadRequestException('Produk baru harus disimpan sebagai draft.');
  const keys=Object.keys(product);
  try{return await this.db.transaction(async client=>{
   const r=await client.query<Product>('INSERT INTO product.products ('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+') RETURNING *,price_idr::integer AS price_idr',keys.map(k=>(product as Record<string,unknown>)[k]));
   await recordAudit(client,'product',operator,null,r.rows[0] as unknown as Record<string,unknown>);return r.rows[0];
  });}catch(e){if((e as {code?:string}).code==='23505')throw new ConflictException('SKU atau slug sudah digunakan.');throw e;}
 }
 async update(id:string,body:unknown,actor?:Principal):Promise<Product>{
  if(!/^[a-f0-9-]{36}$/i.test(id))throw new BadRequestException('Invalid ID');
  const operator=requireActor(actor),edit=parseEdit(body);
  if(Object.hasOwn(edit.fields,'stock_qty'))throw new BadRequestException('Gunakan Warehouse Ledger untuk mengubah stok');
  const patch=cleanProduct(edit.fields,true),keys=Object.keys(patch);
  if(!keys.length)throw new BadRequestException('No changes supplied');
  try{return await this.db.transaction(async client=>{
   const previous=await client.query<Product>('SELECT *,price_idr::integer AS price_idr FROM product.products WHERE id=$1 FOR UPDATE',[id]);
   const before=previous.rows[0];if(!before)throw new NotFoundException('Product not found');assertVersion(before.edit_version,edit.version);
   const merged={...before,...patch};
   if(merged.is_active){
    const missing=publicationMissing(merged as unknown as Record<string,unknown>);
    const brand=merged.brand_id?await client.query('SELECT 1 FROM product.brands WHERE id=$1 AND is_active',[merged.brand_id]):{rows:[]};
    if(!brand.rows.length)missing.push('active_brand');
    const inventory=await client.query('SELECT 1 FROM product.warehouse_stock s JOIN product.warehouses w ON w.id=s.warehouse_id WHERE s.product_id=$1 AND w.is_active AND w.is_dispatch_enabled LIMIT 1',[id]);
    if(!inventory.rows.length)missing.push('verified_warehouse');
    if(missing.length)throw new ConflictException({code:'PUBLICATION_INCOMPLETE',message:'Data belum lengkap: '+missing.join(', '),missing});
   }
   const r=await client.query<Product>('UPDATE product.products SET '+keys.map((k,i)=>k+'=$'+(i+1)).join(',')+',edit_version=edit_version+1,updated_at=now() WHERE id=$'+(keys.length+1)+' RETURNING *,price_idr::integer AS price_idr',[...keys.map(k=>(patch as Record<string,unknown>)[k]),id]);
   await recordAudit(client,'product',operator,before as unknown as Record<string,unknown>,r.rows[0] as unknown as Record<string,unknown>);return r.rows[0];
  });}catch(e){if((e as {code?:string}).code==='23505')throw new ConflictException('SKU atau slug sudah digunakan.');throw e;}
 }
 async summary(){
  const r=await this.db.query(`SELECT jsonb_build_object(
   'managed',(SELECT count(*) FROM product.products WHERE slug NOT LIKE 'demo-%'),
   'published',(SELECT count(*) FROM product.products WHERE slug NOT LIKE 'demo-%' AND is_active),
   'lowStock',(SELECT count(*) FROM product.products WHERE slug NOT LIKE 'demo-%' AND stock_qty<=5),
   'orders',(SELECT count(*) FROM product.orders WHERE idempotency_key IS NOT NULL),
   'pendingOrders',(SELECT count(*) FROM product.orders WHERE idempotency_key IS NOT NULL AND payment_status='not_initiated'),
   'brands',(SELECT count(*) FROM product.brands)) AS totals`);
  return {totals:r.rows[0].totals,scope:'database_total',observedAt:new Date().toISOString()};
 }
 async audit(raw:Record<string,unknown>){
  const {entityId,entityType,...rest}=raw;
  if(typeof entityId!=='string'||!/^[a-f0-9-]{36}$/i.test(entityId)||!['product','brand'].includes(String(entityType)))throw new BadRequestException('Invalid audit target');
  const f=parsePage(rest);
  const r=await this.db.query('SELECT id::text,entity_type,entity_id,actor_id,action,before_data,after_data,created_at FROM product.master_data_audit WHERE entity_id=$1 AND entity_type=$2 ORDER BY id DESC LIMIT $3 OFFSET $4',[entityId,entityType,f.pageSize,(f.page-1)*f.pageSize]);
  const n=await this.db.query<{total:number}>('SELECT count(*)::integer total FROM product.master_data_audit WHERE entity_id=$1 AND entity_type=$2',[entityId,entityType]);
  return pageResult(r.rows,n.rows[0].total,f.page,f.pageSize);
 }
}
''';write(p,s)
p='apps/api/src/brands.ts';s=read(p)
s=s.replace("import {DatabaseService} from './database';","import {DatabaseService} from './database';\nimport type {Principal} from './auth';\nimport {requireActor,parseEdit,assertVersion,recordAudit} from './data-integrity';")
s=s.replace('export interface Brand {id:string;','export interface Brand {id:string;edit_version:number;')
s=s.replace('SELECT id,slug,name,description,logo_url,is_active FROM product.brands','SELECT id,slug,name,description,logo_url,is_active,edit_version FROM product.brands')
a=s.index(' async create(input:unknown)')
s=s[:a]+r''' async create(input:unknown,actor?:Principal){
  const operator=requireActor(actor),fields=parseBrand(input,false),keys=Object.keys(fields);
  try{return await this.db.transaction(async client=>{
   const r=await client.query<Brand>('INSERT INTO product.brands('+keys.join(',')+') VALUES ('+keys.map((_,i)=>'$'+(i+1)).join(',')+') RETURNING *',keys.map(k=>fields[k]));
   await recordAudit(client,'brand',operator,null,r.rows[0] as unknown as Record<string,unknown>);return r.rows[0];
  });}catch(e){if((e as {code?:string}).code==='23505')throw new ConflictException('Nama atau slug brand sudah dipakai');throw e;}
 }
 async update(id:string,input:unknown,actor?:Principal){
  if(!uuid.test(id))throw new BadRequestException('ID brand tidak valid');
  const operator=requireActor(actor),edit=parseEdit(input),fields=parseBrand(edit.fields,true),keys=Object.keys(fields);
  if(!keys.length)throw new BadRequestException('Tidak ada perubahan');
  try{return await this.db.transaction(async client=>{
   const previous=await client.query<Brand>('SELECT * FROM product.brands WHERE id=$1 FOR UPDATE',[id]);
   const before=previous.rows[0];if(!before)throw new NotFoundException('Brand tidak ditemukan');assertVersion(before.edit_version,edit.version);
   const r=await client.query<Brand>('UPDATE product.brands SET '+keys.map((k,i)=>k+'=$'+(i+1)).join(',')+',edit_version=edit_version+1,updated_at=now() WHERE id=$'+(keys.length+1)+' RETURNING *',[...keys.map(k=>fields[k]),id]);
   await recordAudit(client,'brand',operator,before as unknown as Record<string,unknown>,r.rows[0] as unknown as Record<string,unknown>);return r.rows[0];
  });}catch(e){if((e as {code?:string}).code==='23505')throw new ConflictException('Nama atau slug brand sudah dipakai');throw e;}
 }
}
''';write(p,s)
p='apps/api/src/brand-portal.ts';s=read(p)
a=s.index(' private async paidSales(');b=s.index(' async overview(',a)
s=s[:a]+r''' private async paidSales(brandId:string){
  const r=await this.db.query(`SELECT count(DISTINCT o.id)::text AS paid_orders,coalesce(sum(oi.quantity),0)::text AS units_sold,
   coalesce(sum(oi.quantity*oi.unit_price_idr),0)::text AS gross_item_sales_idr
   FROM product.order_items oi JOIN product.orders o ON o.id=oi.order_id
   WHERE oi.brand_id=$1 AND o.payment_status='paid' AND o.payment_provider IS NOT NULL
    AND o.payment_reference IS NOT NULL AND o.status IN ('paid','fulfilled')`,[brandId]);
  return r.rows[0]||{paid_orders:'0',units_sold:'0',gross_item_sales_idr:'0'};
 }
'''+s[b:]
a=s.index(' async sales(');b=s.index(' async warehouseStock(',a)
s=s[:a]+r''' async sales(user:Principal,brandId:string){
  await this.grant(user,brandId);
  const r=await this.db.query(`SELECT oi.product_id,oi.sku,oi.product_name AS name,sum(oi.quantity)::text AS units_sold,
    sum(oi.quantity*oi.unit_price_idr)::text AS gross_item_sales_idr
   FROM product.order_items oi JOIN product.orders o ON o.id=oi.order_id
   WHERE oi.brand_id=$1 AND o.payment_status='paid' AND o.payment_provider IS NOT NULL
    AND o.payment_reference IS NOT NULL AND o.status IN ('paid','fulfilled')
   GROUP BY oi.product_id,oi.sku,oi.product_name ORDER BY oi.product_name,oi.product_id`,[brandId]);
  return {brandId,items:r.rows,scope:'brand_only',salesBasis:'verified_paid_brand_snapshot',settlementAvailable:false};
 }
'''+s[b:];write(p,s)
p='apps/api/src/checkout.ts';s=read(p)
s=s.replace("import type {Principal} from './auth';","import type {Principal} from './auth';\nimport {parsePage,pageResult} from './data-integrity';")
a=s.index(' async adminOrders()');b=s.index(' paymentSession()',a)
s=s[:a]+r''' async adminOrders(raw:Record<string,unknown>={}){
  const f=parsePage(raw);
  const r=await this.db.query(`WITH filtered AS (
   SELECT id,status,payment_status,(payment_provider IS NOT NULL AND payment_reference IS NOT NULL) AS payment_verified,
    contact_name,contact_email,city,province,shipping_provider,shipping_courier_code,shipping_service_code,
    subtotal_idr::text,shipping_fee_idr::text,total_idr::text,payment_method,created_at
   FROM product.orders WHERE idempotency_key IS NOT NULL
    AND ($1::text='' OR strpos(lower(concat_ws(' ',id::text,contact_name,contact_email,city)),lower($1))>0)
    AND ($2::text='' OR status=$2 OR payment_status=$2)
   ), selected AS (SELECT * FROM filtered ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4)
   SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC,s.id DESC) FROM selected s),'[]'::jsonb),
    'total',(SELECT count(*)::integer FROM filtered)) AS data`,[f.q,f.status,f.pageSize,(f.page-1)*f.pageSize]);
  const d=r.rows[0].data;return {...pageResult(d.items,d.total,f.page,f.pageSize),paymentEnabled:false};
 }
'''+s[b:];write(p,s)
p='apps/api/src/controllers.ts'
replace(p,'Patch, Post, Req, ServiceUnavailableException','Patch, Post, Query, Req, ServiceUnavailableException')
replace(p,'async list() { return { items: await this.products.list() }; }','async list(@Query() query:Record<string,unknown>) { return this.products.page(query); }')
replace(p,'async listProducts() { return { items: await this.products.listAdmin() }; }',"async listProducts(@Query() query:Record<string,unknown>) { return this.products.page(query,true); }\n  @Get('summary')\n  summary(){return this.products.summary();}\n  @Get('audit-log')\n  audit(@Query() query:Record<string,unknown>){return this.products.audit(query);}")
replace(p,"async update(@Param('id') id: string, @Body() body: unknown) { return this.products.update(id, body); }","async update(@Req() req:{user:Principal},@Param('id') id: string, @Body() body: unknown) { return this.products.update(id, body,req.user); }")
replace(p,'addBrand(@Body() body:unknown){return this.brands.create(body);}','addBrand(@Req() req:{user:Principal},@Body() body:unknown){return this.brands.create(body,req.user);}')
replace(p,"editBrand(@Param('id') id:string,@Body() body:unknown){return this.brands.update(id,body);}","editBrand(@Req() req:{user:Principal},@Param('id') id:string,@Body() body:unknown){return this.brands.update(id,body,req.user);}")
replace(p,'listOrders(){return this.checkout.adminOrders();}','listOrders(@Query() query:Record<string,unknown>){return this.checkout.adminOrders(query);}')
replace('apps/api/src/admin-product-records.ts',"'height_cm',p.height_cm)","'height_cm',p.height_cm,'edit_version',p.edit_version)")
write('apps/web/src/lib/collection-read.ts',r'''export class CollectionReadError extends Error {
 constructor(public code:string){super('Data tidak dapat dimuat ('+code+'). Silakan coba lagi.');this.name='CollectionReadError';}
}
export async function readCollection<T>(url:string,fetcher:typeof fetch,valid:(row:unknown)=>boolean=()=>true):Promise<T[]> {
 const items:T[]=[];let expected:number|undefined;
 for(let page=1;page<=100;page++){
  const target=new URL(url,'https://local.invalid');target.searchParams.set('page',String(page));target.searchParams.set('pageSize','100');
  const relative=url.startsWith('/');
  let r:Response;try{r=await fetcher(relative?target.pathname+target.search:target.toString(),{cache:'no-store',signal:AbortSignal.timeout(8000)});}
  catch{throw new CollectionReadError('CONNECTION_UNAVAILABLE');}
  if(!r.ok)throw new CollectionReadError(r.status===401?'SESSION_EXPIRED':r.status===403?'ACCESS_DENIED':'SOURCE_UNAVAILABLE');
  let d:unknown;try{d=await r.json();}catch{throw new CollectionReadError('INVALID_RESPONSE');}
  if(!d||typeof d!=='object'||!('items' in d)||!Array.isArray(d.items)||!d.items.every(valid))throw new CollectionReadError('INVALID_RESPONSE');
  const data=d as {items:T[];total?:unknown;page?:unknown;pageSize?:unknown;hasMore?:unknown};
  if(data.total===undefined){if(page!==1)throw new CollectionReadError('INVALID_PAGINATION');return data.items;}
  if(!Number.isSafeInteger(data.total)||Number(data.total)<0||data.page!==page||data.pageSize!==100||typeof data.hasMore!=='boolean')throw new CollectionReadError('INVALID_PAGINATION');
  if(expected!==undefined&&expected!==data.total)throw new CollectionReadError('DATA_CHANGED_RETRY');expected=Number(data.total);
  items.push(...data.items);
  if(!data.hasMore){if(items.length!==expected)throw new CollectionReadError('INCOMPLETE_RESPONSE');return items;}
  if(!data.items.length)throw new CollectionReadError('INCOMPLETE_RESPONSE');
 }
 throw new CollectionReadError('RESULT_TOO_LARGE_USE_FILTER');
}
export async function settleCollection<T>(fn:()=>Promise<T[]>){
 try{return {ok:true as const,items:await fn(),error:null};}
 catch(e){return {ok:false as const,items:[] as T[],error:e instanceof CollectionReadError?e.code:'SOURCE_UNAVAILABLE'};}
}
''')
write('apps/web/src/lib/api.ts',r'''import type {Product} from './types';
import {CollectionReadError,readCollection,settleCollection} from './collection-read';
export interface ActiveBrand {id:string;name:string;slug:string;logo_url:string|null;description:string;is_active:boolean;}
function url(path:string){if(!process.env.API_INTERNAL_URL)throw new CollectionReadError('SOURCE_NOT_CONFIGURED');return new URL(path,process.env.API_INTERNAL_URL).toString();}
const productValid=(x:unknown)=>!!x&&typeof x==='object'&&typeof (x as Product).id==='string'&&typeof (x as Product).slug==='string'&&typeof (x as Product).name==='string'&&typeof (x as Product).is_active==='boolean';
const brandValid=(x:unknown)=>!!x&&typeof x==='object'&&typeof (x as ActiveBrand).id==='string'&&typeof (x as ActiveBrand).name==='string'&&typeof (x as ActiveBrand).slug==='string';
export async function getProducts():Promise<Product[]>{return readCollection<Product>(url('/v1/products'),fetch,productValid);}
export async function getBrands():Promise<ActiveBrand[]>{return readCollection<ActiveBrand>(url('/v1/brands'),fetch,brandValid);}
export function getProductsResult(){return settleCollection(getProducts);}
export function getBrandsResult(){return settleCollection(getBrands);}
export async function getProduct(slug:string):Promise<Product|null>{
 let r:Response;try{r=await fetch(url('/v1/products/'+encodeURIComponent(slug)),{cache:'no-store',signal:AbortSignal.timeout(8000)});}catch{throw new CollectionReadError('SOURCE_UNAVAILABLE');}
 if(r.status===404)return null;if(!r.ok)throw new CollectionReadError('SOURCE_UNAVAILABLE');
 let d:unknown;try{d=await r.json();}catch{throw new CollectionReadError('INVALID_RESPONSE');}
 if(!productValid(d))throw new CollectionReadError('INVALID_RESPONSE');return d as Product;
}
''')
write('apps/web/src/components/data-status.tsx',r''' 'use client';
import {useTransition} from 'react';
import {useRouter} from 'next/navigation';
export function DataStatus({kind,code}:{kind:string;code:string|null}){
 const router=useRouter(),[pending,start]=useTransition();
 return <section role="alert" data-catalog-state="unavailable" className="main-container" style={{marginBlock:18,padding:22,borderRadius:18,background:'var(--vm-card,#f8f4fc)',border:'1px solid #d9cce4'}}>
  <strong>Data {kind} belum dapat dimuat.</strong>
  <p>Koneksi sedang terganggu. Ini bukan berarti data kosong atau terhapus. Tampilan dan aset tetap dipertahankan.</p>
  <small>Kode: {code||'SOURCE_UNAVAILABLE'}</small>{' '}
  <button type="button" disabled={pending} onClick={()=>start(()=>router.refresh())} style={{padding:'12px 18px',borderRadius:99,border:'1px solid currentColor',cursor:'pointer'}}>{pending?'Memuat ulang...':'Coba lagi'}</button>
 </section>;
}
''')
p='apps/web/src/app/page.tsx'
replace(p,"import {getProducts,getBrands} from '@/lib/api';","import {getProductsResult,getBrandsResult} from '@/lib/api';\nimport {DataStatus} from '@/components/data-status';")
replace(p,' const [products,brands]=await Promise.all([getProducts(),getBrands()]);',' const [productResult,brandResult]=await Promise.all([getProductsResult(),getBrandsResult()]);\n const products=productResult.items,brands=brandResult.items;')
replace(p,'   {active.length>0?','   {!productResult.ok?<DataStatus kind="produk" code={productResult.error}/>:active.length>0?')
replace(p,'     {brands.length>0?<BrandRail','     {!brandResult.ok?<DataStatus kind="brand" code={brandResult.error}/>:brands.length>0?<BrandRail')
p='apps/web/src/app/catalog/page.tsx'
replace(p,"import {getProducts} from '@/lib/api';","import {getProductsResult} from '@/lib/api';\nimport {DataStatus} from '@/components/data-status';")
replace(p," const active=(await getProducts()).filter(p=>p.is_active&&!p.slug.startsWith('demo-'));"," const result=await getProductsResult();\n const active=result.items.filter(p=>p.is_active&&!p.slug.startsWith('demo-'));")
replace(p,'   {active.length>0?','   {!result.ok?<DataStatus kind="produk" code={result.error}/>:active.length>0?')
p='apps/web/src/app/brand-partner/page.tsx'
replace(p,"import {getBrands} from '@/lib/api';","import {getBrandsResult} from '@/lib/api';\nimport {DataStatus} from '@/components/data-status';")
replace(p,' const brands=await getBrands();',' const result=await getBrandsResult();\n const brands=result.items;')
replace(p,'   {brands.length>0?','   {!result.ok?<DataStatus kind="brand" code={result.error}/>:brands.length>0?')
write('apps/web/src/app/product/[slug]/error.tsx',"'use client';\nimport {DataStatus} from '@/components/data-status';\nexport default function ProductReadFailure(){return <DataStatus kind=\"produk\" code=\"SOURCE_UNAVAILABLE\"/>;}\n")
p='apps/web/src/app/api/admin/products/route.ts'
replace(p,"new URL('/v1/admin/products',process.env.API_INTERNAL_URL)","new URL('/v1/admin/products'+request.nextUrl.search,process.env.API_INTERNAL_URL)")
write('apps/web/src/app/api/products/route.ts',"import {NextRequest} from 'next/server';\nimport {proxyJson} from '@/lib/server-proxy';\nexport const dynamic='force-dynamic';\nexport function GET(request:NextRequest){return proxyJson(request,'/v1/products'+request.nextUrl.search,'GET');}\n")
replace('apps/web/src/app/api/admin/orders/route.ts',"'/v1/admin/orders','GET'","'/v1/admin/orders'+request.nextUrl.search,'GET'")
for name in ['summary','audit-log']:
 write('apps/web/src/app/api/admin/'+name+'/route.ts',"import {NextRequest} from 'next/server';\nimport {proxyJson} from '@/lib/server-proxy';\nexport const dynamic='force-dynamic';\nexport function GET(request:NextRequest){return proxyJson(request,'/v1/admin/"+name+"'+request.nextUrl.search,'GET',{requireAuth:true});}\n")
p='apps/web/src/app/admin/page.tsx';s=read(p)
s=s.replace("import {formatIDR,type Product} from '@/lib/types';","import {formatIDR,type Product} from '@/lib/types';\nimport {readCollection} from '@/lib/collection-read';\nimport {AuditHistory} from '@/components/audit-history';")
s=s.replace('type Brand={id:string;','type Brand={id:string;edit_version?:number;')
s=s.replace(' const [editingBrand,setEditingBrand]=useState<string|null>(null);',' const [editingBrand,setEditingBrand]=useState<string|null>(null);\n const [productVersion,setProductVersion]=useState<number|null>(null),[brandVersion,setBrandVersion]=useState<number|null>(null);\n const [totals,setTotals]=useState<{published:number;lowStock:number;pendingOrders:number}|null>(null);')
a=s.index(' async function refreshData()');b=s.index(' useEffect(()=>{',a)
s=s[:a]+r''' async function loadWorkspace(token:string){
  const headers={authorization:'Bearer '+token};
  const fetcher:typeof fetch=(input,init)=>fetch(input,{...init,headers:{...init?.headers,...headers},cache:'no-store'});
  const [p,b,o,r]=await Promise.all([
   readCollection<Product>('/api/admin/products',fetcher),readCollection<Brand>('/api/admin/brands',fetcher),
   readCollection<Order>('/api/admin/orders',fetcher),fetcher('/api/admin/summary')]);
  if(!r.ok)throw Error('Statistik seluruh database belum tersedia. Coba lagi.');
  const stats=await r.json();if(!stats.totals)throw Error('Respons statistik tidak valid');
  return {products:p,brands:b,orders:o,totals:stats.totals};
 }
 async function refreshData(){
  if(!auth.accessToken)return;
  const d=await loadWorkspace(auth.accessToken);setProducts(d.products);setBrands(d.brands);setOrders(d.orders);setTotals(d.totals);
 }
'''+s[b:]
a=s.index("    const results=await Promise.all(['/api/admin/products'");b=s.index('   }catch{',a)
if a<0 or b<0:raise RuntimeError('Admin initial load boundary missing')
s=s[:a]+r'''    const d=await loadWorkspace(auth.accessToken);
    if(!alive)return;
    setAuthorized(true);setVerifiedToken(auth.accessToken);setAccessDenied(false);setSessionExpired(false);
    setProducts(d.products);setBrands(d.brands);setOrders(d.orders);setTotals(d.totals);setMessage('');
'''+s[b:]
s=s.replace(' const published=products.filter(p=>p.is_active).length;',' const published=totals?.published??0;')
s=s.replace(' const lowStock=products.filter(p=>p.stock_qty<=5).length;',' const lowStock=totals?.lowStock??0;')
s=s.replace(" const pending=orders.filter(o=>o.payment_status==='not_initiated').length;",' const pending=totals?.pendingOrders??0;')
s=s.replace('  setEditingProduct(p.id);','  setProductVersion(p.edit_version??null);setEditingProduct(p.id);')
s=s.replace('function editBrand(b:Brand){setEditingBrand(b.id);','function editBrand(b:Brand){setBrandVersion(b.edit_version??null);setEditingBrand(b.id);')
s=s.replace('name:productDraft.name,slug:productDraft.slug,sku:','...(editingProduct?{expected_version:productVersion}:{}),name:productDraft.name,slug:productDraft.slug,sku:')
s=s.replace("'PATCH',{is_active:!p.is_active}","'PATCH',{is_active:!p.is_active,expected_version:p.edit_version}")
s=s.replace('name:brandDraft.name,slug:brandDraft.slug,description:','...(editingBrand?{expected_version:brandVersion}:{}),name:brandDraft.name,slug:brandDraft.slug,description:')
s=s.replace("'PATCH',{is_active:!brand.is_active}","'PATCH',{is_active:!brand.is_active,expected_version:brand.edit_version}")
s=s.replace('{message&&<p className="vma26-message"',"{(tab==='products'&&editingProduct||tab==='brands'&&editingBrand)&&<AuditHistory token={auth.accessToken} entityType={tab==='products'?'product':'brand'} entityId={(tab==='products'?editingProduct:editingBrand)!}/> }\n   {message&&<p className=\"vma26-message\"")
if 'expected_version:productVersion' not in s:raise RuntimeError('Admin version wiring failed')
write(p,s)
replace('apps/web/src/lib/types.ts','  id: string;','  id: string;\n  edit_version?: number;',1)
write('apps/web/src/components/audit-history.tsx',r''' 'use client';
import {useEffect,useState} from 'react';
type Change={id:string;action:string;actor_id:string;before_data:Record<string,unknown>|null;after_data:Record<string,unknown>;created_at:string};
export function AuditHistory({token,entityType,entityId}:{token:string|null;entityType:string;entityId:string}){
 const [items,setItems]=useState<Change[]>([]),[error,setError]=useState('');
 useEffect(()=>{if(!token)return;const ac=new AbortController();setItems([]);setError('');
  fetch('/api/admin/audit-log?entityType='+entityType+'&entityId='+entityId+'&pageSize=20',{headers:{authorization:'Bearer '+token},cache:'no-store',signal:ac.signal})
   .then(async r=>{if(!r.ok)throw Error('Riwayat perubahan belum dapat dimuat');return r.json();}).then(d=>setItems(d.items||[]))
   .catch(e=>{if(!ac.signal.aborted)setError(e.message);});return()=>ac.abort();
 },[token,entityType,entityId]);
 return <section className="vma26-panel" aria-label="Audit perubahan"><h2>Riwayat perubahan</h2>
  <p>20 perubahan terbaru, tersimpan bersama perubahan data. Waktu, operator, dan versi tidak dapat diubah dari panel.</p>
  {error?<p role="alert">{error}</p>:!items.length?<p>Belum ada perubahan tercatat sejak fitur audit diaktifkan.</p>:items.map(x=><details key={x.id}>
   <summary>{new Date(x.created_at).toLocaleString('id-ID')} - {x.action} - operator {x.actor_id.slice(0,8)}</summary>
   <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify({before:x.before_data,after:x.after_data},null,2)}</pre>
  </details>)}
 </section>;
}
''')
# Adapt browser fixtures for page queries and independent KPI totals.
for pattern in ['scripts/admin-ui-smoke.mjs','scripts/admin-product-records-smoke.ts']:
 if not (ROOT/pattern).exists():continue
 s=read(pattern).replace("'**/api/admin/'+endpoint","'**/api/admin/'+endpoint+'**'").replace("'**/api/admin/'+name","'**/api/admin/'+name+'**'")
 anchor='const page=await context.newPage();'
 if anchor in s:s=s.replace(anchor,anchor+"\n await page.route('**/api/admin/summary',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({totals:{published:0,lowStock:0,pendingOrders:0},scope:'database_total'})}));",1)
 write(pattern,s)
# Tests that wait on a public deployment are POST-release checks, not candidate checks.
for p in (ROOT/'.github/workflows').glob('*.yml'):
 name=str(p.relative_to(ROOT));s=read(name)
 if any(x in s for x in ['scripts/ui-smoke','scripts/smoke-staging','scripts/theme-smoke','scripts/admin-ui-smoke','scripts/admin-product-records-smoke']):
  s=re.sub(r'(?m)^  push:\n(?:    [^\n]*\n)+','',s)
  write(name,s)
for p,t in changes.items():
 dest=ROOT/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(t)
report={p:{'before':before[p],'after':hashlib.sha256(t.encode()).hexdigest()} for p,t in changes.items()}
MARKER.parent.mkdir(parents=True,exist_ok=True);MARKER.write_text(json.dumps({'checkpoint':'CP37-A','date':'2026-11-03','files':report},indent=2)+'\n')
print('CP37A_MATERIALIZED',len(changes),'files; no data or provider operations')
