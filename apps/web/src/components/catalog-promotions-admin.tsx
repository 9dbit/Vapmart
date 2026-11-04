'use client';
import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {formatIDR} from '@/lib/types';
import {CatalogNotice,useCatalogAdmin} from './catalog-admin-shell';

type Target={id:string;name:string};
type Promo={id:string;slug:string;title:string;description:string;startsAt:string;endsAt:string;status:'draft'|'published'|'archived';lifecycle:'draft'|'scheduled'|'active'|'expired'|'archived';memberOnly:boolean;discountType:'percentage'|'fixed';discountValue:number;minimumSpendIdr:number;maxUsesPerUser:number;autoApply:boolean;stackingRule:'exclusive'|'with_voucher';scopeMode:'all'|'products'|'categories';maxDiscountIdr:number|null;priority:number;editVersion:number;usedPaid:number;products:Target[];categories:Target[]};
type Draft={slug:string;title:string;description:string;startsAt:string;endsAt:string;status:'draft'|'published'|'archived';memberOnly:boolean;discountType:'percentage'|'fixed';discountValue:string;minimumSpendIdr:string;maxUsesPerUser:string;autoApply:boolean;stackingRule:'exclusive'|'with_voucher';scopeMode:'all'|'products'|'categories';maxDiscountIdr:string;priority:string;productIds:string[];categoryIds:string[]};
type Lookup={id:string;name:string;is_active?:boolean};
type Product={id:string;name:string};

function local(d:Date){const x=new Date(d.valueOf()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,16)}
function fresh():Draft{const now=new Date(),end=new Date(now.valueOf()+7*86400000);return {slug:'',title:'',description:'',startsAt:local(now),endsAt:local(end),status:'draft',memberOnly:false,discountType:'percentage',discountValue:'10',minimumSpendIdr:'0',maxUsesPerUser:'0',autoApply:true,stackingRule:'exclusive',scopeMode:'all',maxDiscountIdr:'',priority:'100',productIds:[],categoryIds:[]}}
function slugify(v:string){return v.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)}
const life={draft:'Draft',scheduled:'Terjadwal',active:'Aktif',expired:'Berakhir',archived:'Arsip'} as const;

