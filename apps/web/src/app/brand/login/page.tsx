'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {useCustomerAuth} from '@/lib/customer-auth';
import '../brand-portal.css';
export default function BrandLoginPage(){
 const auth=useCustomerAuth(),router=useRouter();
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{
  if(auth.loading||!auth.accessToken)return;
  const controller=new AbortController();
  fetch('/api/brand-portal/me',{headers:{authorization:'Bearer '+auth.accessToken},signal:controller.signal,cache:'no-store'})
   .then(async r=>{const data=await r.json();if(!r.ok)throw new Error(typeof data.message==='string'?data.message:'Akses tidak dapat diperiksa');
    if((data.brands||[]).length>0)router.replace('/brand');else setMessage('Akun terdaftar, tetapi belum ditugaskan ke brand mana pun. Hubungi admin Vapmart.');})
   .catch(e=>{if(!controller.signal.aborted)setMessage(e.message||'Gagal memeriksa akses brand');});
  return()=>controller.abort();
 },[auth.loading,auth.accessToken,router]);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMessage('');try{await auth.signIn(email.trim(),password);setPassword('');}catch(e){setMessage(e instanceof Error?e.message:'Login gagal');}finally{setBusy(false);}}
 return <main className="vm-brand-portal-root vm-brand-login"><div className="vm-brand-panel">
  <span className="vm-brand-eyebrow">VAPMART / BRAND PARTNERS</span>
  <h1>Brand Partner<br/><em>Portal.</em></h1>
  <p>Login khusus mitra untuk memantau stok SKU dan penjualan terverifikasi. Setiap akun hanya dapat membaca brand yang ditugaskan.</p>
  {!auth.configured?<p role="alert">Supabase Auth belum dikonfigurasi.</p>:auth.loading?<p>Memeriksa sesi...</p>:auth.user?<div className="vm-brand-form"><strong>{auth.user.email}</strong><p role="status">{message||'Memverifikasi akses brand...'}</p><button type="button" onClick={()=>auth.signOut()}>Gunakan akun lain</button></div>:
   <form onSubmit={submit} className="vm-brand-form">
    <label>Email mitra<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="partner@example.com"/></label>
    <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {message&&<p role="alert">{message}</p>}
    <button type="submit" disabled={busy}>{busy?'Memeriksa...':'Masuk Brand Portal ↗'}</button>
   </form>}
  <div className="vm-brand-links"><Link href="/login">Belum punya akun? Daftar</Link><Link href="/">Kembali ke Vapmart</Link></div>
 </div></main>;
}
