import {BadRequestException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {DatabaseService} from './database';
import type {Principal} from './auth';

export type FavoriteKind='product'|'brand';
export function parseFavorite(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Data favorit tidak valid');
 const b=raw as Record<string,unknown>;
 if(Object.keys(b).some(k=>!['type','entityId','saved'].includes(k)))throw new BadRequestException('Parameter favorit tidak dikenal');
 if(b.type!=='product'&&b.type!=='brand')throw new BadRequestException('Jenis favorit tidak valid');
 if(typeof b.entityId!=='string'||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(b.entityId))
  throw new BadRequestException('ID favorit harus UUID valid');
 if(typeof b.saved!=='boolean')throw new BadRequestException('Status favorit harus boolean');
 return {type:b.type as FavoriteKind,entityId:b.entityId,saved:b.saved};
}
@Injectable()
export class CustomerFavoritesService{
 constructor(private readonly db:DatabaseService){}
 async list(user:Principal){
  if(!user.emailVerified)throw new ForbiddenException('Verifikasi email untuk favorit akun');
  const [products,brands]=await Promise.all([
   this.db.query<{id:string;name:string;slug:string;image_url:string|null;price_idr:string;stock_qty:number;created_at:string}>(
    `SELECT p.id,p.name,p.slug,p.image_url,p.price_idr::text,p.stock_qty,f.created_at::text
     FROM public.customer_favorites f
     JOIN product.products p ON p.id=f.entity_id
     WHERE f.user_id=$1 AND f.entity_type='product' AND p.is_active=true
       AND p.archived_at IS NULL AND p.product_type<>'variation'
     ORDER BY f.created_at DESC LIMIT 100`,[user.id]),
   this.db.query<{id:string;name:string;slug:string;logo_url:string|null;description:string;created_at:string}>(
    `SELECT b.id,b.name,b.slug,b.logo_url,b.description,f.created_at::text
     FROM public.customer_favorites f
     JOIN product.brands b ON b.id=f.entity_id
     WHERE f.user_id=$1 AND f.entity_type='brand' AND b.is_active=true
     ORDER BY f.created_at DESC LIMIT 60`,[user.id])
  ]);
  return {productIds:products.rows.map(p=>p.id),brandIds:brands.rows.map(b=>b.id),
   products:products.rows,brands:brands.rows};
 }
 async set(user:Principal,raw:unknown){
  if(!user.emailVerified)throw new ForbiddenException('Verifikasi email untuk favorit akun');
  // One-time guest-to-account import, constrained by published catalog visibility.
  if(raw&&typeof raw==='object'&&!Array.isArray(raw)&&'ids' in raw){
   const b=raw as Record<string,unknown>;
   if(Object.keys(b).some(k=>!['type','ids'].includes(k)))throw new BadRequestException('Parameter impor tidak dikenal');
   if(b.type!=='product'&&b.type!=='brand')throw new BadRequestException('Jenis favorit tidak valid');
   if(!Array.isArray(b.ids)||b.ids.length>100||b.ids.some(x=>typeof x!=='string'||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x)))
    throw new BadRequestException('Daftar ID favorit tidak valid');
   const ids=[...new Set(b.ids as string[])];
   if(!ids.length)return {type:b.type,imported:0};
   const table=b.type==='product'?'product.products':'product.brands';
   const active=b.type==='product'?"AND x.archived_at IS NULL AND x.product_type<>'variation'":'';
   const cap=b.type==='product'?100:60;
   const result=await this.db.query(
    `INSERT INTO public.customer_favorites(user_id,entity_type,entity_id)
       SELECT $1,$2,x.id FROM ${table} x WHERE x.id=ANY($3::uuid[]) AND x.is_active=true ${active}
       ORDER BY x.id
       LIMIT GREATEST(0,$4-(SELECT count(*)::int FROM public.customer_favorites f WHERE f.user_id=$1 AND f.entity_type=$2))
       ON CONFLICT DO NOTHING`,
    [user.id,b.type,ids,cap]);
   return {type:b.type,imported:result.rowCount||0};
  }
  const {type,entityId,saved}=parseFavorite(raw);
  if(!saved){
   await this.db.query('DELETE FROM public.customer_favorites WHERE user_id=$1 AND entity_type=$2 AND entity_id=$3',[user.id,type,entityId]);
   return {type,entityId,saved:false};
  }
  const table=type==='product'?'product.products':'product.brands';
  const extra=type==='product'?"AND archived_at IS NULL AND product_type<>'variation'":'';
  const live=await this.db.query(`SELECT 1 FROM ${table} WHERE id=$1 AND is_active=true ${extra} LIMIT 1`,[entityId]);
  if(!live.rows.length)throw new NotFoundException('Produk atau brand belum tersedia');
  const count=await this.db.query<{n:number}>(
   'SELECT count(*)::int n FROM public.customer_favorites WHERE user_id=$1 AND entity_type=$2',[user.id,type]);
  if(Number(count.rows[0]?.n||0)>=(type==='product'?100:60)){
   const existing=await this.db.query('SELECT 1 FROM public.customer_favorites WHERE user_id=$1 AND entity_type=$2 AND entity_id=$3',[user.id,type,entityId]);
   if(!existing.rows.length)throw new BadRequestException('Daftar favorit sudah mencapai batas');
  }
  await this.db.query('INSERT INTO public.customer_favorites(user_id,entity_type,entity_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[user.id,type,entityId]);
  return {type,entityId,saved:true};
 }
}
