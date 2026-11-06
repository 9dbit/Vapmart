'use client';
import {useEffect,useState} from 'react';
import '../app/courier-visibility.css';
type Option={code:string;name:string};
type Settings={provider:string;configured:boolean;selectedCodes:string[];available:Option[];warning:string|null;updatedAt:string|null};
export function CourierVisibilitySettings({token}:{token:string|null}){
 const [data,setData]=useState<Settings|null>(null),[selected,setSelected]=useState<string[]>([]),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function read(auth:string){
  const r=await fetch('/api/admin/shipping/couriers',{headers:{authorization:'Bearer '+auth},cache:'no-store'});
  const d=await r.json();if(!r.ok)throw Error(d?.message||'Tidak dapat memuat kurir');
  setData(d);setSelected(d.configured?d.selectedCodes:d.available.map((x:Option)=>x.code));
 }
 useEffect(()=>{
  if(!token)return;
  let active=true;
  fetch('/api/admin/shipping/couriers',{headers:{authorization:'Bearer '+token},cache:'no-store'}).then(async r=>{
   const d=await r.json();if(!r.ok)throw Error(d?.message||'Tidak dapat memuat daftar kurir');return d;
  }).then((d:Settings)=>{if(active){setData(d);setSelected(d.configured?d.selectedCodes:d.available.map(x=>x.code));}}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Daftar kurir tidak tersedia');});
  return()=>{active=false};
 },[token]);
 async function save(){
  if(!token||busy)return;setBusy(true);setError('');setMessage('');
  try{
   const r=await fetch('/api/admin/shipping/couriers',{method:'PATCH',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({selectedCodes:selected}),cache:'no-store'});
   const d=await r.json();if(!r.ok)throw Error(d?.message||'Gagal menyimpan pilihan kurir');
   setData(d);setSelected(d.selectedCodes);setMessage(d.selectedCodes.length+' kurir aktif di storefront. Tarif customer akan difilter mulai permintaan berikutnya.');
  }catch(e){setError(e instanceof Error?e.message:'Gagal menyimpan');}finally{setBusy(false);}
 }
 const filtered=(data?.available||[]).filter(x=>(x.name+' '+x.code).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const effectiveSelected=selected.length;
 return <section className="vma26-panel vm-carrier-settings">
  <div className="vm-carrier-top"><div><span className="vma26-eyebrow">STOREFRONT · COURIER VISIBILITY</span><h3>Kurir yang ditampilkan</h3><p>Centang ekspedisi yang boleh dipilih customer. Semua layanan dari kurir yang tidak dicentang akan disembunyikan pada checkout.</p></div>
   <span className="vm-carrier-count">{effectiveSelected} terpilih</span></div>
  {!data&&!error&&<p role="status">Memuat daftar kurir dari Jubelio...</p>}
  {data&&<><p className="vm-carrier-info">{data.configured?'Filter kurir aktif.':'Belum disimpan: untuk sementara storefront mengikuti seluruh kurir penyedia. Simpan pilihan untuk mengaktifkan filter.'}{data.updatedAt?' · Diperbarui '+new Date(data.updatedAt).toLocaleString('id-ID'):''}</p>
   {data.warning&&<p className="vm-carrier-warning" role="status">{data.warning}</p>}
   <div className="vm-carrier-controls"><input aria-label="Cari kurir" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari nama kurir"/><button type="button" disabled={busy||!data.available.length} onClick={()=>setSelected(data.available.map(x=>x.code))}>Pilih semua</button><button type="button" disabled={busy} onClick={()=>setSelected([])}>Kosongkan</button></div>
   <div className="vm-carrier-list">{filtered.map(x=><label className={'vm-carrier-option'+(selected.includes(x.code)?' is-active':'')} key={x.code}><input type="checkbox" checked={selected.includes(x.code)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,x.code]:prev.filter(a=>a!==x.code))}/><span><strong>{x.name}</strong><small>ID {x.code}</small></span><span className="vm-carrier-mark">{selected.includes(x.code)?'Aktif':'Sembunyi'}</span></label>)}
    {filtered.length===0&&<p>Tidak ada kurir sesuai pencarian. Jalankan cek ongkir untuk menyegarkan riwayat layanan jika penyedia sedang tidak tersedia.</p>}</div>
   <div className="vm-carrier-footer"><p>Minimal satu kurir aktif. Kurir tetap harus menyediakan tarif untuk alamat customer. Pengaturan ini tidak mengubah kurir pesanan yang sudah dibayar atau sudah dibuatkan AWB.</p><button type="button" className="vma26-btn-dark" disabled={busy||!selected.length||!data.available.length} onClick={save}>{busy?'Menyimpan...':'Simpan kurir storefront'}</button></div>
  </>}
  {error&&<p role="alert" className="vm-carrier-warning">{error}</p>}
  {message&&<p role="status" className="vm-carrier-info">{message}</p>}
  {data&&<button type="button" className="vm-carrier-refresh" disabled={busy} onClick={()=>{if(token){setBusy(true);setError('');void read(token).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}}>Perbarui daftar kurir</button>}
 </section>;
}
