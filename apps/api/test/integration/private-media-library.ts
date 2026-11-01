import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {join} from 'node:path';
import {DatabaseService} from '../../src/database';
import {MediaLibraryService} from '../../src/media-library';
import {seedMediaLibrary} from '../../src/media-library-seed';
test('private preservation copies 59 byte-identical files once and logs metadata-only edits',async()=>{
 if(!process.env.DATABASE_URL?.includes('127.0.0.1'))throw Error('Only disposable localhost database allowed');
 const db=new DatabaseService(),service=new MediaLibraryService(db);
 try{
  const result=await db.transaction(c=>seedMediaLibrary(c,join(process.cwd(),'resources')));
  assert.equal(result.verifiedOriginals,59);assert.equal(result.inserted,0);
  const list=await service.list();assert.equal(list.total,59);assert.equal(list.publicationEnabled,false);
  assert.ok(list.items.every(a=>a.visibility==='internal'&&!('content' in a)));
  for(const item of list.items){const got=await service.bytes(item.id);assert.equal(got.content.length,item.size_bytes);assert.equal(createHash('sha256').update(got.content).digest('hex'),item.sha256);}
  const a=list.items[0];const actor={id:randomUUID(),email:'internal-fixture@example.invalid',emailVerified:true};
  await service.update(actor,a.id,{notes:'QA metadata preservation test'});
  assert.equal((await service.bytes(a.id)).sha256,a.sha256);
  await assert.rejects(()=>service.update(actor,a.id,{visibility:'public'}));
  const audit=await db.query<{n:number}>('SELECT count(*)::integer n FROM content.media_library_audit WHERE asset_id=$1',[a.id]);assert.equal(audit.rows[0].n,1);
  const again=await db.transaction(c=>seedMediaLibrary(c,join(process.cwd(),'resources')));assert.equal(again.inserted,0);
  assert.equal((await service.list()).items.find(x=>x.id===a.id)?.notes,'QA metadata preservation test');
  const table=await db.query<{n:number}>('SELECT count(*)::integer n FROM product.products');assert.equal(table.rows[0].n,0,'Media import must not seed sellable products');
 }finally{await db.onModuleDestroy();}
});
