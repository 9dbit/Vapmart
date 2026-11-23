'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {CatalogNotice,useCatalogAdmin} from './catalog-admin-shell';
import {PriceFields,StockFields,stockDrafts,stockPayload,inputDate,pricesPayload,type Lookup} from './catalog-editor-fields';
import {formatIDR} from '@/lib/types';
type BulkSelection={id:string;name:string;sku:string|null;expectedVersion:number};
type BulkStatus='ready'|'blocked'|'published'|'failed'|'skipped';
type BulkRow={id:string;name?:string;status:BulkStatus;message?:string};
type BulkReport={ready?:number;blocked?:number;published?:number;failed?:number;skipped?:number;results:BulkRow[];limit?:number};
const MAX_BULK_PUBLISH=50;
export function CatalogProductList(){
 const {request}=useCatalogAdmin();const [data,setData]=useState<any>(null),[lookups,setLookups]=useState<Lookup|null>(null),[q,setQ]=useState(''),[search,setSearch]=useState(''),[status,setStatus]=useState(''),[cat,setCat]=useState(''),[page,setPage]=useState(1),[rev,setRev]=useState(0),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[family,setFamily]=useState<any>(null),[quick,setQuick]=useState<any>(null),[quickId,setQuickId]=useState('');const [selected,setSelected]=useState<Record<string,BulkSelection>>({}),[report,setReport]=useState<BulkReport|null>(null);const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{let live=true;request<Lookup>('lookups').then(d=>{if(live)setLookups(d)}).catch(e=>setError(e.message));return()=>{live=false}},[rev]);
 useEffect(()=>{let live=true;setLoading(true);setError('');request('products?'+new URLSearchParams({q:search,status,category:cat,page:String(page),pageSize:'24'})).then(d=>{if(live)setData(d)}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[search,status,cat,page,rev]);
 function choose(d:any,id:string){if(!lookups)return;const p=[d.product,...d.variants].find(p=>p.id===id);setQuickId(id);setQuick({...p,price_idr:String(p.price_idr),sale_price_idr:p.sale_price_idr==null?'':String(p.sale_price_idr),sale_starts_at:inputDate(p.sale_starts_at),sale_ends_at:inputDate(p.sale_ends_at),sku:p.sku||'',stocks:stockDrafts(lookups,d.stock,id)});}
 async function open(p:any){if(!lookups)return;setBusy(true);setError('');try{const d=await request('products/'+p.id);setFamily(d);choose(d,d.product.product_type==='variable'?d.variants[0]?.id:d.product.id);dialog.current?.showModal();}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function save(){if(!quick)return;setBusy(true);setError('');try{await request('products/'+quickId+'/quick',{expectedVersion:quick.edit_version,sku:quick.sku,...pricesPayload(quick),warehouseStocks:stockPayload(quick.stocks)});dialog.current?.close();setNotice('SKU, harga dan stok tersimpan.');setRev(x=>x+1);}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function publish(p:any){if(!confirm(p.is_active?'Nonaktifkan produk?':'Publikasikan produk terverifikasi ini?'))return;setBusy(true);setError('');try{await request('products/'+p.id+'/state',{expectedVersion:p.edit_version,active:!p.is_active});setSelected(prev=>{const next={...prev};delete next[p.id];return next});setReport(null);setNotice(p.is_active?'Produk dinonaktifkan.':'Produk berhasil dipublikasikan.');setRev(x=>x+1);}catch(e){setError((e as Error).message)}finally{setBusy(false)}}

 const selectedRows=Object.values(selected);
 const draftOnPage=(data?.items||[]).filter((p:any)=>!p.is_active);
 const everyDraftOnPage=draftOnPage.length>0&&draftOnPage.every((p:any)=>Boolean(selected[p.id]));
 function toggleDraft(p:any){
  if(busy||p.is_active)return;
  setError('');setReport(null);
  setSelected(prev=>{
   if(prev[p.id]){const next={...prev};delete next[p.id];return next;}
   if(Object.keys(prev).length>=MAX_BULK_PUBLISH){setError('Maksimal 50 draft dalam sekali publish. Kurangi pilihan terlebih dahulu.');return prev;}
   return {...prev,[p.id]:{id:p.id,name:p.name,sku:p.sku||null,expectedVersion:p.edit_version}};
  });
 }
 function toggleVisibleDrafts(){
  if(busy)return;
  setReport(null);
  const missingDrafts=draftOnPage.filter((p:any)=>!selected[p.id]).length;
  const available=MAX_BULK_PUBLISH-selectedRows.length;
  setError(!everyDraftOnPage&&missingDrafts>available
   ?'Batas 50 produk tercapai. Publikasikan pilihan ini sebelum memilih batch berikutnya.':'');
  setSelected(prev=>{
   const next={...prev};
   if(everyDraftOnPage){for(const p of draftOnPage)delete next[p.id];}
   else{
    for(const p of draftOnPage){
     if(Object.keys(next).length>=MAX_BULK_PUBLISH)break;
     next[p.id]={id:p.id,name:p.name,sku:p.sku||null,expectedVersion:p.edit_version};
    }

   }
   return next;
  });
 }
 async function publishSelected(){
  if(busy||!selectedRows.length)return;
  setBusy(true);setError('');setNotice('');setReport(null);
  const snapshot=selectedRows;
  const payload={items:snapshot.map(({id,expectedVersion})=>({id,expectedVersion}))};
  try{
   const check=await request<BulkReport>('products/bulk/preview',payload);
   setReport(check);
   const ready=check.results.filter(item=>item.status==='ready');
   if(!ready.length){setNotice('Belum ada draft yang lolos validasi. Periksa alasan di bawah dan lengkapi produknya.');return;}
   const message=check.blocked
    ?`${ready.length} produk siap terbit; ${check.blocked} draft belum lengkap dan akan dilewati. Lanjutkan publish produk yang siap?`
    :`Publikasikan ${ready.length} produk yang sudah lengkap ke katalog Vapmart?`;
   if(!window.confirm(message))return;
   const prepared=new Map(snapshot.map(item=>[item.id,item.expectedVersion]));
   const validated=ready.filter(item=>prepared.has(item.id)).map(item=>({id:item.id,expectedVersion:prepared.get(item.id)!}));
   const outcome=await request<BulkReport>('products/bulk/publish',{items:validated});
   const names=new Map(snapshot.map(item=>[item.id,item.name]));
   const merged=check.results.filter(item=>item.status==='blocked')
    .concat(outcome.results.map(item=>({...item,name:item.name||names.get(item.id)})));
   setReport({...outcome,blocked:check.blocked||0,results:merged});
   const succeeded=new Set(outcome.results.filter(item=>item.status==='published').map(item=>item.id));
   setSelected(prev=>Object.fromEntries(Object.entries(prev).filter(([id])=>!succeeded.has(id))));
   setNotice(`${outcome.published||0} produk dipublikasikan; ${(check.blocked||0)+(outcome.failed||0)+(outcome.skipped||0)} produk belum terbit. Produk yang gagal tetap Draft.`);
   setRev(x=>x+1);
  }catch(e){setError((e as Error).message||'Publish massal gagal. Coba muat ulang daftar.');}
  finally{setBusy(false);}
 }
 return <><div className="vc-toolbar"><h2>Semua Produk</h2><div className="vc-actions"><Link className="vc-button" href="/admin/products/import">Impor Produk</Link><Link className="vc-button vc-primary" href="/admin/products/new">Tambah Produk</Link></div></div>
 <form className="vc-panel vc-grid" onSubmit={e=>{e.preventDefault();setSearch(q);setPage(1)}}><label>Cari nama atau SKU<input type="search" value={q} onChange={e=>setQ(e.target.value)}/></label><div className="vc-actions"><button type="submit">Cari</button><button type="button" onClick={()=>setRev(x=>x+1)}>Muat ulang</button></div><label>Status<select value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}><option value="">Semua status</option><option value="draft">Draft</option><option value="published">Tayang</option></select></label><label>Kategori<select value={cat} onChange={e=>{setCat(e.target.value);setPage(1)}}><option value="">Semua kategori</option>{lookups?.categories.map(c=><option key={c.id} value={c.slug}>{c.name}</option>)}</select></label></form>
 <section className="vc-bulk-toolbar" aria-label="Publish massal produk draft">
  <div className="vc-bulk-toolbar-title"><strong>Publish massal Draft</strong><small>Pilih produk satu per satu atau semua Draft pada halaman ini. Maksimal 50 produk per batch. Sistem memvalidasi setiap produk sebelum ditayangkan.</small></div>
  <div className="vc-bulk-toolbar-actions">
   <button type="button" onClick={()=>{setStatus('draft');setPage(1)}} disabled={busy}>Lihat Draft</button>
   <button type="button" disabled={busy||!draftOnPage.length} onClick={toggleVisibleDrafts}>{everyDraftOnPage?'Batalkan pilihan halaman':'Pilih Draft halaman ini'}</button>
   <button type="button" disabled={busy||!selectedRows.length} onClick={()=>{setSelected({});setReport(null);}}>Kosongkan</button>
   <button type="button" className="vc-primary" disabled={busy||!selectedRows.length}
    onClick={()=>{void publishSelected()}}>{busy?'Memeriksa produk...':`Publikasikan ${selectedRows.length} terpilih`}</button>
  </div>
  <p className="vc-bulk-count" role="status">{selectedRows.length} dari {MAX_BULK_PUBLISH} produk dipilih{selectedRows.length>0?' (pilihan tetap tersimpan saat berpindah halaman).':''}</p>
 </section>
 {report&&<section className="vc-bulk-results" aria-label="Hasil pemeriksaan publish" aria-live="polite">
  <strong>{report.published!=null?`Hasil publish: ${report.published} berhasil`:`Pemeriksaan: ${report.ready||0} siap publish`}</strong>
  <span>{(report.blocked||0)+(report.failed||0)+(report.skipped||0)} belum diterbitkan</span>
  {report.results.some(x=>x.status!=='published'&&x.status!=='ready')&&<ul>
   {report.results.filter(x=>x.status!=='published'&&x.status!=='ready').map(x=><li key={x.id}>
    <Link href={'/admin/products/'+x.id}>{x.name||selected[x.id]?.name||x.id}</Link>
    <span>{x.message||'Lengkapi dan simpan produk terlebih dahulu.'}</span>
   </li>)}
  </ul>}
 </section>}
 <CatalogNotice error={error} message={notice}/>{loading?<p role="status">Memuat produk...</p>:data&&<><p className="vc-muted">{data.total} produk utama. Varian berada di dalam produk induk.</p><div className="vc-list">{data.items.map((p:any)=><article className={'vc-product'+(selected[p.id]?' is-bulk-selected':'')} key={p.id}><div className="vc-gallery">
 {!p.is_active&&<label className="vc-bulk-pick"><input type="checkbox" checked={Boolean(selected[p.id])} disabled={busy} onChange={()=>toggleDraft(p)} aria-label={'Pilih draft '+p.name}/><span>Pilih untuk publish</span></label>}{[p.image_url,...p.gallery_urls||[]].filter(Boolean).map((src:string)=><a href={src} key={src} target="_blank" rel="noreferrer"><img src={src} alt={p.name}/></a>)}</div><div><h3><Link href={'/admin/products/'+p.id}>{p.name}</Link></h3><span className="vc-chip">{p.is_active?'Tayang':'Draft'}</span><span className="vc-chip">{p.product_type==='variable'?p.variants_count+' varian':'Simple'}</span><p>SKU: {p.sku||'Belum diisi'} | {p.brand_name||'Tanpa brand'}</p><p>{p.product_type==='variable'?'Harga per SKU varian':formatIDR(Number(p.price_idr))}{p.product_type!=='variable'&&p.sale_price_idr!=null&&<> / Promo {formatIDR(Number(p.sale_price_idr))}</>}</p><p>Tersedia: <strong>{Number(p.available_qty)}</strong> | {(p.category_names||[]).join(', ')}</p></div><div className="vc-product-actions"><Link className="vc-button" href={'/admin/products/'+p.id}>Edit lengkap</Link><button type="button" disabled={busy||!lookups||p.product_type==='variable'&&!p.variants_count} onClick={()=>open(p)}>Edit Cepat</button><button type="button" disabled={busy} onClick={()=>publish(p)}>{p.is_active?'Nonaktifkan':'Publikasikan'}</button></div></article>)}</div>{!data.items.length&&<section className="vc-panel vc-empty">Belum ada produk sesuai filter. Tambah produk baru atau tinjau data arsip di bawah.</section>}<div className="vc-pagination"><button disabled={page<=1} onClick={()=>setPage(x=>x-1)}>Sebelumnya</button><span>{page} / {Math.max(1,Math.ceil(data.total/24))}</span><button disabled={!data.hasMore} onClick={()=>setPage(x=>x+1)}>Berikutnya</button></div></>}
 <section className="vc-panel"><h2>Arsip produk existing</h2><p className="vc-muted">Kelola referensi arsip dari halaman terpisah agar daftar operasional tetap ringan. Konversi hanya menghasilkan draft privat, tanpa publikasi otomatis.</p><Link className="vc-button" href="/admin/products/arsip">Tinjau dan konversi arsip</Link></section>
 <dialog ref={dialog} className="vc-dialog"><div className="vc-toolbar"><h2>Edit Cepat</h2><button type="button" onClick={()=>dialog.current?.close()}>Tutup</button></div><p>{family?.product.name}</p>{family?.product.product_type==='variable'&&<label>Pilih SKU varian<select value={quickId} onChange={e=>choose(family,e.target.value)}>{family.variants.map((v:any)=><option key={v.id} value={v.id}>{Object.values(v.option_values).join(' / ')} | {v.sku||'Tanpa SKU'}</option>)}</select></label>}{quick&&lookups&&<><label>SKU<input value={quick.sku} maxLength={64} onChange={e=>setQuick({...quick,sku:e.target.value.toUpperCase()})}/></label><PriceFields value={quick} onChange={(k,v)=>setQuick({...quick,[k]:v})}/><StockFields value={quick.stocks} lookups={lookups} onChange={s=>setQuick({...quick,stocks:s})}/><CatalogNotice error={error}/><div className="vc-actions"><button disabled={busy} type="button" className="vc-primary" onClick={save}>Simpan Edit Cepat</button><button type="button" onClick={()=>dialog.current?.close()}>Batal</button></div></>}</dialog>
 </>;
}
