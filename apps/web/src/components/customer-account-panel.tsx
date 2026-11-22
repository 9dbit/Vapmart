'use client';
import Link from 'next/link';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useCustomerAuth} from '@/lib/customer-auth';

type MemberStatus='REGISTERED'|'ACTIVE'|'SUSPENDED'|'UNAVAILABLE';
export function CustomerAccountPanel(){
 const auth=useCustomerAuth();
 const currentUser=useRef<string|null>(null);
 const [name,setName]=useState('');
 const [whatsapp,setWhatsapp]=useState('');
 const [address,setAddress]=useState('');
 const [status,setStatus]=useState<MemberStatus>('UNAVAILABLE');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  const user=auth.user;
  if(currentUser.current===user?.id)return;
  currentUser.current=user?.id??null;
  setName(typeof user?.user_metadata?.display_name==='string'?user.user_metadata.display_name:'');
  setWhatsapp(typeof user?.user_metadata?.whatsapp_number==='string'?user.user_metadata.whatsapp_number:'');
  setAddress(typeof user?.user_metadata?.address_line==='string'?user.user_metadata.address_line:'');
  setNotice('');setError('');
 },[auth.user]);
 useEffect(()=>{
  if(!auth.accessToken){setStatus('UNAVAILABLE');return;}
  const controller=new AbortController();
  const token=auth.accessToken;
  fetch('/api/member',{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller.signal})
   .then(async r=>r.ok?await r.json():null)
   .then(x=>{if(!controller.signal.aborted)setStatus(['ACTIVE','REGISTERED','SUSPENDED'].includes(x?.status)?x.status:'UNAVAILABLE');})
   .catch(()=>{if(!controller.signal.aborted)setStatus('UNAVAILABLE');});
  return()=>controller.abort();
 },[auth.accessToken]);
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!auth.user||!auth.accessToken)return;
  setError('');setNotice('');setBusy(true);
  try{
   const input={name:name.trim(),whatsapp:whatsapp.trim(),address:address.trim()};
   if(input.name.length<2||input.name.length>90)throw Error('Nama lengkap harus 2–90 karakter.');
   if(!/^(?:\+?62|0)[0-9\s-]{8,18}$/.test(input.whatsapp))throw Error('Masukkan nomor WhatsApp Indonesia yang valid.');
   if(input.address.length<8||input.address.length>300)throw Error('Alamat harus 8–300 karakter.');
   if(!auth.user.email_confirmed_at)throw Error('Verifikasi email Anda terlebih dahulu sebelum aktivasi gratis.');
   await auth.updateProfile(input);
   const response=await fetch('/api/member/registration',{
    method:'POST',cache:'no-store',
    headers:{Authorization:'Bearer '+auth.accessToken,'Content-Type':'application/json'},
    body:JSON.stringify(input)
   });
   const data=await response.json().catch(()=>({message:'Respons registrasi Member tidak valid.'}));
   if(!response.ok||data.status!=='ACTIVE')
    throw Error(Array.isArray(data.message)?data.message.join(', '):data.message||'Aktivasi Member belum berhasil. Profil akun sudah tersimpan.');
   setStatus('ACTIVE');
   setNotice('Profil akun tersimpan. Vapmart Member aktif gratis, tanpa pembelian produk atau pemotongan saldo.');
  }catch(err){setError(err instanceof Error?err.message:'Tidak dapat menyimpan profil.');}
  finally{setBusy(false);}
 }
 if(auth.loading)return <section className="vm-account-panel"><p role="status">Memeriksa akun pelanggan…</p></section>;
 if(!auth.user)return <section className="vm-account-panel vm-account-guest">
   <p className="vm-account-eyebrow">VAPMART ACCOUNT</p><h1>Akun Saya</h1>
   <p>Masuk atau daftar gratis untuk menyimpan nama, nomor WhatsApp, alamat dan mengaktifkan Member tanpa membeli produk.</p>
   <div className="vm-account-actions"><Link className="vm21-primary" href="/login?next=/akun">Masuk Akun</Link>
    <Link className="vm21-secondary" href="/login?next=/akun&mode=signup">Daftar Gratis</Link></div>
 </section>;
 return <section className="vm-account-panel" aria-labelledby="vm-account-title">
   <div className="vm-account-heading">
    <div><p className="vm-account-eyebrow">VAPMART / PROFILE</p><h1 id="vm-account-title">Akun Saya</h1>
     <p>Kelola data pribadi dan kontak pengiriman. Halaman ini terpisah dari saldo Coin dan benefit Member.</p></div>
    <Link href="/member-2" className="vm-account-member-link">Lihat Member Card</Link>
   </div>
   <div className="vm-account-status" role="status">
    <span className={status==='ACTIVE'?'vm-account-status-dot active':'vm-account-status-dot'}/>
    {status==='ACTIVE'?'Member aktif · Pendaftaran gratis':
      status==='REGISTERED'?'Akun terdaftar · Lengkapi profil untuk aktivasi gratis':
      status==='SUSPENDED'?'Akun sedang ditangguhkan':'Status member sedang tidak tersedia'}
   </div>
   <form onSubmit={save} className="vm-account-form" aria-busy={busy}>
    <label>Nama lengkap<input required autoComplete="name" minLength={2} maxLength={90}
      value={name} onChange={e=>setName(e.target.value)} placeholder="Nama lengkap"/></label>
    <label>Email<input readOnly type="email" value={auth.user.email||''} aria-describedby="vm-account-email-note"/></label>
    <p id="vm-account-email-note" className="vm-account-field-hint">Email mengikuti akun login dan diverifikasi melalui penyedia autentikasi.</p>
    <label>Nomor WhatsApp<input required type="tel" inputMode="tel" autoComplete="tel" minLength={9} maxLength={22}
      value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="08xxxxxxxxxx"/></label>
    <label>Alamat lengkap<textarea required autoComplete="street-address" rows={4} minLength={8} maxLength={300}
      value={address} onChange={e=>setAddress(e.target.value)} placeholder="Jalan, nomor, RT/RW, kelurahan, kota, provinsi, kode pos"/></label>
    <p className="vm-account-field-hint">Aktivasi Member cukup dengan melengkapi profil dan email terverifikasi. Pembelian produk dan top-up Coin adalah transaksi terpisah.</p>
    {error&&<p role="alert" className="vm-account-error">{error}</p>}
    {notice&&<p role="status" className="vm-account-success">{notice}</p>}
    <div className="vm-account-actions">
      <button type="submit" className="vm21-primary" disabled={busy||!auth.configured||status==='SUSPENDED'}>{busy?'Menyimpan…':status==='ACTIVE'?'Simpan Profil':'Simpan & Aktifkan Member Gratis'}</button>
      <Link href="/member-2" className="vm21-secondary">Kembali ke Member</Link>
    </div>
   </form>
   <div className="vm-account-footer-actions"><button type="button" onClick={()=>auth.signOut().catch(e=>setError(e.message))}>Keluar Akun</button></div>
 </section>;
}
