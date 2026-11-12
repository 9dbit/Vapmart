'use client';
import {useEffect,useRef,useState} from 'react';
import {useCustomerAuth} from '@/lib/customer-auth';
import {formatIDR} from '@/lib/types';
import Link from 'next/link';
import '../app/order-airwaybill.css';

type ShippingBatch={
 batch_id:string;order_id:string;brand_name:string|null;warehouse_code:string;state:string;
 manifest_id:string|null;manifest_state:string|null;pickup_method:string|null;booking_state:string|null;
 booking_created_at:string|null;tracking_number:string|null;provider_status:string|null;
 carrier_state:string|null;provider_shipment_id:string|null;provider_events:number;
};
type OrderOverview={
 orderId:string;order:{id:string;status:string;paymentStatus:string;operationalStatus:string;
 paymentVerified:boolean;courierName:string|null;serviceName:string|null};
 batches:ShippingBatch[];canPrepare:boolean;provider:string;bookingEnabled:boolean;
};
type BookingPreview={
 canBook:boolean;blockers:string[];fingerprint?:string;feeIdr?:number;service?:string;
 origin?:string;destination?:string;attempt?:{state:string;message?:string;tracking_number?:string|null}|null;
};
type JobResult={state?:string;message?:string;url?:string;tracking_number?:string|null};
const progress:Record<string,string>={reserved:'Reserved',picking:'Picking',packed:'Packed',ready_for_carrier:'Siap diserahkan ke kurir',cancelled:'Dibatalkan'};
const advance:Record<string,{state:string;label:string}>={
 reserved:{state:'picking',label:'Mulai picking'},picking:{state:'packed',label:'Konfirmasi sudah dipacking'},
 packed:{state:'ready_for_carrier',label:'Konfirmasi siap dikirim'}
};
const shipmentLabels:Record<string,string>={
 confirmed:'Pending / Menunggu kurir',allocated:'Kurir dialokasikan',picking_up:'Kurir menuju lokasi',
 picked:'Sudah dijemput',in_transit:'Dalam pengiriman',on_hold:'Pengiriman tertahan',
 delivered:'Diterima',returned:'Retur',cancelled:'Dibatalkan',rejected:'Ditolak'
};
const explain:Record<string,string>={
 VERIFIED_PAYMENT_REQUIRED:'Pembayaran belum terverifikasi oleh admin',
 ORDER_NOT_PROCESSING:'Status pesanan belum Processing',
 PACKING_NOT_READY:'Picking dan packing harus selesai lebih dahulu',
 WAREHOUSE_DISPATCH_NOT_VERIFIED:'Gudang belum aktif untuk dispatch',
 WAREHOUSE_ADDRESS_INCOMPLETE:'Alamat gudang belum lengkap',
 WAREHOUSE_PICKUP_CONTACT_REQUIRED:'Kontak pickup gudang belum lengkap',
 RECIPIENT_ADDRESS_INCOMPLETE:'Alamat penerima belum lengkap',
 PRODUCT_WEIGHT_UNVERIFIED:'Berat produk belum diverifikasi',
 PARCEL_DIMENSIONS_UNVERIFIED:'Dimensi produk belum terisi',
 SPLIT_ORIGIN_RATES_REQUIRED:'Pesanan lintas gudang membutuhkan quote pengiriman per gudang',
 WAREHOUSE_SPECIFIC_COURIER_QUOTE_REQUIRED:'Tarif kurir tidak sesuai asal gudang yang dipakai',
 COURIER_SERVICE_NOT_SELECTED:'Layanan kurir belum dipilih',
 EXTERNAL_BOOKING_DISABLED:'Booking provider belum diaktifkan',
 JUBELIO_BOOKING_DISABLED:'Booking Jubelio belum aktif di server',
 MANIFEST_REQUIRED:'Manifest paket belum disiapkan',
 IMMEDIATE_PICKUP_REQUIRED:'Manifest harus memakai pickup langsung tanpa jadwal'
};
function messageOf(error:unknown){return error instanceof Error?error.message:'Permintaan gagal';}
export function OrderAirwaybillDialog({orderId,onClose,onUpdated}:{
 orderId:string;onClose:()=>void;onUpdated:()=>void;
}){
 const auth=useCustomerAuth();
 const token=auth.accessToken;
 const [data,setData]=useState<OrderOverview|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const [notes,setNotes]=useState('');
 const [previews,setPreviews]=useState<Record<string,BookingPreview>>({});
 const [labels,setLabels]=useState<Record<string,string>>({});
 const requestKeys=useRef<Record<string,string>>({});
 const manifestKeys=useRef<Record<string,string>>({});
 const reserveKey=useRef<string|null>(null);
 const closeRef=useRef<HTMLButtonElement>(null);
 async function api<T>(path:string,method:'GET'|'POST'='GET',body?:unknown):Promise<T>{
  if(!token)throw Error('Sesi admin telah berakhir. Silakan masuk kembali.');
  const response=await fetch(path,{method,cache:'no-store',
   headers:{authorization:'Bearer '+token,...(body===undefined?{}:{'content-type':'application/json'})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const value=await response.json().catch(()=>({message:'Respons API tidak valid'}));
  if(!response.ok)throw Error(Array.isArray(value?.message)?value.message.join(', '):value?.message||value?.code||'HTTP '+response.status);
  return value as T;
 }
 async function reload(){
  const fresh=await api<OrderOverview>('/api/admin/courier/orders/'+encodeURIComponent(orderId));
  if(fresh.orderId!==orderId)throw Error('ID pesanan tidak cocok');
  setData(fresh);
 }
 useEffect(()=>{
  let alive=true;
  closeRef.current?.focus();
  function escape(event:KeyboardEvent){if(event.key==='Escape')onClose();}
  window.addEventListener('keydown',escape);
  if(!token){setLoading(false);setError('Sesi administrator tidak tersedia');}
  else {
   setLoading(true);setData(null);setError('');
   fetch('/api/admin/courier/orders/'+encodeURIComponent(orderId),{
    headers:{authorization:'Bearer '+token},cache:'no-store'
   }).then(async response=>{
    const value=await response.json();
    if(!response.ok)throw Error(value?.message||'Gagal memuat pesanan');
    return value as OrderOverview;
   }).then(value=>{if(alive){setData(value);setLoading(false);}})
    .catch(e=>{if(alive){setError(messageOf(e));setLoading(false);}});
  }
  return()=>{alive=false;window.removeEventListener('keydown',escape);};
 },[orderId,token,onClose]);
 async function action(callback:()=>Promise<string>,refresh=true){
  if(busy)return;
  setBusy(true);setError('');setMessage('');
  try{
   const success=await callback();
   if(refresh){await reload();onUpdated();}
   setMessage(success);
  }catch(e){setError(messageOf(e));}finally{setBusy(false);}
 }
 function nextStep(batch:ShippingBatch){
  const transition=advance[batch.state];
  if(!transition)return;
  if(notes.trim().length<6){setError('Tulis catatan penyiapan minimal 6 karakter.');return;}
  void action(async()=>{
   await api('/api/admin/fulfillment/batches/'+batch.batch_id+'/state','POST',
    {state:transition.state,notes:notes.trim()});
   setPreviews(x=>{const updated={...x};delete updated[batch.batch_id];return updated;});
   setNotes('');
   return 'Status packing disimpan. Lanjutkan tahapan fisik berikutnya.';
  });
 }
 function createManifest(batch:ShippingBatch){
  if(notes.trim().length<6){setError('Tulis catatan manifest minimal 6 karakter.');return;}
  if(!window.confirm('Konfirmasi paket sudah benar-benar siap di gudang dan akan dijemput segera? Ini baru membuat manifest internal, bukan memesan kurir.'))return;
  void action(async()=>{
   await api('/api/admin/courier/batches/'+batch.batch_id+'/manifest','POST',{
    idempotencyKey:(manifestKeys.current[batch.batch_id]??=crypto.randomUUID()),notes:notes.trim(),pickupMethod:'pickup',pickupDate:null,pickupTime:null
   });
   setNotes('');return 'Manifest siap. Sekarang periksa tarif dan kesiapan booking Jubelio.';
  });
 }
 function reserveOrder(){
  if(!data?.canPrepare)return;
  if(!window.confirm('Reservasi stok fisik pesanan ini? Pastikan pembayaran terverifikasi dan stok gudang tersedia.'))return;
  void action(async()=>{
   await api('/api/admin/fulfillment/orders/'+orderId+'/prepare','POST',{idempotencyKey:(reserveKey.current??=crypto.randomUUID())});
   return 'Stok berhasil direservasi. Lanjutkan picking dan packing sebelum meminta AWB.';
  });
 }
 function checkBooking(batch:ShippingBatch){
  void action(async()=>{
   const preview=await api<BookingPreview>('/api/admin/courier/batches/'+batch.batch_id+'/booking-preview');
   setPreviews(x=>({...x,[batch.batch_id]:preview}));
   if(preview.attempt)return preview.attempt.message||'Booking sebelumnya telah ditemukan. Periksa hasil booking, jangan memesan ulang.';
   return preview.canBook?'Tarif Jubelio tersedia. Tinjau biaya lalu konfirmasi untuk menerbitkan AWB.':
    'Belum bisa meminta resi. Lihat daftar persyaratan di bawah.';
  },false);
 }
 function book(batch:ShippingBatch){
  const preview=previews[batch.batch_id];
  if(!preview?.canBook||!preview.fingerprint||preview.feeIdr===undefined)return;
  if(!window.confirm('Konfirmasi booking '+(preview.service||'kurir')+' untuk order '+orderId.slice(0,8)+
   ' dengan estimasi '+formatIDR(preview.feeIdr)+' dari saldo Jubelio? Permintaan ini dapat menimbulkan biaya dan pickup nyata.'))return;
  void action(async()=>{
   // The same request key is intentionally retained after unknown outcomes.
   const key=requestKeys.current[batch.batch_id]||crypto.randomUUID();
   requestKeys.current[batch.batch_id]=key;
   const result=await api<JobResult>('/api/admin/courier/batches/'+batch.batch_id+'/book','POST',{
    idempotencyKey:key,fingerprint:preview.fingerprint,acceptedFeeIdr:preview.feeIdr
   });
   setPreviews(x=>{const updated={...x};delete updated[batch.batch_id];return updated;});
   return result.message||'Permintaan booking dikirim. Periksa status resmi Jubelio.';
  });
 }
 function sync(batch:ShippingBatch,method:'sync'|'reconcile'){
  void action(async()=>{
   const result=await api<JobResult>('/api/admin/courier/batches/'+batch.batch_id+'/'+method,'POST',{});
   return result.message||'Status pengiriman disinkronkan dari Jubelio.';
  });
 }
 function getLabel(batch:ShippingBatch){
  void action(async()=>{
   const result=await api<{url:string}>('/api/admin/courier/batches/'+batch.batch_id+'/label','POST',{});
   // Server restricts returned labels to verified HTTPS provider/CDN domains.
   if(!/^https:\/\//.test(result.url))throw Error('URL label tidak valid');
   setLabels(x=>({...x,[batch.batch_id]:result.url}));
   return 'Label resmi tersedia. Buka dokumen untuk mencetaknya.';
  },false);
 }
 const orderReady=data?.order.paymentVerified&&data.order.operationalStatus==='processing';
 return <div className="vawb-overlay" role="presentation">
  <section className="vawb-dialog" role="dialog" aria-modal="true" aria-labelledby="vawb-title">
   <header className="vawb-header"><div><small>VAPMART / SHIPPING</small><h2 id="vawb-title">Airwaybill Pesanan #{orderId.slice(0,8).toUpperCase()}</h2>
    <p>Kelola kesiapan paket, booking, nomor resi, tracking, dan cetak label langsung dari Pesanan.</p></div>
    <button type="button" ref={closeRef} onClick={onClose} aria-label="Tutup dialog Airwaybill" className="vawb-close">Tutup ×</button></header>
   <div className="vawb-content">
    {loading&&<p role="status">Memuat data order dan pengiriman...</p>}
    {error&&<p className="vawb-error" role="alert">{error}</p>}
    {message&&<p className="vawb-info" role="status">{message}</p>}
    {data&&<>
     <div className="vawb-summary">
      <div><small>PEMBAYARAN</small><strong>{data.order.paymentVerified?'Terverifikasi':'Belum terverifikasi'}</strong></div>
      <div><small>ORDER</small><strong>{data.order.operationalStatus||data.order.status}</strong></div>
      <div><small>KURIR</small><strong>{data.order.courierName||'Belum dipilih'} {data.order.serviceName||''}</strong></div>
      <div><small>JUBELIO</small><strong>{data.bookingEnabled?'Booking tersedia':'Booking belum aktif'}</strong></div>
     </div>
     {!data.order.paymentVerified&&<p className="vawb-warning">Pembayaran harus dikonfirmasi lebih dulu melalui detail Pesanan. Tidak ada pemesanan kurir otomatis.</p>}
     {data.order.paymentVerified&&data.order.operationalStatus!=='processing'&&<p className="vawb-warning">Order harus berstatus Processing agar dapat diproses oleh gudang. Periksa status di halaman detail pesanan.</p>}
     {!data.bookingEnabled&&<p className="vawb-warning">Booking Jubelio dinonaktifkan atau provider tidak dikonfigurasi. Pengaturan server harus diverifikasi sebelum meminta AWB nyata.</p>}
     {!data.batches.length&&<div className="vawb-empty">
      <h3>Belum ada batch pengiriman</h3>
      <p>Reservasi dan pemrosesan Fulfillment belum terbentuk untuk pesanan ini. Klik di bawah setelah pembayaran dan stok terverifikasi.</p>
      {data.canPrepare?<button type="button" className="vawb-primary" disabled={busy} onClick={reserveOrder}>Mulai Fulfillment: reserve stok</button>:
       <Link className="vawb-link" href={'/admin/orders/'+orderId}>Periksa pembayaran dan status pesanan</Link>}
     </div>}
     {data.batches.length>1&&<p className="vawb-warning">Pesanan ini memiliki {data.batches.length} batch. Setiap gudang membutuhkan booking dan AWB sendiri serta tarif asal gudang yang valid. Sistem tidak akan membuat AWB ganda otomatis.</p>}
     {data.batches.length>0&&<div className="vawb-batches">
      {data.batches.map((batch,index)=>{
       const attempt=previews[batch.batch_id];
       const booked=batch.booking_state==='booked';
       const uncertain=Boolean(batch.booking_state)&&!booked;
       const next=advance[batch.state];
       const status=batch.carrier_state||batch.provider_status;
       return <article className="vawb-batch" key={batch.batch_id}>
        <div className="vawb-batch-head"><div><small>PAKET {index+1} · {batch.warehouse_code}</small>
         <h3>{batch.brand_name||'Vapmart'} <span>· {progress[batch.state]||batch.state}</span></h3></div>
         <span className="vawb-state">{booked?shipmentLabels[status||'']||batch.provider_status||'Booking diterima':uncertain?'Periksa hasil booking':batch.manifest_id?'Manifest siap':'Belum ada AWB'}</span></div>
        {booked?<div className="vawb-booked">
         <p><small>AIRWAYBILL</small><strong>{batch.tracking_number||'Menunggu nomor AWB dari Jubelio'}</strong></p>
         <p><small>STATUS PENGIRIMAN</small><strong>{shipmentLabels[status||'']||status||'Menunggu konfirmasi kurir'}</strong></p>
         <div className="vawb-actions">
          <button type="button" disabled={busy} onClick={()=>sync(batch,'sync')}>Sinkronkan tracking</button>
          <button type="button" className="vawb-primary" disabled={busy} onClick={()=>getLabel(batch)}>Ambil label AWB</button>
          {labels[batch.batch_id]&&<a className="vawb-primary vawb-link" href={labels[batch.batch_id]} target="_blank" rel="noopener noreferrer">Buka & cetak label</a>}
         </div>
         <small>Tracking resmi tersinkron dari Jubelio. Cetak dilakukan melalui PDF/viewer label kurir.</small>
        </div>:uncertain?<div className="vawb-warning">
         <p>Permintaan sebelumnya belum dipastikan oleh Jubelio. Jangan membuat booking ulang.</p>
         <button type="button" disabled={busy} onClick={()=>sync(batch,'reconcile')}>Periksa hasil booking Jubelio</button>
         <small>Hasil yang tidak pasti harus direkonsiliasi sebelum tindakan lainnya.</small>
        </div>:<>
         {next&&<div className="vawb-next">
          <p>Tahap berikutnya: <strong>{next.label}</strong>. Pastikan pekerjaan gudang selesai secara fisik sebelum konfirmasi.</p>
          <label>Catatan operator (wajib minimal 6 karakter)<textarea rows={2} minLength={6} maxLength={300} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Catatan pemeriksaan fisik, packing atau kesiapan pickup"/></label>
          <button type="button" disabled={!orderReady||busy||notes.trim().length<6} onClick={()=>nextStep(batch)}>{next.label}</button>
         </div>}
         {batch.state==='ready_for_carrier'&&!batch.manifest_id&&<div className="vawb-next">
          <p>Barang siap kirim. Buat manifest internal untuk pickup segera sebelum meminta resi.</p>
          <label>Catatan manifest (wajib minimal 6 karakter)<textarea rows={2} minLength={6} maxLength={300} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Paket diperiksa, barang lengkap, siap pickup segera"/></label>
          <button type="button" disabled={!orderReady||busy||notes.trim().length<6} onClick={()=>createManifest(batch)}>Buat manifest pickup segera</button>
         </div>}
         {batch.manifest_id&&<div className="vawb-ready"><p>Manifest sudah disiapkan. <strong>Pickup: {batch.pickup_method||'belum diketahui'}</strong></p>
          <button type="button" disabled={!orderReady||busy} onClick={()=>checkBooking(batch)}>Periksa kesiapan & tarif Jubelio</button>
         </div>}
         {attempt&&<div className="vawb-preflight">
          {attempt.attempt?<p>{attempt.attempt.message||'Booking sebelumnya terdeteksi. Periksa hasil booking.'}</p>:<>
           <h4>{attempt.canBook?'Siap meminta AWB':'Booking masih terblokir'}</h4>
           {attempt.blockers?.length>0&&<ul>{attempt.blockers.map((key,i)=><li key={key+i}>{explain[key]||key}</li>)}</ul>}
           {attempt.canBook&&<><p>{attempt.service||'Layanan kurir'} · estimasi biaya <strong>{formatIDR(Number(attempt.feeIdr))}</strong></p>
            <small>{attempt.origin||'Gudang'} → {attempt.destination||'Penerima'}. Biaya akhir bisa berubah menurut pengukuran kurir.</small>
            <button className="vawb-primary" type="button" disabled={busy} onClick={()=>book(batch)}>Konfirmasi booking & terbitkan AWB</button></>}
          </>}
         </div>}
        </>}
       </article>;
      })}
     </div>}
    </>}
   </div>
   <footer className="vawb-footer"><p>Booking AWB hanya dilakukan setelah konfirmasi admin. Tidak ada debit kurir pada saat dialog dibuka.</p>
    <button type="button" onClick={()=>{setBusy(true);setError('');void reload().then(()=>setMessage('Data pengiriman diperbarui.')).catch(e=>setError(messageOf(e))).finally(()=>setBusy(false));}} disabled={busy||loading}>Muat ulang</button>
    <button type="button" className="vawb-primary" onClick={onClose}>Selesai</button></footer>
  </section>
 </div>;
}
