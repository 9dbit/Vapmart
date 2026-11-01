import assert from 'node:assert/strict';
import test from 'node:test';
import {parseStockAdjustment} from '../src/inventory';
const id='25f397b8-564f-46f4-971e-bc1d333ac1d0';
const key='97544bf9-7b9e-46ac-8cc5-d6f1aa747df8';
const good={productId:id,delta:-3,reason:'adjustment',notes:'Perhitungan fisik dan audit ulang',idempotencyKey:key};
test('stock adjustment requires documented movement and idempotency',()=>{
 assert.deepEqual(parseStockAdjustment(good),good);
 for(const b of [{...good,delta:0},{...good,delta:-100001},{...good,reason:'paid'},{...good,stockAfter:99999},
  {...good,notes:'ok'},{...good,idempotencyKey:'not-uuid'}])assert.throws(()=>parseStockAdjustment(b));
 assert.throws(()=>parseStockAdjustment({...good,reason:'stock_receipt',delta:-1}));
});
