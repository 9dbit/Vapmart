'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useCustomerAuth} from '@/lib/customer-auth';
import {formatIDR} from '@/lib/types';
import {Icon} from '@/components/store-icon';
import {orderStatus} from '@/lib/order-status';
type OrderRow={
 id:string;status:string;operational_status?:string;payment_status:string;
 invoice_number?:string|null;created_at:string;total_idr:string;
 product_id?:string;product_name?:string;image_url?:string|null;slug?:string|null;
 item_count?:number;total_units?:number;
 shipments?:{state:string;trackingNumber:string|null}[];
};
type OrdersResult={items:OrderRow[];total:number;hasMore:boolean;page:number;pageSize:number};
type StatusKey='all'|'pending_payment'|'processing'|'completed'|'cancelled'|'refunded';
type PeriodKey='all'|'7d'|'30d'|'90d'|'365d';
type ItemKey='all'|'single'|'multiple';
const statuses:Record<StatusKey,string>={
 all:'Semua status',pending_payment:'Belum bayar',processing:'Diproses',
 completed:'Selesai',cancelled:'Dibatalkan',refunded:'Refund'
};
const periods:Record<PeriodKey,string>={all:'Semua tanggal','7d':'7 hari','30d':'30 hari','90d':'90 hari','365d':'1 tahun'};
const itemsOptions:Record<ItemKey,string>={all:'Semua produk',single:'1 produk',multiple:'Multi-produk'};
const statusKeys=Object.keys(statuses) as StatusKey[];
const periodKeys=Object.keys(periods) as PeriodKey[];
const itemKeys=Object.keys(itemsOptions) as ItemKey[];
function badge(order:OrderRow){
 const st=orderStatus(order),payment=order.payment_status;
 if(st==='refunded'||payment==='refunded')return {label:'Refund',kind:'muted'};
 if(st==='cancelled'||st==='failed')return {label:st==='failed'?'Gagal':'Dibatalkan',kind:'muted'};
 if(st==='completed')return {label:'Selesai',kind:'success'};
 const shipments=Array.isArray(order.shipments)?order.shipments:[];
 if(payment==='paid'&&shipments.some(s=>s.state==='delivered'))return {label:'Tiba di tujuan',kind:'success'};
 if(payment==='paid'&&shipments.some(s=>['shipped','in_transit','handed_over'].includes(s.state)))return {label:'Dikirim',kind:'purple'};
 if(payment==='paid'||st==='processing')return {label:'Diproses',kind:'purple'};
 if(st==='on_hold')return {label:'Ditahan',kind:'warning'};
 if(st==='pre_order')return {label:'Pre-order',kind:'purple'};
 return {label:'Belum bayar',kind:'warning'};
}
function dateText(raw:string){return new Date(raw).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',year:'numeric'});}
function OrderCard({order}:{order:OrderRow}){
 const state=badge(order);
 const delivered=order.payment_status==='paid'&&Array.isArray(order.shipments)&&order.shipments.some(s=>s.state==='delivered');
 const primary=order.payment_status!=='paid'&&!['cancelled','refunded','failed'].includes(orderStatus(order))?'Lanjutkan pembayaran':
  delivered?'Lihat & ulas produk':'Lihat detail';
 const href='/pesanan/'+encodeURIComponent(order.id);
 return <article className="vm26-order-card" data-order-status={state.kind}>
  <header className="vm26-order-card-head">
   <div className="vm26-order-card-origin"><span className="vm26-order-bag"><Icon name="bag"/></span>
    <div><strong>Belanja</strong><time dateTime={order.created_at}>{dateText(order.created_at)}</time></div></div>
   <span className={'vm26-order-status is-'+state.kind}>{state.label}</span>
   <Link className="vm26-order-more" aria-label={'Detail pesanan '+order.id.slice(0,8)} href={href}>⋮</Link>
  </header>
  <Link className="vm26-order-item" href={href}>
   <span className="vm26-order-thumbnail">
    {order.image_url?<img src={order.image_url} width={84} height={84} alt={order.product_name||'Foto produk'} loading="lazy"/>:<Icon name="bag"/>}
   </span>
   <span className="vm26-order-item-copy"><strong>{order.product_name||'Produk pesanan'}</strong>
    <small>{Math.max(0,Number(order.total_units||0))} barang
      {Number(order.item_count)>1?' · '+(Number(order.item_count)-1)+' produk lainnya':''}</small>
   </span>
   <Icon name="next"/>
  </Link>
  <footer className="vm26-order-card-foot">
   <div><span>Total belanja</span><strong>{formatIDR(Number(order.total_idr))}</strong>
    <small>No. {order.invoice_number||order.id.slice(0,8).toUpperCase()}</small></div>
   <Link className="vm26-order-cta" href={delivered?href+'#ulasan':href}>{primary}</Link>
  </footer>
 </article>;
}
export default function OrdersPage(){
 const auth=useCustomerAuth();
 const [draft,setDraft]=useState('');
 const [query,setQuery]=useState('');
 const [status,setStatus]=useState<StatusKey>('all');
 const [period,setPeriod]=useState<PeriodKey>('all');
 const [items,setItems]=useState<ItemKey>('all');
 const [page,setPage]=useState(1);
 const [revision,setRevision]=useState(0);
 const [data,setData]=useState<OrdersResult|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  const search=new URLSearchParams(window.location.search);
  const s=search.get('status');
  const p=search.get('period');
  if(s&&statusKeys.includes(s as StatusKey))setStatus(s as StatusKey);
  if(p&&periodKeys.includes(p as PeriodKey))setPeriod(p as PeriodKey);
  const term=search.get('q')||'';
  setDraft(term.slice(0,80));setQuery(term.slice(0,80));
 },[]);
 useEffect(()=>{const timer=window.setTimeout(()=>{setQuery(draft.trim());setPage(1);},280);return()=>window.clearTimeout(timer)},[draft]);
 useEffect(()=>{
  const p=new URLSearchParams();
  if(query)p.set('q',query);
  if(status!=='all')p.set('status',status);
  if(period!=='all')p.set('period',period);
  if(items!=='all')p.set('items',items);
  const next='/pesanan'+(p.size?'?'+p.toString():'');
  if(window.location.pathname==='/pesanan')window.history.replaceState(window.history.state,'',next);
 },[query,status,period,items]);
 useEffect(()=>{
  if(!auth.accessToken){setData(null);return;}
  const controller=new AbortController();setLoading(true);setError('');
  const p=new URLSearchParams({page:String(page),pageSize:'12'});
  if(query)p.set('q',query);
  if(status!=='all')p.set('status',status);
  if(period!=='all')p.set('period',period);
  if(items!=='all')p.set('items',items);
  fetch('/api/customer/catalog/orders?'+p,{headers:{authorization:'Bearer '+auth.accessToken},cache:'no-store',signal:controller.signal})
   .then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.message||'Riwayat transaksi tidak tersedia');setData(body);})
   .catch(e=>{if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Gagal memuat transaksi');setData(null);}})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[auth.accessToken,page,query,status,period,items,revision]);
 return <main className="vm26-customer-page vm26-orders" data-page="transactions">
  <div className="vm26-page-head"><div><span className="vm26-eyebrow">VAPMART / TRANSAKSI</span><h1>Transaksi Saya</h1>
   <p>Cari pesanan, periksa pembayaran dan ikuti status pengiriman yang tercatat.</p></div>
   <Link href="/akun" className="vm26-text-link">Akun Saya <Icon name="next"/></Link></div>
  {auth.loading?<p role="status" className="vm26-loading">Memeriksa akun…</p>:!auth.user?
   <section className="vm26-empty"><Icon name="bag"/><h2>Masuk untuk melihat transaksi</h2>
    <p>Riwayat pembelian disimpan di akun pelanggan, bukan di perangkat ini.</p>
    <Link className="vm26-primary" href="/login?next=/pesanan">Masuk Akun</Link></section>:
   <>
    <div className="vm26-orders-controls">
     <form className="vm26-order-search" role="search" onSubmit={e=>{e.preventDefault();setQuery(draft.trim());}}>
      <Icon name="search"/><input aria-label="Cari transaksi" placeholder="Cari produk atau nomor pesanan" value={draft}
       onChange={e=>setDraft(e.target.value)} maxLength={80} autoComplete="off"/>
      {draft&&<button aria-label="Hapus pencarian" type="button" onClick={()=>{setDraft('');setQuery('');}}>×</button>}
     </form>
     <div className="vm26-filter-rail" role="group" aria-label="Filter transaksi">
      <label><span className="sr-only">Filter status</span><select aria-label="Semua status" value={status}
       onChange={e=>{setStatus(e.target.value as StatusKey);setPage(1);}}>
       {statusKeys.map(k=><option key={k} value={k}>{statuses[k]}</option>)}</select></label>
      <label><span className="sr-only">Filter jumlah produk</span><select aria-label="Semua produk" value={items}
       onChange={e=>{setItems(e.target.value as ItemKey);setPage(1);}}>
       {itemKeys.map(k=><option key={k} value={k}>{itemsOptions[k]}</option>)}</select></label>
      <label><span className="sr-only">Filter periode</span><select aria-label="Semua tanggal" value={period}
       onChange={e=>{setPeriod(e.target.value as PeriodKey);setPage(1);}}>
       {periodKeys.map(k=><option key={k} value={k}>{periods[k]}</option>)}</select></label>
     </div>
    </div>
    {error?<div className="vm26-empty" role="alert"><h2>Belum dapat memuat transaksi</h2><p>{error}</p>
     <button className="vm26-primary" type="button" onClick={()=>setRevision(x=>x+1)}>Coba lagi</button></div>:
     loading?<div className="vm26-order-results" role="status">{Array.from({length:3},(_,i)=><div key={i} className="vm26-order-skeleton" aria-label="Memuat kartu transaksi"/>)}</div>:
     data?.items.length?<div className="vm26-order-results">
      <p className="vm26-results-caption">{Number(data.total).toLocaleString('id-ID')} transaksi ditemukan</p>
      {data.items.map(order=><OrderCard key={order.id} order={order}/>)}
      <nav className="vm26-pagination" aria-label="Halaman riwayat transaksi">
       <button type="button" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Sebelumnya</button>
       <span>Halaman {page}</span>
       <button type="button" disabled={!data.hasMore} onClick={()=>setPage(p=>p+1)}>Berikutnya</button>
      </nav>
     </div>:
     <section className="vm26-empty"><Icon name="bag"/><h2>{query||status!=='all'||period!=='all'||items!=='all'?'Pesanan tidak ditemukan':'Belum ada transaksi'}</h2>
      <p>{query||status!=='all'||period!=='all'||items!=='all'?'Ubah filter atau kata kunci untuk melihat pesanan lainnya.':'Pesanan yang dibuat lewat akun ini akan tampil di sini.'}</p>
      {query||status!=='all'||period!=='all'||items!=='all'?<button className="vm26-secondary" type="button" onClick={()=>{setDraft('');setQuery('');setStatus('all');setPeriod('all');setItems('all');setPage(1);}}>Reset filter</button>:
       <Link href="/catalog" className="vm26-primary">Jelajahi Produk</Link>}
     </section>}
   </>}
 </main>;
}
