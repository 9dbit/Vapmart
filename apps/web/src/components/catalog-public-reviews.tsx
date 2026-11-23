'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {useCustomerAuth} from '@/lib/customer-auth';
import '../app/catalog-store.css';

type PublicReview={id:string;display_name:string;rating:number;body:string;reply:string|null;created_at:string;photos?:string[];verified_purchase:boolean};
type PublicReviewResult={items:PublicReview[];average:number;total:number;hasMore:boolean};
type EligibleLine={order_item_id:string;order_id:string;product_name:string};
const permitted=new Set(['image/png','image/jpeg','image/webp']);
function Stars({rating}:{rating:number}){
 return <span className="vcs-review-stars" aria-label={rating+' dari 5 bintang'}>{Array.from({length:5},(_,i)=><span key={i} aria-hidden="true">{i<Math.round(rating)?'★':'☆'}</span>)}</span>;
}
function toBase64(file:File):Promise<string>{
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>{const raw=String(reader.result||'');const sep=raw.indexOf(',');sep>0?resolve(raw.slice(sep+1)):reject(Error('Foto tidak dapat dibaca'));};
  reader.onerror=()=>reject(Error('Foto tidak dapat dibaca'));
  reader.readAsDataURL(file);
 });
}
export function CatalogPublicReviews({slug}:{slug:string}){
 const [data,setData]=useState<PublicReviewResult|null>(null);
 const [error,setError]=useState('');
 const [page,setPage]=useState(1),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setError('');setData(null);
  fetch('/api/catalog/reviews/'+encodeURIComponent(slug)+'?page='+page+'&pageSize=10',{cache:'no-store',signal:controller.signal})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.message||'Ulasan belum tersedia');setData(d);})
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Ulasan tidak tersedia')});
  return()=>controller.abort();
 },[slug,page,retry]);
 return <div className="vcs-reviews" aria-labelledby="vcs-review-heading">
  <h2 id="vcs-review-heading">Ulasan pembeli</h2>
  {error?<p role="alert">{error} <button type="button" onClick={()=>setRetry(x=>x+1)}>Coba lagi</button></p>:
   !data?<p role="status">Memuat ulasan pembeli…</p>:
    data.total===0?<p>Belum ada ulasan pembeli terverifikasi untuk produk ini.</p>:<>
     <div className="vcs-review-summary">
      <Stars rating={data.average}/><strong>{data.average.toFixed(1)}</strong>
      <span>Dari {data.total} ulasan pembelian terverifikasi</span>
     </div>
     {data.items.map(review=><article key={review.id} className="vcs-review">
      <div className="vcs-review-author"><strong>{review.display_name}</strong>
       {review.verified_purchase&&<small>Pembelian terverifikasi</small>}</div>
      <Stars rating={review.rating}/>
      <small>{new Date(review.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</small>
      <p>{review.body}</p>
      {Array.isArray(review.photos)&&review.photos.length>0&&<div className="vcs-review-media" aria-label="Foto pembeli">
       {review.photos.map((src,i)=><a href={src} target="_blank" rel="noopener noreferrer" key={src} aria-label={'Buka foto ulasan '+(i+1)}>
        <img src={src} alt={'Foto ulasan '+(i+1)} width={84} height={84} loading="lazy" decoding="async"/></a>)}
      </div>}
      {review.reply&&<div><strong>Balasan Vapmart</strong><p>{review.reply}</p></div>}
     </article>)}
     {data.total>10&&<nav className="vcs-actions" aria-label="Halaman ulasan">
      <button type="button" disabled={page===1} onClick={()=>setPage(x=>x-1)}>Sebelumnya</button>
      <span>{page}</span>
      <button type="button" disabled={!data.hasMore} onClick={()=>setPage(x=>x+1)}>Berikutnya</button>
     </nav>}
    </>}
 </div>;
}
export function BuyerReviewForm({orderId}:{orderId:string}){
 const auth=useCustomerAuth();
 const [items,setItems]=useState<EligibleLine[]>([]);
 const [line,setLine]=useState('');
 const [name,setName]=useState(''),[rating,setRating]=useState('5'),[body,setBody]=useState('');
 const [photos,setPhotos]=useState<File[]>([]);
 const [uploadedIds,setUploadedIds]=useState<string[]>([]);
 const [notice,setNotice]=useState(''),[error,setError]=useState('');
 const [busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{
  if(!auth.accessToken)return;
  const controller=new AbortController();
  fetch('/api/customer/catalog/review-eligible',{
   headers:{authorization:'Bearer '+auth.accessToken},signal:controller.signal,cache:'no-store'
  }).then(async r=>{const d=await r.json();if(!r.ok)throw Error('Kelayakan ulasan belum dapat diverifikasi');
   const mine=(d.items||[]).filter((x:EligibleLine)=>x.order_id===orderId);
   if(!controller.signal.aborted){setItems(mine);setLine(mine[0]?.order_item_id||'');}
  }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Gagal memuat ulasan')});
  return()=>controller.abort();
 },[auth.accessToken,orderId,revision]);
 useEffect(()=>{setPhotos([]);setUploadedIds([]);},[line]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   if(!auth.accessToken)throw Error('Masuk untuk mengulas produk.');
   if(photos.length>3)throw Error('Maksimal 3 foto per ulasan.');
   const ids=[...uploadedIds];
   for(let i=ids.length;i<photos.length;i++){
    const file=photos[i];
    if(!permitted.has(file.type)||file.size<16||file.size>1572864)throw Error('Foto harus JPEG, PNG, atau WebP, maksimal 1,5 MB per foto.');
    const response=await fetch('/api/customer/catalog/review-photos',{
     method:'POST',cache:'no-store',
     headers:{authorization:'Bearer '+auth.accessToken,'content-type':'application/json'},
     body:JSON.stringify({orderItemId:line,filename:file.name,mimeType:file.type,base64:await toBase64(file)})
    });
    const data=await response.json();
    if(!response.ok||typeof data.id!=='string')throw Error(data.message||'Gagal mengunggah foto ulasan');
    ids.push(data.id);setUploadedIds([...ids]);
   }
   const response=await fetch('/api/customer/catalog/reviews',{
    method:'POST',cache:'no-store',
    headers:{authorization:'Bearer '+auth.accessToken,'content-type':'application/json'},
    body:JSON.stringify({orderItemId:line,displayName:name,rating:Number(rating),body,photoIds:ids})
   });
   const data=await response.json();
   if(!response.ok)throw Error(data.message||'Gagal menyimpan ulasan');
   setBody('');setPhotos([]);setUploadedIds([]);
   setNotice('Ulasan dan foto dikirim untuk moderasi. Akan tampil setelah disetujui.');
   setRevision(x=>x+1);
  }catch(e){setError(e instanceof Error?e.message:'Tidak dapat mengirim ulasan')}
  finally{setBusy(false);}
 }
 if(!items.length)return <section className="vcs-reviews"><h2>Ulasan pembelian</h2>
  <p>{notice||'Ulasan tersedia untuk barang yang sudah dibayar dan diterima serta belum pernah diulas.'}</p>
  {error&&<p role="alert">{error}</p>}</section>;
 return <form className="vcs-reviews" onSubmit={submit}>
  <h2>Tulis ulasan pembelian</h2>
  <div className="vcs-form">
   <label>Item pesanan
    <select value={line} onChange={e=>setLine(e.target.value)} required>
     {items.map(x=><option key={x.order_item_id} value={x.order_item_id}>{x.product_name}</option>)}
    </select></label>
   <label>Nama tampilan<input value={name} minLength={2} maxLength={60} required onChange={e=>setName(e.target.value)}/></label>
   <label>Rating<select value={rating} onChange={e=>setRating(e.target.value)}>
    {[5,4,3,2,1].map(n=><option value={n} key={n}>{n} dari 5</option>)}</select></label>
   <label>Ulasan<textarea rows={4} minLength={10} maxLength={2000} required value={body} onChange={e=>setBody(e.target.value)}/></label>
  </div>
  <label className="vcs-review-photos-input">Foto produk (opsional, maksimal 3)
   <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy}
    onChange={e=>{setPhotos(Array.from(e.target.files||[]));setUploadedIds([]);}}/>
   <small>Foto hanya ditampilkan setelah pembelian dan ulasan diverifikasi. JPEG/PNG/WebP otomatis dikonversi ke WebP, maksimum 1,5 MB tiap foto.</small>
   {photos.length>0&&<small>{photos.length} foto dipilih: {photos.map(x=>x.name).join(', ')}</small>}
  </label>
  <button className="vco26-button" type="submit" disabled={busy||!line}>{busy?'Mengirim ulasan…':'Kirim ulasan'}</button>
  {error&&<p role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
 </form>;
}
