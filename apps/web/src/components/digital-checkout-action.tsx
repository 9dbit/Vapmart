'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useCustomerAuth} from '@/lib/customer-auth';
import type {CartItem} from '@/lib/types';
import {digitalPackFor,isDigitalProduct} from '@/lib/digital-products';
import {formatIDR} from '@/lib/types';

export function DigitalCheckoutAction({items,subtotal}:{items:CartItem[];subtotal:number}){
 const auth=useCustomerAuth();
 const [expanded,setExpanded]=useState(false);
 const [busy,setBusy]=useState(false);
 const [feedback,setFeedback]=useState('');
 const [created,setCreated]=useState<{id:string;status:string}|null>(null);
 const digitalOnly=items.length===1&&items[0].quantity===1&&isDigitalProduct(items[0].product);
 const selected=digitalOnly?digitalPackFor(items[0].product.sku):undefined;
 const checkoutReady=process.env.NEXT_PUBLIC_DIGITAL_CHECKOUT_ENABLED==='true';
 const submit=async()=>{
   setBusy(true);setFeedback('');setCreated(null);
   try{
     if(!auth.accessToken)throw new Error('Masuk atau daftar sebelum melakukan checkout.');
     const key=crypto.randomUUID();
     const response=await fetch('/api/digital-orders',{method:'POST',headers:{
       'content-type':'application/json',Authorization:'Bearer '+auth.accessToken
     },body:JSON.stringify({sku:selected?.sku,idempotencyKey:key})});
     const result=await response.json();
     if(!response.ok)throw new Error(typeof result?.message==='string'?result.message:'Sesi pembayaran belum tersedia.');
     setCreated({id:result.id,status:result.status});
     setFeedback('Order dibuat, tetapi belum dibayar. Coin belum dikreditkan.');
   }catch(e){setFeedback(e instanceof Error?e.message:'Gagal membuat order.');}
   finally{setBusy(false);}
 };
 return <div className="vm21-checkout-action">
   <button className="vm21-primary" type="button" onClick={()=>setExpanded(v=>!v)}
     aria-expanded={expanded} disabled={!digitalOnly}>
     {digitalOnly?'Tinjau Pembelian Coin / Member':'Checkout belum tersedia'}
     {digitalOnly&&<span aria-hidden="true">↗</span>}
   </button>
   {expanded&&selected&&<section className="vm21-checkout-review" aria-label="Ringkasan pembelian digital">
     <h3>Konfirmasi Produk Digital</h3>
     <div><span>{selected.kind==='membership_activation'?'Aktivasi member':'Top Up Coin'}</span><strong>{selected.coins.toLocaleString('id-ID')} Coin</strong></div>
     <div><span>Jumlah pembayaran</span><strong>{formatIDR(subtotal)}</strong></div>
     <div><span>Biaya tambahan</span><strong>Rp0</strong></div>
     <p>Coin baru masuk saldo setelah webhook pembayaran diverifikasi dan ledger berhasil dicatat.</p>
     {!auth.user?<Link className="vm21-secondary" href="/login?next=/keranjang-2">Masuk untuk Checkout</Link>:
       checkoutReady?<button className="vm21-primary" type="button" onClick={submit} disabled={busy}>{busy?'Memproses…':'Buat Order Pembayaran'}</button>:
       <div className="vm21-config-warning">Gateway pembayaran masih nonaktif pada staging. Tidak ada pembayaran maupun kredit Coin yang diproses.</div>}
     {feedback&&<p role="status" className="vm21-checkout-feedback">{feedback}</p>}
     {created&&<p role="status" className="vm21-checkout-feedback">Order {created.id} · {created.status} · belum dibayar.</p>}
   </section>}
 </div>;
}
