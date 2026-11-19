import test from 'node:test';
import assert from 'node:assert/strict';
import {createArchiveCatalogDraft,archiveEditorUrl} from '../apps/web/src/lib/archive-publish';
import {readFileSync} from 'node:fs';

const token='fixture-admin-session-token';
const productId='10000000-0000-4000-8000-000000000099';

test('Publish ke Katalog starts one authenticated, confirmed archive-to-draft request only',async()=>{
 const original=globalThis.fetch;
 const calls:{url:string;init:RequestInit|undefined}[]=[];
 try{
  globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
   calls.push({url:String(input),init});
   return new Response(JSON.stringify({created:true,productId,status:'draft'}),{status:201,headers:{'content-type':'application/json'}});
  }) as typeof fetch;
  const id=await createArchiveCatalogDraft(token,'archive-demo-product');
  assert.equal(id,productId);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'/api/admin/product-records/archive-demo-product/convert');
  assert.equal(calls[0].init?.method,'POST');
  assert.equal((calls[0].init?.headers as Record<string,string>).authorization,'Bearer '+token);
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)),{confirm:true});
  assert.ok(!calls[0].url.includes('/state'),'No publish request before reviewing the draft');
 }finally{globalThis.fetch=original;}
});
test('Existing conversion is idempotent: UI reuses the returned catalog ID',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=(async()=>new Response(JSON.stringify({created:false,productId,replayed:true}),{status:201})) as typeof fetch;
  assert.equal(await createArchiveCatalogDraft(token,'archive-demo-product'),productId);
  assert.equal(archiveEditorUrl(productId),'/admin/products/'+productId+'?from=archive');
  assert.equal(archiveEditorUrl('a/b'),'/admin/products/a%2Fb?from=archive');
 }finally{globalThis.fetch=original;}
});
test('Missing administrator session and server-side rejection block conversion',async()=>{
 await assert.rejects(()=>createArchiveCatalogDraft('','source'),/administrator/);
 const original=globalThis.fetch;
 try{
  globalThis.fetch=(async()=>new Response(JSON.stringify({message:'Forbidden'}),{status:403})) as typeof fetch;
  await assert.rejects(()=>createArchiveCatalogDraft(token,'archive-demo-product'),/Forbidden/);
 }finally{globalThis.fetch=original;}
});
test('Archive CTA and editor retain explicit review and server-side publish gate',()=>{
 const list=readFileSync('apps/web/src/components/admin-product-records.tsx','utf8');
 const page=readFileSync('apps/web/src/app/admin/products/arsip/page.tsx','utf8');
 const editor=readFileSync('apps/web/src/components/catalog-product-editor.tsx','utf8');
 const backend=readFileSync('apps/api/src/admin-product-records.ts','utf8');
 assert.match(list,/onClick=\{\(\)=>void publishArchive\(r\)\}/);
 assert.match(list,/Publish ke Katalog/);
 assert.match(list,/createArchiveCatalogDraft\(token,record\.slug\)/);
 assert.match(page,/<AdminProductRecords archiveMode/);
 assert.match(editor,/archivePublish.*Persiapan publish produk arsip/s);
 assert.match(editor,/minimal 3 foto berbeda/);
 assert.match(editor,/setError\('Tambahkan minimal 3 foto produk berbeda sebelum publikasi\.'\)/);
 assert.match(backend,/if\(saved\.product\.is_active\)throw/);
 assert.match(backend,/source_key,source_id,product_id/);
});
