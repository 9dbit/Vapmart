import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from './database';
import type {Principal} from './auth';
import {requireActor,parseEdit,assertVersion,recordAudit,publicationMissing,parsePage,pageResult} from './data-integrity';

export const categories = ['home', 'lifestyle', 'decor', 'accessories', 'electronics', 'other'] as const;
type Category = typeof categories[number];

export interface Product {
  id: string;
  edit_version: number;
  slug: string;
  sku: string | null;
  brand_id: string | null;
  brand_name?: string | null;
  gallery_urls: string[];
  name: string;
  description: string;
  category: Category;
  price_idr: number;
  stock_qty: number;
  weight_grams?: number|null;
  length_cm?: number|null;
  width_cm?: number|null;
  height_cm?: number|null;
  image_url: string | null;
  is_active: boolean;
}

type Payload = Record<string, unknown>;
const restricted = /\b(nicotine|nikotin|vape|vaping|rokok|tobacco|e-cig(?:arette)?|e-liquid)\b/i;
function asObject(body: unknown): Payload {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Expected a product object');
  }
  return body as Payload;
}

export function cleanProduct(body: unknown, partial = false): Partial<Product> {
  const input = asObject(body);
  const allowed = ['slug', 'sku', 'name', 'description', 'category', 'price_idr', 'stock_qty', 'image_url', 'is_active', 'brand_id', 'gallery_urls','weight_grams','length_cm','width_cm','height_cm'];
  if (Object.keys(input).some(k => !allowed.includes(k))) {
    throw new BadRequestException('Unknown product field');
  }
  if (!partial && ['slug','name','category','price_idr','stock_qty'].some(k => !(k in input))) {
    throw new BadRequestException('Missing required product fields');
  }
  const out: Record<string, unknown> = {};
  if ('slug' in input) {
    if (typeof input.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) || input.slug.length > 120)
      throw new BadRequestException('Invalid slug');
    out.slug = input.slug;
  }
  if ('sku' in input) {
    const sku=input.sku;
    if(sku===null || sku==='')out.sku=null;
    else {
      if(typeof sku!=='string'||!/^[A-Z0-9][A-Z0-9._-]{2,63}$/.test(sku))
        throw new BadRequestException('Invalid SKU');
      out.sku=sku;
    }
  }
  if ('name' in input) {
    if (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.length > 140)
      throw new BadRequestException('Invalid name');
    out.name = input.name.trim();
  }
  if ('description' in input) {
    if (typeof input.description !== 'string' || input.description.length > 3000)
      throw new BadRequestException('Invalid description');
    out.description = input.description;
  } else if (!partial) {
    out.description = '';
  }
  if ('category' in input) {
    if (typeof input.category !== 'string' || !categories.includes(input.category as Category))
      throw new BadRequestException('Unsupported category');
    out.category = input.category;
  }
  for (const field of ['price_idr', 'stock_qty'] as const) {
    if (field in input) {
      const number = input[field];
      if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 0 || number > 2000000000)
        throw new BadRequestException(`Invalid ${field}`);
      out[field] = number;
    }
  }
  for (const attr of ['weight_grams','length_cm','width_cm','height_cm'] as const){
    if(attr in input){const v=input[attr];if(v===null){out[attr]=null;continue;}
      if(typeof v!=='number'||!Number.isSafeInteger(v)||v<1||v>(attr==='weight_grams'?1000000:1000))throw new BadRequestException('Invalid '+attr);
      out[attr]=v;
    }
  }
  if ('image_url' in input) {
    const url = input.image_url;
    if (url === null || url === '') out.image_url = null;
    else {
      if (typeof url !== 'string' || url.length > 500 || !/^https:\/\//i.test(url))
        throw new BadRequestException('Image URL must be HTTPS');
      out.image_url = url;
    }
  }
  if ('brand_id' in input) {
    if(input.brand_id===null)out.brand_id=null;
    else if(typeof input.brand_id!=='string'||!/^[0-9a-f-]{36}$/i.test(input.brand_id))
      throw new BadRequestException('Invalid brand ID');
    else out.brand_id=input.brand_id;
  }
  if ('gallery_urls' in input) {
    if(!Array.isArray(input.gallery_urls)||input.gallery_urls.length>8||
      input.gallery_urls.some(u=>typeof u!=='string'||u.length>600||!/^https:\/\//i.test(u)))
      throw new BadRequestException('Invalid image gallery (maximum 8 HTTPS photos)');
    if(new Set(input.gallery_urls).size!==input.gallery_urls.length)
      throw new BadRequestException('Duplicate gallery image');
    out.gallery_urls=input.gallery_urls;
  }
  if ('is_active' in input) {
    if (typeof input.is_active !== 'boolean') throw new BadRequestException('Invalid is_active');
    out.is_active = input.is_active;
  }
  if ([out.name,out.description,out.slug,out.sku].some(v=>restricted.test(String(v||'')))) {
    throw new BadRequestException('This catalog cannot contain nicotine or tobacco products');
  }
  if (!partial) out.is_active ??= false;
  return out as Partial<Product>;
}

@Injectable()
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
