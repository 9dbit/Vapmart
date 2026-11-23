import {BadRequestException} from '@nestjs/common';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {imageMime} from './media-library-seed';

export const HERO_MAX_BYTES=5*1024*1024;
export const WEBP_MIME_TYPE='image/webp';
export type HeroUpload={buffer:Buffer;originalname:string;mimetype:string;size:number};
export type WebpConversionOptions={maxOutputBytes?:number};

/** Name of the image actually served. Never label WebP bytes with .jpg or .png. */
export function webpFilename(original:string):string {
 const basename=(original.split(/[\\/]/).pop()||'image')
   .replace(/\.(?:jpe?g|png|webp)$/i,'')
   .normalize('NFKC')
   .replace(/[^\p{L}\p{N}._-]+/gu,'-')
   .replace(/^[.-]+|[.-]+$/g,'')
   .slice(0,154).replace(/[.-]+$/g,'');
 return (basename||'image')+'.webp';
}

/** Shared upload converter for hero banners, admin product media, and buyer review photos.
 * This is a security boundary: validate actual bytes, decode fully, auto-orient, strip
 * metadata, and ONLY persist the WebP derivative to public display content.
 * Original bytes may be kept privately for audit/provenance where a table supports it.
 */
export async function validateHeroImage(file:HeroUpload|undefined,options:WebpConversionOptions={}){
 if(!file||!Buffer.isBuffer(file.buffer)||file.buffer.length<16||file.buffer.length>HERO_MAX_BYTES)
  throw new BadRequestException('Pilih gambar PNG, JPG atau WebP maksimal 5 MiB.');
 const maxOutputBytes=options.maxOutputBytes??HERO_MAX_BYTES;
 if(!Number.isSafeInteger(maxOutputBytes)||maxOutputBytes<1024||maxOutputBytes>HERO_MAX_BYTES)
  throw new BadRequestException('Batas konversi WebP tidak valid.');
 try{
  const mime=imageMime(file.buffer);
  if(mime!==file.mimetype)throw Error('MIME mismatch');
  const input=sharp(file.buffer,{limitInputPixels:16777216,failOn:'warning'});
  const meta=await input.metadata();
  if(!['png','jpeg','webp'].includes(meta.format||'')||(meta.pages||1)!==1||!meta.width||!meta.height||
     meta.width<64||meta.height<64||meta.width>8192||meta.height>8192)throw Error('Invalid image geometry');

  // Bounded adaptation is only used for constrained product/review thumbnails.
  // Never crop: transparent PNG remains transparent and portrait EXIF is rotated.
  const attempts=maxOutputBytes>=HERO_MAX_BYTES
   ?[{size:2560,quality:88}]
   :[{size:2560,quality:88},{size:2048,quality:83},{size:1600,quality:78},{size:1280,quality:74}];
  let output:{data:Buffer;info:{format:string;width:number;height:number}}|undefined;
  for(const attempt of attempts){
   const encoded=await sharp(file.buffer,{limitInputPixels:16777216,failOn:'warning'})
    .rotate()
    .resize({width:attempt.size,height:attempt.size,fit:'inside',withoutEnlargement:true})
    .webp({quality:attempt.quality,effort:4})
    .toBuffer({resolveWithObject:true});
   if(encoded.info.format!=='webp')throw Error('WebP encoder output mismatch');
   if(encoded.data.length<=maxOutputBytes){output=encoded;break;}
  }
  if(!output)throw new BadRequestException('Hasil WebP masih terlalu besar. Kurangi resolusi foto.');
  const originalFilename=(file.originalname.split(/[\\/]/).pop()||'image').slice(0,160);
  return {
   filename:webpFilename(file.originalname),
   originalFilename,
   mime,
   displayMime:WEBP_MIME_TYPE,
   original:file.buffer,
   originalHash:createHash('sha256').update(file.buffer).digest('hex'),
   display:output.data,
   displayHash:createHash('sha256').update(output.data).digest('hex'),
   width:output.info.width,
   height:output.info.height
  };
 }catch(error){
  if(error instanceof BadRequestException)throw error;
  throw new BadRequestException('Gambar tidak valid. Gunakan PNG, JPG atau WebP statis, minimal 64 px, maksimal 8192 px dan 16 megapiksel.');
 }
}
