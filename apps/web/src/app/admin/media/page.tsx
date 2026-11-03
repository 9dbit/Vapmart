'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import '../../hero-banners.css';
import {useRouter} from 'next/navigation';
import {useCustomerAuth} from '@/lib/customer-auth';
import {AdminMediaLibrary} from '@/components/admin-media-library';
import {AdminWorkspace,type AdminSection} from '@/components/admin-workspace';
import '../../admin-v26.css';
export default function PrivateMediaPage(){
 const auth=useCustomerAuth(),router=useRouter();
 const [state,setState]=useState<'checking'|'allowed'|'error'>('checking');
 const [verifiedToken,setVerifiedToken]=useState<string|null>(null);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  if(auth.loading)return;
  if(!auth.accessToken){setVerifiedToken(null);setState('checking');router.replace('/admin');return;}
  const ac=new AbortController();
  setVerifiedToken(null);setState('checking');
  fetch('/api/admin/status',{headers:{authorization:'Bearer '+auth.accessToken},cache:'no-store',signal:ac.signal})
   .then(r=>{
    if(ac.signal.aborted)return;
    if(r.status===401||r.status===403){router.replace('/admin');return;}
    if(!r.ok)throw Error('Authorization unavailable');
    setVerifiedToken(auth.accessToken);setState('allowed');
   })
   .catch(()=>{if(!ac.signal.aborted)setState('error');});
  return()=>ac.abort();
 },[auth.accessToken,auth.loading,router,retry]);
 function navigate(section:AdminSection){
  router.push(section==='media'?'/admin/media':section==='overview'?'/admin':'/admin?tab='+encodeURIComponent(section));
 }
 async function logout(){
  try{await auth.signOut();setVerifiedToken(null);router.replace('/admin');}
  catch{setState('error');}
 }
 if(state!=='allowed'||!auth.accessToken||verifiedToken!==auth.accessToken){
  return <main className="vma27-access-page vma26-root">
   <section className="vma26-panel vma26-auth"><h1>Vapmart Control Panel</h1>
    <p role="status">{state==='error'?'Tidak dapat memverifikasi sesi Media Library. Data tetap terlindungi.':'Memverifikasi izin administrator...'}</p>
    {state==='error'&&<button type="button" className="vma26-btn-dark" onClick={()=>setRetry(x=>x+1)}>Coba lagi</button>}
   </section>
  </main>;
 }
 return <AdminWorkspace active="media" onNavigate={navigate} email={auth.user?.email} onLogout={logout}>
  <header className="vma27-page-heading"><div><p className="vma26-eyebrow">VAPMART / ASSET MANAGEMENT</p>
   <h1>Media &amp; Aset</h1><p>Kelola gambar dan dokumentasi brand dari library privat yang terlindungi.</p>
  </div></header>
  <nav className="vh-tabs" aria-label="Pengelolaan media"><Link href="/admin/media" aria-current="page">Media &amp; Aset</Link><Link href="/admin/banners">Hero Banner</Link></nav>
  <AdminMediaLibrary token={auth.accessToken}/>
 </AdminWorkspace>;
}
