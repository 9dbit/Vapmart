'use client';
import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {formatIDR} from '@/lib/types';
import {CatalogNotice,useCatalogAdmin} from './catalog-admin-shell';

type Voucher={
 id:string;code:string;discountType:'fixed'|'percent';discountValue:number;maxDiscountIdr:number|null;
 minSubtotalIdr:number;usageLimit:number|null;startsAt:string|null;endsAt:string|null;isActive:boolean;editVersion:number;
 usedPaid:number;pendingOrders:number;lifecycle:'active'|'inactive'|'scheduled'|'expired';createdAt:string;updatedAt:string;
};
type Draft={code:string;discountType:'fixed'|'percent';discountValue:string;maxDiscountIdr:string;minSubtotalIdr:string;usageLimit:string;startsAt:string;endsAt:string;isActive:boolean};
const blank:Draft={code:'',discountType:'percent',discountValue:'10',maxDiscountIdr:'',minSubtotalIdr:'0',usageLimit:'',startsAt:'',endsAt:'',isActive:true};
const life:Record<Voucher['lifecycle'],string>={active:'Aktif',inactive:'Nonaktif',scheduled:'Terjadwal',expired:'Berakhir'};
function toLocal(value:string|null){
 if(!value)return '';const d=new Date(value);if(Number.isNaN(d.valueOf()))return '';
 const off=d.getTimezoneOffset()*60000;return new Date(d.valueOf()-off).toISOString().slice(0,16);
}
function toIso(value:string){return value?new Date(value).toISOString():null;}
function fromVoucher(v:Voucher):Draft{
 return {code:v.code,discountType:v.discountType,discountValue:String(v.discountValue),maxDiscountIdr:v.maxDiscountIdr===null?'':String(v.maxDiscountIdr),
  minSubtotalIdr:String(v.minSubtotalIdr),usageLimit:v.usageLimit===null?'':String(v.usageLimit),startsAt:toLocal(v.startsAt),endsAt:toLocal(v.endsAt),isActive:v.isActive};
}
function discount(v:Voucher){return v.discountType==='percent'?v.discountValue+'%':formatIDR(v.discountValue);}
export function CatalogVouchersAdmin(){
 const api=useCatalogAdmin();
 const [items,setItems]=useState<Voucher[]>([]),[draft,setDraft]=useState<Draft>(blank),[editing,setEditing]=useState<Voucher|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[q,setQ]=useState(''),[status,setStatus]=useState('');
 const load=async()=>{
  const query=new URLSearchParams({pageSize:'100',...(q.trim()?{q:q.trim()}:{}),...(status?{status}:{})});
  const d=await api.request<{items:Voucher[]}>('vouchers?'+query.toString());setItems(d.items||[]);
 };
 useEffect(()=>{let alive=true;(async()=>{try{const d=await api.request<{items:Voucher[]}>('vouchers?pageSize=100');if(alive)setItems(d.items||[]);}catch(e){if(alive)setError(e instanceof Error?e.message:'Voucher tidak dapat dimuat');}})();return()=>{alive=false};},[]);
 const stats=useMemo(()=>({
  total:items.length,active:items.filter(x=>x.lifecycle==='active').length,scheduled:items.filter(x=>x.lifecycle==='scheduled').length,
  redeemed:items.reduce((n,x)=>n+x.usedPaid,0)
 }),[items]);
 const set=<K extends keyof Draft>(key:K,value:Draft[K])=>setDraft(d=>({...d,[key]:value}));
 const reset=()=>{setDraft(blank);setEditing(null);setError('');};
 const edit=(v:Voucher)=>{setEditing(v);setDraft(fromVoucher(v));setMessage('');setError('');window.scrollTo({top:0,behavior:'smooth'});};
 const payload=()=>{
  const value=Number(draft.discountValue),min=Number(draft.minSubtotalIdr||0),max=draft.maxDiscountIdr===''?null:Number(draft.maxDiscountIdr),limit=draft.usageLimit===''?null:Number(draft.usageLimit);
  if(!Number.isSafeInteger(value)||value<=0)throw Error('Nilai diskon harus bilangan bulat positif.');
  if(draft.discountType==='percent'&&value>100)throw Error('Diskon persen maksimal 100%.');
  if(!Number.isSafeInteger(min)||min<0)throw Error('Minimum belanja tidak valid.');
  if(max!==null&&(!Number.isSafeInteger(max)||max<=0))throw Error('Maksimum diskon tidak valid.');
  if(limit!==null&&(!Number.isSafeInteger(limit)||limit<=0))throw Error('Kuota penggunaan tidak valid.');
  if(draft.startsAt&&draft.endsAt&&Date.parse(draft.startsAt)>=Date.parse(draft.endsAt))throw Error('Waktu mulai harus lebih awal dari waktu berakhir.');
  return {code:draft.code.trim().toUpperCase(),discountType:draft.discountType,discountValue:value,maxDiscountIdr:draft.discountType==='percent'?max:null,
   minSubtotalIdr:min,usageLimit:limit,startsAt:toIso(draft.startsAt),endsAt:toIso(draft.endsAt),isActive:draft.isActive};
 };
 const save=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');setMessage('');
  try{
   const body=payload();
   if(editing)await api.request('vouchers/'+editing.id,{...body,expectedVersion:editing.editVersion},'PATCH');
   else await api.request('vouchers',body);
   await load();setMessage(editing?'Voucher diperbarui.':'Voucher dibuat.');reset();
  }catch(e){setError(e instanceof Error?e.message:'Voucher gagal disimpan');}finally{setBusy(false);}
 };
 const toggle=async(v:Voucher)=>{setBusy(true);setError('');setMessage('');
  try{await api.request('vouchers/'+v.id,{expectedVersion:v.editVersion,isActive:!v.isActive},'PATCH');await load();setMessage(v.isActive?'Voucher dinonaktifkan.':'Voucher diaktifkan.');if(editing?.id===v.id)reset();}
  catch(e){setError(e instanceof Error?e.message:'Status voucher gagal diubah');}finally{setBusy(false);}
 };
 const filter=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{await load();}catch(e){setError(e instanceof Error?e.message:'Filter voucher gagal');}finally{setBusy(false);}};
 return <>
  <section className="vc-voucher-stats" aria-label="Ringkasan voucher">
   <div><span>Total voucher</span><strong>{stats.total}</strong></div><div><span>Sedang aktif</span><strong>{stats.active}</strong></div>
   <div><span>Terjadwal</span><strong>{stats.scheduled}</strong></div><div><span>Redeem terbayar</span><strong>{stats.redeemed}</strong></div>
  </section>
  <CatalogNotice error={error} message={message}/>
  <div className="vc-voucher-layout">
   <form className="vc-panel vc-voucher-editor" onSubmit={save}>
    <div className="vc-voucher-head"><div><small>{editing?'EDIT VOUCHER':'NEW VOUCHER'}</small><h2>{editing?'Edit '+editing.code:'Buat voucher baru'}</h2></div>{editing&&<button type="button" onClick={reset}>Batal edit</button>}</div>
    <label>Kode voucher<input required minLength={3} maxLength={32} value={draft.code} onChange={e=>set('code',e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,''))} placeholder="SAVE10"/></label>
    <div className="vc-grid">
     <label>Tipe diskon<select value={draft.discountType} onChange={e=>set('discountType',e.target.value as Draft['discountType'])}><option value="percent">Persen</option><option value="fixed">Nominal IDR</option></select></label>
     <label>{draft.discountType==='percent'?'Diskon (%)':'Diskon (IDR)'}<input required type="number" min="1" max={draft.discountType==='percent'?100:2000000000} step="1" value={draft.discountValue} onChange={e=>set('discountValue',e.target.value)}/></label>
    </div>
    <div className="vc-grid">
     <label>Minimum belanja (IDR)<input type="number" min="0" step="1" value={draft.minSubtotalIdr} onChange={e=>set('minSubtotalIdr',e.target.value)}/></label>
     <label>Maksimum diskon (IDR) <span className="vc-optional">(opsional)</span><input type="number" min="1" step="1" disabled={draft.discountType==='fixed'} value={draft.discountType==='percent'?draft.maxDiscountIdr:''} onChange={e=>set('maxDiscountIdr',e.target.value)} placeholder="Tanpa batas"/></label>
    </div>
    <div className="vc-grid">
     <label>Mulai berlaku <span className="vc-optional">(opsional)</span><input type="datetime-local" value={draft.startsAt} onChange={e=>set('startsAt',e.target.value)}/></label>
     <label>Berakhir <span className="vc-optional">(opsional)</span><input type="datetime-local" value={draft.endsAt} onChange={e=>set('endsAt',e.target.value)}/></label>
    </div>
    <label>Kuota penggunaan <span className="vc-optional">(opsional)</span><input type="number" min="1" step="1" value={draft.usageLimit} onChange={e=>set('usageLimit',e.target.value)} placeholder="Tanpa batas"/></label>
    <label className="vc-switch"><input type="checkbox" checked={draft.isActive} onChange={e=>set('isActive',e.target.checked)}/><span>Status voucher: <strong>{draft.isActive?'Aktif':'Nonaktif'}</strong></span></label>
    <p className="vc-muted">Voucher aktif tetap mengikuti jadwal, minimum belanja, kuota, dan validasi server saat checkout. Membuat voucher tidak mengaktifkan payment gateway.</p>
    <button className="vc-primary" disabled={busy}>{busy?'Menyimpan...':editing?'Simpan perubahan':'Buat voucher'}</button>
   </form>
   <section className="vc-panel">
    <form className="vc-voucher-filter" onSubmit={filter}><input aria-label="Cari voucher" value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari kode voucher..."/><select aria-label="Filter status voucher" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Semua status</option><option value="active">Aktif</option><option value="scheduled">Terjadwal</option><option value="expired">Berakhir</option><option value="inactive">Nonaktif</option></select><button disabled={busy}>Terapkan</button></form>
    <div className="vc-voucher-list">{items.length===0?<div className="vc-empty"><strong>Belum ada voucher.</strong><p>Voucher baru hanya muncul setelah administrator menyimpannya.</p></div>:items.map(v=><article className="vc-voucher-card" key={v.id}>
     <div className="vc-voucher-code"><span className={'vc-voucher-life is-'+v.lifecycle}>{life[v.lifecycle]}</span><strong>{v.code}</strong><small>v{v.editVersion}</small></div>
     <div className="vc-voucher-value"><strong>{discount(v)}</strong><span>{v.discountType==='percent'&&v.maxDiscountIdr?'maks. '+formatIDR(v.maxDiscountIdr):'potongan checkout'}</span></div>
     <div className="vc-voucher-meta">
      <span>Min. belanja <strong>{formatIDR(v.minSubtotalIdr)}</strong></span><span>Kuota <strong>{v.usageLimit??'∞'}</strong></span>
      <span>Redeem paid <strong>{v.usedPaid}</strong></span><span>Order pending <strong>{v.pendingOrders}</strong></span>
     </div>
     <div className="vc-voucher-dates"><span>Mulai: {v.startsAt?new Date(v.startsAt).toLocaleString('id-ID'):'Langsung'}</span><span>Berakhir: {v.endsAt?new Date(v.endsAt).toLocaleString('id-ID'):'Tanpa batas'}</span></div>
     <div className="vc-actions"><button type="button" onClick={()=>edit(v)}>Edit</button><button type="button" className={v.isActive?'vc-danger':''} disabled={busy} onClick={()=>void toggle(v)}>{v.isActive?'Nonaktifkan':'Aktifkan'}</button></div>
    </article>)}</div>
   </section>
  </div>
 </>;
}
