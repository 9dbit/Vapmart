'use client';
import {orderStatuses,orderStatus} from '@/lib/order-status';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {BuyerReviewForm} from '@/components/catalog-public-reviews';
import {useParams} from 'next/navigation';
import {useCustomerAuth} from '@/lib/customer-auth';
import {formatIDR} from '@/lib/types';
import '../../checkout-v26.css';
type Order={id:string;status:string;operational_status?:string;additional_fee_idr?:string;payment_status:string;payment_method:string;subtotal_idr:string;discount_idr:string;voucher_discount_idr:string;voucher_code:string|null;promotion_discount_idr:string;promotion_event_id:string|null;promotion_title:string|null;shipping_fee_idr:string;total_idr:string;shipping_provider:string|null;shipping_courier_code:string|null;shipping_service_code:string|null;shipping_courier_name?:string|null;shipping_service_name?:string|null;contact_name:string;city:string;province:string;created_at:string};
type Line={product_id:string;product_name:string;sku:string|null;quantity:number;unit_price_idr:string};
type TrackingBatch={batch_id:string;brand_name:string;state:string;origin_city:string;events:{state:string;at:string}[]|null};
type CourierUpdate={batch_id:string;carrier_state:string|null;provider_status:string|null;tracking_number:string|null;
 event_type:string|null;event_status:string|null;is_applied:boolean|null;received_at:string|null};
