'use client';
import {useState} from 'react';
import {CatalogNotice,useCatalogAdmin} from './catalog-admin-shell';
import {formatIDR} from '@/lib/types';
export function ManualPaymentForm({order,onSaved,disabled}:{order:any;onSaved:()=>void;disabled:boolean}){
 const {request}=useCatalogAdmin(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [key]=useState(()=>crypto.randomUUID());
 async function approve(){if(busy||disabled)return;setError('');setBusy(true);try{
 await request('orders/'+order.id+'/confirm-payment',{approve:true,expectedVersion:order.edit_version,idempotencyKey:key});onSaved();
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="vc-panel" aria-label="Konfirmasi transfer"><h3>Konfirmasi pembayaran</h3><p><strong>#{order.id.slice(0,8).toUpperCase()}</strong> · {order.contact_name}</p><p>Transfer bank · <strong>{formatIDR(Number(order.total_idr))}</strong></p><p>Dengan klik Konfirmasi, Anda menyatakan pembayaran pesanan ini sudah diterima. Pesanan akan masuk Processing.</p><CatalogNotice error={error}/><button type="button" className="vc-primary" disabled={busy||disabled} onClick={approve}>{busy?'Mengonfirmasi...':'Konfirmasi pembayaran'}</button></section>;
}
