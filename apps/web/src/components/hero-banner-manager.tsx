 'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import '../app/hero-banners.css';
type Banner={id:string;title:string;alt:string;desktopAssetId:string|null;mobileAssetId:string|null;desktopPath:string|null;mobilePath:string|null;active:boolean;editVersion:number;deletedAt:string|null;position:number};
type Source={id?:string|null;path?:string|null;file?:File;url?:string};
type Draft={title:string;alt:string;desktop:Source;mobile:Source};
const blank=():Draft=>({title:'',alt:'',desktop:{},mobile:{}});
function PreviewImage({source,token,alt}:{source:Source;token:string;alt:string}){
 const [remote,setRemote]=useState(''),[error,setError]=useState(false);
 useEffect(()=>{
  setRemote('');setError(false);if(!source.id||source.file)return;
  const ac=new AbortController();let url='';
  fetch('/api/admin/hero-banners/assets/'+source.id+'/content',{headers:{authorization:'Bearer '+token},cache:'no-store',signal:ac.signal})
   .then(async r=>{if(!r.ok)throw Error('Preview');return r.blob();})
   .then(b=>{if(ac.signal.aborted)return;url=URL.createObjectURL(b);setRemote(url);})
   .catch(()=>{if(!ac.signal.aborted)setError(true);});
  return()=>{ac.abort();if(url)URL.revokeObjectURL(url);};
 },[source.id,source.file,source.path,source.url,token]);
 const src=source.url||source.path||remote;
 return src&&!error?<img src={src} alt={alt} onError={()=>setError(true)}/>:<span role="status">{error?'Preview tidak tersedia':source.id?'Memuat preview...':'Belum ada gambar'}</span>;
}
export function HeroBannerManager({token}:{token:string}){
 const [items,setItems]=useState<Banner[]>([]),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [trash,setTrash]=useState(false),[editing,setEditing]=useState<Banner|null>(null),[draft,setDraft]=useState<Draft>(blank);
 const [dirty,setDirty]=useState(false),[preview,setPreview]=useState<'desktop'|'mobile'>('desktop');
 const draftKey=useRef(''),urls=useRef<string[]>([]),uploads=useRef(new Map<File,string>()),editor=useRef<HTMLElement>(null);
 const current=items.filter(b=>!b.deletedAt),deleted=items.filter(b=>b.deletedAt),shown=trash?deleted:current;
 const active=current.filter(b=>b.active).length;
 const api=useCallback(async(path:string,method='GET',data?:unknown)=>{
  const form=data instanceof FormData;
  const r=await fetch('/api/admin/hero-banners'+path,{method,headers:{authorization:'Bearer '+token,...(data&&!form?{'content-type':'application/json'}:{})},
   ...(data?{body:form?data:JSON.stringify(data)}:{}),cache:'no-store',signal:AbortSignal.timeout(35000)});
  const body=await r.json();
  if(!r.ok)throw Error(r.status===401||r.status===403?'Sesi admin berakhir atau izin tidak tersedia. Masuk kembali.':Array.isArray(body.message)?body.message.join('. '):body.message||'Permintaan gagal. Coba lagi.');
  return body;
 },[token]);
 const load=useCallback(async()=>{
  const data=await api('');
  if(!Array.isArray(data.items)||!Number.isInteger(data.revision))throw Error('Daftar banner tidak valid.');
  setItems(data.items);setRevision(data.revision);
 },[api]);
 useEffect(()=>{let mounted=true;setLoading(true);load().catch(e=>{if(mounted)setError(e.message);}).finally(()=>{if(mounted)setLoading(false);});return()=>{mounted=false;};},[load]);
 useEffect(()=>()=>{urls.current.forEach(URL.revokeObjectURL);},[]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 function cleanUrls(){urls.current.forEach(URL.revokeObjectURL);urls.current=[];uploads.current.clear();}
 function choose(b:Banner|null){
  if(dirty&&!window.confirm('Abaikan perubahan banner yang belum disimpan?'))return;
  cleanUrls();setEditing(b);setDirty(false);setError('');setNotice('');draftKey.current=crypto.randomUUID();
  setDraft(b?{title:b.title,alt:b.alt,desktop:{id:b.desktopAssetId,path:b.desktopPath},mobile:{id:b.mobileAssetId,path:b.mobilePath}}:blank());
  setTrash(false);editor.current?.scrollIntoView({behavior:'smooth',block:'start'});
 }
 function file(side:'desktop'|'mobile',f?:File){
  if(!f)return;setError('');
  if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>5242880){setError('Gunakan PNG, JPG atau WebP maksimal 5 MiB per file.');return;}
  const url=URL.createObjectURL(f);urls.current.push(url);setDraft(d=>({...d,[side]:{file:f,url}}));setDirty(true);setPreview(side);
 }
 async function uploaded(s:Source){
  if(!s.file)return s.id||undefined;
  const cached=uploads.current.get(s.file);if(cached)return cached;
  const form=new FormData();form.append('file',s.file);
  const asset=await api('/assets','POST',form);uploads.current.set(s.file,asset.id);return asset.id as string;
 }
 async function save(e:FormEvent){
  e.preventDefault();if(busy)return;
  if(!editing&&(!draft.desktop.file||!draft.mobile.file)){setError('Upload gambar desktop dan mobile sebelum menyimpan draft.');return;}
  setBusy(true);setError('');setNotice('Mengunggah dan memvalidasi gambar...');
  try{
   const desktopAssetId=await uploaded(draft.desktop),mobileAssetId=await uploaded(draft.mobile);
   if(!draftKey.current)draftKey.current=crypto.randomUUID();
   const result:Banner=await api(editing?'/'+editing.id:'',editing?'PATCH':'POST',{
    title:draft.title,alt:draft.alt,...(desktopAssetId?{desktopAssetId}:{}),...(mobileAssetId?{mobileAssetId}:{}),
    ...(editing?{expectedVersion:editing.editVersion}:{idempotencyKey:draftKey.current})});
   setEditing(result);setDraft({title:result.title,alt:result.alt,desktop:{id:result.desktopAssetId,path:result.desktopPath},mobile:{id:result.mobileAssetId,path:result.mobilePath}});cleanUrls();setDirty(false);
   await load();setNotice(result.active?'Perubahan disimpan dan tampil pada pemuatan homepage berikutnya.':'Draft tersimpan. Klik Aktifkan pada daftar untuk menampilkannya di homepage.');
  }catch(e){setNotice('');setError(e instanceof Error?e.message:'Penyimpanan gagal.');}finally{setBusy(false);}
 }
 async function action(b:Banner,kind:'state'|'trash'|'restore'){
  if(busy)return;
  if(editing?.id===b.id&&dirty){setError('Simpan atau batalkan perubahan form sebelum mengubah status banner ini.');return;}
  if(kind==='trash'&&!window.confirm('Hapus "'+b.title+'" dari homepage? Banner dipindahkan ke sampah. File original tetap disimpan.'))return;
  if(kind==='state'&&!b.active&&!window.confirm('Tampilkan "'+b.title+'" di homepage publik?'))return;
  setBusy(true);setError('');setNotice('');
  try{
   const row:Banner=await api('/'+b.id+'/'+kind,'POST',{expectedVersion:b.editVersion,...(kind==='state'?{active:!b.active}:kind==='trash'?{confirm:true}:{})});
   if(editing?.id===b.id){if(kind==='trash'){setEditing(null);setDraft(blank());cleanUrls();}else setEditing(row);}
   await load();setNotice(kind==='trash'?'Banner dihapus dari homepage. Original tetap aman di arsip.':kind==='restore'?'Banner dipulihkan sebagai draft, belum aktif.':row.active?'Banner aktif di homepage.':'Banner dinonaktifkan.');
  }catch(e){setError(e instanceof Error?e.message:'Perubahan gagal.');}finally{setBusy(false);}
 }
 async function move(b:Banner,direction:number){
  if(busy)return;if(dirty){setError('Simpan atau batalkan perubahan form sebelum mengatur urutan.');return;}
  const ids=current.map(x=>x.id),from=ids.indexOf(b.id),to=from+direction;if(to<0||to>=ids.length)return;
  [ids[from],ids[to]]=[ids[to],ids[from]];setBusy(true);setError('');
  try{await api('/reorder','POST',{ids,expectedRevision:revision});await load();setEditing(null);setDraft(blank());setNotice('Urutan banner tersimpan.');}
  catch(e){setError(e instanceof Error?e.message:'Urutan gagal disimpan.');}finally{setBusy(false);}
 }
 async function refresh(){setBusy(true);setError('');try{await load();setNotice(dirty?'Daftar diperbarui. Input form belum disimpan tetap dipertahankan.':'Daftar diperbarui.');}catch(e){setError(e instanceof Error?e.message:'Gagal memuat.');}finally{setBusy(false);}}
 return <section className="vh-root" aria-label="Pengelola Hero Banner" aria-busy={busy||loading}>
  <div className="vh-intro"><div><span className="vh-eyebrow">HOMEPAGE CONTENT</span><h2>Kelola tampilan pertama.</h2><p>Tambah, susun, dan tampilkan banner. Gambar original tetap tersimpan.</p></div>
   <button type="button" className="vh-primary" disabled={busy||loading||current.length>=30} onClick={()=>choose(null)}>+ Tambah Banner</button></div>
  <div className="vh-stats"><div><strong>{active}</strong><span>Aktif</span></div><div><strong>{current.length-active}</strong><span>Draft / nonaktif</span></div><div><strong>{deleted.length}</strong><span>Di sampah</span></div></div>
  {!loading&&!active&&revision>0&&<p className="vh-note">Tidak ada banner aktif. Area hero homepage disembunyikan, bukan diganti banner lama.</p>}
  {error&&<div className="vh-error" role="alert"><p>{error}</p><button type="button" onClick={()=>void refresh()} disabled={busy}>Muat ulang daftar</button></div>}
  {notice&&<p className="vh-notice" role="status">{notice}</p>}
  <div className="vh-workspace">
   <section className="vh-list" aria-label="Daftar banner">
    <header className="vh-list-heading"><div className="vh-switch"><button type="button" aria-pressed={!trash} onClick={()=>setTrash(false)}>Daftar ({current.length})</button><button type="button" aria-pressed={trash} onClick={()=>setTrash(true)}>Sampah ({deleted.length})</button></div><button type="button" onClick={()=>void refresh()} disabled={busy}>Refresh</button></header>
    {loading?<p role="status">Memuat banner...</p>:shown.length===0?<div className="vh-empty">{trash?'Sampah masih kosong.':'Belum ada banner. Tambahkan pasangan gambar desktop dan mobile.'}</div>:shown.map((b,index)=><article className={'vh-row'+(editing?.id===b.id?' selected':'')} key={b.id} data-banner-id={b.id}>
     <div className="vh-thumb"><PreviewImage source={{id:b.desktopAssetId,path:b.desktopPath}} token={token} alt={b.alt}/></div>
     <div className="vh-row-body"><div className="vh-row-title"><strong>{b.title}</strong><span className={'vh-badge'+(b.active?' active':'')}>{b.deletedAt?'Sampah':b.active?'Aktif':'Draft'}</span></div>
      <small>{b.deletedAt?'Original tetap tersimpan':'Urutan '+(index+1)+' / '+current.length}</small>
      <div className="vh-row-actions">{b.deletedAt?<button type="button" disabled={busy} onClick={()=>void action(b,'restore')}>Pulihkan sebagai draft</button>:<>
       <button type="button" disabled={busy} onClick={()=>choose(b)}>Edit</button>
       <button type="button" disabled={busy} onClick={()=>void action(b,'state')}>{b.active?'Nonaktifkan':'Aktifkan'}</button>
       <button type="button" aria-label={'Naikkan '+b.title} disabled={busy||index===0} onClick={()=>void move(b,-1)}>&#8593;</button>
       <button type="button" aria-label={'Turunkan '+b.title} disabled={busy||index===current.length-1} onClick={()=>void move(b,1)}>&#8595;</button>
       <button type="button" className="vh-danger" disabled={busy} onClick={()=>void action(b,'trash')}>Hapus</button>
      </>}</div></div>
    </article>)}
   </section>
   <section className="vh-editor" ref={editor} aria-label="Editor banner">
    <header><span className="vh-eyebrow">{editing?'EDIT BANNER':'BANNER BARU'}</span><h3>{editing?editing.title:'Mulai dari dua gambar.'}</h3><p>{editing?.active?'Menyimpan perubahan banner aktif akan memperbarui homepage.':'Banner baru selalu disimpan sebagai draft. Aktivasi dilakukan terpisah.'}</p></header>
    <form onSubmit={save}>
     <fieldset disabled={busy||loading||revision===0}>
      <label htmlFor="hero-title">Nama banner<input id="hero-title" value={draft.title} maxLength={120} required placeholder="Contoh: Informasi layanan" onChange={e=>{setDraft(d=>({...d,title:e.target.value}));setDirty(true);}}/></label>
      <label htmlFor="hero-alt">Teks alternatif gambar<input id="hero-alt" value={draft.alt} maxLength={240} required placeholder="Deskripsi singkat untuk aksesibilitas" onChange={e=>{setDraft(d=>({...d,alt:e.target.value}));setDirty(true);}}/></label>
      <div className="vh-uploads">{(['desktop','mobile'] as const).map(side=><label className="vh-upload" key={side} htmlFor={'hero-'+side}>
       <strong>Gambar {side==='desktop'?'desktop':'mobile'}</strong><small>{side==='desktop'?'Disarankan 1024 x 320 px':'Disarankan 1024 x 448 px'}</small>
       <input id={'hero-'+side} type="file" accept="image/png,image/jpeg,image/webp" key={(editing?.id||'new')+side+(dirty?'dirty':'clean')} onChange={e=>file(side,e.target.files?.[0])}/>
       <span>{draft[side].file?.name||((draft[side].id||draft[side].path)?'Gambar tersimpan. Pilih file untuk mengganti.':'PNG / JPG / WebP, maksimal 5 MiB')}</span>
      </label>)}</div>
      <div className="vh-preview-heading"><strong>Preview</strong><div className="vh-switch"><button type="button" aria-pressed={preview==='desktop'} onClick={()=>setPreview('desktop')}>Desktop</button><button type="button" aria-pressed={preview==='mobile'} onClick={()=>setPreview('mobile')}>Mobile</button></div></div>
      <div className={'vh-preview '+preview}><PreviewImage source={draft[preview]} token={token} alt={draft.alt||'Preview banner'}/></div>
      <p className="vh-help">Preview mengikuti crop tengah homepage. File original dipertahankan; versi tampil dioptimalkan untuk web. SVG dan gambar animasi tidak diterima.</p>
      <div className="vh-save"><button type="submit" className="vh-primary" disabled={!draft.title.trim()||!draft.alt.trim()}>{busy?'Menyimpan...':editing?'Simpan perubahan':'Simpan draft'}</button><button type="button" onClick={()=>choose(null)}>Batalkan</button></div>
     </fieldset>
    </form>
   </section>
  </div>
 </section>;
}
