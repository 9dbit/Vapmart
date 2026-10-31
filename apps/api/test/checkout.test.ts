import assert from 'node:assert/strict';
import test from 'node:test';
import {parseBasket,parseDraftOrder,priceBasket} from '../src/checkout';
import {parseImageUpload} from '../src/media';
import {cleanProduct} from '../src/products';
const id='25f397b8-564f-46f4-971e-bc1d333ac1d0';
const form={items:[{productId:id,quantity:2}],name:'Budi Pembeli',phone:'081234567890',address:'Jalan Merdeka 12',city:'Bandung',province:'Jawa Barat',postalCode:'40115',paymentMethod:'qris',idempotencyKey:'97544bf9-7b9e-46ac-8cc5-d6f1aa747df8'};
test('quote prices originate from database, not cart input',()=>{
 const cart=parseBasket({items:[{productId:id,quantity:2}]});
 const quote=priceBasket(cart,[{id,sku:'DECOR-001',name:'Vas Keramik',price_idr:150000,stock_qty:4,is_active:true}]);
 assert.equal(quote.subtotalIdr,300000);
 assert.equal(quote.paymentEnabled,false);
 assert.equal(quote.items[0].quantity,2);
});
test('rejects price injection into cart',()=>{
 assert.throws(()=>parseBasket({items:[{productId:id,quantity:1,unitPriceIdr:1}]}),/ID produk tidak valid/);
});
test('rejects duplicate items and unavailable stock',()=>{
 assert.throws(()=>parseBasket({items:[{productId:id,quantity:1},{productId:id,quantity:1}]}),/ganda/);
 assert.throws(()=>priceBasket([{productId:id,quantity:5}],[{id,sku:null,name:'Barang',price_idr:10,stock_qty:4,is_active:true}]),/Stok/);
});
test('validate checkout without allowing payment state injection',()=>{
 assert.equal(parseDraftOrder(form).details.paymentMethod,'qris');
 assert.throws(()=>parseDraftOrder({...form,paymentStatus:'paid'}),/tidak dikenali/);
 assert.throws(()=>parseDraftOrder({...form,paymentMethod:'bank_transfer_manual'}),/tidak tersedia/);
 assert.throws(()=>parseDraftOrder({...form,postalCode:'100'}),/Kode pos/);
});
test('image upload rejects falsified content and markup',()=>{
 assert.throws(()=>parseImageUpload({filename:'p.svg',mimeType:'image/svg+xml',base64:Buffer.from('<svg></svg>').toString('base64')}),/Hanya JPEG/);
 assert.throws(()=>parseImageUpload({filename:'p.png',mimeType:'image/png',base64:'not_base64'}),/Data gambar/);
});
test('product supports brand references and gallery with strict URLs',()=>{
 assert.equal(cleanProduct({slug:'object-one',name:'Lampu Meja',category:'home',price_idr:200000,stock_qty:1,brand_id:id}).brand_id,id);
 assert.throws(()=>cleanProduct({gallery_urls:['javascript:alert(1)']},true),/Invalid image gallery/);
});
