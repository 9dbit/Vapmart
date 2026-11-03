import {BadRequestException} from '@nestjs/common';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {imageMime} from './media-library-seed';
export const HERO_MAX_BYTES=5*1024*1024;
export type HeroUpload={buffer:Buffer;originalname:string;mimetype:string;size:number};
export async function validateHeroImage(file:HeroUpload|undefined){
 if(!file||!Buffer.isBuffer(file.buffer)||file.buffer.length<16||file.buffer.length>HERO_MAX_BYTES)
  throw new BadRequestException('Pilih gambar PNG, JPG atau WebP maksimal 5 MiB.');
 try{
  const mime=imageMime(file.buffer);
  if(mime!==file.mimetype)throw Error('MIME mismatch');
  const input=sharp(file.buffer,{limitInputPixels:16777216,failOn:'warning'});
  const meta=await input.metadata();
  if(!['png','jpeg','webp'].includes(meta.format||'')||(meta.pages||1)!==1||!meta.width||!meta.height||
    meta.width<64||meta.height<64||meta.width>8192||meta.height>8192)throw Error('Invalid image geometry');
  // Decode fully, apply orientation and strip metadata. Never serve uploaded original bytes publicly.
  const output=await input.rotate().resize({width:2560,height:2560,fit:'inside',withoutEnlargement:true})
    .webp({quality:88}).toBuffer({resolveWithObject:true});
  if(output.data.length>HERO_MAX_BYTES)throw Error('Encoded image too large');
  const filename=(file.originalname.split(/[\\/]/).pop()||'banner').replace(/[\x00-\x1f\x7f]/g,'').slice(0,160)||'banner';
  return {filename,mime,original:file.buffer,originalHash:createHash('sha256').update(file.buffer).digest('hex'),
   display:output.data,displayHash:createHash('sha256').update(output.data).digest('hex'),width:output.info.width,height:output.info.height};
 }catch{throw new BadRequestException('Gambar tidak valid. Gunakan PNG, JPG atau WebP statis, minimal 64 px, maksimal 8192 px dan 16 megapiksel.');}
}
