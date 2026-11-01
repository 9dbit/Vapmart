'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useCustomerAuth} from '@/lib/customer-auth';
import {formatIDR} from '@/lib/types';
import '../../checkout-v26.css';
type Order={id:string;status:string;payment_status:string;payment_method:string;subtotal_idr:string;shipping_fee_idr:string;total_idr:string;shipping_provider:string|null;shipping_courier_code:string|null;shipping_service_code:string|null;contact_name:string;city:string;province:string;created_at:string};
type Line={product_id:string;product_name:string;sku:string|null;quantity:number;unit_price_idr:string};
type TrackingBatch={batch_id:string;brand_name:string;state:string;origin_city:string;events:{state:string;at:string}[]|null};
export default function OrderPage(){
 const auth=useCustomerAuth();const params=useParams<{id:string}>();
 const [detail,setDetail]=useState<{order:Order;items:Line[]}|null>(null);
 const [tracking,setTracking]=useState<TrackingBatch[]>([]);
 const [error,setError]=useState('');const [loading,setLoading]=useState(true);
 useEffect(()=>{
  if(auth.loading)return;
  if(!auth.accessToken){setLoading(false);return;}
  const controller=new AbortController();
  fetch('/api/checkout/orders/'+encodeURIComponent(params.id),{headers:{authorization:'Bearer '+auth.accessToken},signal:controller.signal,cache:'no-store'})
    .then(async r=>{const x=await r.json();if(!r.ok)throw new Error(x?.message||'Pesanan tidak ditemukan');setDetail(x);})
    .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Gagal membaca pesanan');})
    .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  fetch('/api/customer-fulfillment/orders/'+encodeURIComponent(params.id)+'/tracking',{headers:{authorization:'Bearer '+auth.accessToken},cache:'no-store',signal:controller.signal})
    .then(async r=>{if(!r.ok)return null;return r.json();}).then(x=>{if(x)setTracking(x.batches||[]);}).catch(()=>{});
  return()=>controller.abort();
 },[auth.loading,auth.accessToken,params.id]);
 const paymentNames:Record<string,string>={qris:'QRIS',virtual_account:'Virtual Account',ewallet:'E-Wallet'};
 return <main className="vco26-root main-container vco26-receipt">
  <p className="vco26-eyebrow">VAPMART / ORDER STATUS</p><h1>Detail pesanan</h1>
  {loading?<section className="vco26-card">Memuat status pesanan...</section>:!auth.user?<section className="vco26-card"><h2>Masuk untuk melihat pesanan</h2><Link className="vco26-button" href={'/login?next=/pesanan/'+params.id}>Masuk ↗</Link></section>:
   error?<section className="vco26-card"><p role="alert">{error}</p><Link href="/keranjang-2" className="vco26-secondary">Ke keranjang</Link></section>:
   detail?<section className="vco26-card">
    <div className="vco26-order-badge">{detail.order.payment_status==='paid'?'Pembayaran terverifikasi':'Draft · Belum dibayar'}</div>
    <h2>Nomor pesanan</h2><p className="vco26-id">{detail.order.id}</p>
    <p>Pesanan tersimpan sebagai draft. Pembayaran tidak tersedia sampai payment gateway diintegrasikan. Jangan melakukan transfer berdasarkan halaman ini.</p>
    <div className="vco26-order-grid"><div><span>Penerima</span><strong>{detail.order.contact_name}</strong></div><div><span>Pengiriman</span><strong>{detail.order.city}, {detail.order.province}</strong></div><div><span>Preferensi pembayaran</span><strong>{paymentNames[detail.order.payment_method]||detail.order.payment_method}</strong></div><div><span>Status pembayaran</span><strong>{detail.order.payment_status==='not_initiated'?'Belum dimulai':detail.order.payment_status}</strong></div></div>
    <h2>Barang</h2>{detail.items.map(x=><div className="vco26-receipt-row" key={x.product_id}><span>{x.product_name} · {x.quantity} pcs</span><strong>{formatIDR(Number(x.unit_price_idr)*x.quantity)}</strong></div>)}
    <div className="vco26-receipt-row"><span>{detail.order.shipping_courier_code?('Ongkir '+detail.order.shipping_courier_code.toUpperCase()+' · '+detail.order.shipping_service_code+' (sandbox)'):'Ongkos kirim (estimasi)'}</span><strong>{formatIDR(Number(detail.order.shipping_fee_idr))}</strong></div>
    <div className="vco26-receipt-row vco26-total"><span>Total estimasi</span><strong>{formatIDR(Number(detail.order.total_idr))}</strong></div>
    <div style={{marginTop:26,paddingTop:18,borderTop:'1px solid #eee5f0'}}>
    <h2>Fulfillment & tracking</h2>
    <p>Tracking berikut hanya untuk proses internal gudang. Nomor resi dan status kurir belum tersedia sampai integrasi pengiriman resmi diaktifkan.</p>
    {tracking.length?tracking.map(t=><div key={t.batch_id} style={{padding:'15px 0',borderBottom:'1px solid #eee5f0'}}>
      <strong>{t.brand_name} · {t.state.replaceAll('_',' ')}</strong>
      <p>Asal: {t.origin_city||'Gudang belum tersedia'}</p>
      {t.events?.map((e,i)=><p key={i} style={{fontSize:12,margin:'6px 0'}}>{new Date(e.at).toLocaleString('id-ID')} · {e.state.replaceAll('_',' ')}</p>)}
    </div>):<p className="vco26-footnote">Belum ada batch. Draft tidak otomatis mereservasi stok atau memesan kurir.</p>}
   </div>
   <button className="vco26-button" type="button" disabled>Bayar sekarang · Gateway belum aktif</button>
    <p className="vco26-footnote">Status lunas hanya bisa diberikan oleh backend setelah notifikasi payment gateway diverifikasi.</p>
    <Link className="vco26-secondary" href="/catalog">Kembali ke katalog ↗</Link>
   </section>:<section className="vco26-card">Detail belum tersedia.</section>}
 </main>;
}
