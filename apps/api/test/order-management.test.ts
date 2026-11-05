import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,MAX_CSV_BYTES} from '../src/catalog-csv';
import {editBinding,editBlocker,parseOrderEdit,statusOptions,validateTransition} from '../src/order-policy';
import {fulfillmentOrderEligible,paidOrderVerified} from '../src/fulfillment';
const input=()=>({expectedVersion:1,notes:'Koreksi permintaan pelanggan',contact:{name:'Pelanggan',phone:'081234567890',address:'Jalan Contoh Nomor 123',city:'Jakarta',province:'DKI Jakarta',postalCode:'10150',areaId:'3171011002'},items:[{productId:'31363533-15eb-42a0-8bc0-c9f8addc715a',quantity:2,unitPriceIdr:10000}],fees:[{label:'Kemasan',amountIdr:1000}],voucherCode:''});
test('CSV keeps inch marks and correctly parses semicolons, BOM, escaped quotes and multiline descriptions',()=>{
 const p=parseCSV('\uFEFFID;Name;Description\r\n1;Speaker 15";"Baris satu\nBaris dua; detail ""rapi"""\r\n');
 assert.equal(p.delimiter,';');assert.equal(p.rows[0].Name,'Speaker 15"');assert.equal(p.rows[0].Description,'Baris satu\nBaris dua; detail "rapi"');assert.equal(p.warnings.length,1);assert.equal(p.warnings[0].row,2);
 assert.equal(parseCSV('sep=;\nName;SKU\nLampu;LMP').rows[0].SKU,'LMP');
});
test('CSV reports ambiguous quoting/row shape and enforces limits inside quoted cells',()=>{
 assert.throws(()=>parseCSV('Name,SKU\n"Speaker "15",A'),/Record 2.*kolom 1/);
 assert.throws(()=>parseCSV('Name,SKU\nLampu,A,extra'),/record 2.*3.*2/);
 assert.throws(()=>parseCSV('Name\n"'+('x'.repeat(100001))+'"'),/Sel CSV terlalu panjang/);
 assert.throws(()=>parseCSV('Name\n'+('x'.repeat(MAX_CSV_BYTES))),/2 MiB/);
 assert.throws(()=>parseCSV('Name,SKU\nA,\uFFFD'),/Encoding/);
});
test('Order edit binds rates to version, address and all financial inputs',()=>{
 const x=parseOrderEdit(input()),key=editBinding(x);
 assert.equal(key,editBinding({...x,notes:'Alasan lain yang lengkap',shippingQuoteId:'31363533-15eb-42a0-8bc0-c9f8addc715a'}));
 for(const changed of [{...x,expectedVersion:2},{...x,contact:{...x.contact,address:'Jalan tujuan berbeda'}},{...x,items:[{...x.items[0],unitPriceIdr:20000}]},{...x,fees:[]}])assert.notEqual(key,editBinding(changed));
 assert.throws(()=>parseOrderEdit({...input(),items:[input().items[0],input().items[0]]}),/ganda/);
 assert.throws(()=>parseOrderEdit({...input(),fees:[{label:'Biaya',amountIdr:-1}]}),/Biaya/);
});
test('Holding an order blocks new fulfillment but preserves financial verification for physical tracking',()=>{
 const paid={status:'paid',payment_status:'paid',payment_provider:'fixture',payment_reference:'verified',operational_status:'on_hold',processing_started_at:'2026-11-05'};
 assert.equal(paidOrderVerified(paid),true);assert.equal(fulfillmentOrderEligible(paid),false);
 assert.ok(editBlocker(paid,false));assert.throws(()=>validateTransition(paid,'pending_payment'),/tahap awal/);
 assert.equal(fulfillmentOrderEligible({...paid,operational_status:'processing'}),true);
});
test('Status changes cannot fabricate a payment or refund, or reopen terminal orders',()=>{
 const pending={status:'draft',payment_status:'pending',operational_status:'pending_payment'};
 assert.throws(()=>validateTransition(pending,'processing'),/terverifikasi/);
 assert.throws(()=>validateTransition({...pending,operational_status:'on_hold'},'refunded'),/Refund/);
 assert.throws(()=>validateTransition({...pending,operational_status:'cancelled'},'draft'),/tidak diizinkan/);
 assert.ok(statusOptions(pending).includes('pre_order'));
});
