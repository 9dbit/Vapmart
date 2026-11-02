import {BadRequestException,ConflictException,Injectable,NotFoundException} from '@nestjs/common';
import {DatabaseService} from './database';
import type {Principal} from './auth';
import {requireActor,parseEdit,assertVersion,recordAudit} from './data-integrity';
const uuid=/^[0-9a-f-]{36}$/i;
const restricted=/\b(nicotine|nikotin|vape|vaping|rokok|tobacco|e-cig(?:arette)?|e-liquid)\b/i;
export interface Brand {id:string;edit_version:number;slug:string;name:string;description:string;logo_url:string|null;is_active:boolean;}
function parseBrand(raw:unknown,partial:boolean):Record<string,unknown>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Brand harus berupa objek');
 const body=raw as Record<string,unknown>;
 const allowed=['slug','name','description','logo_url','is_active'];
 if(Object.keys(body).some(k=>!allowed.includes(k)))throw new BadRequestException('Kolom brand tidak dikenali');
 if(!partial&&(!('name'in body)||!('slug'in body)))throw new BadRequestException('Nama dan slug brand wajib diisi');
 const out:Record<string,unknown>={};
 if('name'in body){
  if(typeof body.name!=='string'||body.name.trim().length<2||body.name.length>100)throw new BadRequestException('Nama brand tidak valid');
  out.name=body.name.trim();
 }
 if('slug'in body){
  if(typeof body.slug!=='string'||body.slug.length>120||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug))throw new BadRequestException('Slug brand tidak valid');
  out.slug=body.slug;
 }
 if('description'in body){
  if(typeof body.description!=='string'||body.description.length>1200)throw new BadRequestException('Deskripsi brand terlalu panjang');
  out.description=body.description;
 }
 if('logo_url'in body){
  if(body.logo_url!==null&&(typeof body.logo_url!=='string'||body.logo_url.length>600||!/^https:\/\//.test(body.logo_url)))
    throw new BadRequestException('Logo brand harus URL HTTPS');
  out.logo_url=body.logo_url;
 }
 if('is_active'in body){
  if(typeof body.is_active!=='boolean')throw new BadRequestException('Status brand tidak valid');
  out.is_active=body.is_active;
 }
 if([out.name,out.slug,out.description].some(value=>restricted.test(String(value||''))))
  throw new BadRequestException('Brand produk terbatas tidak didukung');
 if(!partial)out.description??='';
 return out;
}
@Injectable()
export class BrandsService {
 constructor(private readonly db:DatabaseService){}
 async publicList(){const r=await this.db.query<Brand>('SELECT id,slug,name,description,logo_url,is_active,edit_version FROM product.brands WHERE is_active=true ORDER BY name');return {items:r.rows};}
 async list(){const r=await this.db.query<Brand>('SELECT id,slug,name,description,logo_url,is_active,edit_version FROM product.brands ORDER BY name');return {items:r.rows};}
 async create(input:unknown,actor?:Principal){
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
