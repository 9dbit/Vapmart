'use client';
import {useEffect,useState} from 'react';
import {useCustomerAuth} from '@/lib/customer-auth';
import Link from 'next/link';
import '../../brand-portal.css';
export default function BrandAcceptPage(){
 const auth=useCustomerAuth();
 const [token,setToken]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[success,setSuccess]=useState(false);
 useEffect(()=>{
  const params=new URLSearchParams(window.location.hash.slice(1));
  const raw=params.get('token')||'';
  setToken(raw);
  if(!raw)setMessage('Link undangan tidak lengkap. Mintalah link baru kepada admin Vapmart.');
 },[]);
 async function accept(){
  if(!auth.accessToken||!token||busy)return;
  setBusy(true);setMessage('');
  try{
   const r=await fetch('/api/brand-invitations/accept',{method:'POST',
    headers:{authorization:'Bearer '+auth.accessToken,'content-type':'application/json'},
    body:JSON.stringify({token})});
   const data=await r.json();if(!r.ok)throw Error(data?.message||'Undangan tidak berlaku');
   window.history.replaceState(null,'','/brand/accept');setSuccess(true);setToken('');
   setMessage('Undangan diterima. Sekarang akun kamu memiliki akses ke data brand yang ditugaskan.');
  }catch(e){setMessage(e instanceof Error?e.message:'Undangan tidak dapat diterima');}
  finally{setBusy(false);}
 }
 return <main className="vm-brand-portal-root vm-brand-login"><section className="vm-brand-panel">
  <span className="vm-brand-eyebrow">VAPMART / PARTNER INVITATION</span><h1>Join your <em>brand.</em></h1>
  <p>Undangan hanya berlaku untuk email yang dicantumkan oleh admin dan sudah diverifikasi melalui Supabase. Akses penjualan mitra bersifat read-only.</p>
  {success?<Link href="/brand" className="vm-commerce-primary">Buka Brand Portal ↗</Link>:
   !auth.user?<><p>Login menggunakan email yang diundang, lalu buka kembali tautan undangan ini.</p><Link href="/brand/login">Login Brand Portal ↗</Link></>:
   <div className="vm-brand-form"><strong>{auth.user.email}</strong>
    <button disabled={busy||!token} onClick={accept} type="button">{busy?'Memvalidasi...':'Terima undangan brand ↗'}</button>
   </div>}
  {message&&<p role="status">{message}</p>}
  <Link href="/" style={{display:'inline-block',marginTop:24}}>Kembali ke Vapmart</Link>
 </section></main>;
}
