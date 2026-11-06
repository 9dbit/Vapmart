import {BadRequestException,ConflictException} from '@nestjs/common';
import {createHash} from 'node:crypto';
import {parseBasket} from './checkout';
import {requireUuid} from './warehouses';
import * as V from './catalog-validation';

export const orderStatuses={draft:'Draft',pending_payment:'Pending payment',processing:'Processing',completed:'Selesai',on_hold:'On hold',cancelled:'Cancelled',refunded:'Refunded',failed:'Failed',pre_order:'Pre-order'} as const;
export type OrderStatus=keyof typeof orderStatuses;
export const orderHash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function parseOrderEdit(raw:unknown){
 const x=V.record(raw,['expectedVersion','notes','contact','items','fees','voucherCode','shippingQuoteId','previewHash']);
 const c=V.record(x.contact,['name','phone','address','city','province','postalCode','areaId']);
 const contact={name:V.text(c.name,'Nama penerima',2,100),phone:V.text(c.phone,'Telepon',9,22),address:V.text(c.address,'Alamat',8,300),city:V.text(c.city,'Kota',2,90),province:V.text(c.province,'Provinsi',2,90),postalCode:V.text(c.postalCode,'Kode pos',5,5),areaId:c.areaId?V.text(c.areaId,'Wilayah',10,10):null};
 if(!/^\+?[0-9\s()-]{9,22}$/.test(contact.phone)||!/^\d{5}$/.test(contact.postalCode)||contact.areaId&&!/^\d{10}$/.test(contact.areaId))throw new BadRequestException('Nomor telepon, kode pos, atau wilayah tidak valid');
 if(!Array.isArray(x.items))throw new BadRequestException('Daftar barang diperlukan');
 const items=x.items.map((v:unknown)=>{const i=V.record(v,['productId','quantity','unitPriceIdr']);return {productId:requireUuid(i.productId,'produk'),quantity:V.integer(i.quantity,'Jumlah',1,99),unitPriceIdr:V.integer(i.unitPriceIdr,'Harga')};}).sort((a,b)=>a.productId.localeCompare(b.productId));
 parseBasket({items:items.map(({productId,quantity})=>({productId,quantity}))});
 if(!Array.isArray(x.fees)||x.fees.length>10)throw new BadRequestException('Maksimal 10 biaya tambahan');
 const fees=x.fees.map((v:unknown)=>{const f=V.record(v,['label','amountIdr']);return {label:V.text(f.label,'Nama biaya',2,100),amountIdr:V.integer(f.amountIdr,'Biaya',0,10000000)};});
 const voucherCode=x.voucherCode?V.text(x.voucherCode,'Voucher',3,32).toUpperCase():null;
 if(voucherCode&&!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(voucherCode))throw new BadRequestException('Kode voucher tidak valid');
 return {expectedVersion:V.integer(x.expectedVersion,'Versi',1),notes:V.text(x.notes,'Alasan perubahan',8,500),contact,items,fees,voucherCode,shippingQuoteId:x.shippingQuoteId?requireUuid(x.shippingQuoteId,'quote ongkir'):null};
}
export type OrderEdit=ReturnType<typeof parseOrderEdit>;
export function editBinding(x:OrderEdit){return orderHash({...x,notes:undefined,shippingQuoteId:undefined});}
export function editBlocker(o:any,hasFulfillment:boolean){
 if(o.processing_started_at||hasFulfillment)return 'Pesanan sudah masuk proses gudang atau memiliki resi. Edit dikunci.';
 if(!['draft','pending_payment','on_hold','pre_order'].includes(o.operational_status))return 'Status pesanan tidak mengizinkan edit.';
 if(['paid','refunded'].includes(o.payment_status))return 'Pesanan sudah dibayar. Rekonsiliasi pembayaran diperlukan sebelum mengubah nilai.';
 return null;
}
const transitions:Record<OrderStatus,OrderStatus[]>={
 draft:['pending_payment','on_hold','pre_order','cancelled','failed'],
 pending_payment:['draft','processing','on_hold','pre_order','cancelled','failed'],
 pre_order:['pending_payment','processing','on_hold','cancelled','failed'],
 on_hold:['pending_payment','pre_order','processing','completed','cancelled','refunded','failed'],
 processing:['on_hold','completed','cancelled','refunded'],
 completed:['refunded'],cancelled:['refunded'],refunded:[],failed:['draft','pending_payment','cancelled']
};
export function validateTransition(o:any,target:OrderStatus){
 if(target===o.operational_status)throw new ConflictException('Ini status pesanan saat ini.');
 if(!(target in orderStatuses)||!transitions[o.operational_status as OrderStatus]?.includes(target))throw new ConflictException('Perpindahan dari status saat ini tidak diizinkan.');
 if(['processing','completed'].includes(target)&&!(o.payment_status==='paid'&&o.payment_provider&&o.payment_reference))throw new ConflictException('Processing memerlukan pembayaran yang telah terverifikasi.');
 if(target==='refunded'&&!(o.payment_status==='refunded'&&o.payment_provider&&o.payment_reference))throw new ConflictException('Refund harus sudah tercatat dan diverifikasi sebelum memilih Refunded.');
 if(['draft','pending_payment','pre_order','failed'].includes(target)&&(o.processing_started_at||o.payment_status==='paid'))throw new ConflictException('Pesanan yang sudah diproses atau dibayar tidak dapat dikembalikan ke tahap awal.');
}
export function statusOptions(o:any){return (transitions[o.operational_status as OrderStatus]||[]).filter(s=>{try{validateTransition(o,s);return true;}catch{return false;}});}
