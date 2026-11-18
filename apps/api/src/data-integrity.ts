import {BadRequestException,ConflictException,ForbiddenException} from '@nestjs/common';
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
export function inventorySku(value:unknown):string|null {
 if(typeof value!=='string')return null;
 const code=value.trim();
 return !code||/^(?:test|tes|dummy|demo|sample)(?:[-_ /]?\d+)?$/i.test(code)?null:code;
}
function photoKey(value:unknown):string|null {
 if(typeof value!=='string'||!value.trim())return null;
 try {
  const url=new URL(value,'https://vapmart.id');
  const media=/^\/api\/media\/[0-9a-f-]{36}$/i.test(url.pathname);
  if(url.protocol!=='https:'||url.username||url.password||url.hash||(!value.startsWith('https://')&&!(value.startsWith('/api/media/')&&media)))return null;
  if(media&&['vapmart.id','www.vapmart.id'].includes(url.host))return url.pathname.toLowerCase();
  return url.href;
 }catch{return null;}
}
export function hasGallery(product:Record<string,unknown>):boolean {
 const images=[product.image_url,...(Array.isArray(product.gallery_urls)?product.gallery_urls:[])];
 return Boolean(photoKey(product.image_url))&&new Set(images.map(photoKey).filter(Boolean)).size>=3;
}
export function publicationMissing(p:Record<string,unknown>):string[]{
 const missing:string[]=[];
 if(!inventorySku(p.sku))missing.push('sku');
 if(typeof p.description!=='string'||!p.description.trim())missing.push('description');
 if(!photoKey(p.image_url))missing.push('image_url');
 if(p.product_type!=='variation'&&!hasGallery(p))missing.push('minimal 3 foto produk berbeda');
 if(!Number.isSafeInteger(Number(p.price_idr))||Number(p.price_idr)<=0)missing.push('price_idr');
 for(const k of ['weight_grams','length_cm','width_cm','height_cm'])if(typeof p[k]!=='number'||!(k==='weight_grams'?Number.isSafeInteger(p[k]):Number.isFinite(p[k]))||Number(p[k])<1||Number(p[k])>(k==='weight_grams'?1000000:1000))missing.push(k);
 return missing;
}
export function parsePage(raw:Record<string,unknown>={}){
 const allowed=['page','pageSize','q','category','brand','status'];
 if(Object.keys(raw).some(k=>!allowed.includes(k)))throw new BadRequestException('Unknown list filter');
 function number(k:string,n:number,max:number){const v=raw[k]===undefined?String(n):raw[k];
  if(typeof v!=='string'||!/^\d{1,6}$/.test(v)||Number(v)<1||Number(v)>max)throw new BadRequestException('Invalid '+k);return Number(v);}
 function text(k:string,max:number){const v=raw[k]??'';if(typeof v!=='string'||v.length>max)throw new BadRequestException('Invalid '+k);return v.trim();}
 return {page:number('page',1,100000),pageSize:number('pageSize',100,100),q:text('q',120),category:text('category',120),brand:text('brand',80),status:text('status',40)};
}
export function pageResult<T>(items:T[],total:number,page:number,pageSize:number){
 return {items,total,page,pageSize,pages:Math.ceil(total/pageSize),hasMore:page*pageSize<total};
}
