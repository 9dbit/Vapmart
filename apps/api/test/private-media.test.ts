import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {loadPreservedAssets,classifyAsset,imageMime} from '../src/media-library-seed';
import {parseMediaNotes} from '../src/media-library';
test('all 59 original raster assets load with 56 source checksums plus 3 site logos',async()=>{
 const assets=await loadPreservedAssets(join(process.cwd(),'resources'));
 assert.equal(assets.length,59);assert.equal(assets.reduce((n,a)=>n+a.bytes,0),4534238);
 const counts=Object.fromEntries(['banner','category_icon','brand_logo','product_image','article_image','site_logo'].map(k=>[k,assets.filter(a=>a.kind===k).length]));
 assert.deepEqual(counts,{banner:7,category_icon:5,brand_logo:13,product_image:21,article_image:10,site_logo:3});
 assert.ok(assets.every(a=>a.sha256.length===64));
});
test('private metadata API cannot change public state or original files',()=>{
 assert.deepEqual(parseMediaNotes({title:'Internal name',notes:'Verified original'}),{title:'Internal name',notes:'Verified original'});
 for(const raw of [{publish:true},{visibility:'public'},{content:'replace'},{notes:'x'.repeat(1001)},{title:''},{}])assert.throws(()=>parseMediaNotes(raw));
});
test('classification distinguishes category icons from product photos; rejects executable content',()=>{
 assert.equal(classifyAsset('legacy/categories/pod.png'),'category_icon');
 assert.equal(classifyAsset('legacy/categories/pod-06.jpeg'),'product_image');
 assert.equal(classifyAsset('branding/vapmart-logo.png'),'site_logo');
 assert.throws(()=>imageMime(Buffer.from('<script>alert(1)</script>')));
});
