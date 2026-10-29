'use client';

import {useEffect,useState,type FormEvent} from 'react';
import '../studio.css';
import Link from 'next/link';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {formatIDR,type Product} from '@/lib/types';

let client:SupabaseClient|null=null;
function getClient():SupabaseClient|null {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return null;
  if(!client)client=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true}});
  return client;
}
type Draft={
  name:string;slug:string;description:string;category:string;
  price_idr:string;stock_qty:string;image_url:string;is_active:boolean;
};
const empty:Draft={name:'',slug:'',description:'',category:'lifestyle',price_idr:'',stock_qty:'0',image_url:'',is_active:false};

export default function AdminPage(){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [authorized,setAuthorized]=useState(false);
  const [checking,setChecking]=useState(true);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState('');
  const [products,setProducts]=useState<Product[]>([]);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [draft,setDraft]=useState<Draft>({...empty});
  const configured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  async function authorizedFetch(path:string,init:RequestInit={}):Promise<Response>{
    const supabase=getClient();
    if(!supabase)throw new Error('Supabase Auth belum diatur');
    const {data,error}=await supabase.auth.getSession();
    if(error || !data.session?.access_token)throw new Error('Sesi telah berakhir, silakan login ulang');
    return fetch(path,{...init,headers:{...init.headers,authorization:'Bearer '+data.session.access_token},cache:'no-store'});
  }
  async function refreshProducts():Promise<void>{
    const response=await authorizedFetch('/api/admin/products');
    if(!response.ok)throw new Error('Gagal memuat produk (HTTP '+response.status+')');
    const data=await response.json() as {items:Product[]};
    setProducts(Array.isArray(data.items)?data.items:[]);
  }

  useEffect(()=>{
    let mounted=true;
    (async()=>{
      const supabase=getClient();
      if(!supabase||!mounted){if(mounted)setChecking(false);return;}
      const {data,error}=await supabase.auth.getSession();
      if(error||!data.session?.access_token){if(mounted)setChecking(false);return;}
      try{
        const resp=await fetch('/api/admin/status',{headers:{authorization:'Bearer '+data.session.access_token}});
        if(resp.ok && mounted){
          setAuthorized(true);
          const list=await fetch('/api/admin/products',{headers:{authorization:'Bearer '+data.session.access_token}});
          if(list.ok){const data=await list.json() as {items:Product[]};if(mounted)setProducts(data.items||[]);}
        }
      }catch { /* No privilege is granted on failed validation. */ }
      finally{if(mounted)setChecking(false);}
    })();
    return()=>{mounted=false};
  },[]);

  async function signIn(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const supabase=getClient();if(!supabase)return;
    setLoading(true);setMessage('');
    try{
      const {data,error}=await supabase.auth.signInWithPassword({email,password});
      if(error||!data.session)throw new Error(error?.message||'Login gagal');
      const response=await fetch('/api/admin/status',{headers:{authorization:'Bearer '+data.session.access_token}});
      if(!response.ok){
        await supabase.auth.signOut();
        throw new Error(response.status===403?'Akun tidak memiliki izin admin':'Admin API belum siap (HTTP '+response.status+')');
      }
      setAuthorized(true);setPassword('');
      await refreshProducts();
      setMessage('Login administrator terverifikasi.');
    }catch(error){setAuthorized(false);setMessage(error instanceof Error?error.message:'Login gagal');}
    finally{setLoading(false);}
  }
  function beginEdit(product:Product){
    setEditingId(product.id);
    setDraft({
      name:product.name,slug:product.slug,description:product.description,
      category:product.category,price_idr:String(product.price_idr),stock_qty:String(product.stock_qty),
      image_url:product.image_url||'',is_active:product.is_active
    });
    setMessage('Editing: '+product.name);
  }
  function resetForm(){setEditingId(null);setDraft({...empty});}
  function field<K extends keyof Draft>(key:K,value:Draft[K]){
    setDraft(previous=>({...previous,[key]:value}));
  }
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setLoading(true);setMessage('');
    const price=Number(draft.price_idr);
    const stock=Number(draft.stock_qty);
    if(!Number.isSafeInteger(price)||price<0||!Number.isSafeInteger(stock)||stock<0){
      setMessage('Harga dan stok wajib bilangan bulat positif.');setLoading(false);return;
    }
    try{
      const payload={
        name:draft.name,slug:draft.slug,description:draft.description,category:draft.category,
        price_idr:price,stock_qty:stock,image_url:draft.image_url||null,
        is_active:editingId?draft.is_active:false
      };
      const response=await authorizedFetch(editingId?'/api/admin/products/'+editingId:'/api/admin/products',{
        method:editingId?'PATCH':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)
      });
      const result=await response.json() as {name?:string;message?:string};
      if(!response.ok)throw new Error('Tidak dapat menyimpan (HTTP '+response.status+'): '+(result.message||'Periksa data'));
      setMessage((editingId?'Produk diperbarui: ':'Draft disimpan: ')+(result.name||draft.name));
      await refreshProducts();resetForm();
    }catch(error){setMessage(error instanceof Error?error.message:'Tidak dapat menyimpan');}
    finally{setLoading(false);}
  }
  async function togglePublish(product:Product){
    setLoading(true);setMessage('');
    try{
      const response=await authorizedFetch('/api/admin/products/'+product.id,{
        method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({is_active:!product.is_active})
      });
      if(!response.ok)throw new Error('Publikasi gagal (HTTP '+response.status+')');
      await refreshProducts();
      setMessage(product.is_active?'Produk dikembalikan ke draft':'Produk telah dipublikasikan di staging');
    }catch(error){setMessage(error instanceof Error?error.message:'Gagal mengubah status');}
    finally{setLoading(false);}
  }
  async function signOut(){
    await getClient()?.auth.signOut();
    setAuthorized(false);setProducts([]);resetForm();setMessage('Anda telah keluar.');
  }

  return <main className="admin-page main-container">
    <Link className="back-link" href="/">← Kembali ke toko</Link>
    <div className="admin-banner">
      <p className="eyebrow">MANAGEMENT CONSOLE / STAGING</p>
      <h1>Vapmart Studio.</h1>
      <p>Kelola katalog produk non-nikotin, draft, publikasi, harga, dan stok. Checkout tetap dinonaktifkan.</p>
    </div>
    {!configured?<div className="admin-panel"><h2>Authentication not configured</h2><p>Proyek Supabase Auth khusus Vapmart belum dihubungkan. Dashboard tidak membuka akses admin tanpa konfigurasi dan role yang valid.</p></div>
     :checking?<div className="admin-panel"><h2>Memeriksa sesi...</h2></div>
     :!authorized?<form className="admin-panel admin-form" onSubmit={signIn}>
       <h2>Administrator sign in</h2>
       <label>Email<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label>
       <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
       <button type="submit" className="button button-dark" disabled={loading}>{loading?'Verifying...':'Masuk administrator'}</button>
     </form>
     :<div className="studio-layout">
       <section className="admin-panel studio-catalog">
         <div className="studio-head"><div><p className="eyebrow">PRODUCT MANAGER</p><h2>Produk <span className="muted">{products.length}</span></h2></div>
           <button className="studio-minor-button" type="button" onClick={()=>{resetForm();setMessage('Produk baru disimpan sebagai draft.');}}>+ Produk baru</button>
         </div>
         <div className="studio-list">{products.length===0?<p className="fine-print">Belum ada produk. Tambahkan produk pertama melalui form.</p>
           :products.map(product=><article className="studio-product" key={product.id}>
             <div className="studio-product-body">
               <div className="studio-swatch">{product.image_url?<img src={product.image_url} alt=""/>:<span>✳</span>}</div>
               <div className="studio-product-meta"><strong>{product.name}</strong><span>{formatIDR(product.price_idr)} · Stok {product.stock_qty}</span>
                 <small className={product.is_active?'studio-active':'studio-draft'}>{product.is_active?'Published':'Draft'}</small>
               </div>
             </div>
             <div className="studio-actions"><button type="button" onClick={()=>beginEdit(product)} disabled={loading}>Edit</button>
               <button type="button" onClick={()=>togglePublish(product)} disabled={loading}>{product.is_active?'Unpublish':'Publish'}</button>
             </div>
           </article>)}</div>
         <button className="admin-signout" type="button" onClick={signOut}>Sign out</button>
       </section>
       <form className="admin-panel admin-form studio-editor" onSubmit={save}>
         <p className="eyebrow">{editingId?'EDIT PRODUCT':'NEW PRODUCT'}</p>
         <h2>{editingId?'Edit produk':'Tambah produk'}</h2>
         <p className="fine-print">{editingId?'Perubahan stok, harga, dan status berlaku setelah tersimpan.':'Produk baru selalu dimulai sebagai draft.'}</p>
         <label>Nama produk<input value={draft.name} required minLength={2} maxLength={140}
           onChange={e=>setDraft(s=>({...s,name:e.target.value,slug:editingId?s.slug:e.target.value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g,'').trim().replace(/ +/g,'-')}))}/></label>
         <label>Slug<input value={draft.slug} required onChange={e=>field('slug',e.target.value)}/></label>
         <label>Deskripsi<textarea rows={3} maxLength={3000} value={draft.description} onChange={e=>field('description',e.target.value)}/></label>
         <label>Kategori<select value={draft.category} onChange={e=>field('category',e.target.value)}>
           {['home','lifestyle','decor','accessories','electronics','other'].map(c=><option value={c} key={c}>{c}</option>)}
         </select></label>
         <div className="admin-cols">
           <label>Harga IDR<input type="number" min="0" step="1" required value={draft.price_idr} onChange={e=>field('price_idr',e.target.value)}/></label>
           <label>Stok<input type="number" min="0" step="1" required value={draft.stock_qty} onChange={e=>field('stock_qty',e.target.value)}/></label>
         </div>
         <label>URL gambar (HTTPS)<input type="url" value={draft.image_url} onChange={e=>field('image_url',e.target.value)} placeholder="https://..."/></label>
         {editingId&&<label className="studio-switch"><input type="checkbox" checked={draft.is_active} onChange={e=>field('is_active',e.target.checked)}/> Tampilkan di katalog</label>}
         <button className="button button-dark" disabled={loading} type="submit">{loading?'Menyimpan...':editingId?'Simpan perubahan ↗':'Simpan draft ↗'}</button>
         {editingId&&<button className="studio-minor-button" type="button" onClick={resetForm}>Batalkan edit</button>}
       </form>
     </div>}
     {message&&<p className="admin-message" role="status">{message}</p>}
  </main>;
}
