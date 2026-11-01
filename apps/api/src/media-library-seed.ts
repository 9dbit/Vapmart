import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {join,relative,resolve,sep,basename} from 'node:path';
import type {PoolClient} from 'pg';
export type MediaKind='banner'|'category_icon'|'brand_logo'|'product_image'|'article_image'|'site_logo';
export type PreservedAsset={originalPath:string;sourcePath:string|null;filename:string;kind:MediaKind;mimeType:string;content:Buffer;sha256:string;bytes:number};
export function classifyAsset(path:string):MediaKind{
 if(path.startsWith('branding/')||path==='legacy/vapmart-logo-white.webp')return 'site_logo';
 if(path.startsWith('legacy/banners/'))return 'banner';
 if(path.startsWith('legacy/brands/'))return 'brand_logo';
 if(path.startsWith('legacy/news/'))return 'article_image';
 if(/^legacy\/categories\/(brand|pod|mod|cartridge|liquid)\.png$/.test(path))return 'category_icon';
 return 'product_image';
}
export function imageMime(bytes:Buffer){
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
 throw new Error('Unsupported source image bytes');
}
export async function loadPreservedAssets(resources:string):Promise<PreservedAsset[]>{
 const root=resolve(resources,'media-source');
 const manifest=JSON.parse(await readFile(join(resources,'media-provenance.json'),'utf8')) as Array<{path:string;source:string;bytes:number;sha256:string}>;
 if(!Array.isArray(manifest)||manifest.length!==56)throw new Error('Original 56-file manifest missing');
 const indexed=new Map(manifest.map(m=>[m.path,m]));
 if(indexed.size!==manifest.length)throw new Error('Duplicate provenance entries');
 const found:PreservedAsset[]=[];
 async function scan(dir:string):Promise<void>{
  for(const entry of await readdir(dir,{withFileTypes:true})){
   const path=resolve(dir,entry.name);
   if(!path.startsWith(root+sep))throw new Error('Asset escaped resource root');
   if(entry.isSymbolicLink())throw new Error('Media bundle must not contain symlinks');
   if(entry.isDirectory()){await scan(path);continue;}
   if(!entry.isFile()||!/[.](png|jpe?g|webp)$/i.test(entry.name))throw new Error('Unreviewed file in media bundle');
   const rel=relative(root,path).split(sep).join('/'),originalPath='apps/web/public/'+rel;
   const content=await readFile(path),sha256=createHash('sha256').update(content).digest('hex');
   if(content.length<16||content.length>5242880)throw new Error('Original asset size exceeds limit');
   const known=indexed.get(originalPath);
   if(known&&(known.sha256!==sha256||known.bytes!==content.length))throw new Error('Original asset integrity mismatch: '+originalPath);
   if(!known&&!['branding/vapmart-logo.png','branding/vapmart-logo-dark.png','legacy/vapmart-logo-white.webp'].includes(rel))throw new Error('Unexpected unindexed visual asset');
   found.push({originalPath,sourcePath:known?.source||null,filename:basename(rel),kind:classifyAsset(rel),mimeType:imageMime(content),content,sha256,bytes:content.length});
  }
 }
 await scan(root);
 if(found.length!==59||manifest.some(m=>!found.some(a=>a.originalPath===m.path)))throw new Error('Media bundle incomplete: expected 59 images including 56 source records');
 return found.sort((a,b)=>a.originalPath.localeCompare(b.originalPath));
}
export async function seedMediaLibrary(client:PoolClient,resources:string){
 const assets=await loadPreservedAssets(resources);let inserted=0;
 for(const a of assets){
  const existing=await client.query<{sha256:string;size_bytes:number}>('SELECT sha256,size_bytes FROM content.media_library_assets WHERE original_path=$1',[a.originalPath]);
  if(existing.rows[0]){
   if(existing.rows[0].sha256!==a.sha256||existing.rows[0].size_bytes!==a.bytes)throw new Error('Preserved database asset differs from original; refusing overwrite');
   continue;
  }
  await client.query('INSERT INTO content.media_library_assets(original_path,source_path,filename,title,kind,mime_type,size_bytes,sha256,content) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
   [a.originalPath,a.sourcePath,a.filename,a.filename,a.kind,a.mimeType,a.bytes,a.sha256,a.content]);
  inserted++;
 }
 return {verifiedOriginals:assets.length,inserted,storedBytes:assets.reduce((n,a)=>n+a.bytes,0),visibility:'internal'};
}
