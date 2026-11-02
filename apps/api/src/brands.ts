import {BadRequestException,ConflictException,Injectable,NotFoundException} from '@nestjs/common';
import {DatabaseService} from './database';
const uuid=/^[0-9a-f-]{36}$/i;
const restricted=/\b(nicotine|nikotin|vape|vaping|rokok|tobacco|e-cig(?:arette)?|e-liquid)\b/i;
export interface Brand {id:string;slug:string;name:string;description:string;logo_url:string|null;is_active:boolean;}
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
 async publicList(){const r=await this.db.query<Brand>('SELECT id,slug,name,description,logo_url,is_active FROM product.brands WHERE is_active=true ORDER BY name');return {items:r.rows};}
 async list(){const r=await this.db.query<Brand>('SELECT id,slug,name,description,logo_url,is_active FROM product.brands ORDER BY name');return {items:r.rows};}
 async create(input:unknown){
  const fields=parseBrand(input,false),keys=Object.keys(fields);
  try{const r=await this.db.query<Brand>(
    `INSERT INTO product.brands(${keys.join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING id,slug,name,description,logo_url,is_active`,
    keys.map(k=>fields[k]));return r.rows[0];}
  catch(error){if((error as {code?:string}).code==='23505')throw new ConflictException('Nama atau slug brand sudah dipakai');throw error;}
 }
 async update(id:string,input:unknown){
  if(!uuid.test(id))throw new BadRequestException('ID brand tidak valid');
  const fields=parseBrand(input,true),keys=Object.keys(fields);
  if(!keys.length)throw new BadRequestException('Tidak ada perubahan');
  try{const r=await this.db.query<Brand>(
    `UPDATE product.brands SET ${keys.map((k,i)=>k+'=$'+(i+1)).join(',')},updated_at=now() WHERE id=$${keys.length+1} RETURNING id,slug,name,description,logo_url,is_active`,
    [...keys.map(k=>fields[k]),id]);
    if(!r.rows[0])throw new NotFoundException('Brand tidak ditemukan');return r.rows[0];
  }catch(error){if((error as {code?:string}).code==='23505')throw new ConflictException('Nama atau slug brand sudah dipakai');throw error;}
 }
}
