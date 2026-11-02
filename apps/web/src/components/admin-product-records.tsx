'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {formatIDR,type Product} from '@/lib/types';
import type {ProductRecord,ProductRecordResponse,ProductRecordSummary} from '@/lib/admin-product-records';
import '../app/admin-product-records.css';

export function useProductRecordSummary(token:string|null,products:Product[]){
 const [summary,setSummary]=useState<ProductRecordSummary|null>(null),[error,setError]=useState(''),[version,setVersion]=useState(0);
 const reload=useCallback(()=>setVersion(n=>n+1),[]);
 useEffect(()=>{
  if(!token){setSummary(null);setError('');return;}
  const controller=new AbortController();
  fetch('/api/admin/product-records?pageSize=1',{headers:{authorization:'Bearer '+token},cache:'no-store',signal:controller.signal})
   .then(async r=>{if(!r.ok)throw Error('Jumlah produk belum dapat diverifikasi');return r.json();})
   .then(x=>{if(!x.summary||!Number.isSafeInteger(x.summary.total))throw Error('Data ringkasan tidak valid');setSummary(x.summary);setError('');})
   .catch(e=>{if(!controller.signal.aborted){setSummary(null);setError(e instanceof Error?e.message:'Sinkronisasi gagal');}});
  return()=>controller.abort();
 },[token,products,version]);
 return {summary,error,reload};
}

function RecordImage({record,token,large=false}:{record:ProductRecord;token:string;large?:boolean}){
 const [source,setSource]=useState(''),[failed,setFailed]=useState(false);
 useEffect(()=>{
  setSource('');setFailed(false);
  if(record.record_kind==='managed'){setSource(record.image_url||'');return;}
  if(!record.media_id){setFailed(true);return;}
  const controller=new AbortController();let objectUrl='';
  fetch('/api/admin/media-library/'+encodeURIComponent(record.media_id)+'/content',{
   headers:{authorization:'Bearer '+token},cache:'no-store',signal:controller.signal
  }).then(async r=>{if(!r.ok)throw Error('Foto tidak dapat diakses');const blob=await r.blob();
   if(!['image/png','image/jpeg','image/webp'].includes(blob.type))throw Error('Format foto tidak valid');
   if(controller.signal.aborted)return;
   objectUrl=URL.createObjectURL(blob);setSource(objectUrl);
  }).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
  return()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[record.record_id,record.media_id,record.image_url,record.record_kind,token]);
 return <div className={'vpr-image'+(large?' vpr-image-large':'')}>
  {source&&!failed?<img src={source} alt={large?record.name:''} loading="lazy" onError={()=>setFailed(true)}/>:
   <span>{failed?'Foto belum terhubung':'Memuat foto'}</span>}
 </div>;
}

function RecordDetails({record,token,onClose}:{record:ProductRecord;token:string;onClose:()=>void}){
 const modal=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=modal.current;if(node&&!node.open)node.showModal();return()=>{if(node?.open)node.close();};},[]);
 const existing=record.record_kind==='existing';
 return <dialog ref={modal} className="vpr-dialog" onCancel={onClose} onClose={onClose} aria-labelledby="product-record-title">
  <div className="vpr-dialog-head"><span>{existing?'DATA PRODUK EXISTING':'DATA PRODUK OPERASIONAL'}</span>
   <button type="button" onClick={onClose} aria-label="Tutup detail produk">×</button></div>
  <h2 id="product-record-title">{record.name}</h2>
  <div className="vpr-details-layout">
   <RecordImage record={record} token={token} large/>
   <dl>
    <div><dt>Brand sumber</dt><dd>{record.brand||'Belum diisi'}</dd></div>
    <div><dt>Kategori</dt><dd>{record.category}</dd></div>
    <div><dt>SKU</dt><dd>{record.sku||'Tidak tersedia pada sumber'}</dd></div>
    <div><dt>Stok</dt><dd>{record.stock_qty===null?'Belum diverifikasi':record.stock_qty}</dd></div>
    <div><dt>{existing?'Harga historis':'Harga operasional'}</dt><dd>{existing?record.historical_price||'Tidak tersedia':formatIDR(record.price_idr||0)}</dd></div>
    {existing&&record.historical_original_price&&<div><dt>Harga pembanding historis</dt><dd>{record.historical_original_price}</dd></div>}
    <div><dt>Asal data</dt><dd>{record.source_snapshot}</dd></div>
    <div><dt>Status</dt><dd>{existing?'Tersinkron untuk pemeriksaan internal':record.is_active?'Tayang':'Draf'}</dd></div>
    <div><dt>Foto</dt><dd>{existing?(record.media_id?'Terhubung ke Media Library privat':'Perlu pemeriksaan pemetaan media'):record.image_url?'Tersedia':'Belum diisi'}</dd></div>
   </dl>
  </div>
  <details className="vpr-provenance"><summary>Identitas dan sumber asli</summary>
   <p>Slug: <code>{record.slug}</code></p><p>Record: <code>{record.record_id}</code></p>
   {record.original_path&&<p>Path sumber: <code>{record.original_path}</code></p>}
   <p>Tanggal record: {new Date(record.source_updated_at).toLocaleString('id-ID')}</p>
  </details>
  {existing&&<p className="vpr-note">Nama, foto, kategori, brand, dan harga di atas dipertahankan dari sumber existing. SKU, stok, varian, deskripsi lengkap, berat, dan harga saat ini belum terverifikasi. Record ini bersifat internal/read-only, tidak dipublikasikan atau dimasukkan ke checkout.</p>}
  <div className="vpr-dialog-actions"><Link href="/admin/media" className="vma26-btn-light">Buka Media Library</Link>
   <button type="button" className="vma26-btn-dark" onClick={onClose}>Selesai</button></div>
 </dialog>;
}

