'use client';
import {useEffect,useState,type FormEvent} from 'react';
import '../app/brand-portal.css';
type Brand={id:string;name:string};
type Member={user_id:string;role:string;is_active:boolean;created_at:string};
type Invitation={id:string;email:string;role:string;created_at:string;expires_at:string;accepted_at:string|null;revoked_at:string|null};
export function BrandAccessManager({brands,token}:{brands:Brand[];token:string|null}){
 const [selected,setSelected]=useState(''),[members,setMembers]=useState<Member[]>([]),[invites,setInvites]=useState<Invitation[]>([]);
 const [email,setEmail]=useState(''),[role,setRole]=useState('viewer'),[inviteUrl,setInviteUrl]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{if(!brands.some(b=>b.id===selected))setSelected(brands[0]?.id||'');},[brands,selected]);
 async function load(id:string,signal?:AbortSignal){
  if(!id||!token)return;
  const headers={authorization:'Bearer '+token};
  const results=await Promise.all([
   fetch('/api/admin/brand-access/'+encodeURIComponent(id),{headers,cache:'no-store',signal}),
   fetch('/api/admin/brand-invitations/'+encodeURIComponent(id),{headers,cache:'no-store',signal})
  ]);
  const data=await Promise.all(results.map(r=>r.json()));
  if(results.some(r=>!r.ok))throw Error((data.find(d=>d.message)||{}).message||'Gagal memuat akses brand');
  if(!signal?.aborted){setMembers(data[0].items||[]);setInvites(data[1].items||[]);}
 }
 useEffect(()=>{if(!selected||!token)return;const ac=new AbortController();setInviteUrl('');setMessage('');load(selected,ac.signal).catch(e=>{if(!ac.signal.aborted)setMessage(e.message);});return()=>ac.abort();},[selected,token]);
 async function create(event:FormEvent){
  event.preventDefault();if(!selected||!token)return;setBusy(true);setMessage('');setInviteUrl('');
  try{
   const response=await fetch('/api/admin/brand-invitations/'+selected,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({email:email.trim(),role})});
   const data=await response.json();if(!response.ok)throw Error(data?.message||'Gagal membuat undangan');
   setInviteUrl(window.location.origin+'/brand/accept#token='+data.token);setEmail('');
   await load(selected);
   setMessage('Link undangan dibuat untuk '+data.email+'. Salin dan kirim sendiri; sistem tidak mengirim email otomatis. Berlaku 48 jam.');
  }catch(e){setMessage(e instanceof Error?e.message:'Gagal membuat undangan');}
  finally{setBusy(false);}
 }
 async function toggle(m:Member){
  if(!selected||!token)return;setBusy(true);setMessage('');
  try{
   const r=await fetch('/api/admin/brand-access/'+selected,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({userId:m.user_id,role:m.role,isActive:!m.is_active})});
   const x=await r.json();if(!r.ok)throw Error(x?.message||'Gagal memperbarui akses');
   await load(selected);setMessage('Hak akses mitra diperbarui.');
  }catch(e){setMessage(e instanceof Error?e.message:'Gagal memperbarui');}finally{setBusy(false);}
 }
 async function revoke(invite:Invitation){
  if(!selected||!token)return;setBusy(true);setMessage('');
  try{
   const r=await fetch('/api/admin/brand-invitations/'+selected+'/'+invite.id+'/revoke',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:'{}'});
   const x=await r.json();if(!r.ok)throw Error(x?.message||'Gagal mencabut undangan');
   await load(selected);setMessage('Undangan dicabut.');
  }catch(e){setMessage(e instanceof Error?e.message:'Gagal mencabut');}finally{setBusy(false);}
 }
 return <section className="vma26-panel vm-brand-access">
  <span className="vma26-eyebrow">VERIFIED PARTNER ACCESS</span><h2>Brand Onboarding</h2>
  <p>Undang pemilik/manager brand menggunakan emailnya. Mitra harus login Supabase dan memverifikasi email yang sama sebelum akses data brand aktif. Hak akses bisa dicabut kapan saja.</p>
  {brands.length===0?<p>Buat brand di Control Panel dulu untuk mulai onboarding.</p>:<>
   <form onSubmit={create} className="vm-brand-access-grid">
    <label>Brand<select value={selected} onChange={e=>setSelected(e.target.value)}>{brands.map(b=><option value={b.id} key={b.id}>{b.name}</option>)}</select></label>
    <label>Email mitra<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="owner@brand.com" maxLength={254}/></label>
    <label>Role<select value={role} onChange={e=>setRole(e.target.value)}><option value="viewer">Viewer</option><option value="manager">Manager</option><option value="owner">Owner</option></select></label>
    <button type="submit" disabled={busy||!selected}>Buat undangan</button>
   </form>
   {message&&<p role="status">{message}</p>}
   {inviteUrl&&<div style={{padding:16,background:'#f6f0fb',borderRadius:16,overflowWrap:'anywhere'}}>
    <p style={{marginTop:0}}>Tautan hanya ditampilkan sekarang. Kirim pribadi ke alamat email undangan.</p>
    <code style={{fontSize:12}}>{inviteUrl}</code>
    <button type="button" style={{marginTop:10}} onClick={()=>navigator.clipboard.writeText(inviteUrl)}>Salin tautan</button>
   </div>}
   <h3 style={{marginTop:26}}>Undangan</h3>
   {invites.length?<div>{invites.map(i=><div className="vm-brand-access-member" key={i.id}><span><strong>{i.email}</strong><small> · {i.role} · {i.accepted_at?'Diterima':i.revoked_at?'Dicabut':new Date(i.expires_at).getTime()<Date.now()?'Kedaluwarsa':'Menunggu'}</small></span>
    {!i.accepted_at&&!i.revoked_at&&<button type="button" onClick={()=>revoke(i)} disabled={busy}>Cabut</button>}</div>)}</div>:<p>Belum ada undangan brand.</p>}
   <h3 style={{marginTop:26}}>Akun aktif</h3>
   {members.length?<div>{members.map(m=><div className="vm-brand-access-member" key={m.user_id}><span><strong>{m.role}</strong><small> · {m.user_id.slice(0,8)} · {m.is_active?'Aktif':'Nonaktif'}</small></span>
    <button type="button" disabled={busy} onClick={()=>toggle(m)}>{m.is_active?'Nonaktifkan':'Aktifkan'}</button></div>)}</div>:<p>Belum ada mitra yang menerima undangan.</p>}
  </>}
 </section>;
}
