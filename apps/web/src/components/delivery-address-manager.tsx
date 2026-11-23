'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useCustomerAuth} from '@/lib/customer-auth';
import {IndonesiaAddressPicker} from '@/components/indonesia-address-picker';
import type {AddressSelection} from '@/lib/address-location';
import {ADDRESS_BOOK_MAX,CHOSEN_ADDRESS_KEY,legacyAccountAddress,readAddressBook,
 validAddressRegion,validatedBook,preferredAddress,addressStreet,type SavedDeliveryAddress
} from '@/lib/delivery-address-book';
import {googleMapsPinUrl,type DeliveryPin} from '@/lib/delivery-pin';

type Draft={
 label:string;recipientName:string;contactName:string;phone:string;
 street:string;unit:string;region:AddressSelection|null;pin:DeliveryPin|null;
};
const emptyDraft:Draft={label:'Rumah',recipientName:'',contactName:'',phone:'',street:'',unit:'',region:null,pin:null};
const fromAddress=(a:SavedDeliveryAddress):Draft=>({
 label:a.label,recipientName:a.recipientName,contactName:a.contactName,phone:a.phone,
 street:a.street,unit:a.unit,region:a.region,pin:a.pin
});
const coord=(x:{latitude:number;longitude:number;accuracy:number})=>
 ({latitude:x.latitude,longitude:x.longitude,confirmed:true as const});

