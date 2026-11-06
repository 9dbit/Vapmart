'use client';
import {useEffect,useState} from 'react';
import {CatalogNotice,useCatalogAdmin} from './catalog-admin-shell';
const fields=[['name','Nama toko'],['address','Alamat lengkap'],['city','Kota / kabupaten'],['province','Provinsi'],['postalCode','Kode pos'],['phone','Telepon / WhatsApp'],['email','Email']] as const;
export function StoreProfileAdmin(){
 const {request}=useCatalogAdmin(),[data,setData]=useState<any>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function load(){setError('');try{setData(await request('store-profile'));}catch(e){setError((e as Error).message);}}
 useEffect(()=>{void load()},[]);
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');try{setData(await request('store-profile',{...data.profile,expectedVersion:data.version},'PATCH'));setMessage('Profil toko tersimpan. Data ini digunakan untuk invoice baru.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <><div className="vc-toolbar"><h2>Profil Toko</h2><button onClick={load} disabled={busy}>Muat ulang</button></div><CatalogNotice error={error} message={message}/>{!data&&!error&&<p role="status">Memuat profil toko...</p>}{data&&<form className="vc-panel" onSubmit={save}><p>Identitas toko untuk invoice. Invoice yang sudah diterbitkan mempertahankan data saat diterbitkan. Alamat pickup diatur di Gudang & Stok.</p><fieldset disabled={busy} className="vo-fieldset"><div className="vc-grid">{fields.map(([key,label])=><label key={key}>{label}<input type={key==='email'?'email':'text'} required={key!=='email'} value={data.profile[key]} maxLength={key==='address'?300:key==='email'?254:key==='postalCode'?5:key==='phone'?22:key==='name'?100:90} pattern={key==='postalCode'?'[0-9]{5}':undefined} onChange={e=>{setMessage('');setData({...data,profile:{...data.profile,[key]:e.target.value}})}}/></label>)}</div><button className="vc-primary" type="submit">{busy?'Menyimpan...':'Simpan profil toko'}</button></fieldset></form>}</>;
}
