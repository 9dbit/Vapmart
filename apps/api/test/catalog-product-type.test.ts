import test from 'node:test';
import assert from 'node:assert/strict';
import {assertProductTypeChange} from '../src/catalog-product-type';

const draft={id:'11111111-2222-4333-8444-000000000004',product_type:'simple',is_active:false,stock_qty:0};
const clear={has_stock:false,has_variants:false,has_orders:false};
const reader=(state:Record<string,boolean>)=>({query:async()=>({rows:[state]})});

test('new products and unchanged types do not impose conversion restrictions',async()=>{
 const q={query:async()=>{throw Error('No conversion query expected');}};
 await assertProductTypeChange(q,null,'variable');
 await assertProductTypeChange(q,{...draft,is_active:true,stock_qty:42},'simple');
});
test('empty unpublished draft type can change in either direction',async()=>{
 await assertProductTypeChange(reader(clear),draft,'variable');
 await assertProductTypeChange(reader(clear),{...draft,product_type:'variable'},'simple');
});
test('type conversion protects live listings, all warehouse balances, historical orders and saved variant IDs',async()=>{
 await assert.rejects(()=>assertProductTypeChange(reader(clear),{...draft,is_active:true},'variable'),/Nonaktifkan/);
 await assert.rejects(()=>assertProductTypeChange(reader({...clear,has_stock:true}),draft,'variable'),/stok atau reservasi/);
 await assert.rejects(()=>assertProductTypeChange(reader(clear),{...draft,stock_qty:2},'variable'),/stok atau reservasi/);
 await assert.rejects(()=>assertProductTypeChange(reader({...clear,has_orders:true}),draft,'variable'),/riwayat pesanan/);
 await assert.rejects(()=>assertProductTypeChange(reader({...clear,has_variants:true}),{...draft,product_type:'variable'},'simple'),/SKU varian tersimpan/);
});
test('conversion fails closed when inventory status cannot be read',async()=>{
 await assert.rejects(()=>assertProductTypeChange({query:async()=>({rows:[]})},draft,'variable'),/Status produk belum/);
});
