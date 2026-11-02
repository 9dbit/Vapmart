'use client';
import {useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useCustomerAuth} from '@/lib/customer-auth';
import {AdminBrandLogo} from '@/components/admin-brand-logo';
import '../app/admin-v27.css';

export type AdminAccessPhase='checking'|'logged-out'|'denied'|'expired'|'error'|'unconfigured';
export function AdminAccess({phase,onRetry}:{phase:AdminAccessPhase;onRetry:()=>void}){
 const auth=useCustomerAuth();
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [visible,setVisible]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  setBusy(true);setError('');
  try{
   await auth.signIn(email.trim(),password);
   setPassword('');
  }catch{
   setError('Login gagal. Periksa email, password, dan status verifikasi akun.');
  }finally{setBusy(false);}
 }
 async function switchAccount(){
  setBusy(true);setError('');
  try{await auth.signOut();setPassword('');setEmail('');}
  catch{setError('Tidak dapat keluar dari sesi. Coba ulangi.');}
  finally{setBusy(false);}
 }
 const validating=auth.loading||phase==='checking';
 return <main className="vma27-access-page vma26-root" aria-label="Vapmart Admin Control Panel">
  <div className="vma27-access-layout">
   <section className="vma27-access-intro" aria-label="Informasi dashboard">
    <Link href="/" className="vma27-access-brand" aria-label="Vapmart beranda">
     <AdminBrandLogo placement="access"/>
    </Link>
    <span className="vma27-access-kicker">PRIVATE WORKSPACE</span>
    <h1>Kelola toko.<br/><span>Satu tempat.</span></h1>
    <p>Produk, media, brand, stok, pesanan, dan pengiriman dalam satu Control Panel. Akses hanya untuk administrator terverifikasi.</p>
    <div className="vma27-access-highlights" aria-label="Keamanan sistem">
     <div><strong>01</strong><span>Login Supabase terverifikasi</span></div>
     <div><strong>02</strong><span>Izin admin diperiksa di server</span></div>
     <div><strong>03</strong><span>Gateway pembayaran tetap nonaktif</span></div>
    </div>
   </section>
   <section className="vma27-access-card" aria-labelledby="admin-login-title">
    <span className="vma27-access-chip"><span aria-hidden="true" className="vma27-secure-dot"/> SECURE ADMIN ACCESS</span>
    <h2 id="admin-login-title">Selamat datang kembali.</h2>
    <p className="vma27-access-subtitle">Masuk untuk melanjutkan pekerjaan di Vapmart.</p>
    {!auth.configured||phase==='unconfigured'?
     <div role="alert" className="vma27-access-alert">Supabase Auth belum dikonfigurasi. Control Panel tetap terkunci hingga koneksi aman tersedia.</div>:
     validating?
     <div role="status" className="vma27-access-loading"><span className="vma27-loading-ring" aria-hidden="true"/> Memverifikasi sesi dan izin administrator...</div>:
     auth.user?
     <div className="vma27-access-existing">
      <span className="vma27-access-label">Akun aktif</span>
      <strong className="vma27-account-email">{auth.user.email||'Akun terautentikasi'}</strong>
      <div role={phase==='denied'?'alert':'status'} className="vma27-access-alert">
       {phase==='denied'?'Akun ini belum memiliki izin administrator. Hubungi pengelola Vapmart atau gunakan akun admin yang diotorisasi.':phase==='expired'?'Sesi sudah berakhir atau tidak valid. Silakan masuk dengan akun admin lagi.':
        'Koneksi pemeriksaan admin belum tersedia. Data administrasi tetap terkunci.'}
      </div>
      {phase==='error'&&<button type="button" className="vma27-primary-button" onClick={onRetry}>Coba verifikasi lagi</button>}
      <button type="button" className="vma27-outline-button" onClick={switchAccount} disabled={busy}>
       {busy?'Keluar dari sesi...':'Gunakan akun lain'}
      </button>
     </div>:
     <form className="vma27-access-form" onSubmit={submit}>
      <label htmlFor="admin-email">Email administrator</label>
      <input id="admin-email" type="email" name="email" autoComplete="username" autoCapitalize="none"
        required placeholder="Email yang terdaftar" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/>
      <label htmlFor="admin-password">Password</label>
      <div className="vma27-password-wrap">
       <input id="admin-password" type={visible?'text':'password'} name="password" autoComplete="current-password"
        required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/>
       <button type="button" onClick={()=>setVisible(x=>!x)} aria-label={visible?'Sembunyikan password':'Tampilkan password'}
        aria-pressed={visible} disabled={busy}>{visible?'Sembunyikan':'Lihat'}</button>
      </div>
      {error&&<div className="vma27-access-alert" role="alert">{error}</div>}
      <button className="vma27-primary-button" type="submit" disabled={busy}>
       {busy?'Memeriksa akun...':'Masuk ke Control Panel'}<span aria-hidden="true">↗</span>
      </button>
     </form>}
    <div className="vma27-access-footer"><span>Area internal • Akses tercatat di sistem</span><Link href="/">← Kembali ke toko</Link></div>
   </section>
  </div>
 </main>;
}
