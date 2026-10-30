'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useCustomerAuth} from '@/lib/customer-auth';

type Mode='signin'|'signup'|'forgot'|'newpassword';
export function CustomerAuthPanel(){
 const params=useSearchParams();
 const auth=useCustomerAuth();
 const [mode,setMode]=useState<Mode>('signin');
 const [name,setName]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [confirmation,setConfirmation]=useState('');
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>{if(params.get('mode')==='reset')setMode('newpassword');},[params]);
 const choose=(next:Mode)=>{setMode(next);setPassword('');setNotice('');setError('');};
 const onSubmit=async(e:FormEvent<HTMLFormElement>)=>{
   e.preventDefault();setBusy(true);setError('');setNotice('');
   try{
     if(mode==='signin'){
       await auth.signIn(email.trim().toLowerCase(),password);
       setNotice('Berhasil masuk. Akun Anda sudah tersedia.');
     }else if(mode==='signup'){
       if(name.trim().length<2)throw new Error('Nama minimal 2 karakter.');
       if(password.length<8)throw new Error('Password minimal 8 karakter.');
       if(password!==confirmation)throw new Error('Konfirmasi password tidak cocok.');
       const outcome=await auth.signUp(email.trim().toLowerCase(),password,name);
       setNotice(outcome.needsConfirmation?'Periksa inbox untuk verifikasi email sebelum masuk.':'Akun dibuat. Anda dapat membuka Member Card.');
     }else if(mode==='forgot'){
       await auth.sendReset(email.trim().toLowerCase());
       setNotice('Jika email terdaftar, instruksi reset password dikirim ke inbox.');
     }else{
       if(password.length<8)throw new Error('Password minimal 8 karakter.');
       if(password!==confirmation)throw new Error('Konfirmasi password tidak cocok.');
       await auth.changePassword(password);
       setNotice('Password diperbarui. Silakan lanjutkan ke halaman Member.');
     }
   }catch(err){setError(err instanceof Error?err.message:'Operasi tidak berhasil.');}
   finally{setBusy(false);}
 };
 const nextPath=params.get('next');
 const safeNext=nextPath?.startsWith('/')&&!nextPath.startsWith('//')?nextPath:'/member-2';
 return <section className="vm21-auth-card">
   <div className="vm21-auth-ident"><img src="/branding/vapmart-logo.png" alt="Vapmart" width={180} height={50}/></div>
   {auth.loading?<p role="status">Memeriksa sesi akun…</p>:auth.user?
   <>
     <span className="vm21-eyebrow">AKUN TERHUBUNG</span>
     <h1>Selamat datang kembali.</h1>
     <p>{auth.user.email}</p>
     <div className="vm21-auth-actions">
       <Link href={safeNext} className="vm21-primary">Buka Member Card <span aria-hidden="true">↗</span></Link>
       <button type="button" className="vm21-secondary" onClick={()=>auth.signOut().catch(e=>setError(e.message))}>Keluar dari akun</button>
     </div>
     {error&&<p role="alert" className="vm21-form-error">{error}</p>}
   </>:
   <>
     <span className="vm21-eyebrow">YOUR VAPMART ACCOUNT</span>
     <h1>{mode==='signin'?'Masuk ke Vapmart':mode==='signup'?'Buat akun baru':mode==='forgot'?'Reset password':'Buat password baru'}</h1>
     <p>Daftar gratis, simpan favorit, dan kelola membership serta Coin dari satu akun.</p>
     <div className="vm21-auth-tabs" role="group" aria-label="Pilihan autentikasi">
       <button type="button" className={mode==='signin'?'is-active':''} aria-pressed={mode==='signin'} onClick={()=>choose('signin')}>Masuk</button>
       <button type="button" className={mode==='signup'?'is-active':''} aria-pressed={mode==='signup'} onClick={()=>choose('signup')}>Daftar</button>
     </div>
     {!auth.configured&&<div className="vm21-config-warning" role="status">Layanan akun Vapmart belum terhubung ke project Supabase khusus. Form tidak mengirim kredensial hingga konfigurasi selesai.</div>}
     <form className="vm21-auth-form" onSubmit={onSubmit}>
       {mode==='signup'&&<label>Nama lengkap<input required autoComplete="name" value={name} onChange={e=>setName(e.target.value)} maxLength={90} placeholder="Nama lengkap"/></label>}
       {mode!=='newpassword'&&<label>Email<input required type="email" inputMode="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@email.com" maxLength={255}/></label>}
       {mode!=='forgot'&&<label>{mode==='newpassword'?'Password baru':'Password'}
         <input required type="password" autoComplete={mode==='signin'?'current-password':'new-password'} minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimal 8 karakter"/>
       </label>}
       {(mode==='signup'||mode==='newpassword')&&<label>Konfirmasi password
         <input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="Ulangi password"/>
       </label>}
       {error&&<p role="alert" className="vm21-form-error">{error}</p>}
       {notice&&<p role="status" className="vm21-form-success">{notice}</p>}
       <button type="submit" className="vm21-primary" disabled={!auth.configured||busy}>
         {busy?'Memproses…':mode==='signin'?'Masuk':mode==='signup'?'Daftar Gratis':mode==='forgot'?'Kirim Email Reset':'Simpan Password'}
       </button>
     </form>
     <div className="vm21-auth-links">
       {mode==='signin'&&<button type="button" onClick={()=>choose('forgot')}>Lupa password?</button>}
       {(mode==='forgot'||mode==='newpassword')&&<button type="button" onClick={()=>choose('signin')}>Kembali ke Login</button>}
       <Link href="/member-2">Lihat benefit member</Link>
     </div>
   </>}
 </section>;
}
