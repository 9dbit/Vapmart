import {BadRequestException,Injectable,NotFoundException} from '@nestjs/common';
import {DatabaseService} from './database';
import {validateHeroImage} from './hero-images';
import type {Principal} from './auth';
export const MAX_IMAGE_BYTES=1572864;
const uuid=/^[0-9a-f-]{36}$/i;
type MediaInput={filename:string;mimeType:string;base64:string};
export function parseImageUpload(raw:unknown):{filename:string;mimeType:string;content:Buffer}{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Upload tidak valid');
 const data=raw as Partial<MediaInput>;
 if(Object.keys(raw).some(k=>!['filename','mimeType','base64'].includes(k)))throw new BadRequestException('Kolom upload tidak dikenal');
 if(typeof data.filename!=='string'||data.filename.length>160||data.filename.trim().length<1||/[\\/\x00-\x1f]/.test(data.filename))
   throw new BadRequestException('Nama file tidak valid');
 if(typeof data.base64!=='string'||data.base64.length>2100000||!/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64))
   throw new BadRequestException('Data gambar tidak valid');
 const content=Buffer.from(data.base64,'base64');
 if(content.length<16||content.length>MAX_IMAGE_BYTES||content.toString('base64')!==data.base64)
   throw new BadRequestException('Ukuran atau encoding foto tidak valid (maksimal 1,5 MB)');
 const png=content.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpeg=content[0]===255&&content[1]===216&&content[2]===255;
 const webp=content.toString('ascii',0,4)==='RIFF'&&content.toString('ascii',8,12)==='WEBP';
 const mimeType=png?'image/png':jpeg?'image/jpeg':webp?'image/webp':null;
 if(!mimeType||mimeType!==data.mimeType)throw new BadRequestException('Hanya JPEG, PNG, dan WebP asli yang diterima');
 return {filename:data.filename.trim(),mimeType,content};
}
@Injectable()
export class MediaService{
 constructor(private readonly db:DatabaseService){}
 async upload(user:Principal,input:unknown){
  const parsed=parseImageUpload(input);
  const image=await validateHeroImage({buffer:parsed.content,originalname:parsed.filename,mimetype:parsed.mimeType,size:parsed.content.length});
  if(image.display.length>MAX_IMAGE_BYTES)throw new BadRequestException('Gambar terlalu besar setelah optimasi; kurangi dimensi atau ukuran file');
  return this.db.transaction(async client=>{
   await client.query('SELECT pg_advisory_xact_lock(2026110309)');
   const quota=(await client.query("SELECT count(*) FILTER(WHERE uploaded_by=$1 AND created_at>now()-interval '1 hour')::int recent,coalesce(sum(size_bytes+coalesce(octet_length(original_content),0)),0)::text bytes FROM product.media_assets",[user.id])).rows[0];
   if(quota.recent>=60||Number(quota.bytes)+image.original.length+image.display.length>536870912)throw new BadRequestException('Batas upload tercapai. Maksimal 60 file per jam dan 512 MiB penyimpanan produk.');
   const r=await client.query<{id:string}>(
    'INSERT INTO product.media_assets(uploaded_by,filename,mime_type,size_bytes,content,original_content,original_mime_type) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [user.id,parsed.filename,'image/webp',image.display.length,image.display,image.original,image.mime]);
   return {id:r.rows[0].id,mimeType:'image/webp',sizeBytes:image.display.length};
  });
 }
 async get(id:string){
  if(!uuid.test(id))throw new BadRequestException('ID foto tidak valid');
  const r=await this.db.query<{mime_type:string;content:Buffer}>(
   'SELECT mime_type,content FROM product.media_assets WHERE id=$1',[id]);
  if(!r.rows[0])throw new NotFoundException('Foto tidak ditemukan');
  return r.rows[0];
 }
}
