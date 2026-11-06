'use client';
import {useEffect,useMemo,useState} from 'react';
import '../app/courier-visibility.css';

type CourierService={
 key:string;courierCode:string;courierName:string;serviceCode:string;
 serviceName:string;category:string;supportsPostalCheckout:boolean
};
type Settings={
 provider:string;configured:boolean;selectedCodes:string[];selectedServices:string[]|null;
 availableServices:CourierService[];warning:string|null;updatedAt:string|null
};
const checkedServices=(d:Settings)=>d.availableServices.filter(x=>x.supportsPostalCheckout&&
 (!d.configured||d.selectedServices===null&&d.selectedCodes.includes(x.courierCode)||
 Array.isArray(d.selectedServices)&&d.selectedServices.includes(x.key))).map(x=>x.key);

export function CourierVisibilitySettings({token}:{token:string|null}){
 const [data,setData]=useState<Settings|null>(null);
 const [selected,setSelected]=useState<string[]>([]);
 const [search,setSearch]=useState(''),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 async function load(auth:string){
  const response=await fetch('/api/admin/shipping/couriers',{headers:{authorization:'Bearer '+auth},cache:'no-store'});
  const result=await response.json() as Settings&{message?:string};
  if(!response.ok)throw Error(result.message||'Tidak dapat memuat daftar layanan');
  setData(result);setSelected(checkedServices(result));
 }
 useEffect(()=>{
  if(!token)return;
  let active=true;
  fetch('/api/admin/shipping/couriers',{headers:{authorization:'Bearer '+token},cache:'no-store'}).then(async response=>{
   const result=await response.json() as Settings&{message?:string};
   if(!response.ok)throw Error(result.message||'Daftar kurir tidak tersedia');
   return result;
  }).then(result=>{if(active){setData(result);setSelected(checkedServices(result));}})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'Daftar kurir tidak tersedia');});
  return()=>{active=false};
 },[token]);
 const available=data?.availableServices||[];
 const selectable=useMemo(()=>available.filter(x=>x.supportsPostalCheckout),[available]);
 const groups=useMemo(()=>{
  const m=new Map<string,{name:string;code:string;items:CourierService[]}>();
  for(const item of available){
   const group=m.get(item.courierCode)||{name:item.courierName,code:item.courierCode,items:[]};
   group.items.push(item);m.set(item.courierCode,group);
  }
  return [...m.values()].filter(g=>(g.name+' '+g.items.map(x=>x.serviceName+' '+x.serviceCode).join(' ')).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
 },[available,search]);
 function toggle(key:string,checked:boolean){
  setSelected(current=>checked?[...new Set([...current,key])]:current.filter(x=>x!==key));setMessage('');
 }
 function toggleCarrier(keys:string[],enable:boolean){
  setSelected(current=>enable?[...new Set([...current,...keys])]:current.filter(x=>!keys.includes(x)));setMessage('');
 }
 async function save(){
  if(!token||busy||!selected.length)return;
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/admin/shipping/couriers',{method:'PATCH',
    headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify({selectedServices:selected}),cache:'no-store'});
   const result=await response.json() as Settings&{message?:string};
   if(!response.ok)throw Error(result.message||'Pilihan layanan gagal disimpan');
   setData(result);setSelected(checkedServices(result));
   setMessage(result.selectedServices?.length+' layanan berhasil diaktifkan. Checkout berikutnya hanya menampilkan pilihan yang dicentang dan memiliki tarif.');
  }catch(e){setError(e instanceof Error?e.message:'Gagal menyimpan');}
  finally{setBusy(false);}
 }
 return <section className="vma26-panel vm-carrier-settings">
  <div className="vm-carrier-top"><div><span className="vma26-eyebrow">STOREFRONT / JASA PENGIRIMAN</span>
   <h3>Kurir & layanan yang ditampilkan</h3>
   <p>Centang <strong>setiap layanan</strong> yang boleh muncul di checkout. Contoh: JNE REG aktif, JNE YES tidak aktif. Layanan dari ekspedisi yang sama dapat dipilih secara terpisah.</p></div>
   <span className="vm-carrier-count">{selected.length} layanan aktif</span></div>
  {!data&&!error&&<p role="status">Memuat layanan dari aggregator pengiriman...</p>}
  {data&&<>
   <p className="vm-carrier-info">{data.configured&&data.selectedServices!==null?'Filter layanan aktif.':data.configured?'Pilihan kurir sebelumnya aktif, tetapi belum dipisah per layanan. Simpan pilihan baru untuk mengaktifkan filter per layanan.':'Filter belum dikonfigurasi, sehingga seluruh tarif kurir yang memenuhi syarat dapat muncul. Simpan pilihan untuk mengaktifkannya.'}{data.updatedAt?' Terakhir disimpan '+new Date(data.updatedAt).toLocaleString('id-ID'):''}</p>
   {data.warning&&<p className="vm-carrier-warning" role="status">{data.warning}</p>}
   <div className="vm-carrier-controls">
    <input aria-label="Cari kurir atau layanan" placeholder="Cari ekspedisi atau layanan..." value={search} onChange={e=>setSearch(e.target.value)}/>
    <button type="button" disabled={busy||!selectable.length} onClick={()=>setSelected(selectable.map(x=>x.key))}>Pilih semua</button>
    <button type="button" disabled={busy} onClick={()=>setSelected([])}>Kosongkan</button>
   </div>
   <div className="vm-carrier-service-groups">
    {groups.map(group=>{
     const keys=group.items.filter(x=>x.supportsPostalCheckout).map(x=>x.key);
     const count=keys.filter(x=>selected.includes(x)).length;
     return <section key={group.code} className="vm-carrier-group">
      <div className="vm-carrier-group-head"><div><h4>{group.name}</h4><small>{count} dari {keys.length} layanan dipilih</small></div>
       <button type="button" disabled={busy||!keys.length} onClick={()=>toggleCarrier(keys,count!==keys.length)}>{count===keys.length?'Batalkan pilihan':'Pilih semua layanan'}</button></div>
      <div className="vm-carrier-list">{group.items.map(item=>{
       const disabled=!item.supportsPostalCheckout;
       const active=selected.includes(item.key);
       return <label key={item.key} className={'vm-carrier-option'+(active?' is-active':'')+(disabled?' is-unavailable':'')}>
        <input type="checkbox" checked={active} disabled={disabled||busy} onChange={e=>toggle(item.key,e.target.checked)}/>
        <span><strong>{item.serviceName}</strong><small>{item.category||'Layanan kurir'} · {item.serviceCode}</small></span>
        <span className="vm-carrier-mark">{disabled?'Butuh koordinat':active?'Tampil':'Sembunyi'}</span>
       </label>
      })}</div>
     </section>;
    })}
    {!groups.length&&<p>Belum ditemukan layanan kurir. Periksa koneksi aggregator atau ubah pencarian.</p>}
   </div>
   <div className="vm-carrier-footer">
    <p>Pilih minimal satu layanan. Opsi Instant dan Same Day yang membutuhkan koordinat peta belum dapat digunakan oleh checkout berbasis kode pos. Perubahan ini tidak membatalkan AWB yang sudah diterbitkan.</p>
    <button type="button" className="vma26-btn-dark" disabled={busy||!selected.length||!selectable.length} onClick={()=>void save()}>{busy?'Menyimpan...':'Simpan layanan storefront'}</button>
   </div>
  </>}
  {error&&<p role="alert" className="vm-carrier-warning">{error}</p>}
  {message&&<p role="status" className="vm-carrier-info">{message}</p>}
  {data&&<button type="button" className="vm-carrier-refresh" disabled={busy} onClick={()=>{
   if(!token)return;setBusy(true);setError('');void load(token).catch(e=>setError(e.message)).finally(()=>setBusy(false));
  }}>Perbarui daftar layanan</button>}
 </section>;
}
