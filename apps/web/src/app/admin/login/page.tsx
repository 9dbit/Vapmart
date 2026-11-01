'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {useCustomerAuth} from '@/lib/customer-auth';
import '../../admin-v26.css';
export default function AdminLogin(){
 const auth=useCustomerAuth();const router=useRouter();
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false);const [status,setStatus]=useState<'idle'|'denied'|'error'>('idle');const [message,setMessage]=useState('');
 useEffect(()=>{
  if(auth.loading||!auth.accessToken)return;
  let alive=true;
  fetch('/api/admin/status',{headers:{authorization:'Bearer '+auth.accessToken},cache:'no-store'})
   .then(async r=>{if(!alive)return;if(r.ok){router.replace('/admin');return;}setStatus(r.status===403?'denied':'error');setMessage(r.status===403?'Akun ini tidak memiliki izin Control Panel. Hubungi pengelola Vapmart.':'Akses administrator tidak dapat diverifikasi.');})
   .catch(()=>{if(alive){setStatus('error');setMessage('Layanan autentikasi belum dapat dihubungi.');}});
  return()=>{alive=false;};
 },[auth.accessToken,auth.loading,router]);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setMessage('');setStatus('idle');try{await auth.signIn(email.trim(),password);setPassword('');}catch(err){setMessage(err instanceof Error?err.message:'Login gagal');setStatus('error');}finally{setBusy(false);}}
 async function switchAccount(){await auth.signOut();setStatus('idle');setMessage('');}
 return <main className="vma26-root main-container" style={{minHeight:'78vh',display:'grid',placeItems:'center'}}>
 <section className="vma26-panel vma26-auth" style={{width:'100%',maxWidth:480,margin:'32px auto'}}>
  <p className="vma26-eyebrow">VAPMART / SECURE ACCESS</p>
  <h1 style={{fontSize:'clamp(30px,5vw,42px)',letterSpacing:'-.06em',lineHeight:1.1,margin:'8px 0 16px'}}>Vapmart <span style={{color:'#8428d6'}}>Control Panel</span></h1>
  <p style={{fontSize:13,color:'#86768e',lineHeight:1.6}}>Login khusus staf terotorisasi. Akses diverifikasi oleh Supabase Auth dan role admin di server.</p>
  {!auth.configured?<p role="alert" className="vma26-message">Autentikasi belum dikonfigurasi.</p>:
   auth.loading?<p role="status">Memeriksa sesi...</p>:
   auth.user?<div style={{display:'grid',gap:15,marginTop:24}}>
    <p>{status==='denied'?'Akun aktif bukan administrator.':status==='error'?'Gagal memeriksa otorisasi.':'Memverifikasi izin akses...'}</p>
    <strong style={{overflowWrap:'anywhere'}}>{auth.user.email}</strong>
    {message&&<p role="alert" style={{color:'#b23c5e'}}>{message}</p>}
    <button type="button" className="vma26-btn-light" onClick={switchAccount}>Gunakan akun lain</button>
   </div>:
   <form className="vma26-login" onSubmit={submit}>
    <label>Email administrator<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@vapmart.id"/></label>
    <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {message&&<p role="alert" style={{color:'#b23c5e',fontSize:12}}>{message}</p>}
    <button type="submit" className="vma26-btn-dark" disabled={busy}>{busy?'Memverifikasi...':'Login Control Panel'}</button>
   </form>}
  <Link href="/" style={{display:'inline-block',marginTop:25,fontSize:12,color:'#85788a'}}>← Kembali ke Vapmart</Link>
 </section>
 </main>;
}
