'use client';
import {useState} from 'react';
import Link from 'next/link';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {formatIDR} from '@/lib/types';

let client:SupabaseClient|null=null;
function getClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return null;
  if(!client)client=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true}});
  return client;
}
export default function AdminPage(){
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  const [token,setToken]=useState('');const [message,setMessage]=useState('');const [loading,setLoading]=useState(false);
  const [name,setName]=useState('');const [slug,setSlug]=useState('');const [description,setDescription]=useState('');const [category,setCategory]=useState('lifestyle');const [price,setPrice]=useState('');const [stock,setStock]=useState('0');
  const configured=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  async function signin(e:React.FormEvent){e.preventDefault();const supabase=getClient();if(!supabase)return;setLoading(true);setMessage('');try{
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error||!data.session){setMessage('Gagal login: '+(error?.message||'Sesi tidak ditemukan'));return;}
    const response=await fetch('/api/admin/products',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+data.session.access_token},body:JSON.stringify({})});
    if(response.status===403){await supabase.auth.signOut();setMessage('Akun ini tidak memiliki peran admin.');return;}
    if(response.status!==400&&response.status!==422){await supabase.auth.signOut();setMessage('Admin API belum siap. Cek database dan konfigurasi.');return;}
    setToken(data.session.access_token);setMessage('Login admin terverifikasi.');
  }catch{setMessage('Koneksi ke server gagal.');}finally{setLoading(false);}}
  async function save(e:React.FormEvent){e.preventDefault();const supabase=getClient();if(!supabase)return;setLoading(true);setMessage('');try{
    const {data}=await supabase.auth.getSession();const access=data.session?.access_token||token;
    const response=await fetch('/api/admin/products',{method:'POST',headers:{authorization:'Bearer '+access,'content-type':'application/json'},body:JSON.stringify({name,slug,description,category,price_idr:Number(price),stock_qty:Number(stock),is_active:false})});
    const result=await response.json() as {name?:string;message?:string};
    if(response.ok){setMessage('Draft produk tersimpan: '+(result.name||name));setName('');setSlug('');setDescription('');setPrice('');}else{setMessage('Gagal menyimpan produk: '+(result.message||response.status));}
  }catch{setMessage('Gagal menghubungi API.');}finally{setLoading(false);}}
  return <main className="admin-page main-container"><Link className="back-link" href="/">← Back to store</Link><div className="admin-banner"><p className="eyebrow">MANAGEMENT CONSOLE / STAGING</p><h1>Vapmart Studio.</h1><p>Kelola katalog produk non-nikotin. Checkout tetap nonaktif hingga integrasi transaksi selesai.</p></div>{!configured?<div className="admin-panel"><h2>Authentication not configured</h2><p>Atur NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY di environment web, serta SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY di API. Akses admin tetap tertutup hingga pengaturan selesai.</p></div>:!token?<form className="admin-panel admin-form" onSubmit={signin}><h2>Admin sign in</h2><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/></label><label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label><button className="button button-dark" type="submit" disabled={loading}>{loading?'Verifying...':'Masuk admin'}</button></form>:<form className="admin-panel admin-form" onSubmit={save}><h2>Tambah produk baru</h2><p className="fine-print">Produk disimpan sebagai draft. Aktivasi publikasi dilakukan setelah QA konten.</p><label>Nama produk<input value={name} onChange={e=>{setName(e.target.value);setSlug(e.target.value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g,'').trim().replace(/ +/g,'-'));}} required minLength={2}/></label><label>Slug<input value={slug} onChange={e=>setSlug(e.target.value)} required/></label><label>Deskripsi<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={4}/></label><label>Kategori<select value={category} onChange={e=>setCategory(e.target.value)}>{['home','lifestyle','decor','accessories','electronics','other'].map(c=><option key={c} value={c}>{c}</option>)}</select></label><div className="admin-cols"><label>Harga IDR<input value={price} onChange={e=>setPrice(e.target.value)} type="number" min="0" step="1" required/>{price&&<small>{formatIDR(Number(price))}</small>}</label><label>Stok<input value={stock} onChange={e=>setStock(e.target.value)} type="number" min="0" step="1" required/></label></div><button className="button button-dark" type="submit" disabled={loading}>{loading?'Saving...':'Simpan draft ↗'}</button><button type="button" className="admin-signout" onClick={async()=>{await getClient()?.auth.signOut();setToken('');setMessage('Signed out.');}}>Sign out</button></form>}{message&&<p className="admin-message" role="status">{message}</p>}</main>;
}
