'use client';
import {useEffect,useMemo,useState} from 'react';
import '../app/admin-media-library.css';
type Asset={id:string;filename:string;title:string;kind:string;mime_type:string;size_bytes:number;sha256:string;original_path:string;source_path:string|null;notes:string;visibility:'internal';imported_at:string};
const folders=[['all','Semua aset'],['banner','Banner'],['category_icon','Ikon kategori'],['brand_logo','Logo brand'],['product_image','Foto produk'],['article_image','Artikel'],['site_logo','Logo Vapmart']] as const;
const label=(kind:string)=>folders.find(f=>f[0]===kind)?.[1]||kind;
const size=(n:number)=>n>=1048576?(n/1048576).toFixed(2)+' MB':(n/1024).toFixed(1)+' KB';
function PrivateImage({asset,token,large=false}:{asset:Asset;token:string;large?:boolean}){
 const [src,setSrc]=useState(''),[error,setError]=useState('');
 useEffect(()=>{
  const ac=new AbortController();let url='';setSrc('');setError('');
  fetch('/api/admin/media-library/'+asset.id+'/content',{headers:{authorization:'Bearer '+token},signal:ac.signal,cache:'no-store'})
   .then(async r=>{if(!r.ok)throw Error(r.status===401?'Sesi berakhir':'Preview tidak tersedia');return r.blob();})
   .then(blob=>{if(ac.signal.aborted)return;url=URL.createObjectURL(blob);setSrc(url);})
   .catch(e=>{if(!ac.signal.aborted)setError(e instanceof Error?e.message:'Gagal memuat');});
  return()=>{ac.abort();if(url)URL.revokeObjectURL(url);};
 },[asset.id,token]);
 return <div className={'vml-image'+(large?' vml-image-large':'')}>
  {src?<img src={src} alt={asset.title} loading="lazy"/>:<span role="status">{error||'Memuat gambar...'}</span>}
 </div>;
}
export function AdminMediaLibrary({token}:{token:string|null}){
 const [assets,setAssets]=useState<Asset[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [folder,setFolder]=useState('all'),[query,setQuery]=useState(''),[page,setPage]=useState(0),[selected,setSelected]=useState<string|null>(null);
 const [title,setTitle]=useState(''),[notes,setNotes]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{
  if(!token){setAssets([]);setLoading(false);return;}
  const ac=new AbortController();setLoading(true);setError('');
  fetch('/api/admin/media-library',{headers:{authorization:'Bearer '+token},signal:ac.signal,cache:'no-store'})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.message||d.code||'Gagal memuat Media Library');return d;})
   .then(d=>{if(!ac.signal.aborted)setAssets(d.items||[]);})
   .catch(e=>{if(!ac.signal.aborted)setError(e instanceof Error?e.message:'Library belum tersedia');})
   .finally(()=>{if(!ac.signal.aborted)setLoading(false);});
  return()=>ac.abort();
 },[token]);
 const filtered=useMemo(()=>assets.filter(a=>(folder==='all'||a.kind===folder)&&[a.filename,a.title,a.original_path,a.source_path||'',a.notes].join(' ').toLowerCase().includes(query.trim().toLowerCase())),[assets,folder,query]);
 const current=assets.find(a=>a.id===selected)||null;
 const pages=Math.max(1,Math.ceil(filtered.length/12));
 const shown=filtered.slice(Math.min(page,pages-1)*12,Math.min(page,pages-1)*12+12);
 useEffect(()=>{setPage(0);},[query,folder]);
 useEffect(()=>{setTitle(current?.title||'');setNotes(current?.notes||'');setNotice('');},[current?.id]);
 async function download(){
  if(!current||!token)return;setBusy(true);setNotice('');
  try{
   const r=await fetch('/api/admin/media-library/'+current.id+'/content',{headers:{authorization:'Bearer '+token},cache:'no-store'});
   if(!r.ok)throw Error('Unduhan memerlukan sesi admin aktif');
   const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download=current.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setNotice(e instanceof Error?e.message:'Unduhan gagal');}finally{setBusy(false);}
 }
 async function save(){
  if(!current||!token)return;setBusy(true);setNotice('');
  try{
   const r=await fetch('/api/admin/media-library/'+current.id,{method:'PATCH',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({title:title.trim(),notes:notes.trim()})});
   const d=await r.json();if(!r.ok)throw Error(d.message||d.code||'Penyimpanan gagal');
   setAssets(prev=>prev.map(a=>a.id===current.id?{...a,title:d.title,notes:d.notes}:a));
   setNotice('Catatan internal disimpan. File asli tidak diubah.');
  }catch(e){setNotice(e instanceof Error?e.message:'Penyimpanan gagal');}finally{setBusy(false);}
 }
 if(!token)return <section className="vma26-panel"><h2>Media Library</h2><p>Login administrator diperlukan.</p></section>;
 return <section className="vml-root" aria-label="Media Library internal">
  <header className="vml-heading"><div><p className="vma26-eyebrow">VAPMART / PRIVATE MEDIA LIBRARY</p><h2>Media & Aset</h2><p>Seluruh gambar asli tersimpan di PostgreSQL. Preview, pencarian, dan catatan internal dalam satu tempat.</p></div><span className="vml-private">Internal · Admin only</span></header>
  <div className="vml-stats"><div><small>File tersimpan</small><strong>{assets.length}</strong></div><div><small>Ukuran asli</small><strong>{size(assets.reduce((n,a)=>n+a.size_bytes,0))}</strong></div><div><small>Integritas</small><strong>SHA-256</strong></div><div><small>Publikasi otomatis</small><strong>OFF</strong></div></div>
  {loading?<p role="status">Memuat aset tersimpan...</p>:error?<p className="vml-error" role="alert">{error}</p>:<>
   <div className="vml-tools"><label className="vml-search">Cari file<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nama, folder sumber atau catatan..."/></label><span>{filtered.length} dari {assets.length} aset</span></div>
   <nav className="vml-folders" aria-label="Kategori media">{folders.map(([id,name])=><button type="button" key={id} className={folder===id?'active':''} onClick={()=>setFolder(id)}>{name} <span>{id==='all'?assets.length:assets.filter(a=>a.kind===id).length}</span></button>)}</nav>
   <div className="vml-workspace"><div><div className="vml-grid">{shown.map(a=><button type="button" key={a.id} className={'vml-card'+(selected===a.id?' selected':'')} onClick={()=>setSelected(a.id)} aria-label={'Lihat aset '+a.filename}>
    <PrivateImage asset={a} token={token}/><div className="vml-card-info"><small>{label(a.kind)}</small><strong>{a.title}</strong><span>{a.mime_type.replace('image/','').toUpperCase()} · {size(a.size_bytes)}</span></div>
   </button>)}</div>{!filtered.length&&<p className="vma26-panel">Tidak ada aset yang sesuai pencarian.</p>}
    <div className="vml-pagination"><button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Sebelumnya</button><span>{Math.min(page,pages-1)+1} / {pages}</span><button type="button" disabled={page>=pages-1} onClick={()=>setPage(p=>p+1)}>Berikutnya</button></div>
   </div><aside className="vml-detail">{current?<>
     <div className="vml-detail-head"><h3>Detail aset</h3><button type="button" onClick={()=>setSelected(null)} aria-label="Tutup detail">×</button></div>
     <PrivateImage asset={current} token={token} large/>
     <label>Nama internal<input maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label>
     <label>Catatan<textarea rows={3} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Catatan penggunaan sebelumnya atau referensi tim"/></label>
     <dl><dt>File asli</dt><dd>{current.filename}</dd><dt>Ukuran / format</dt><dd>{size(current.size_bytes)} · {current.mime_type}</dd><dt>Lokasi sumber</dt><dd>{current.original_path}</dd>{current.source_path&&<><dt>Sumber impor</dt><dd>{current.source_path}</dd></>}<dt>Checksum SHA-256</dt><dd className="vml-hash">{current.sha256}</dd></dl>
     <div className="vml-actions"><button type="button" className="vml-primary" onClick={save} disabled={busy||!title.trim()}>Simpan catatan</button><button type="button" onClick={download} disabled={busy}>Unduh original</button></div>
     {notice&&<p role="status" className="vml-notice">{notice}</p>}
    </>:<div className="vml-empty-detail"><h3>Preview file asli</h3><p>Pilih gambar untuk melihat ukuran penuh, sumber, checksum dan catatan. Tidak ada file yang dipublikasikan dari halaman ini.</p></div>}</aside></div>
   <p className="vml-footnote">Library menyimpan media, bukan stok atau SKU aktif. File sumber dipertahankan tanpa mengubah gambar. Tampilan storefront dan semua kontrol pembayaran tetap tidak berubah.</p>
  </>}
 </section>;
}