export function CatalogPromotionsAdmin(){
 const api=useCatalogAdmin();
 const [items,setItems]=useState<Promo[]>([]),[categories,setCategories]=useState<Lookup[]>([]),[products,setProducts]=useState<Product[]>([]);
 const [draft,setDraft]=useState<Draft>(fresh),[editing,setEditing]=useState<Promo|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const load=async()=>{const d=await api.request<{items:Promo[]}>('promotions?pageSize=100');setItems(d.items||[])};
 useEffect(()=>{let live=true;(async()=>{try{const [p,l,pr]=await Promise.all([api.request<{items:Promo[]}>('promotions?pageSize=100'),api.request<{categories:Lookup[]}>('lookups'),api.request<{items:Product[]}>('products?pageSize=100&status=published')]);if(live){setItems(p.items||[]);setCategories((l.categories||[]).filter(x=>x.is_active!==false));setProducts(pr.items||[])}}catch(e){if(live)setError(e instanceof Error?e.message:'Campaign gagal dimuat')}})();return()=>{live=false}},[]);
 const stats=useMemo(()=>({active:items.filter(x=>x.lifecycle==='active').length,scheduled:items.filter(x=>x.lifecycle==='scheduled').length,used:items.reduce((n,x)=>n+x.usedPaid,0)}),[items]);
 const set=<K extends keyof Draft>(k:K,v:Draft[K])=>setDraft(d=>({...d,[k]:v}));
 const reset=()=>{setDraft(fresh());setEditing(null)};
 const edit=(v:Promo)=>{setEditing(v);setDraft({slug:v.slug,title:v.title,description:v.description,startsAt:local(new Date(v.startsAt)),endsAt:local(new Date(v.endsAt)),status:v.status,memberOnly:v.memberOnly,discountType:v.discountType,discountValue:String(v.discountValue),minimumSpendIdr:String(v.minimumSpendIdr),maxUsesPerUser:String(v.maxUsesPerUser),autoApply:v.autoApply,stackingRule:v.stackingRule,scopeMode:v.scopeMode,maxDiscountIdr:v.maxDiscountIdr===null?'':String(v.maxDiscountIdr),priority:String(v.priority),productIds:v.products.map(x=>x.id),categoryIds:v.categories.map(x=>x.id)});window.scrollTo({top:0,behavior:'smooth'})};
 const payload=()=>({slug:draft.slug,title:draft.title,description:draft.description,startsAt:new Date(draft.startsAt).toISOString(),endsAt:new Date(draft.endsAt).toISOString(),status:draft.status,memberOnly:draft.memberOnly,discountType:draft.discountType,discountValue:Number(draft.discountValue),minimumSpendIdr:Number(draft.minimumSpendIdr||0),maxUsesPerUser:Number(draft.maxUsesPerUser||0),autoApply:draft.autoApply,stackingRule:draft.stackingRule,scopeMode:draft.scopeMode,maxDiscountIdr:draft.discountType==='percentage'&&draft.maxDiscountIdr?Number(draft.maxDiscountIdr):null,priority:Number(draft.priority||100),productIds:draft.scopeMode==='products'?draft.productIds:[],categoryIds:draft.scopeMode==='categories'?draft.categoryIds:[]});
 const save=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');setMessage('');try{const body=payload();if(editing)await api.request('promotions/'+editing.id,{...body,expectedVersion:editing.editVersion},'PATCH');else await api.request('promotions',body);await load();setMessage('Campaign tersimpan.');reset()}catch(e){setError(e instanceof Error?e.message:'Campaign gagal disimpan')}finally{setBusy(false)}};
 const status=async(v:Promo,next:'draft'|'published'|'archived')=>{setBusy(true);setError('');try{await api.request('promotions/'+v.id,{expectedVersion:v.editVersion,status:next},'PATCH');await load();setMessage(next==='published'?'Campaign dipublish.':next==='archived'?'Campaign diarsipkan.':'Campaign dikembalikan ke draft.')}catch(e){setError(e instanceof Error?e.message:'Status gagal diubah')}finally{setBusy(false)}};
 return <>
  <section className="vc-voucher-stats"><div><span>Total campaign</span><strong>{items.length}</strong></div><div><span>Aktif</span><strong>{stats.active}</strong></div><div><span>Terjadwal</span><strong>{stats.scheduled}</strong></div><div><span>Redeem paid</span><strong>{stats.used}</strong></div></section>
  <CatalogNotice error={error} message={message}/>
  <div className="vc-promo-layout">
   <form className="vc-panel vc-promo-editor" onSubmit={save}>
    <div className="vc-voucher-head"><div><small>{editing?'EDIT CAMPAIGN':'NEW CAMPAIGN'}</small><h2>{editing?editing.title:'Buat campaign promo'}</h2></div>{editing&&<button type="button" onClick={reset}>Batal</button>}</div>
    <label>Judul<input required value={draft.title} onChange={e=>{const title=e.target.value;setDraft(d=>({...d,title,slug:editing?d.slug:slugify(title)}))}}/></label>
    <label>Slug<input required value={draft.slug} onChange={e=>set('slug',slugify(e.target.value))}/></label>
    <label>Deskripsi<textarea rows={3} maxLength={2000} value={draft.description} onChange={e=>set('description',e.target.value)}/></label>
    <div className="vc-grid"><label>Mulai<input type="datetime-local" required value={draft.startsAt} onChange={e=>set('startsAt',e.target.value)}/></label><label>Berakhir<input type="datetime-local" required value={draft.endsAt} onChange={e=>set('endsAt',e.target.value)}/></label></div>
    <div className="vc-grid"><label>Status<select value={draft.status} onChange={e=>set('status',e.target.value as Draft['status'])}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label><label>Priority<input type="number" min="0" max="10000" value={draft.priority} onChange={e=>set('priority',e.target.value)}/></label></div>
    <div className="vc-grid"><label>Tipe diskon<select value={draft.discountType} onChange={e=>set('discountType',e.target.value as Draft['discountType'])}><option value="percentage">Persen</option><option value="fixed">Nominal IDR</option></select></label><label>Nilai diskon<input type="number" min="1" max={draft.discountType==='percentage'?100:2000000000} value={draft.discountValue} onChange={e=>set('discountValue',e.target.value)}/></label></div>
    <div className="vc-grid"><label>Minimum belanja<input type="number" min="0" value={draft.minimumSpendIdr} onChange={e=>set('minimumSpendIdr',e.target.value)}/></label><label>Maksimum diskon<input type="number" min="1" disabled={draft.discountType==='fixed'} value={draft.maxDiscountIdr} onChange={e=>set('maxDiscountIdr',e.target.value)} placeholder="Tanpa batas"/></label></div>
    <div className="vc-grid"><label>Max / user <small>(0 = tanpa batas)</small><input type="number" min="0" value={draft.maxUsesPerUser} onChange={e=>set('maxUsesPerUser',e.target.value)}/></label><label>Stacking<select value={draft.stackingRule} onChange={e=>set('stackingRule',e.target.value as Draft['stackingRule'])}><option value="exclusive">Tidak + voucher</option><option value="with_voucher">Boleh + voucher</option></select></label></div>
    <div className="vc-grid"><label>Scope<select value={draft.scopeMode} onChange={e=>setDraft(d=>({...d,scopeMode:e.target.value as Draft['scopeMode'],productIds:[],categoryIds:[]}))}><option value="all">Semua produk</option><option value="products">Produk tertentu</option><option value="categories">Kategori tertentu</option></select></label><label className="vc-switch"><input type="checkbox" checked={draft.memberOnly} onChange={e=>set('memberOnly',e.target.checked)}/><span>Khusus member ACTIVE</span></label></div>
    {draft.scopeMode==='products'&&<label>Target produk<select multiple size={7} value={draft.productIds} onChange={e=>set('productIds',Array.from(e.currentTarget.selectedOptions,x=>x.value))}>{products.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
    {draft.scopeMode==='categories'&&<label>Target kategori<select multiple size={7} value={draft.categoryIds} onChange={e=>set('categoryIds',Array.from(e.currentTarget.selectedOptions,x=>x.value))}>{categories.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
    <label className="vc-switch"><input type="checkbox" checked={draft.autoApply} onChange={e=>set('autoApply',e.target.checked)}/><span>Auto-apply di checkout</span></label>
    <p className="vc-muted">Maksimal satu campaign otomatis per order. Priority lebih kecil menang; jika sama, potongan terbesar dipilih.</p>
    <button className="vc-primary" disabled={busy}>{busy?'Menyimpan...':'Simpan campaign'}</button>
   </form>
   <section className="vc-panel"><div className="vc-voucher-list">{items.length===0?<div className="vc-empty">Belum ada campaign.</div>:items.map(v=><article className="vc-promo-card" key={v.id}>
    <div className="vc-promo-main"><span className={'vc-voucher-life is-'+v.lifecycle}>{life[v.lifecycle]}</span><strong>{v.title}</strong><small>{v.slug} · v{v.editVersion}</small></div>
    <div className="vc-voucher-value"><strong>{v.discountType==='percentage'?v.discountValue+'%':formatIDR(v.discountValue)}</strong><span>{v.scopeMode==='all'?'Semua produk':v.scopeMode==='products'?v.products.length+' produk':v.categories.length+' kategori'}</span></div>
    <div className="vc-promo-badges"><span>{v.autoApply?'AUTO':'MANUAL'}</span><span>{v.stackingRule==='with_voucher'?'+ VOUCHER':'EXCLUSIVE'}</span>{v.memberOnly&&<span>MEMBER</span>}<span>P{v.priority}</span></div>
    <div className="vc-voucher-meta"><span>Min. <strong>{formatIDR(v.minimumSpendIdr)}</strong></span><span>Max/user <strong>{v.maxUsesPerUser||'∞'}</strong></span><span>Redeem <strong>{v.usedPaid}</strong></span><span>Max diskon <strong>{v.maxDiscountIdr?formatIDR(v.maxDiscountIdr):'∞'}</strong></span></div>
    <div className="vc-voucher-dates"><span>{new Date(v.startsAt).toLocaleString('id-ID')}</span><span>→ {new Date(v.endsAt).toLocaleString('id-ID')}</span></div>
    <div className="vc-actions"><button type="button" onClick={()=>edit(v)}>Edit</button>{v.status==='published'?<button type="button" disabled={busy} onClick={()=>void status(v,'draft')}>Unpublish</button>:v.status!=='archived'?<button type="button" disabled={busy} onClick={()=>void status(v,'published')}>Publish</button>:null}{v.status!=='archived'&&<button type="button" className="vc-danger" disabled={busy} onClick={()=>void status(v,'archived')}>Arsipkan</button>}</div>
   </article>)}</div></section>
  </div>
 </>;
}
