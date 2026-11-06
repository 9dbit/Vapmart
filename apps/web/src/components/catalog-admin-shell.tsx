'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import Link from 'next/link';
import {useCustomerAuth} from '@/lib/customer-auth';
import {AdminWorkspace,type AdminSection} from './admin-workspace';
import '../app/admin-v26.css';
import '../app/catalog-admin.css';
type Client={request:<T=any>(path:string,body?:unknown,method?:'POST'|'PATCH')=>Promise<T>;upload:(file:File)=>Promise<string>};
const Context=createContext<Client|null>(null);
export function useCatalogAdmin(){const x=useContext(Context);if(!x)throw Error('Catalog admin context required');return x;}
export function CatalogAdminShell({children,section='products'}:{children:ReactNode;section?:'products'|'orders'|'vouchers'|'settings'}){
 const auth=useCustomerAuth(),router=useRouter(),path=usePathname();const [verified,setVerified]=useState<string|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{if(auth.loading)return;const ac=new AbortController();setVerified(null);setError('');
  if(!auth.accessToken){router.replace('/admin');return;}
  fetch('/api/admin/status',{headers:{authorization:'Bearer '+auth.accessToken},cache:'no-store',signal:ac.signal}).then(async r=>{if(r.status===401||r.status===403){router.replace('/admin');return;}if(!r.ok)throw Error('Tidak dapat memverifikasi sesi administrator');setVerified(auth.accessToken);}).catch(e=>{if(!ac.signal.aborted)setError(e.message);});return()=>ac.abort();
 },[auth.loading,auth.accessToken,router,retry]);
 async function request<T=any>(target:string,body?:unknown,method:'POST'|'PATCH'='POST'):Promise<T>{
  if(!auth.accessToken)throw Error('Sesi berakhir');const r=await fetch('/api/admin/catalog/'+target,{method:body===undefined?'GET':method,headers:{authorization:'Bearer '+auth.accessToken,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store'});
  const d=await r.json().catch(()=>({message:'Respons server tidak valid'}));if(!r.ok){if(r.status===401)throw Error('Sesi berakhir. Masuk ulang sebelum melanjutkan.');throw Error(Array.isArray(d.message)?d.message.join(', '):d.message||'Permintaan gagal ('+r.status+')');}return d;
 }
 async function upload(file:File){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1572864)throw Error('JPG, PNG atau WebP maksimal 1,5 MiB per gambar');
  const base64=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(Error('Gagal membaca gambar'));r.readAsDataURL(file);});
  const r=await fetch('/api/admin/media',{method:'POST',headers:{authorization:'Bearer '+auth.accessToken,'content-type':'application/json'},body:JSON.stringify({filename:file.name,mimeType:file.type,base64})});const d=await r.json();if(!r.ok)throw Error(d.message||'Upload gagal');return '/api/media/'+d.id;
 }
 function navigate(s:AdminSection){router.push(s==='settings'?'/admin/settings':s==='media'?'/admin/media':s==='products'?'/admin/products':s==='orders'?'/admin/orders':s==='vouchers'?'/admin/vouchers':s==='overview'?'/admin':'/admin?tab='+s);}
 if(!verified||verified!==auth.accessToken)return <main className="vma27-access-page"><section className="vma26-panel"><h1>Vapmart Control Panel</h1><p role={error?'alert':'status'}>{error||'Memverifikasi akses...'}</p>{error&&<button onClick={()=>setRetry(x=>x+1)}>Coba lagi</button>}</section></main>;
 return <AdminWorkspace active={section} email={auth.user?.email} onNavigate={navigate} onLogout={async()=>{await auth.signOut();router.replace('/admin');}}>
  <Context.Provider value={{request,upload}}><div className="vc-root" data-engine="cp39">
   <header className="vc-heading"><div><small>VAPMART / CATALOG & OPERATIONS</small><h1>{section==='settings'?'Pengaturan':section==='products'?'Produk & SKU':section==='orders'?'Pesanan':'Voucher & Promo'}</h1><p>{section==='settings'?'Kelola identitas toko untuk invoice.':section==='products'?'Kelola produk, harga, variasi dan stok dari satu workspace.':section==='orders'?'Kelola pesanan dan verifikasi pembayaran transfer bank.':'Kelola voucher dan campaign promo terjadwal tanpa mengaktifkan payment gateway.'}</p></div><Link href="/" className="vc-button">Lihat website</Link></header>
   {section==='products'&&<nav className="vc-nav" aria-label="Halaman produk">{[['/admin/products','Semua Produk'],['/admin/products/new','Tambah Produk'],['/admin/products/arsip','Arsip & Konversi'],['/admin/products/categories','Kategori Produk'],['/admin/products/reviews','Review Pembeli']].map(([href,label])=><Link key={href} href={href} aria-current={path===href?'page':undefined}>{label}</Link>)}</nav>}
   {section==='vouchers'&&<nav className="vc-nav" aria-label="Voucher dan campaign">{[['/admin/vouchers','Voucher'],['/admin/promotions','Campaign'],['/admin/promotions/analytics','Analytics']].map(([href,label])=><Link key={href} href={href} aria-current={path===href?'page':undefined}>{label}</Link>)}</nav>}
   {children}
  </div></Context.Provider>
 </AdminWorkspace>;
}
export function CatalogNotice({error,message}:{error?:string;message?:string}){return error?<p role="alert" className="vc-alert">{error}</p>:message?<p role="status" className="vc-notice">{message}</p>:null;}