export function DeliveryAddressManager({onSelected}:{onSelected:(address:SavedDeliveryAddress|null)=>void}){
 const auth=useCustomerAuth();
 const book=useMemo(()=>readAddressBook(auth.user?.user_metadata),[auth.user?.user_metadata]);
 const callback=useRef(onSelected);callback.current=onSelected;
 const [selectedId,setSelectedId]=useState('');
 const [expanded,setExpanded]=useState(false);
 const [editingId,setEditingId]=useState<string|null>(null);
 const [draft,setDraft]=useState<Draft>(emptyDraft);
 const [makeDefault,setMakeDefault]=useState(false);
 const [gps,setGps]=useState<{latitude:number;longitude:number;accuracy:number}|null>(null);
 const [legacyRegion,setLegacyRegion]=useState<AddressSelection|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const legacy=useMemo(()=>legacyAccountAddress(auth.user?.user_metadata),[auth.user?.user_metadata]);
 const defaultChoice=preferredAddress(book,selectedId);
 const legacyChoice=useMemo(()=>{
  if(book.addresses.length||!legacy||!legacyRegion)return null;
  return {
   id:'legacy-account',label:legacy.label,recipientName:legacy.recipientName||'Penerima',
   contactName:legacy.contactName||'Penerima',phone:legacy.phone,
   street:legacy.street,unit:'',region:legacyRegion,pin:null
  } satisfies SavedDeliveryAddress;
 },[book.addresses.length,legacy,legacyRegion]);
 const selectedAddress=defaultChoice||legacyChoice;

 useEffect(()=>{
  if(!auth.user){setSelectedId('');setLegacyRegion(null);callback.current(null);return;}
  let previous= '';
  try{previous=sessionStorage.getItem(CHOSEN_ADDRESS_KEY+auth.user.id)||'';}catch{}
  try{
   const regionRaw=localStorage.getItem('vapmart.shipping.region.'+auth.user.id);
   if(regionRaw){const region:unknown=JSON.parse(regionRaw);setLegacyRegion(validAddressRegion(region)?region:null);}
   else setLegacyRegion(null);
  }catch{setLegacyRegion(null);}
  const found=preferredAddress(book,previous);
  setSelectedId(found?.id||'');
  callback.current(found);
 },[auth.user?.id]);

 useEffect(()=>{
  if(!auth.user)return;
  const chosen=preferredAddress(book,selectedId);
  // Supabase emits USER_UPDATED after a save. Refresh the current choice from
  // server metadata without switching away from another selected address.
  if(chosen){
   callback.current(chosen);
   if(!selectedId)setSelectedId(chosen.id);
  }else callback.current(legacyChoice);
 },[book,legacyChoice,selectedId,auth.user?.id]);

 function selectAddress(addr:SavedDeliveryAddress){
  setSelectedId(addr.id);setExpanded(false);setEditingId(null);setError('');
  try{if(auth.user)sessionStorage.setItem(CHOSEN_ADDRESS_KEY+auth.user.id,addr.id);}catch{}
  callback.current(addr);
 }
 function startAdd(fromLegacy=false){
  if(book.addresses.length>=ADDRESS_BOOK_MAX){setError('Maksimal 10 alamat tersimpan. Edit alamat yang sudah ada.');return;}
  setDraft({...emptyDraft,
   ...(fromLegacy&&legacy?{
    label:legacy.label,recipientName:legacy.recipientName,contactName:legacy.contactName,
    phone:legacy.phone,street:legacy.street,region:legacyRegion
   }:{recipientName:typeof auth.user?.user_metadata?.display_name==='string'?auth.user.user_metadata.display_name:'',
     contactName:typeof auth.user?.user_metadata?.display_name==='string'?auth.user.user_metadata.display_name:'',
     phone:typeof auth.user?.user_metadata?.whatsapp_number==='string'?auth.user.user_metadata.whatsapp_number:''})
  });
  setEditingId('new');setGps(null);setExpanded(true);setMakeDefault(!book.defaultId);setError('');setNotice('');
 }
 function startEdit(a:SavedDeliveryAddress){
  setEditingId(a.id);setDraft(fromAddress(a));setGps(null);setExpanded(true);
  setMakeDefault(a.id===book.defaultId);setError('');setNotice('');
 }
 async function save(){
  if(!auth.user||busy)return;
  if(!validAddressRegion(draft.region)){setError('Lengkapi provinsi, kota, kecamatan, kelurahan, dan kode pos terlebih dahulu.');return;}
  if(!draft.street.trim()||!draft.unit.trim()) {
   // Unit may not exist in a detached house; the user is explicitly offered "Tidak ada".
   if(draft.street.trim().length<8){setError('Isi nama jalan dan nomor rumah atau patokan lengkap.');return;}
  }
  const id=editingId&&editingId!=='new'?editingId:crypto.randomUUID();
  const next:SavedDeliveryAddress={
   id,label:draft.label.trim(),recipientName:draft.recipientName.trim(),
   contactName:draft.contactName.trim(),phone:draft.phone.trim(),
   street:draft.street.trim(),unit:draft.unit.trim(),region:draft.region,
   pin:gps?coord(gps):draft.pin
  };
  let addresses=book.addresses.filter(a=>a.id!==id);
  if(editingId==='new'&&addresses.length>=ADDRESS_BOOK_MAX){setError('Buku alamat sudah penuh (10 alamat).');return;}
  addresses=[...addresses,next];
  const defaultId=makeDefault||!book.defaultId?id:book.defaultId;
  setBusy(true);setError('');
  try{
   const updated=validatedBook({version:1,addresses,defaultId});
   await auth.saveAddressBook(updated);
   selectAddress(next);setEditingId(null);setNotice('Alamat tersimpan dan dipilih untuk pengiriman.');
  }catch(e){setError(e instanceof Error?e.message:'Alamat gagal disimpan. Coba lagi.');}
  finally{setBusy(false);}
 }
 async function setDefault(id:string){
  if(!auth.user||busy)return;setBusy(true);setError('');
  try{await auth.saveAddressBook({...book,defaultId:id});setNotice('Alamat utama diperbarui.');}
  catch(e){setError(e instanceof Error?e.message:'Gagal mengubah alamat utama.');}
  finally{setBusy(false);}
 }
 return <div className="vpd-address-manager">
  <div className="vpd-ship-destination" aria-label="Alamat tujuan terpilih">
   <div className="vpd-address-destination-copy">
    <small>Dikirim ke</small>
    <strong>{selectedAddress?.label||legacy?.label||'Pilih alamat pengiriman'}{selectedAddress?.recipientName?', '+selectedAddress.recipientName:''}</strong>
    {selectedAddress?<span>{addressStreet(selectedAddress)} · {selectedAddress.region.label}</span>:
     legacy?<span>{legacy.street} · Lengkapi wilayah untuk cek ongkir</span>:
     <span>Belum ada alamat tersimpan di akun ini.</span>}
   </div>
   {auth.user&&<button type="button" className="vpd-address-toggle" onClick={()=>{setExpanded(x=>!x);setEditingId(null);setError('');}} aria-expanded={expanded}>
    {expanded?'Tutup':'Pilih alamat'} <span aria-hidden="true">⌄</span>
   </button>}
  </div>
  {!auth.user?<div className="vpd-ship-state"><p>Masuk untuk menyimpan dan memilih alamat pengiriman.</p><Link className="vpd-ship-action" href="/login?next=/akun">Masuk Akun</Link></div>:
   <>
    {!selectedAddress&&<div className="vpd-ship-state"><p>{legacy?'Lengkapi wilayah alamat akun agar tarif kurir dapat dihitung.':'Tambahkan alamat tujuan untuk melihat kurir dan harga.'}</p>
     <button type="button" className="vpd-ship-action" onClick={()=>startAdd(Boolean(legacy))}>{legacy?'Lengkapi alamat akun':'Tambah alamat pertama'}</button>
    </div>}
    {expanded&&<section className="vpd-address-book" aria-label="Alamat tersimpan">
     <header><strong>Daftar alamat saya</strong><span>{book.addresses.length}/{ADDRESS_BOOK_MAX}</span></header>
     {book.addresses.map(addr=><article className={'vpd-address-option'+(selectedAddress?.id===addr.id?' is-selected':'')} key={addr.id}>
      <div className="vpd-address-title"><b>{addr.label}</b>{book.defaultId===addr.id&&<small>Utama</small>}</div>
      <strong>{addr.recipientName} · {addr.phone}</strong>
      <p>{addressStreet(addr)}, {addr.region.label}</p>
      <div className="vpd-address-actions">
       <button type="button" disabled={busy} className={selectedAddress?.id===addr.id?'is-current':''} onClick={()=>selectAddress(addr)}>{selectedAddress?.id===addr.id?'Dipilih':'Pilih alamat'}</button>
       <button type="button" disabled={busy} onClick={()=>startEdit(addr)}>Edit</button>
       {book.defaultId!==addr.id&&<button type="button" disabled={busy} onClick={()=>void setDefault(addr.id)}>Jadikan utama</button>}
      </div>
     </article>)}
     {!book.addresses.length&&legacy&&<div className="vpd-address-legacy"><strong>Alamat akun</strong><p>{legacy.street}</p>
      <button type="button" onClick={()=>startAdd(true)}>Lengkapi dan simpan alamat</button></div>}
     {book.addresses.length<ADDRESS_BOOK_MAX&&<button type="button" className="vpd-address-add" onClick={()=>startAdd(false)}>+ Tambah alamat lain</button>}
    </section>}
    {editingId&&<section onKeyDown={e=>{if(e.key==='Enter'&&!(e.target instanceof HTMLTextAreaElement))e.preventDefault();}} className="vpd-address-form" aria-label={editingId==='new'?'Tambah alamat baru':'Edit alamat'}>
     <div className="vpd-address-form-heading"><h3>{editingId==='new'?'Tambah alamat baru':'Edit alamat tersimpan'}</h3>
      <button type="button" onClick={()=>{setEditingId(null);setGps(null);setError('');}}>Batal</button></div>
     <p className="vpd-address-geohint">Gunakan GPS untuk mendeteksi provinsi, kota, kecamatan, kelurahan, dan kode pos. Periksa wilayah yang terisi sebelum menyimpan.</p>
     <IndonesiaAddressPicker key={editingId} initialValue={draft.region||undefined}
      onChange={region=>{setDraft(old=>({...old,region,pin:old.region?.areaId===region?.areaId?old.pin:null}));setGps(null);}}
      onLocationCandidate={point=>{setGps(point);}}/>
     {gps&&<div className="vpd-address-gps-confirm"><strong>GPS ditemukan · akurasi sekitar {gps.accuracy} m</strong>
      <a href={googleMapsPinUrl(coord(gps))} target="_blank" rel="noopener noreferrer">Periksa pin di Google Maps</a>
      <small>Pin GPS baru akan disimpan setelah Anda mengonfirmasi alamat di bawah.</small></div>}
     <div className="vpd-address-fields">
      <label>Label alamat<input value={draft.label} maxLength={40} required placeholder="Rumah / Kantor" onChange={e=>setDraft(d=>({...d,label:e.target.value}))}/></label>
      <label>Nama penerima<input value={draft.recipientName} minLength={2} maxLength={90} autoComplete="name" required onChange={e=>setDraft(d=>({...d,recipientName:e.target.value}))}/></label>
      <label>Kontak person<input value={draft.contactName} minLength={2} maxLength={90} required onChange={e=>setDraft(d=>({...d,contactName:e.target.value}))}/></label>
      <label>No. telepon penerima<input type="tel" inputMode="tel" autoComplete="tel" value={draft.phone} maxLength={22} required placeholder="08xxxxxxxxxx" onChange={e=>setDraft(d=>({...d,phone:e.target.value}))}/></label>
      <label className="vpd-address-wide">Detail alamat<textarea value={draft.street} rows={2} minLength={8} maxLength={300} required placeholder="Jalan, nomor rumah/gedung, RT/RW, patokan" onChange={e=>setDraft(d=>({...d,street:e.target.value}))}/></label>
      <label className="vpd-address-wide">Nomor rumah / unit / lantai <small>(jika ada)</small>
       <input value={draft.unit} maxLength={100} placeholder="Contoh: Tower A, Lantai 5, Unit 06" onChange={e=>setDraft(d=>({...d,unit:e.target.value}))}/></label>
     </div>
     <label className="vpd-address-default-check"><input type="checkbox" checked={makeDefault} onChange={e=>setMakeDefault(e.target.checked)}/> Jadikan alamat utama</label>
     {error&&<p role="alert" className="vpd-ship-error">{error}</p>}
     <div className="vpd-address-form-actions"><button type="button" onClick={()=>{setEditingId(null);setGps(null);}}>Batal</button>
      <button type="button" className="vpd-ship-action vpd-address-save-button" disabled={busy||!draft.region} onClick={()=>void save()}>{busy?'Menyimpan…':'Simpan & gunakan alamat'}</button>
     </div>
    </section>}
    {!editingId&&error&&<p role="alert" className="vpd-ship-error">{error}</p>}
    {!editingId&&notice&&<p role="status" className="vpd-ship-selected">{notice}</p>}
   </>}
 </div>;
}