export function AdminProductRecords({token,products,onEdit,onPublish,onNew,onSynced,busy}:{
 token:string;products:Product[];onEdit:(product:Product)=>void;onPublish:(product:Product)=>void;
 onNew:()=>void;onSynced:()=>void;busy:boolean;
}){
 const [data,setData]=useState<ProductRecordResponse|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [q,setQ]=useState(''),[source,setSource]=useState('all'),[status,setStatus]=useState('all');
 const [brand,setBrand]=useState(''),[category,setCategory]=useState(''),[page,setPage]=useState(1),[revision,setRevision]=useState(0);
 const [selected,setSelected]=useState<ProductRecord|null>(null);
 const [settledQuery,setSettledQuery]=useState('');
 useEffect(()=>{const timer=setTimeout(()=>{setSettledQuery(q);setPage(1);},250);return()=>clearTimeout(timer);},[q]);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');setSelected(null);
  const params=new URLSearchParams({q:settledQuery,source,status,brand,category,page:String(page),pageSize:'24'});
  fetch('/api/admin/product-records?'+params,{headers:{authorization:'Bearer '+token},cache:'no-store',signal:controller.signal})
   .then(async r=>{const x=await r.json();if(!r.ok)throw Error(typeof x.message==='string'?x.message:'Data produk belum dapat dimuat');
    if(!Array.isArray(x.items)||!x.summary)throw Error('Respons daftar produk tidak lengkap');
    if(controller.signal.aborted)return;
    if(x.pages>0&&page>x.pages){setPage(x.pages);return;}
    setData(x);
   }).catch(e=>{if(!controller.signal.aborted){setData(null);setError(e instanceof Error?e.message:'Sinkronisasi gagal');}})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[token,settledQuery,source,status,brand,category,page,revision,products]);
 function refresh(){setRevision(n=>n+1);onSynced();}
 function filter(update:()=>void){update();setPage(1);}
 return <section className="vma26-panel vpr-panel" aria-labelledby="product-records-heading">
  <div className="vma26-section-head"><div><p className="vma26-eyebrow">UNIFIED PRODUCT RECORDS</p>
   <h2 id="product-records-heading">Semua produk <span>{data?.summary.total??'…'}</span></h2></div>
   <button className="vma26-btn-dark" type="button" onClick={onNew}>+ Produk baru</button></div>
  <p className="vpr-note">Produk existing dan katalog operasional ditampilkan di satu tempat, langsung dari PostgreSQL. Tidak ada salinan produk baru setiap sinkronisasi.</p>
  <div className="vpr-toolbar"><button type="button" className="vma26-btn-light" disabled={loading} onClick={refresh}>{loading?'Memuat data…':'↻ Sinkronkan ulang'}</button>
   <span role="status">{data?`${data.summary.existing} existing · ${data.summary.managed} operasional · ${data.summary.existing_media_linked}/${data.summary.existing} foto existing terhubung`:'Memeriksa sumber data…'}</span></div>
  <div className="vpr-search"><label>Cari produk<input type="search" value={q} maxLength={120} onChange={e=>setQ(e.target.value)} placeholder="Nama, SKU, brand, atau slug"/></label></div>
  <div className="vpr-filters">
   <label>Sumber<select aria-label="Filter sumber produk" value={source} onChange={e=>filter(()=>setSource(e.target.value))}><option value="all">Semua produk</option><option value="existing">Existing</option><option value="managed">Operasional</option></select></label>
   <label>Status<select aria-label="Filter status produk" value={status} onChange={e=>filter(()=>setStatus(e.target.value))}><option value="all">Semua status</option><option value="unverified">Perlu verifikasi</option><option value="draft">Draf</option><option value="published">Tayang</option></select></label>
   <label>Brand<select aria-label="Filter brand produk" value={brand} onChange={e=>filter(()=>setBrand(e.target.value))}><option value="">Semua brand</option>{data?.facets.brands.map(b=><option key={b} value={b}>{b}</option>)}</select></label>
   <label>Kategori<select aria-label="Filter kategori produk" value={category} onChange={e=>filter(()=>setCategory(e.target.value))}><option value="">Semua kategori</option>{data?.facets.categories.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
  </div>
  {error&&<p role="alert" className="vpr-error">{error}. Data tidak dianggap kosong. <button type="button" onClick={refresh}>Coba lagi</button></p>}
  <div className="vpr-list" aria-busy={loading}>
   {data?.items.map(r=><article key={r.record_id} className="vpr-row" data-kind={r.record_kind}>
    <RecordImage record={r} token={token}/>
    <div className="vpr-row-info"><strong>{r.name}</strong><small>{r.brand||'Tanpa brand'} · {r.category}</small>
     <small>SKU: {r.sku||'Belum tersedia'} · Stok: {r.stock_qty===null?'Belum diverifikasi':r.stock_qty}</small>
     <small>{r.record_kind==='existing'?'Harga historis: '+(r.historical_price||'Belum tersedia'):'Harga: '+formatIDR(r.price_idr||0)}</small>
     <span className="vpr-source-badge">{r.record_kind==='existing'?'Existing · Pemeriksaan internal':r.is_active?'Operasional · Tayang':'Operasional · Draf'}</span></div>
    <div className="vpr-row-actions"><button type="button" onClick={()=>setSelected(r)}>Lihat data</button>
     {r.record_kind==='managed'&&r.product&&<><button type="button" disabled={busy} onClick={()=>onEdit(r.product!)}>Edit</button>
      <button type="button" disabled={busy} onClick={()=>onPublish(r.product!)}>{r.is_active?'Unpublish':'Publish'}</button></>}
    </div>
   </article>)}
   {!loading&&!error&&data?.items.length===0&&<p>Tidak ada produk yang cocok dengan filter. <button type="button" className="vma26-btn-light" onClick={()=>{setQ('');setSource('all');setStatus('all');setBrand('');setCategory('');setPage(1);}}>Reset filter</button></p>}
   {loading&&!data&&<p>Memuat record dan memeriksa pemetaan foto…</p>}
  </div>
  {data&&<footer className="vpr-pagination"><span>{data.matched} hasil · Halaman {data.pages?data.page:0}/{data.pages}</span><div>
   <button type="button" disabled={loading||page===1} onClick={()=>setPage(n=>n-1)} aria-label="Halaman produk sebelumnya">←</button>
   <button type="button" disabled={loading||!data.hasMore} onClick={()=>setPage(n=>n+1)} aria-label="Halaman produk berikutnya">→</button></div></footer>}
  {data&&<p className="vpr-provenance-note">Dibaca ulang: {new Date(data.syncedAt).toLocaleString('id-ID')}. Cakupan existing: snapshot halaman yang tersedia, belum bukti ekspor lengkap WooCommerce. Harga historis bukan harga jual saat ini; record existing tidak memiliki aksi publikasi.</p>}
  {selected&&<RecordDetails record={selected} token={token} onClose={()=>setSelected(null)}/>}
 </section>;
}
