'use client';
import {useEffect,useState} from 'react';
import {useCustomerAuth} from '@/lib/customer-auth';
import {CatalogNotice,useCatalogAdmin} from './catalog-admin-shell';

function ReviewPhotos({ids}:{ids:string[]}){
 const auth=useCustomerAuth();
 const [urls,setUrls]=useState<string[]>([]),[error,setError]=useState('');
 const key=ids.join(',');
 useEffect(()=>{
  if(!auth.accessToken||!key){setUrls([]);return;}
  const controller=new AbortController();
  const created:string[]=[];
  setError('');
  Promise.all(key.split(',').map(async id=>{
   if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('ID foto tidak valid');
   const r=await fetch('/api/admin/catalog/review-photos/'+id,{
    headers:{authorization:'Bearer '+auth.accessToken},signal:controller.signal,cache:'no-store'
   });
   if(!r.ok)throw Error('Foto ulasan tidak dapat ditampilkan');
   const file=await r.blob();if(file.type!=='image/webp'||file.size>1572864)throw Error('Foto ulasan tidak valid');
   const url=URL.createObjectURL(file);created.push(url);return url;
  })).then(v=>{if(!controller.signal.aborted)setUrls(v);})
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Foto ulasan gagal dimuat')});
  return()=>{controller.abort();created.forEach(URL.revokeObjectURL);};
 },[auth.accessToken,key]);
 if(!ids.length)return null;
 return <div className="vc-review-photos"><h4>Foto pembeli untuk moderasi</h4>
  {urls.map((url,i)=><img key={url} src={url} alt={'Foto ulasan '+(i+1)} width={112} height={112}/>)}
  {!urls.length&&!error&&<small role="status">Memuat foto privat…</small>}
  {error&&<small role="alert">{error}</small>}
 </div>;
}

export function CatalogReviewsAdmin(){const {request}=useCatalogAdmin(),[data,setData]=useState<any>(null),[status,setStatus]=useState('pending'),[q,setQ]=useState(''),[page,setPage]=useState(1),[rev,setRev]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false),[replies,setReplies]=useState<Record<string,string>>({});
 useEffect(()=>{let live=true;setError('');request('reviews?'+new URLSearchParams({status,q,page:String(page),pageSize:'20'})).then(d=>{if(live){setData(d);setReplies(Object.fromEntries(d.items.map((r:any)=>[r.id,r.reply||''])))}}).catch(e=>setError(e.message));return()=>{live=false}},[status,q,page,rev]);
 async function moderate(r:any,next:string){setBusy(true);setError('');try{await request('reviews/'+r.id+'/moderate',{expectedVersion:r.edit_version,status:next,reply:replies[r.id]||''});setRev(x=>x+1);}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <><div className="vc-panel"><h2>Review Pembeli</h2><p className="vc-muted">Hanya ulasan dari pembeli yang memiliki item pesanan terkirim dan pembayaran terverifikasi. Tidak ada pembuatan ulasan oleh admin.</p><div className="vc-grid"><label>Status ulasan<select value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}>{[['','Semua'],['pending','Menunggu moderasi'],['approved','Disetujui'],['rejected','Ditolak'],['spam','Spam'],['trash','Sampah']].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><label>Cari ulasan<input type="search" value={q} onChange={e=>{setQ(e.target.value);setPage(1)}}/></label></div></div><CatalogNotice error={error}/>{!data?<p role="status">Memuat ulasan...</p>:<>{!data.items.length&&<section className="vc-panel vc-empty">Belum ada ulasan sesuai filter. Rating tidak dibuat otomatis.</section>}{data.items.map((r:any)=><article className="vc-review-item" key={r.id}><h3>{r.product_name}</h3><p><strong>{r.display_name}</strong> | {r.rating}/5 | Pembelian terverifikasi | {new Date(r.created_at).toLocaleDateString('id-ID')}</p><span className="vc-chip">{r.status}</span><p style={{whiteSpace:'pre-wrap'}}>{r.body}</p><ReviewPhotos ids={Array.isArray(r.photo_ids)?r.photo_ids:[]}/><label>Balasan admin<textarea rows={3} maxLength={2000} value={replies[r.id]||''} onChange={e=>setReplies({...replies,[r.id]:e.target.value})}/></label><div className="vc-actions"><button disabled={busy} className="vc-primary" onClick={()=>moderate(r,'approved')}>Setujui dan simpan balasan</button><button disabled={busy} onClick={()=>moderate(r,'pending')}>Tunda</button><button disabled={busy} onClick={()=>moderate(r,'rejected')}>Tolak</button><button disabled={busy} onClick={()=>moderate(r,'spam')}>Spam</button><button disabled={busy} className="vc-danger" onClick={()=>{if(confirm('Pindahkan ulasan ke Sampah?'))void moderate(r,'trash')}}>Sampah</button></div></article>)}<div className="vc-pagination"><button disabled={page===1} onClick={()=>setPage(x=>x-1)}>Sebelumnya</button><span>Halaman {page}</span><button disabled={!data.hasMore} onClick={()=>setPage(x=>x+1)}>Berikutnya</button></div></>}</>;
}
