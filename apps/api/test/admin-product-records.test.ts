import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRecordQuery,productRecordsSql,AdminProductRecordsController} from '../src/admin-product-records';
import {AdminGuard} from '../src/auth';
test('product record filters are bounded and reject arrays and hidden publication inputs',()=>{
 assert.deepEqual(parseRecordQuery(),{q:'',source:'all',status:'all',brand:'',category:'',page:1,pageSize:24});
 for(const input of [{page:'0'},{page:'-1'},{pageSize:'101'},{q:['x']},{publish:'true'},{source:'sale'},{q:'x'.repeat(121)}])assert.throws(()=>parseRecordQuery(input));
 assert.equal(parseRecordQuery({q:'100% _ exact'}).q,'100% _ exact');
 assert.equal(parseRecordQuery({page:'2',pageSize:'7',source:'existing'}).pageSize,7);
});
test('record projection is read-only and guarded',()=>{
 assert.equal(/\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP)\b/i.test(productRecordsSql),false);
 assert.ok(productRecordsSql.includes("'apps/web/public'||a.image_path"));
 assert.ok(productRecordsSql.includes("'demo-%'"));
 assert.ok((Reflect.getMetadata('__guards__',AdminProductRecordsController)||[]).includes(AdminGuard));
});
