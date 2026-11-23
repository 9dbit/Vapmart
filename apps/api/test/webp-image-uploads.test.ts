import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {webpFilename,validateHeroImage,WEBP_MIME_TYPE} from '../src/hero-images';
import {parseImageUpload,MAX_IMAGE_BYTES} from '../src/media';

const asset=async(format:'png'|'jpeg'|'webp',alpha=false)=>{
 const base=sharp({create:{width:320,height:240,channels:alpha?4:3,background:alpha?'#ae41ca99':'#ae41ca'}});
 return format==='png'?base.png().toBuffer():format==='jpeg'?base.jpeg().toBuffer():base.webp().toBuffer();
};

test('all supported uploads become correctly named WebP; private input remains byte-identical',async()=>{
 for(const [format,mime,ext] of [['png','image/png','PNG'],['jpeg','image/jpeg','JpG'],['webp','image/webp','webp']] as const){
  const bytes=await asset(format);
  const name='Photo Upload.'+ext;
  const output=await validateHeroImage({buffer:bytes,originalname:name,mimetype:mime,size:bytes.length},{maxOutputBytes:MAX_IMAGE_BYTES});
  assert.equal(output.filename,'Photo-Upload.webp');
  assert.equal(output.displayMime,WEBP_MIME_TYPE);
  assert.equal(output.mime,mime);
  assert.deepEqual(output.original,bytes);
  assert.equal((await sharp(output.display).metadata()).format,'webp');
  assert.ok(output.display.length<=MAX_IMAGE_BYTES);
  assert.equal(output.width,320);
  assert.equal(output.height,240);
 }
});

test('PNG transparency survives conversion while stripping metadata',async()=>{
 const input=await asset('png',true);
 const output=await validateHeroImage({buffer:input,originalname:'alpha.png',mimetype:'image/png',size:input.length},{maxOutputBytes:MAX_IMAGE_BYTES});
 const metadata=await sharp(output.display).metadata();
 assert.equal(metadata.format,'webp');
 assert.equal(metadata.hasAlpha,true);
});

test('filename, spoofed image, animation and unsupported file guards',async()=>{
 assert.equal(webpFilename('../../Weird Upload.JPG'),'Weird-Upload.webp');
 assert.equal(webpFilename('logo.webp'),'logo.webp');
 assert.equal(webpFilename('x.svg'),'x.svg.webp');
 const png=await asset('png');
 await assert.rejects(()=>validateHeroImage({buffer:png,originalname:'spoof.webp',mimetype:'image/webp',size:png.length}));
 await assert.rejects(()=>validateHeroImage({buffer:png,originalname:'x.png',mimetype:'image/png',size:png.length},{maxOutputBytes:100}));
 assert.throws(()=>parseImageUpload({filename:'script.svg',mimeType:'image/svg+xml',base64:Buffer.from('<svg><script/></svg>').toString('base64')}));
 const gif=Buffer.from('GIF89a'+''.padEnd(32,'\0'),'binary');
 await assert.rejects(()=>validateHeroImage({buffer:gif,originalname:'animation.gif',mimetype:'image/gif',size:gif.length}));
});
