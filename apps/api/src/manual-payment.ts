import {BadRequestException} from '@nestjs/common';
import * as V from './catalog-validation';
import {requireUuid} from './warehouses';
import {orderHash} from './order-policy';
export function manualPaymentBlocker(o:any){
 if(o.payment_method!=='bank_transfer')return 'Konfirmasi manual hanya untuk transfer bank.';
 if(o.payment_status!=='pending')return 'Pembayaran harus berstatus Pending.';
 if(!['draft','pending_payment','pre_order','on_hold'].includes(o.operational_status)||o.processing_started_at)return 'Pesanan sudah diproses atau ditutup.';
 return null;
}
export function parseManualPayment(raw:unknown){
 const input=V.record(raw);
 if(input.approve===true){const x=V.record(raw,['expectedVersion','idempotencyKey','approve']);return {mode:'admin_approval' as const,expectedVersion:V.integer(x.expectedVersion,'Versi',1),idempotencyKey:requireUuid(x.idempotencyKey,'konfirmasi')};}
 const x=V.record(raw,['expectedVersion','idempotencyKey','amountIdr','paidAt','bankName','accountNumber','accountName','reference','notes','verified']);
 if(x.verified!==true)throw new BadRequestException('Konfirmasi bahwa dana sudah masuk ke rekening penerima.');
 const paidAt=V.date(x.paidAt);if(!paidAt||Date.parse(paidAt)>Date.now()+300000)throw new BadRequestException('Tanggal pembayaran tidak valid atau berada di masa depan.');
 const bankName=V.text(x.bankName,'Bank penerima',2,80),accountNumber=V.text(x.accountNumber,'Nomor rekening',5,40).replace(/[ -]/g,''),accountName=V.text(x.accountName,'Nama pemilik rekening',2,100),reference=V.text(x.reference,'Referensi transaksi',3,120),notes=V.text(x.notes,'Catatan verifikasi',8,500);
 if(!/^\d{5,34}$/.test(accountNumber))throw new BadRequestException('Nomor rekening harus berupa angka.');
 return {mode:'bank_details' as const,expectedVersion:V.integer(x.expectedVersion,'Versi',1),idempotencyKey:requireUuid(x.idempotencyKey,'konfirmasi'),amountIdr:V.integer(x.amountIdr,'Nominal diterima',1),paidAt,bankName,accountNumber,accountName,reference,notes,referenceKey:orderHash([accountNumber,reference.toLowerCase().replace(/\s+/g,' ')])};
}
