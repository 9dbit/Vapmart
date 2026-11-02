import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWarehouse,parseWarehousePatch,parseWarehouseMovement,parseWarehouseTransfer} from '../src/warehouses';
const w='25f397b8-564f-46f4-971e-bc1d333ac1d0',p='137e4cd0-d66f-4fc7-a739-06e59513a3e8',key='97544bf9-7b9e-46ac-8cc5-d6f1aa747df8';
test('warehouse creation requires real code and optional valid postcode, never auto dispatch',()=>{
 assert.deepEqual(parseWarehouse({code:'bdg-01',name:'Bandung Stock',address:'Jalan Bandung Raya 5',city:'Bandung',province:'Jawa Barat',postalCode:'40115'}).code,'BDG-01');
 assert.throws(()=>parseWarehouse({code:'?',name:'A'}));
 assert.throws(()=>parseWarehouse({code:'WH-1',name:'Bandung',postalCode:'123'}));
 assert.deepEqual(parseWarehousePatch({dispatchEnabled:false}),{dispatchEnabled:false});
 assert.throws(()=>parseWarehousePatch({dispatchEnabled:'true'}));
});
test('stock movements reject injection, invalid balance direction, missing audit note',()=>{
 const good={warehouseId:w,productId:p,delta:4,reason:'receipt',notes:'Receiving verified invoice #42',idempotencyKey:key};
 assert.equal(parseWarehouseMovement(good).delta,4);
 for(const wrong of [{...good,delta:0},{...good,reason:'reserve'},{...good,reason:'receipt',delta:-5},
 {...good,notes:'x'},{...good,available:9999}])assert.throws(()=>parseWarehouseMovement(wrong));
});
test('warehouse transfer rejects same warehouse, negative quantities and unknown flags',()=>{
 const good={fromWarehouseId:w,toWarehouseId:p,productId:p,quantity:3,notes:'Verified transfer receipt',idempotencyKey:key};
 assert.equal(parseWarehouseTransfer(good).quantity,3);
 assert.throws(()=>parseWarehouseTransfer({...good,toWarehouseId:w}));
 assert.throws(()=>parseWarehouseTransfer({...good,quantity:-1}));
 assert.throws(()=>parseWarehouseTransfer({...good,actorId:w}));
});
