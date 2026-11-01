'use client';
import {useEffect,useState,type FormEvent} from 'react';
import '../app/brand-portal.css';
type Brand={id:string;name:string};
type Member={user_id:string;role:string;is_active:boolean;created_at:string};
export function BrandAccessManager({brands,token}:{brands:Brand[];token:string|null}){
 const [selected,setSelected]=useState(''),[members,setMembers]=useState<Member[]>([]);
 const [userId,setUserId]=useState(''),[role,setRole]=useState('viewer'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{if(!brands.some(b=>b.id===selected))setSelected(brands[0]?.id||'');},[brands,selected]);
 async function load(id:string,signal?:AbortSignal){
  if(!id||!token)return;
  const r=await fetch('/api/admin/brand-access/'+encodeURIComponent(id),{headers:{authorization:'Bearer '+token},cache:'no-store',signal});
  const x=await r.json();if(!r.ok)throw new Error(x?.message||'Gagal memuat anggota');
  setMembers(x.items||[]);
 }
 useEffect(()=>{if(!selected||!token)return;const controller=new AbortController();load(selected,controller.signal).catch(e=>{if(!controller.signal.aborted)setMessage(e.message);});return()=>controller.abort();},[selected,token]);
 async function save(event:FormEvent){event.preventDefault();if(!selected||!token)return;setBusy(true);setMessage('');try{const r=await fetch('/api/admin/brand-access/'+selected,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({userId,role,isActive:true})});
  const x=await r.json();if(!r.ok)throw new Error(x?.message||'Gagal menyimpan akses');await load(selected);setMessage('Akun brand ditautkan.');setUserId('');}
  catch(e){setMessage(e instanceof Error?e.message:'Gagal menyimpan');}finally{setBusy(false);}}
 async function toggle(m:Member){if(!selected||!token)return;setBusy(true);try{const r=await fetch('/api/admin/brand-access/'+selected,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({userId:m.user_id,role:m.role,isActive:!m.is_active})});const x=await r.json();if(!r.ok)throw new Error(x?.message||'Gagal memperbarui');await load(selected);setMessage('Hak akses diperbarui.');}catch(e){setMessage(e instanceof Error?e.message:'Gagal memperbarui');}finally{setBusy(false);}}
 return <section className="vma26-panel vm-brand-access"><span className="vma26-eyebrow">BRAND ACCOUNT ACCESS</span><h2>Login per brand</h2>
 <p>Brand partner masuk melalui <a href="/brand/login">/brand/login</a> dengan akun Supabase sendiri. Setelah email diverifikasi, admin menautkan UUID dari Supabase Users ke brand yang ditentukan. Tidak ada password yang dibagikan.</p>
 {brands.length===0?<p>Tambahkan brand aktif terlebih dahulu.</p>:<>
  <form onSubmit={save} className="vm-brand-access-grid">
   <label>Brand<select value={selected} onChange={e=>{setSelected(e.target.value);setMessage('');}}>{brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
   <label>Supabase User UUID<input required pattern="[0-9a-fA-F-]{36}" value={userId} onChange={e=>setUserId(e.target.value)} placeholder="User ID terverifikasi"/></label>
   <label>Role<select value={role} onChange={e=>setRole(e.target.value)}><option value="viewer">Viewer</option><option value="manager">Manager</option><option value="owner">Owner</option></select></label>
   <button type="submit" disabled={busy||!selected}>Tautkan akun</button>
  </form>
  {message&&<p role="status">{message}</p>}
  {members.length>0?<div>{members.map(m=><div className="vm-brand-access-member" key={m.user_id}><span><strong>{m.role}</strong><small> · {m.user_id.slice(0,8)} · {m.is_active?'Aktif':'Nonaktif'}</small></span><button type="button" disabled={busy} onClick={()=>toggle(m)}>{m.is_active?'Nonaktifkan':'Aktifkan'}</button></div>)}</div>:<p>Belum ada user yang memiliki akses ke brand ini.</p>}
 </>}
 </section>;
}
