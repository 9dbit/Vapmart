'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useCustomerAuth} from '@/lib/customer-auth';
import {AdminMediaLibrary} from '@/components/admin-media-library';
import '../../admin-v26.css';
export default function PrivateMediaPage(){
 const auth=useCustomerAuth(),router=useRouter();
 const [state,setState]=useState<'checking'|'allowed'|'error'>('checking');
 useEffect(()=>{
  if(auth.loading)return;
  if(!auth.accessToken){router.replace('/admin/login');return;}
  const ac=new AbortController();setState('checking');
  fetch('/api/admin/status',{headers:{authorization:'Bearer '+auth.accessToken},cache:'no-store',signal:ac.signal})
   .then(r=>{if(r.status===401||r.status===403){router.replace('/admin/login');return;}if(!r.ok)throw Error('Authorization unavailable');setState('allowed');})
   .catch(()=>{if(!ac.signal.aborted)setState('error');});
  return()=>ac.abort();
 },[auth.accessToken,auth.loading,router]);
 return <main className="vma26-root main-container" style={{paddingTop:24}}>
  {state==='allowed'&&auth.accessToken?<AdminMediaLibrary token={auth.accessToken}/>:<section className="vma26-panel"><h1>Vapmart Control Panel</h1><p role="status">{state==='error'?'Otorisasi belum dapat diperiksa. Muat ulang halaman.':'Memverifikasi akses Media Library...'}</p></section>}
 </main>;
}
