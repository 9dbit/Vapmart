'use client';
import {useEffect,useState,type FormEvent,type ChangeEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useCustomerAuth} from '@/lib/customer-auth';
import {formatIDR,type Product} from '@/lib/types';
import {readCollection} from '@/lib/collection-read';
import {AuditHistory} from '@/components/audit-history';
import {BrandAccessManager} from '@/components/brand-access-manager';
import {ShippingPanel} from '@/components/shipping-panel';
import {WarehouseOps} from '@/components/warehouse-ops';
import {FulfillmentPanel} from '@/components/fulfillment-panel';
import {CourierOpsPanel} from '@/components/courier-ops-panel';
import {AdminAccess,type AdminAccessPhase} from '@/components/admin-access';
import {AdminWorkspace,adminTitles,adminDescriptions,type AdminSection} from '@/components/admin-workspace';
import {AdminProductRecords,useProductRecordSummary} from '@/components/admin-product-records';
import '../admin-v26.css';

type Brand={id:string;edit_version?:number;name:string;slug:string;description:string;logo_url:string|null;is_active:boolean};
type Order={id:string;status:string;payment_status:string;contact_name:string;contact_email:string;city:string;province:string;total_idr:string;payment_method:string;created_at:string};
type ProductDraft={name:string;slug:string;sku:string;description:string;category:string;price_idr:string;stock_qty:string;weight_grams:string;length_cm:string;width_cm:string;height_cm:string;brand_id:string;image_url:string;gallery_urls:string[];is_active:boolean};
type BrandDraft={name:string;slug:string;description:string;logo_url:string;is_active:boolean};
type Tab=Exclude<AdminSection,'media'|'vouchers'>;
const allowedTabs:ReadonlyArray<Tab>=['overview','products','warehouses','brands','orders','fulfillment','courier','shipping'];
const categories=['home','lifestyle','decor','accessories','electronics','other'];
const blankProduct:ProductDraft={name:'',slug:'',sku:'',description:'',category:'lifestyle',price_idr:'',stock_qty:'0',weight_grams:'',length_cm:'',width_cm:'',height_cm:'',brand_id:'',image_url:'',gallery_urls:[],is_active:false};
const blankBrand:BrandDraft={name:'',slug:'',description:'',logo_url:'',is_active:true};
const slugify=(text:string)=>text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 -]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-');
function labelDate(date:string){const d=new Date(date);return Number.isNaN(d.valueOf())?'-':d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function statusError(response:Response,payload:unknown){const data=(payload||{}) as {message?:string|string[];code?:string};return typeof data.message==='string'?data.message:Array.isArray(data.message)?data.message.join(', '):data.code||'HTTP '+response.status;}

export default function AdminPage(){
 const auth=useCustomerAuth();
 const router=useRouter();
 const [checking,setChecking]=useState(true);
 const [authorized,setAuthorized]=useState(false);
 const [verifiedToken,setVerifiedToken]=useState<string|null>(null);
 const [retryKey,setRetryKey]=useState(0);
 const [accessDenied,setAccessDenied]=useState(false);
 const [sessionExpired,setSessionExpired]=useState(false);
 const [busy,setBusy]=useState(false);
 const [uploading,setUploading]=useState(false);
 const [message,setMessage]=useState('');
 const [tab,setTab]=useState<Tab>('overview');
 const [products,setProducts]=useState<Product[]>([]);
 const [brands,setBrands]=useState<Brand[]>([]);
 const [orders,setOrders]=useState<Order[]>([]);
 const [editingProduct,setEditingProduct]=useState<string|null>(null);
 const [editingBrand,setEditingBrand]=useState<string|null>(null);
 const [productVersion,setProductVersion]=useState<number|null>(null),[brandVersion,setBrandVersion]=useState<number|null>(null);
 const [totals,setTotals]=useState<{published:number;lowStock:number;pendingOrders:number;draftOrders?:number;bankTransferPending?:number}|null>(null);
 const [productDraft,setProductDraft]=useState<ProductDraft>({...blankProduct});
 const [brandDraft,setBrandDraft]=useState<BrandDraft>({...blankBrand});
 const recordSummary=useProductRecordSummary(authorized&&verifiedToken===auth.accessToken?auth.accessToken:null,products);

 async function authorizedFetch(path:string,init:RequestInit={}){
  if(!auth.accessToken)throw new Error('Sesi berakhir, silakan masuk ulang');
  return fetch(path,{...init,headers:{...init.headers,authorization:'Bearer '+auth.accessToken},cache:'no-store'});
 }
 async function loadWorkspace(token:string|null){
  if(!token)throw Error('Sesi berakhir. Silakan masuk ulang.');
  const headers={authorization:'Bearer '+token};
  const fetcher:typeof fetch=(input,init)=>fetch(input,{...init,headers:{...init?.headers,...headers},cache:'no-store'});
  const [p,b,o,r]=await Promise.all([
   readCollection<Product>('/api/admin/products',fetcher),readCollection<Brand>('/api/admin/brands',fetcher),
   readCollection<Order>('/api/admin/orders',fetcher),fetcher('/api/admin/summary')]);
  if(!r.ok)throw Error('Statistik seluruh database belum tersedia. Coba lagi.');
  const stats=await r.json();if(!stats.totals)throw Error('Respons statistik tidak valid');
  return {products:p,brands:b,orders:o,totals:stats.totals};
 }
 async function refreshData(){
  if(!auth.accessToken)return;
  const d=await loadWorkspace(auth.accessToken);setProducts(d.products);setBrands(d.brands);setOrders(d.orders);setTotals(d.totals);
 }
 useEffect(()=>{
  if(auth.loading)return;
  if(!auth.accessToken){
   setVerifiedToken(null);setAuthorized(false);setAccessDenied(false);setSessionExpired(false);setChecking(false);
   return;
  }
  let alive=true;
  setChecking(true);setAuthorized(false);setVerifiedToken(null);setAccessDenied(false);setSessionExpired(false);
  (async()=>{
   try{
    const response=await fetch('/api/admin/status',{headers:{authorization:'Bearer '+auth.accessToken},cache:'no-store'});
    if(!alive)return;
    if(!response.ok){
     setAccessDenied(response.status===403);
     setSessionExpired(response.status===401);
     setAuthorized(false);setVerifiedToken(null);
     return;
    }
    const d=await loadWorkspace(auth.accessToken);
    if(!alive)return;
    setAuthorized(true);setVerifiedToken(auth.accessToken);setAccessDenied(false);setSessionExpired(false);
    setProducts(d.products);setBrands(d.brands);setOrders(d.orders);setTotals(d.totals);setMessage('');
   }catch{
    if(alive){setAuthorized(false);setVerifiedToken(null);}
   }finally{
    if(alive)setChecking(false);
   }
  })();
  return()=>{alive=false;};
 },[auth.accessToken,auth.loading,retryKey]);
 useEffect(()=>{
  const sync=()=>{
   const requested=new URLSearchParams(window.location.search).get('tab');
   if(requested==='products'||requested==='orders'){router.replace('/admin/'+requested);return;}
   const section=allowedTabs.find(x=>x===requested);
   setTab(section||'overview');
  };
  sync();
  window.addEventListener('popstate',sync);
  return()=>window.removeEventListener('popstate',sync);
 },[]);
 function navigate(section:AdminSection){
  if(section==='products'){router.push('/admin/products');return;}
  if(section==='orders'){router.push('/admin/orders');return;}
  if(section==='media'){router.push('/admin/media');return;}
  if(section==='vouchers'){router.push('/admin/vouchers');return;}
  setTab(section);
  const url=section==='overview'?'/admin':'/admin?tab='+encodeURIComponent(section);
  if(window.location.pathname==='/admin'&&window.location.pathname+window.location.search!==url)
   window.history.pushState(null,'',url);
  window.scrollTo({top:0,behavior:'smooth'});
 }
 async function logout(){try{await auth.signOut();setAuthorized(false);setVerifiedToken(null);setProducts([]);setBrands([]);setOrders([]);setMessage('');}catch{setMessage('Tidak dapat keluar dari sesi, coba kembali.');}}
 const published=totals?.published??0;
 const lowStock=totals?.lowStock??0;
 const pending=totals?.pendingOrders??0;
 const editingProductRecord=products.find(p=>p.id===editingProduct);
 function setP<K extends keyof ProductDraft>(key:K,value:ProductDraft[K]){setProductDraft(p=>({...p,[key]:value}));}
 function setB<K extends keyof BrandDraft>(key:K,value:BrandDraft[K]){setBrandDraft(b=>({...b,[key]:value}));}
 function newProduct(){router.push('/admin/products/new');}
 function editProduct(p:Product){router.push('/admin/products/'+p.id);}

 function newBrand(){setEditingBrand(null);setBrandDraft({...blankBrand});navigate('brands');setMessage('');}
 function editBrand(b:Brand){setBrandVersion(b.edit_version??null);setEditingBrand(b.id);setBrandDraft({name:b.name,slug:b.slug,description:b.description,logo_url:b.logo_url||'',is_active:b.is_active});navigate('brands');}
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
    ...(editingProduct?{expected_version:productVersion}:{}),name:productDraft.name,slug:productDraft.slug,sku:productDraft.sku||null,description:productDraft.description,
    category:productDraft.category,price_idr:price,...(editingProduct?{}:{stock_qty:0}),weight_grams:productDraft.weight_grams?Number(productDraft.weight_grams):null,length_cm:productDraft.length_cm?Number(productDraft.length_cm):null,width_cm:productDraft.width_cm?Number(productDraft.width_cm):null,height_cm:productDraft.height_cm?Number(productDraft.height_cm):null,brand_id:productDraft.brand_id||null,
    image_url:productDraft.image_url||null,gallery_urls:productDraft.gallery_urls,is_active:editingProduct?productDraft.is_active:false
   });
   await refreshData();setMessage(editingProduct?'Produk diperbarui.':'Draft produk ditambahkan.');
   setEditingProduct(null);setProductDraft({...blankProduct,gallery_urls:[]});
  }catch(error){setMessage(error instanceof Error?error.message:'Tidak dapat menyimpan produk');}
  finally{setBusy(false);}
 }
 async function publish(p:Product){router.push('/admin/products/'+p.id);}

 async function saveBrand(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage('');
  try{
   await send(editingBrand?'/api/admin/brands/'+editingBrand:'/api/admin/brands',editingBrand?'PATCH':'POST',{
    ...(editingBrand?{expected_version:brandVersion}:{}),name:brandDraft.name,slug:brandDraft.slug,description:brandDraft.description,
    logo_url:brandDraft.logo_url||null,is_active:brandDraft.is_active
   });
   await refreshData();setMessage(editingBrand?'Brand diperbarui.':'Brand baru ditambahkan.');
   setEditingBrand(null);setBrandDraft({...blankBrand});
  }catch(error){setMessage(error instanceof Error?error.message:'Gagal menyimpan brand');}
  finally{setBusy(false);}
 }
 async function toggleBrand(brand:Brand){
  if(!window.confirm(brand.is_active?'Nonaktifkan brand ini? Akses dan katalog brand dapat terdampak.':'Aktifkan kembali brand ini?'))return;
  setBusy(true);setMessage('');
  try{await send('/api/admin/brands/'+brand.id,'PATCH',{is_active:!brand.is_active,expected_version:brand.edit_version});await refreshData();setMessage('Status brand diperbarui.');}
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

 const showDashboard=authorized&&auth.configured&&!!auth.accessToken&&verifiedToken===auth.accessToken;
 const accessPhase:AdminAccessPhase=!auth.configured?'unconfigured':auth.loading||checking?'checking':!auth.accessToken?'logged-out':accessDenied?'denied':sessionExpired?'expired':'error';
 return !showDashboard?
  <AdminAccess phase={accessPhase} onRetry={()=>setRetryKey(x=>x+1)}/>:
  <AdminWorkspace active={tab} email={auth.user?.email} onLogout={logout} onNavigate={navigate}>
   <header className="vma27-page-heading">
    <div><p className="vma26-eyebrow">VAPMART / OPERATIONS CENTER</p>
     <h1>{adminTitles[tab]}</h1>
     <p>{adminDescriptions[tab]}</p>
    </div>
    <Link href="/" className="vma27-heading-action">↗ Lihat website</Link>
   </header>
   <div className="vma26-kpis">
    <div><span>Seluruh data produk</span><strong>{recordSummary.summary?.total??'—'}</strong><small className="vpr-source-count">{recordSummary.summary?`${recordSummary.summary.existing} existing + ${recordSummary.summary.managed} operasional`:'Memverifikasi sumber PostgreSQL'}</small></div>
    <div><span>Produk tayang</span><strong>{recordSummary.summary?.published??published}</strong><small>Terlihat di storefront</small></div>
    <div><span>Stok ≤ 5</span><strong>{lowStock}</strong><small>Hanya stok operasional</small></div>
    <div><span>Brand operasional</span><strong>{brands.length}</strong><small>{recordSummary.summary?`${recordSummary.summary.existing_brands} brand pada data existing`:`Aktif ${brands.filter(b=>b.is_active).length}`}</small></div>
    <div><span>Menunggu pembayaran</span><strong>{pending}</strong><small>Termasuk {totals?.bankTransferPending??0} transfer bank pending dan {totals?.draftOrders??0} draft belum dimulai</small></div>
   </div>
   {recordSummary.error&&<p className="vpr-catalog-warning" role="status">{recordSummary.error}. <button type="button" onClick={recordSummary.reload}>Coba sinkronkan lagi</button></p>}
   {tab==='overview'&&<div className="vma26-overview">
    <section className="vma26-panel"><p className="vma26-eyebrow">QUICK ACTIONS</p><h2>Kelola toko lebih cepat.</h2>
     <p>Produk existing dapat diperiksa di Produk &amp; SKU. Publikasi produk operasional tetap memerlukan data, foto, dan stok terverifikasi.</p>
     <div className="vma26-quick-actions"><button className="vma26-btn-dark" type="button" onClick={()=>navigate('products')}>Lihat semua produk</button><button className="vma26-btn-light" type="button" onClick={newProduct}>+ Tambah produk</button><button className="vma26-btn-light" type="button" onClick={newBrand}>+ Tambah brand</button><button className="vma26-btn-light" type="button" onClick={()=>navigate('media')}>Lihat Media Library</button><button className="vma26-btn-light" type="button" onClick={()=>navigate('orders')}>Lihat pesanan</button></div>
    </section>
    <section className="vma26-panel vma26-gateway"><p className="vma26-eyebrow">PAYMENT STATUS</p><h2>Gateway belum terhubung</h2><p>QRIS, Virtual Account, dan e-wallet tersedia sebagai preferensi checkout. Pesanan baru disimpan sebagai draft dan tidak memicu transaksi.</p>
     <div className="vma26-gate-row"><span>Cart &amp; checkout review</span><strong>Siap di kode</strong></div>
     <div className="vma26-gate-row"><span>Draft order database</span><strong>Siap di kode</strong></div>
     <div className="vma26-gate-row"><span>Pembayaran langsung</span><strong>Nonaktif</strong></div>
    </section>
   </div>}
   {tab==='overview'&&products.length===0&&<section className="vma26-panel vma27-start-guide" aria-label="Panduan memulai">
    <p className="vma26-eyebrow">GET STARTED</p><h2>Periksa data existing, lengkapi operasional.</h2>
    <p>Data existing tidak hilang. SKU dan stok yang belum tersedia pada sumber ditandai untuk pemeriksaan, bukan diisi angka perkiraan.</p>
    <div className="vma27-guide-steps">
     <button type="button" onClick={()=>navigate('products')}><span>01</span><strong>Periksa semua produk</strong><small>Nama, brand, kategori dan foto existing</small></button>
     <button type="button" onClick={()=>navigate('media')}><span>02</span><strong>Periksa aset</strong><small>Media Library menyimpan foto dan logo asli</small></button>
     <button type="button" onClick={newProduct}><span>03</span><strong>Lengkapi SKU operasional</strong><small>Gunakan data produk yang telah diverifikasi</small></button>
     <button type="button" onClick={()=>navigate('warehouses')}><span>04</span><strong>Verifikasi stok</strong><small>Catat penerimaan melalui gudang fisik</small></button>
    </div>
   </section>}
   {tab==='products'&&<div className="vma26-layout">
    <AdminProductRecords token={auth.accessToken!} products={products} onEdit={editProduct} onPublish={publish} onNew={newProduct} onSynced={recordSummary.reload} busy={busy}/>
    <form className="vma26-panel vma26-editor" onSubmit={saveProduct}>
      <p className="vma26-eyebrow">{editingProduct?'EDIT PRODUCT':'NEW PRODUCT'}</p><h2>{editingProduct?'Edit produk':'Tambah produk'}</h2>
      <p className="vma26-muted">{editingProductRecord?'Terakhir dipilih: '+editingProductRecord.name:'Produk baru selalu berstatus draft hingga dipublikasikan.'}</p>
      <label>Nama produk<input minLength={2} maxLength={140} required value={productDraft.name} onChange={e=>setProductDraft(p=>({...p,name:e.target.value,slug:editingProduct?p.slug:slugify(e.target.value)}))}/></label>
      <label>Slug<input required value={productDraft.slug} onChange={e=>setP('slug',e.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*"/></label>
      <div className="vma26-cols"><label>SKU unik<input placeholder="HOME-001" maxLength={64} value={productDraft.sku} onChange={e=>setP('sku',e.target.value.toUpperCase())}/></label><label>Kategori<select value={productDraft.category} onChange={e=>setP('category',e.target.value)}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></label></div>
      <label>Brand<select value={productDraft.brand_id} onChange={e=>setP('brand_id',e.target.value)}><option value="">Tanpa brand</option>{brands.map(b=><option key={b.id} value={b.id}>{b.name}{b.is_active?'':' (nonaktif)'}</option>)}</select></label>
      <label>Deskripsi<textarea maxLength={3000} rows={4} value={productDraft.description} onChange={e=>setP('description',e.target.value)}/></label>
      <div className="vma26-cols"><label>Harga (IDR)<input type="number" min="0" max="2000000000" required step="1" value={productDraft.price_idr} onChange={e=>setP('price_idr',e.target.value)}/></label><label>Stok (dikelola di Gudang &amp; Stok)<input type="number" value={editingProduct?productDraft.stock_qty:'0'} disabled readOnly/></label></div>
      <div className="vma26-cols"><label>Berat produk (gram)<input type="number" min="1" max="1000000" step="1" placeholder="Wajib untuk tarif kurir" value={productDraft.weight_grams} onChange={e=>setP('weight_grams',e.target.value)}/></label><label>Panjang (cm)<input type="number" min="1" max="1000" step="1" value={productDraft.length_cm} onChange={e=>setP('length_cm',e.target.value)}/></label></div>
      <div className="vma26-cols"><label>Lebar (cm)<input type="number" min="1" max="1000" step="1" value={productDraft.width_cm} onChange={e=>setP('width_cm',e.target.value)}/></label><label>Tinggi (cm)<input type="number" min="1" max="1000" step="1" value={productDraft.height_cm} onChange={e=>setP('height_cm',e.target.value)}/></label></div>
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
   {tab==='brands'&&<><div className="vma26-layout">
    <section className="vma26-panel">
      <div className="vma26-section-head"><div><p className="vma26-eyebrow">BRAND DIRECTORY</p><h2>Brands <span>{brands.length}</span></h2></div><button type="button" className="vma26-btn-dark" onClick={newBrand}>+ Brand baru</button></div>
      <div className="vma26-list">{brands.length===0?<p className="vma26-muted">Belum ada brand operasional. Brand sumber existing dapat diperiksa di Produk &amp; SKU.</p>:brands.map(b=><article className="vma26-item" key={b.id}>
       <div className="vma26-thumb">{b.logo_url?<img src={b.logo_url} alt=""/>:<span>{b.name.charAt(0)}</span>}</div>
       <div className="vma26-item-info"><strong>{b.name}</strong><small>{b.slug} · {products.filter(p=>p.brand_id===b.id).length} produk</small><span className={'vma26-state'+(b.is_active?' live':'')}>{b.is_active?'Aktif':'Nonaktif'}</span></div>
       <div className="vma26-item-actions"><button type="button" disabled={busy} onClick={()=>editBrand(b)}>Edit</button><button type="button" disabled={busy} onClick={()=>toggleBrand(b)}>{b.is_active?'Nonaktifkan':'Aktifkan'}</button></div>
      </article>)}</div>
    </section>
    <form className="vma26-panel vma26-editor" onSubmit={saveBrand}>
      <p className="vma26-eyebrow">BRAND MANAGER</p><h2>{editingBrand?'Edit brand':'Tambah brand'}</h2>
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
   </div><BrandAccessManager brands={brands} token={auth.accessToken}/></>}
   {tab==='warehouses'&&<WarehouseOps token={auth.accessToken} products={products} onUpdated={refreshData}/>}
   {tab==='fulfillment'&&<FulfillmentPanel token={auth.accessToken} orders={orders}/>}
   {tab==='courier'&&<CourierOpsPanel token={auth.accessToken}/>}
   {tab==='shipping'&&<ShippingPanel token={auth.accessToken} products={products}/>}
   {tab==='orders'&&<section className="vma26-panel vma26-orders">
    <div className="vma26-section-head"><div><p className="vma26-eyebrow">ORDER MANAGEMENT</p><h2>Pesanan <span>{orders.length}</span></h2><p>Hanya pesanan draft terverifikasi. Status lunas tidak bisa diubah manual dari dashboard.</p></div><button className="vma26-btn-light" type="button" onClick={()=>{setBusy(true);refreshData().catch(e=>setMessage(String(e))).finally(()=>setBusy(false));}}>↻ Refresh</button></div>
    <div className="vma26-orders-scroller"><table><thead><tr><th>Order ID</th><th>Pelanggan / Kota</th><th>Metode</th><th>Total</th><th>Pesanan</th><th>Pembayaran</th><th>Waktu</th></tr></thead>
     <tbody>{orders.map(o=><tr key={o.id}><td><code>{o.id.slice(0,8)}</code></td><td><strong>{o.contact_name||'Pelanggan'}</strong><small>{o.city||'-'}, {o.province||'-'}</small></td><td>{o.payment_method||'-'}</td><td>{formatIDR(Number(o.total_idr))}</td><td><span className="vma26-state">{o.status}</span></td><td><span className="vma26-state">{o.payment_status==='not_initiated'?'Belum dimulai':o.payment_status}</span></td><td>{labelDate(o.created_at)}</td></tr>)}</tbody>
    </table>{orders.length===0&&<p className="vma26-muted">Belum ada draft pesanan.</p>}</div>
    <p className="vma26-muted">Pembayaran akan terhubung setelah provider, webhook, serta rekonsiliasi berhasil melewati QA. Saat ini tombol bayar tetap nonaktif.</p>
   </section>}
   {(tab==='products'&&editingProduct||tab==='brands'&&editingBrand)&&<AuditHistory token={auth.accessToken} entityType={tab==='products'?'product':'brand'} entityId={(tab==='products'?editingProduct:editingBrand)!}/> }
   {message&&<p className="vma26-message" role="status" aria-live="polite">{message}</p>}
  </AdminWorkspace>;
}
