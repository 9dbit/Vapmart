'use client';
import {useEffect,useMemo,useState,type FormEvent,type ChangeEvent} from 'react';
import Link from 'next/link';
import {useCustomerAuth} from '@/lib/customer-auth';
import {formatIDR,type Product} from '@/lib/types';
import '../admin-v26.css';

type Brand={id:string;name:string;slug:string;description:string;logo_url:string|null;is_active:boolean};
type Order={id:string;status:string;payment_status:string;contact_name:string;contact_email:string;city:string;province:string;total_idr:string;payment_method:string;created_at:string};
type ProductDraft={name:string;slug:string;sku:string;description:string;category:string;price_idr:string;stock_qty:string;brand_id:string;image_url:string;gallery_urls:string[];is_active:boolean};
type BrandDraft={name:string;slug:string;description:string;logo_url:string;is_active:boolean};
type Tab='overview'|'products'|'brands'|'orders';
const categories=['home','lifestyle','decor','accessories','electronics','other'];
const blankProduct:ProductDraft={name:'',slug:'',sku:'',description:'',category:'lifestyle',price_idr:'',stock_qty:'0',brand_id:'',image_url:'',gallery_urls:[],is_active:false};
const blankBrand:BrandDraft={name:'',slug:'',description:'',logo_url:'',is_active:true};
const slugify=(text:string)=>text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 -]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-');
function labelDate(date:string){const d=new Date(date);return Number.isNaN(d.valueOf())?'-':d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function statusError(response:Response,payload:unknown){const data=(payload||{}) as {message?:string|string[];code?:string};return typeof data.message==='string'?data.message:Array.isArray(data.message)?data.message.join(', '):data.code||'HTTP '+response.status;}
function Pill({active,children,onClick}:{active:boolean;children:React.ReactNode;onClick:()=>void}){return <button type="button" className={'vma26-pill'+(active?' active':'')} onClick={onClick}>{children}</button>;}

export default function AdminPage(){
 const auth=useCustomerAuth();
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [checking,setChecking]=useState(true);
 const [authorized,setAuthorized]=useState(false);
 const [accessDenied,setAccessDenied]=useState(false);
 const [busy,setBusy]=useState(false);
 const [uploading,setUploading]=useState(false);
 const [message,setMessage]=useState('');
 const [tab,setTab]=useState<Tab>('overview');
 const [products,setProducts]=useState<Product[]>([]);
 const [brands,setBrands]=useState<Brand[]>([]);
 const [orders,setOrders]=useState<Order[]>([]);
 const [search,setSearch]=useState('');
 const [statusFilter,setStatusFilter]=useState('all');
 const [editingProduct,setEditingProduct]=useState<string|null>(null);
 const [editingBrand,setEditingBrand]=useState<string|null>(null);
 const [productDraft,setProductDraft]=useState<ProductDraft>({...blankProduct});
 const [brandDraft,setBrandDraft]=useState<BrandDraft>({...blankBrand});

 async function authorizedFetch(path:string,init:RequestInit={}){
  if(!auth.accessToken)throw new Error('Sesi berakhir, silakan masuk ulang');
  return fetch(path,{...init,headers:{...init.headers,authorization:'Bearer '+auth.accessToken},cache:'no-store'});
 }
 async function refreshData(){
  if(!auth.accessToken)return;
  const paths=['/api/admin/products','/api/admin/brands','/api/admin/orders'];
  const responses=await Promise.all(paths.map(path=>authorizedFetch(path)));
  const data=await Promise.all(responses.map(r=>r.json()));
  for(let i=0;i<responses.length;i++)if(!responses[i].ok)throw new Error('Gagal memuat '+paths[i]+': '+statusError(responses[i],data[i]));
  setProducts(Array.isArray(data[0].items)?data[0].items:[]);
  setBrands(Array.isArray(data[1].items)?data[1].items:[]);
  setOrders(Array.isArray(data[2].items)?data[2].items:[]);
 }
 useEffect(()=>{
  if(auth.loading)return;
  if(!auth.accessToken){setAuthorized(false);setAccessDenied(false);setChecking(false);return;}
  let active=true;
  setChecking(true);
  (async()=>{
   try{
    const response=await fetch('/api/admin/status',{headers:{authorization:'Bearer '+auth.accessToken},cache:'no-store'});
    if(!response.ok){if(active){setAuthorized(false);setAccessDenied(response.status===403);}return;}
    const results=await Promise.all(['/api/admin/products','/api/admin/brands','/api/admin/orders'].map(path=>
      fetch(path,{headers:{authorization:'Bearer '+auth.accessToken},cache:'no-store'})));
    const data=await Promise.all(results.map(r=>r.json()));
    if(!active)return;
    setAuthorized(true);setAccessDenied(false);
    if(results.every(r=>r.ok)){
     setProducts(data[0].items||[]);setBrands(data[1].items||[]);setOrders(data[2].items||[]);
    }else setMessage('Admin terverifikasi, tetapi beberapa data belum tersedia. Periksa migrasi database.');
   }catch{if(active)setMessage('Tidak dapat menghubungi API admin.');}
   finally{if(active)setChecking(false);}
  })();
  return()=>{active=false;};
 },[auth.accessToken,auth.loading]);
 async function login(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage('');
  try{await auth.signIn(email,password);setPassword('');}
  catch(error){setMessage(error instanceof Error?error.message:'Login gagal');}
  finally{setBusy(false);}
 }
 async function logout(){await auth.signOut();setAuthorized(false);setProducts([]);setBrands([]);setOrders([]);}
 const filtered=useMemo(()=>products.filter(p=>{
  const q=search.trim().toLowerCase();
  const match=!q||[p.name,p.sku||'',p.slug,p.brand_name||''].some(x=>x.toLowerCase().includes(q));
  const status=statusFilter==='all'||(statusFilter==='active'&&p.is_active)||(statusFilter==='draft'&&!p.is_active)||(statusFilter==='low'&&p.stock_qty<=5);
  return match&&status;
 }),[products,search,statusFilter]);
 const published=products.filter(p=>p.is_active).length;
 const lowStock=products.filter(p=>p.stock_qty<=5).length;
 const pending=orders.filter(o=>o.payment_status==='not_initiated').length;
 const editingProductRecord=products.find(p=>p.id===editingProduct);
 function setP<K extends keyof ProductDraft>(key:K,value:ProductDraft[K]){setProductDraft(p=>({...p,[key]:value}));}
 function setB<K extends keyof BrandDraft>(key:K,value:BrandDraft[K]){setBrandDraft(b=>({...b,[key]:value}));}
 function newProduct(){setEditingProduct(null);setProductDraft({...blankProduct,gallery_urls:[]});setTab('products');setMessage('');}
 function editProduct(p:Product){
  setEditingProduct(p.id);setProductDraft({name:p.name,slug:p.slug,sku:p.sku||'',description:p.description,
   category:p.category,price_idr:String(p.price_idr),stock_qty:String(p.stock_qty),brand_id:p.brand_id||'',image_url:p.image_url||'',
   gallery_urls:[...(p.gallery_urls||[])],is_active:p.is_active});setTab('products');window.scrollTo({top:350,behavior:'smooth'});
 }
 function newBrand(){setEditingBrand(null);setBrandDraft({...blankBrand});setTab('brands');setMessage('');}
 function editBrand(b:Brand){setEditingBrand(b.id);setBrandDraft({name:b.name,slug:b.slug,description:b.description,logo_url:b.logo_url||'',is_active:b.is_active});setTab('brands');}
 async function send(path:string,method:'POST'|'PATCH',payload:Record<string,unknown>){
  const response=await authorizedFetch(path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const data=await response.json();
  if(!response.ok)throw new Error(statusError(response,data));
  return data;
 }
 async function saveProduct(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage('');
  const price=Number(productDraft.price_idr),stock=Number(productDraft.stock_qty);
  if(!Number.isSafeInteger(price)||price<0||!Number.isSafeInteger(stock)||stock<0){setMessage('Harga dan stok harus bilangan bulat tidak negatif.');setBusy(false);return;}
  try{
   await send(editingProduct?'/api/admin/products/'+editingProduct:'/api/admin/products',editingProduct?'PATCH':'POST',{
    name:productDraft.name,slug:productDraft.slug,sku:productDraft.sku||null,description:productDraft.description,
    category:productDraft.category,price_idr:price,stock_qty:stock,brand_id:productDraft.brand_id||null,
    image_url:productDraft.image_url||null,gallery_urls:productDraft.gallery_urls,is_active:editingProduct?productDraft.is_active:false
   });
   await refreshData();setMessage(editingProduct?'Produk diperbarui.':'Draft produk ditambahkan.');
   setEditingProduct(null);setProductDraft({...blankProduct,gallery_urls:[]});
  }catch(error){setMessage(error instanceof Error?error.message:'Tidak dapat menyimpan produk');}
  finally{setBusy(false);}
 }
 async function publish(p:Product){
  setBusy(true);setMessage('');
  try{await send('/api/admin/products/'+p.id,'PATCH',{is_active:!p.is_active});await refreshData();setMessage('Status publikasi produk diperbarui.');}
  catch(error){setMessage(error instanceof Error?error.message:'Publikasi gagal');}finally{setBusy(false);}
 }
 async function saveBrand(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage('');
  try{
   await send(editingBrand?'/api/admin/brands/'+editingBrand:'/api/admin/brands',editingBrand?'PATCH':'POST',{
    name:brandDraft.name,slug:brandDraft.slug,description:brandDraft.description,
    logo_url:brandDraft.logo_url||null,is_active:brandDraft.is_active
   });
   await refreshData();setMessage(editingBrand?'Brand diperbarui.':'Brand baru ditambahkan.');
   setEditingBrand(null);setBrandDraft({...blankBrand});
  }catch(error){setMessage(error instanceof Error?error.message:'Gagal menyimpan brand');}
  finally{setBusy(false);}
 }
 async function toggleBrand(brand:Brand){
  setBusy(true);setMessage('');
  try{await send('/api/admin/brands/'+brand.id,'PATCH',{is_active:!brand.is_active});await refreshData();setMessage('Status brand diperbarui.');}
  catch(error){setMessage(error instanceof Error?error.message:'Gagal mengubah brand');}finally{setBusy(false);}
 }
 async function upload(event:ChangeEvent<HTMLInputElement>,destination:'product'|'brand'){
  const files=Array.from(event.target.files||[]);event.target.value='';
  if(!files.length)return;setUploading(true);setMessage('');
  try{
   for(const file of files.slice(0,destination==='brand'?1:8)){
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1572864||file.size<16)
     throw new Error('Gunakan JPG, PNG, atau WebP maksimal 1,5 MB per foto.');
    const base64=await new Promise<string>((resolve,reject)=>{
     const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');
     reader.onerror=()=>reject(new Error('File tidak dapat dibaca'));reader.readAsDataURL(file);
    });
    const result=await send('/api/admin/media','POST',{filename:file.name,mimeType:file.type,base64});
    const url=window.location.origin+'/api/media/'+result.id;
    if(destination==='brand')setBrandDraft(prev=>({...prev,logo_url:url}));
    else setProductDraft(prev=>{
     if(!prev.image_url)return {...prev,image_url:url};
     return {...prev,gallery_urls:[...prev.gallery_urls,url].slice(0,8)};
    });
   }
   setMessage('Foto berhasil diunggah. Klik Simpan untuk mengaitkannya ke produk atau brand.');
  }catch(error){setMessage(error instanceof Error?error.message:'Upload gagal');}
  finally{setUploading(false);}
 }

 return <main className="vma26-root main-container">
  <header className="vma26-hero">
   <div><p className="vma26-eyebrow">VAPMART / COMMERCE CONTROL</p><h1>Admin <span>Studio.</span></h1>
   <p>Brand, SKU, katalog, galeri foto, dan pesanan dalam satu dashboard. Akses khusus administrator.</p></div>
   <div className="vma26-hero-actions"><Link href="/" className="vma26-btn-light">↗ Lihat storefront</Link>{authorized&&<button className="vma26-btn-dark" onClick={logout} type="button">Keluar</button>}</div>
  </header>
  {!auth.configured?<section className="vma26-panel vma26-auth"><h2>Autentikasi belum dihubungkan</h2><p>Hubungkan Supabase Auth khusus Vapmart dan tetapkan staff role admin. Dashboard tetap terkunci untuk melindungi produk, akun, dan pesanan.</p></section>:
  checking?<section className="vma26-panel vma26-auth"><h2>Memvalidasi akses admin...</h2></section>:
  !authorized?<section className="vma26-panel vma26-auth">
   <h2>{accessDenied?'Akun belum memiliki izin admin':'Masuk sebagai administrator'}</h2>
   <p>{accessDenied?'Akun sudah masuk, tetapi role admin belum diset di database Vapmart.': 'Login dengan akun Vapmart berizin admin. Akses diverifikasi oleh API dan role database.'}</p>
   {accessDenied?<button className="vma26-btn-dark" onClick={logout} type="button">Keluar dari akun ini</button>:
    <form onSubmit={login} className="vma26-login">
     <label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
     <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
     <button className="vma26-btn-dark" type="submit" disabled={busy}>{busy?'Memeriksa...':'Masuk dashboard ↗'}</button>
    </form>}
  </section>:
  <>
   <div className="vma26-kpis">
    <div><span>Total produk</span><strong>{products.length}</strong><small>Semua SKU katalog</small></div>
    <div><span>Produk tayang</span><strong>{published}</strong><small>Terlihat di storefront</small></div>
    <div><span>Stok ≤ 5</span><strong>{lowStock}</strong><small>Butuh pemeriksaan</small></div>
    <div><span>Brand</span><strong>{brands.length}</strong><small>Aktif {brands.filter(b=>b.is_active).length}</small></div>
    <div><span>Draft pesanan</span><strong>{pending}</strong><small>Belum dibayar</small></div>
   </div>
   <nav className="vma26-tabs" aria-label="Menu dashboard">
    <Pill active={tab==='overview'} onClick={()=>setTab('overview')}>Ringkasan</Pill>
    <Pill active={tab==='products'} onClick={()=>setTab('products')}>Produk &amp; SKU</Pill>
    <Pill active={tab==='brands'} onClick={()=>setTab('brands')}>Brands</Pill>
    <Pill active={tab==='orders'} onClick={()=>setTab('orders')}>Pesanan</Pill>
   </nav>
   {tab==='overview'&&<div className="vma26-overview">
    <section className="vma26-panel"><p className="vma26-eyebrow">QUICK ACTIONS</p><h2>Kelola toko lebih cepat.</h2>
     <p>Publikasikan produk non-nikotin setelah harga, stok, foto, dan SKU terverifikasi. Semua perubahan tercatat di PostgreSQL.</p>
     <div className="vma26-quick-actions"><button className="vma26-btn-dark" type="button" onClick={newProduct}>+ Tambah produk</button><button className="vma26-btn-light" type="button" onClick={newBrand}>+ Tambah brand</button><button className="vma26-btn-light" type="button" onClick={()=>setTab('orders')}>Lihat pesanan</button></div>
    </section>
    <section className="vma26-panel vma26-gateway"><p className="vma26-eyebrow">PAYMENT STATUS</p><h2>Gateway belum terhubung</h2><p>QRIS, Virtual Account, dan e-wallet tersedia sebagai preferensi checkout. Pesanan baru disimpan sebagai draft dan tidak memicu transaksi.</p>
     <div className="vma26-gate-row"><span>Cart & checkout review</span><strong>Siap di kode</strong></div>
     <div className="vma26-gate-row"><span>Draft order database</span><strong>Siap di kode</strong></div>
     <div className="vma26-gate-row"><span>Pembayaran langsung</span><strong>Nonaktif</strong></div>
    </section>
   </div>}
   {tab==='products'&&<div className="vma26-layout">
    <section className="vma26-panel">
     <div className="vma26-section-head"><div><p className="vma26-eyebrow">CATALOG MANAGER</p><h2>Produk <span>{filtered.length}</span></h2></div><button className="vma26-btn-dark" type="button" onClick={newProduct}>+ Produk baru</button></div>
     <div className="vma26-filter"><input aria-label="Cari produk" placeholder="Cari nama, SKU, brand..." value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filter status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Semua status</option><option value="active">Published</option><option value="draft">Draft</option><option value="low">Stok rendah</option></select></div>
     <div className="vma26-list">{filtered.length===0?<p className="vma26-muted">Belum ada produk pada filter ini.</p>:filtered.map(p=><article className="vma26-item" key={p.id}>
       <div className="vma26-thumb">{p.image_url?<img src={p.image_url} alt=""/>:<span>V</span>}</div>
       <div className="vma26-item-info"><strong>{p.name}</strong><small>{p.brand_name||brands.find(b=>b.id===p.brand_id)?.name||'Tanpa brand'} · SKU {p.sku||'Belum diisi'}</small><small>{formatIDR(p.price_idr)} · Stok {p.stock_qty}</small><span className={'vma26-state'+(p.is_active?' live':'')}>{p.is_active?'Published':'Draft'}</span></div>
       <div className="vma26-item-actions"><button type="button" onClick={()=>editProduct(p)} disabled={busy}>Edit</button><button type="button" onClick={()=>publish(p)} disabled={busy}>{p.is_active?'Unpublish':'Publish'}</button>{p.is_active&&<Link href={'/product/'+p.slug}>Lihat ↗</Link>}</div>
      </article>)}</div>
    </section>
    <form className="vma26-panel vma26-editor" onSubmit={saveProduct}>
      <p className="vma26-eyebrow">{editingProduct?'EDIT PRODUCT':'NEW PRODUCT'}</p><h2>{editingProduct?'Edit produk':'Tambah produk'}</h2>
      <p className="vma26-muted">{editingProductRecord?'Terakhir dipilih: '+editingProductRecord.name:'Produk baru selalu berstatus draft hingga dipublikasikan.'}</p>
      <label>Nama produk<input minLength={2} maxLength={140} required value={productDraft.name} onChange={e=>setProductDraft(p=>({...p,name:e.target.value,slug:editingProduct?p.slug:slugify(e.target.value)}))}/></label>
      <label>Slug<input required value={productDraft.slug} onChange={e=>setP('slug',e.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*"/></label>
      <div className="vma26-cols"><label>SKU unik<input placeholder="HOME-001" maxLength={64} value={productDraft.sku} onChange={e=>setP('sku',e.target.value.toUpperCase())}/></label><label>Kategori<select value={productDraft.category} onChange={e=>setP('category',e.target.value)}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></label></div>
      <label>Brand<select value={productDraft.brand_id} onChange={e=>setP('brand_id',e.target.value)}><option value="">Tanpa brand</option>{brands.map(b=><option key={b.id} value={b.id}>{b.name}{b.is_active?'':' (nonaktif)'}</option>)}</select></label>
      <label>Deskripsi<textarea maxLength={3000} rows={4} value={productDraft.description} onChange={e=>setP('description',e.target.value)}/></label>
      <div className="vma26-cols"><label>Harga (IDR)<input type="number" min="0" max="2000000000" required step="1" value={productDraft.price_idr} onChange={e=>setP('price_idr',e.target.value)}/></label><label>Stok<input type="number" min="0" max="2000000000" required step="1" value={productDraft.stock_qty} onChange={e=>setP('stock_qty',e.target.value)}/></label></div>
      <label>Foto utama (URL HTTPS)<input type="url" value={productDraft.image_url} placeholder="https://..." onChange={e=>setP('image_url',e.target.value)}/></label>
      <label className="vma26-upload">+ Upload foto produk<input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={e=>upload(e,'product')} disabled={uploading}/></label>
      <p className="vma26-muted">Maksimal 1,5 MB/foto. Foto pertama menjadi cover, foto berikutnya masuk galeri (maksimal 8).</p>
      {(productDraft.image_url||productDraft.gallery_urls.length>0)&&<div className="vma26-gallery">
        {[productDraft.image_url,...productDraft.gallery_urls].filter(Boolean).map((url,index)=><div key={url}><img src={url} alt={'Foto '+(index+1)}/><button type="button" aria-label={'Hapus foto '+(index+1)} onClick={()=>{
         if(index===0)setProductDraft(p=>({...p,image_url:p.gallery_urls[0]||'',gallery_urls:p.gallery_urls.slice(1)}));
         else setProductDraft(p=>({...p,gallery_urls:p.gallery_urls.filter((_,i)=>i!==index-1)}));
        }}>×</button></div>)}
      </div>}
      {editingProduct&&<label className="vma26-check"><input type="checkbox" checked={productDraft.is_active} onChange={e=>setP('is_active',e.target.checked)}/> Tampilkan produk di katalog</label>}
      <button type="submit" className="vma26-btn-dark" disabled={busy||uploading}>{busy?'Menyimpan...':editingProduct?'Simpan perubahan ↗':'Simpan draft ↗'}</button>
      {editingProduct&&<button className="vma26-btn-light" type="button" onClick={newProduct}>Batal edit</button>}
    </form>
   </div>}
   {tab==='brands'&&<div className="vma26-layout">
    <section className="vma26-panel">
      <div className="vma26-section-head"><div><p className="vma26-eyebrow">BRAND DIRECTORY</p><h2>Brands <span>{brands.length}</span></h2></div><button type="button" className="vma26-btn-dark" onClick={newBrand}>+ Brand baru</button></div>
      <div className="vma26-list">{brands.length===0?<p className="vma26-muted">Belum ada brand. Tambahkan brand pertama melalui form.</p>:brands.map(b=><article className="vma26-item" key={b.id}>
       <div className="vma26-thumb">{b.logo_url?<img src={b.logo_url} alt=""/>:<span>{b.name.charAt(0)}</span>}</div>
       <div className="vma26-item-info"><strong>{b.name}</strong><small>{b.slug} · {products.filter(p=>p.brand_id===b.id).length} produk</small><span className={'vma26-state'+(b.is_active?' live':'')}>{b.is_active?'Aktif':'Nonaktif'}</span></div>
       <div className="vma26-item-actions"><button type="button" disabled={busy} onClick={()=>editBrand(b)}>Edit</button><button type="button" disabled={busy} onClick={()=>toggleBrand(b)}>{b.is_active?'Nonaktifkan':'Aktifkan'}</button></div>
      </article>)}</div>
    </section>
    <form className="vma26-panel vma26-editor" onSubmit={saveBrand}>
      <p className="vma26-eyebrow">{editingBrand?'EDIT BRAND':'NEW BRAND'}</p><h2>{editingBrand?'Edit brand':'Tambah brand'}</h2>
      <label>Nama brand<input required minLength={2} maxLength={100} value={brandDraft.name} onChange={e=>setBrandDraft(b=>({...b,name:e.target.value,slug:editingBrand?b.slug:slugify(e.target.value)}))}/></label>
      <label>Slug<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={brandDraft.slug} onChange={e=>setB('slug',e.target.value)}/></label>
      <label>Deskripsi<textarea maxLength={1200} rows={3} value={brandDraft.description} onChange={e=>setB('description',e.target.value)}/></label>
      <label>URL logo HTTPS<input type="url" value={brandDraft.logo_url} onChange={e=>setB('logo_url',e.target.value)}/></label>
      <label className="vma26-upload">+ Upload logo brand<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>upload(e,'brand')} disabled={uploading}/></label>
      {brandDraft.logo_url&&<div className="vma26-logo-preview"><img src={brandDraft.logo_url} alt="Preview logo brand"/></div>}
      <label className="vma26-check"><input type="checkbox" checked={brandDraft.is_active} onChange={e=>setB('is_active',e.target.checked)}/> Brand aktif</label>
      <button className="vma26-btn-dark" disabled={busy||uploading} type="submit">{busy?'Menyimpan...':editingBrand?'Simpan brand ↗':'Tambahkan brand ↗'}</button>
      {editingBrand&&<button type="button" className="vma26-btn-light" onClick={newBrand}>Batal edit</button>}
    </form>
   </div>}
   {tab==='orders'&&<section className="vma26-panel vma26-orders">
    <div className="vma26-section-head"><div><p className="vma26-eyebrow">ORDER MANAGEMENT</p><h2>Pesanan <span>{orders.length}</span></h2><p>Hanya pesanan draft terverifikasi. Status lunas tidak bisa diubah manual dari dashboard.</p></div><button className="vma26-btn-light" type="button" onClick={()=>{setBusy(true);refreshData().catch(e=>setMessage(String(e))).finally(()=>setBusy(false));}}>↻ Refresh</button></div>
    <div className="vma26-orders-scroller"><table><thead><tr><th>Order ID</th><th>Pelanggan / Kota</th><th>Metode</th><th>Total</th><th>Pesanan</th><th>Pembayaran</th><th>Waktu</th></tr></thead>
     <tbody>{orders.map(o=><tr key={o.id}><td><code>{o.id.slice(0,8)}</code></td><td><strong>{o.contact_name||'Pelanggan'}</strong><small>{o.city||'-'}, {o.province||'-'}</small></td><td>{o.payment_method||'-'}</td><td>{formatIDR(Number(o.total_idr))}</td><td><span className="vma26-state">{o.status}</span></td><td><span className="vma26-state">{o.payment_status==='not_initiated'?'Belum dimulai':o.payment_status}</span></td><td>{labelDate(o.created_at)}</td></tr>)}</tbody>
    </table>{orders.length===0&&<p className="vma26-muted">Belum ada draft pesanan.</p>}</div>
    <p className="vma26-muted">Pembayaran akan terhubung setelah provider, webhook, serta rekonsiliasi berhasil melewati QA. Saat ini tombol bayar tetap nonaktif.</p>
   </section>}
  </>}
  {message&&<p className="vma26-message" role="status">{message}</p>}
 </main>;
