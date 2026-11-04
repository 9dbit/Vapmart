import {BadRequestException,ConflictException,Injectable,NotFoundException} from '@nestjs/common';
import type {PoolClient} from 'pg';
import {DatabaseService} from './database';
import type {Principal} from './auth';
import {assertVersion,parsePage,pageResult,requireActor} from './data-integrity';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type VoucherShape={
 code:string;discount_type:'fixed'|'percent';discount_value:number;max_discount_idr:number|null;
 min_subtotal_idr:number;usage_limit:number|null;starts_at:string|null;ends_at:string|null;is_active:boolean;
};
function object(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Data voucher tidak valid');
 return raw as Record<string,unknown>;
}
function integer(raw:unknown,label:string,min:number,max:number){
 const n=typeof raw==='string'&&raw.trim()!==''?Number(raw):raw;
 if(!Number.isSafeInteger(n)||Number(n)<min||Number(n)>max)throw new BadRequestException(label+' tidak valid');
 return Number(n);
}
function nullableInteger(raw:unknown,label:string,min:number,max:number){
 if(raw===null||raw===undefined||raw==='')return null;
 return integer(raw,label,min,max);
}
function voucherCode(raw:unknown){
 if(typeof raw!=='string')throw new BadRequestException('Kode voucher wajib diisi');
 const value=raw.trim().toUpperCase();
 if(!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(value))throw new BadRequestException('Kode voucher 3-32 karakter: huruf besar, angka, _ atau -');
 return value;
}
function date(raw:unknown,label:string){
 if(raw===null||raw===undefined||raw==='')return null;
 if(typeof raw!=='string')throw new BadRequestException(label+' tidak valid');
 const d=new Date(raw);if(Number.isNaN(d.valueOf()))throw new BadRequestException(label+' tidak valid');
 return d.toISOString();
}
function bool(raw:unknown,label:string){
 if(typeof raw!=='boolean')throw new BadRequestException(label+' tidak valid');
 return raw;
}
function shape(raw:Record<string,unknown>,base?:VoucherShape):VoucherShape{
 const discountType=(raw.discountType??base?.discount_type) as unknown;
 if(discountType!=='fixed'&&discountType!=='percent')throw new BadRequestException('Tipe diskon harus fixed atau percent');
 const discountValue=integer(raw.discountValue??base?.discount_value,'Nilai diskon',1,discountType==='percent'?100:2_000_000_000);
 const maxDiscount=discountType==='percent'?nullableInteger(raw.maxDiscountIdr===undefined?base?.max_discount_idr:raw.maxDiscountIdr,'Maksimum diskon',1,2_000_000_000):null;
 const minSubtotal=integer(raw.minSubtotalIdr??base?.min_subtotal_idr??0,'Minimum belanja',0,2_000_000_000);
 const usageLimit=nullableInteger(raw.usageLimit===undefined?base?.usage_limit:raw.usageLimit,'Kuota penggunaan',1,10_000_000);
 const startsAt=date(raw.startsAt===undefined?base?.starts_at:raw.startsAt,'Mulai berlaku');
 const endsAt=date(raw.endsAt===undefined?base?.ends_at:raw.endsAt,'Berakhir');
 if(startsAt&&endsAt&&Date.parse(startsAt)>=Date.parse(endsAt))throw new BadRequestException('Waktu mulai harus lebih awal dari waktu berakhir');
 return {
  code:voucherCode(raw.code??base?.code),discount_type:discountType,discount_value:discountValue,max_discount_idr:maxDiscount,
  min_subtotal_idr:minSubtotal,usage_limit:usageLimit,starts_at:startsAt,ends_at:endsAt,
  is_active:raw.isActive===undefined?(base?.is_active??true):bool(raw.isActive,'Status voucher')
 };
}
async function audit(client:PoolClient,actor:string,id:string,action:string,before:any,after:any){
 await client.query(
  'INSERT INTO product.catalog_audit(actor_id,entity_type,entity_id,action,before_data,after_data) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',
  [actor,'voucher',id,action,before?JSON.stringify(before):null,JSON.stringify(after)]
 );
}
function publicRow(row:any){
 return {
  id:row.id,code:row.code,discountType:row.discount_type,discountValue:Number(row.discount_value),
  maxDiscountIdr:row.max_discount_idr===null?null:Number(row.max_discount_idr),
  minSubtotalIdr:Number(row.min_subtotal_idr),usageLimit:row.usage_limit===null?null:Number(row.usage_limit),
  startsAt:row.starts_at,endsAt:row.ends_at,isActive:Boolean(row.is_active),editVersion:Number(row.edit_version),
  usedPaid:Number(row.used_paid||0),pendingOrders:Number(row.pending_orders||0),lifecycle:row.lifecycle,
  createdAt:row.created_at,updatedAt:row.updated_at
 };
}
@Injectable()
export class VoucherAdminService{
 constructor(private readonly db:DatabaseService){}
 async list(raw:Record<string,unknown>={}){
  const f=parsePage(raw);if(f.status&&!['active','inactive','scheduled','expired'].includes(f.status))throw new BadRequestException('Status voucher tidak valid');
  const lifecycle="CASE WHEN NOT v.is_active THEN 'inactive' WHEN v.starts_at IS NOT NULL AND v.starts_at>now() THEN 'scheduled' WHEN v.ends_at IS NOT NULL AND v.ends_at<=now() THEN 'expired' ELSE 'active' END";
  const sql='WITH base AS ('+
   ' SELECT v.*,'+
   " (SELECT count(*)::int FROM product.orders o WHERE o.voucher_id=v.id AND o.payment_status='paid') AS used_paid,"+
   " (SELECT count(*)::int FROM product.orders o WHERE o.voucher_id=v.id AND o.payment_status='pending') AS pending_orders,"+
   ' '+lifecycle+' AS lifecycle'+
   " FROM product.vouchers v WHERE ($1::text='' OR strpos(lower(v.code),lower($1))>0)"+
   '), filtered AS (SELECT * FROM base WHERE ($2::text=\'\' OR lifecycle=$2)),'+
   ' selected AS (SELECT * FROM filtered ORDER BY updated_at DESC,id DESC LIMIT $3 OFFSET $4)'+
   " SELECT coalesce(jsonb_agg(to_jsonb(selected) ORDER BY updated_at DESC,id DESC),'[]'::jsonb) AS items,"+
   ' (SELECT count(*)::int FROM filtered) AS total FROM selected';
  const r=await this.db.query(sql,[f.q,f.status,f.pageSize,(f.page-1)*f.pageSize]);
  const items=(r.rows[0]?.items||[]).map(publicRow);return pageResult(items,Number(r.rows[0]?.total||0),f.page,f.pageSize);
 }
 async detail(id:string){
  if(!uuid.test(id))throw new BadRequestException('ID voucher tidak valid');
  const sql='SELECT v.*,'+
   " (SELECT count(*)::int FROM product.orders o WHERE o.voucher_id=v.id AND o.payment_status='paid') AS used_paid,"+
   " (SELECT count(*)::int FROM product.orders o WHERE o.voucher_id=v.id AND o.payment_status='pending') AS pending_orders,"+
   " CASE WHEN NOT v.is_active THEN 'inactive' WHEN v.starts_at IS NOT NULL AND v.starts_at>now() THEN 'scheduled'"+
   " WHEN v.ends_at IS NOT NULL AND v.ends_at<=now() THEN 'expired' ELSE 'active' END AS lifecycle"+
   ' FROM product.vouchers v WHERE v.id=$1';
  const r=await this.db.query(sql,[id]);
  if(!r.rows[0])throw new NotFoundException('Voucher tidak ditemukan');return publicRow(r.rows[0]);
 }
 async create(actor:Principal,raw:unknown){
  const operator=requireActor(actor),data=object(raw);
  const allowed=['code','discountType','discountValue','maxDiscountIdr','minSubtotalIdr','usageLimit','startsAt','endsAt','isActive'];
  if(Object.keys(data).some(k=>!allowed.includes(k)))throw new BadRequestException('Kolom voucher tidak dikenali');
  const v=shape(data);
  try{return await this.db.transaction(async client=>{
   const r=await client.query('INSERT INTO product.vouchers '+
    '(code,discount_type,discount_value,max_discount_idr,min_subtotal_idr,usage_limit,starts_at,ends_at,is_active,created_by,updated_by) '+
    'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *',
    [v.code,v.discount_type,v.discount_value,v.max_discount_idr,v.min_subtotal_idr,v.usage_limit,v.starts_at,v.ends_at,v.is_active,operator]);
   const row=r.rows[0];await audit(client,operator,row.id,'create',null,row);return this.detail(row.id);
  });}catch(e:any){if(e?.code==='23505')throw new ConflictException('Kode voucher sudah digunakan');throw e;}
 }
 async update(actor:Principal,id:string,raw:unknown){
  if(!uuid.test(id))throw new BadRequestException('ID voucher tidak valid');
  const operator=requireActor(actor),data=object(raw);
  const allowed=['expectedVersion','code','discountType','discountValue','maxDiscountIdr','minSubtotalIdr','usageLimit','startsAt','endsAt','isActive'];
  if(Object.keys(data).some(k=>!allowed.includes(k)))throw new BadRequestException('Kolom voucher tidak dikenali');
  const expected=integer(data.expectedVersion,'Versi voucher',1,2_000_000_000);
  try{return await this.db.transaction(async client=>{
   const current=await client.query('SELECT * FROM product.vouchers WHERE id=$1 FOR UPDATE',[id]);const before=current.rows[0];
   if(!before)throw new NotFoundException('Voucher tidak ditemukan');assertVersion(Number(before.edit_version),expected);
   const v=shape(data,{
    code:before.code,discount_type:before.discount_type,discount_value:Number(before.discount_value),
    max_discount_idr:before.max_discount_idr===null?null:Number(before.max_discount_idr),min_subtotal_idr:Number(before.min_subtotal_idr),
    usage_limit:before.usage_limit===null?null:Number(before.usage_limit),starts_at:before.starts_at,ends_at:before.ends_at,is_active:before.is_active
   });
   const r=await client.query('UPDATE product.vouchers SET code=$2,discount_type=$3,discount_value=$4,max_discount_idr=$5,'+
    ' min_subtotal_idr=$6,usage_limit=$7,starts_at=$8,ends_at=$9,is_active=$10,updated_by=$11,updated_at=now(),edit_version=edit_version+1'+
    ' WHERE id=$1 RETURNING *',
    [id,v.code,v.discount_type,v.discount_value,v.max_discount_idr,v.min_subtotal_idr,v.usage_limit,v.starts_at,v.ends_at,v.is_active,operator]);
   const after=r.rows[0];const action=before.is_active!==after.is_active?(after.is_active?'activate':'deactivate'):'update';
   await audit(client,operator,id,action,before,after);
   return this.detail(id);
  });}catch(e:any){if(e?.code==='23505')throw new ConflictException('Kode voucher sudah digunakan');throw e;}
 }
}