type ReturnRow={id:string;batch_id:string;status:string;reason:string;created_at:string};
export default function OrderPage(){
 const auth=useCustomerAuth();const params=useParams<{id:string}>();
 const [detail,setDetail]=useState<{order:Order;items:Line[]}|null>(null);
 const [tracking,setTracking]=useState<TrackingBatch[]>([]);
 const [courier,setCourier]=useState<CourierUpdate[]>([]),[returns,setReturns]=useState<ReturnRow[]>([]);
 const [returnReason,setReturnReason]=useState<Record<string,string>>({}),[returnBusy,setReturnBusy]=useState(false),[returnMessage,setReturnMessage]=useState('');
 const returnKeys=useRef<Record<string,string>>({});
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
  fetch('/api/customer-courier/orders/'+encodeURIComponent(params.id),{headers:{authorization:'Bearer '+auth.accessToken},cache:'no-store',signal:controller.signal})
   .then(async r=>r.ok?r.json():null).then(x=>{if(x)setCourier(x.items||[]);}).catch(()=>{});
  fetch('/api/customer-returns',{headers:{authorization:'Bearer '+auth.accessToken},cache:'no-store',signal:controller.signal})
   .then(async r=>r.ok?r.json():null).then(x=>{if(x)setReturns((x.items||[]).filter((y:ReturnRow & {order_id:string})=>y.order_id===params.id));}).catch(()=>{});
  return()=>controller.abort();
 },[auth.loading,auth.accessToken,params.id]);
 async function requestReturn(batchId:string){
  if(!auth.accessToken||returnBusy)return;
  const reason=(returnReason[batchId]||'').trim();
  if(reason.length<10){setReturnMessage('Jelaskan alasan retur minimal 10 karakter.');return;}
  setReturnBusy(true);setReturnMessage('');
  try{
   const key=returnKeys.current[batchId]||crypto.randomUUID();returnKeys.current[batchId]=key;
   const r=await fetch('/api/customer-returns',{method:'POST',headers:{authorization:'Bearer '+auth.accessToken,'content-type':'application/json'},
    body:JSON.stringify({batchId,reason,idempotencyKey:key})});
   const x=await r.json();if(!r.ok)throw Error(x?.message||'Permintaan retur tidak bisa diproses');
   delete returnKeys.current[batchId];
   const list=await fetch('/api/customer-returns',{headers:{authorization:'Bearer '+auth.accessToken},cache:'no-store'});
   if(list.ok){const result=await list.json();setReturns((result.items||[]).filter((y:ReturnRow & {order_id:string})=>y.order_id===params.id));}
   setReturnMessage('Permintaan retur tercatat untuk ditinjau admin. Tidak ada refund atau kurir retur otomatis.');
  }catch(e){setReturnMessage(e instanceof Error?e.message:'Permintaan retur gagal');}
  finally{setReturnBusy(false);}
 }
 const paymentNames:Record<string,string>={bank_transfer:'Bank Transfer',qris:'QRIS',virtual_account:'Virtual Account',ewallet:'E-Wallet'};
 return <main className="vco26-root main-container vco26-receipt">
  <p className="vco26-eyebrow">VAPMART / ORDER STATUS</p><h1>Detail pesanan</h1>
  {loading?<section className="vco26-card">Memuat status pesanan...</section>:!auth.user?<section className="vco26-card"><h2>Masuk untuk melihat pesanan</h2><Link className="vco26-button" href={'/login?next=/pesanan/'+params.id}>Masuk ↗</Link></section>:
   error?<section className="vco26-card"><p role="alert">{error}</p><Link href="/keranjang-2" className="vco26-secondary">Ke keranjang</Link></section>:
   detail?<section className="vco26-card">
    <div className="vco26-order-badge">{detail.order.payment_status==='paid'?'Pembayaran terverifikasi':detail.order.payment_status==='pending'?'Menunggu pembayaran':'Draft · Belum dibayar'}</div>
    <h2>Nomor pesanan</h2><p className="vco26-id">{detail.order.id}</p>
    <p>{detail.order.payment_status==='paid'?'Status pembayaran dan pengiriman mengikuti catatan backend terverifikasi.':detail.order.payment_method==='bank_transfer'?'Pesanan sudah masuk dashboard dan menunggu verifikasi pembayaran manual. Instruksi rekening tidak diterbitkan dari halaman test ini.':'Pesanan tersimpan sebagai draft. Metode gateway belum dapat memproses pembayaran.'}</p>
    <p>Status pesanan: <strong>{orderStatuses[orderStatus(detail.order)]||detail.order.status}</strong></p><div className="vco26-order-grid"><div><span>Penerima</span><strong>{detail.order.contact_name}</strong></div><div><span>Pengiriman</span><strong>{detail.order.city}, {detail.order.province}</strong></div><div><span>Preferensi pembayaran</span><strong>{paymentNames[detail.order.payment_method]||detail.order.payment_method}</strong></div><div><span>Status pembayaran</span><strong>{detail.order.payment_status==='not_initiated'?'Belum dimulai':detail.order.payment_status}</strong></div></div>
    <h2>Barang</h2>{detail.items.map(x=><div className="vco26-receipt-row" key={x.product_id}><span>{x.product_name} · {x.quantity} pcs</span><strong>{formatIDR(Number(x.unit_price_idr)*x.quantity)}</strong></div>)}
    {Number(detail.order.voucher_discount_idr||0)>0&&<div className="vco26-receipt-row"><span>Voucher {detail.order.voucher_code||''}</span><strong>-{formatIDR(Number(detail.order.voucher_discount_idr))}</strong></div>}
    {Number(detail.order.promotion_discount_idr||0)>0&&<div className="vco26-receipt-row"><span>Promo otomatis {detail.order.promotion_title||''}</span><strong>-{formatIDR(Number(detail.order.promotion_discount_idr))}</strong></div>}
    <div className="vco26-receipt-row"><span>{(detail.order.shipping_courier_name||detail.order.shipping_courier_code)?('Ongkir '+(detail.order.shipping_courier_name||detail.order.shipping_courier_code)+' · '+(detail.order.shipping_service_name||detail.order.shipping_service_code||'')):'Ongkos kirim (estimasi)'}</span><strong>{formatIDR(Number(detail.order.shipping_fee_idr))}</strong></div>
    {Number(detail.order.additional_fee_idr||0)>0&&<div className="vco26-receipt-row"><span>Biaya tambahan</span><strong>{formatIDR(Number(detail.order.additional_fee_idr))}</strong></div>}
    <div className="vco26-receipt-row vco26-total"><span>Total estimasi</span><strong>{formatIDR(Number(detail.order.total_idr))}</strong></div>
    <div style={{marginTop:26,paddingTop:18,borderTop:'1px solid #eee5f0'}}>
    <h2>Fulfillment & tracking</h2>
    <p>Status internal gudang ditampilkan terpisah dari event kurir. Resi dan status pengiriman baru muncul setelah konfirmasi provider yang terverifikasi.</p>
    {tracking.length?tracking.map(t=>{
     const updates=courier.filter(x=>x.batch_id===t.batch_id);
     const latest=updates.find(x=>x.carrier_state)||null;
     const rma=returns.find(x=>x.batch_id===t.batch_id);
     const delivered=latest?.carrier_state==='delivered';
     return <div key={t.batch_id} style={{padding:'15px 0',borderBottom:'1px solid #eee5f0'}}>
      <strong>{t.brand_name||'Vapmart'} · {t.state.replaceAll('_',' ')}</strong>
      <p>Asal: {t.origin_city||'Gudang belum tersedia'}</p>
      <div style={{background:'#f5eef9',borderRadius:14,padding:13,margin:'10px 0'}}>
        <strong>Ekspedisi: {latest?.provider_status?.replaceAll('_',' ')||'Belum dipesan'}</strong>
        <p>Resi kurir: {latest?.tracking_number||'Belum tersedia'}</p>
        {updates.filter(x=>x.event_type&&x.is_applied&&x.event_status).map((x,i)=>
         <p key={i} style={{fontSize:12}}>{x.received_at?new Date(x.received_at).toLocaleString('id-ID'):''} · {x.event_status?.replaceAll('_',' ')}</p>)}
      </div>
      {t.events?.map((e,i)=><p key={i} style={{fontSize:12,margin:'6px 0'}}>{new Date(e.at).toLocaleString('id-ID')} · Proses internal: {e.state.replaceAll('_',' ')}</p>)}
      {rma?<p><strong>Retur:</strong> {rma.status} · {rma.reason}</p>:delivered&&
       <div style={{display:'grid',gap:9,marginTop:12}}>
        <label style={{fontSize:12}}>Ajukan retur untuk batch ini<textarea rows={2} maxLength={500}
         value={returnReason[t.batch_id]||''} onChange={e=>setReturnReason(x=>({...x,[t.batch_id]:e.target.value}))}
         placeholder="Jelaskan masalah barang (minimal 10 karakter)"
         style={{width:'100%',marginTop:6,padding:12,borderRadius:12,border:'1px solid #e5dcea'}}/></label>
        <button type="button" className="vco26-secondary" disabled={returnBusy||(returnReason[t.batch_id]||'').trim().length<10}
         onClick={()=>requestReturn(t.batch_id)}>Ajukan retur untuk review</button>
       </div>}
     </div>;
    }):<p className="vco26-footnote">Belum ada batch. Draft tidak otomatis mereservasi stok atau memesan kurir.</p>}
    {returnMessage&&<p role="status">{returnMessage}</p>}
   </div>
   <button className="vco26-button" type="button" disabled>{detail.order.payment_method==='bank_transfer'?'Bank Transfer · Menunggu verifikasi':'Bayar sekarang · Gateway belum aktif'}</button>
    <p className="vco26-footnote">Status lunas hanya bisa diberikan oleh backend setelah notifikasi payment gateway diverifikasi.</p>
    <Link className="vco26-secondary" href="/catalog">Kembali ke katalog ↗</Link>
   </section>:<section className="vco26-card">Detail belum tersedia.</section>}
 {detail&&<BuyerReviewForm orderId={params.id}/>}
 <Link href="/pesanan">Seluruh pesanan saya</Link>
 </main>;
}
