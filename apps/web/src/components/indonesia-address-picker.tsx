'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {pathFromLocation,regionFromPath,resetAddressPath,locationCompletion,type AddressPath,type AddressSelection,type AddressList} from '@/lib/address-location';
const empty:AddressPath={provinces:[],cities:[],districts:[],areas:[],provinceId:'',cityId:'',districtId:'',areaId:''};
export function IndonesiaAddressPicker({onChange,initialValue,onLocationCandidate}:{onChange:(region:AddressSelection|null)=>void;initialValue?:AddressSelection;onLocationCandidate?:(coords:{latitude:number;longitude:number;accuracy:number})=>void}){
 const [path,setPath]=useState<AddressPath>(()=>({...empty,provinceId:initialValue?.provinceId||'',cityId:initialValue?.cityId||'',districtId:initialValue?.districtId||'',areaId:initialValue?.areaId||''})),[loading,setLoading]=useState('provinces'),[error,setError]=useState(''),[reload,setReload]=useState(0),[locating,setLocating]=useState(false),[suggestion,setSuggestion]=useState<AddressPath|null>(null),[locationNote,setLocationNote]=useState('');
 const callback=useRef(onChange);callback.current=onChange;
 const coordinateCallback=useRef(onLocationCandidate);coordinateCallback.current=onLocationCandidate;
 const version=useRef(0),locationRun=useRef(0),mounted=useRef(true);
 const list:AddressList=useCallback(async(level,parent='')=>{const r=await fetch('/api/shipping/areas?level='+level+'&parentId='+encodeURIComponent(parent),{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(typeof d.message==='string'?d.message:'Daftar wilayah belum tersedia.');return d.items;},[]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;locationRun.current++;}},[]);
 useEffect(()=>{
  let active=true;const run=++version.current;
  const level=!path.provinces.length?'provinces':path.provinceId&&!path.cities.length?'cities':path.cityId&&!path.districts.length?'districts':path.districtId&&!path.areas.length?'areas':null;
  if(!level){setLoading('');return;}
  const parent=level==='cities'?path.provinceId:level==='districts'?path.cityId:level==='areas'?path.districtId:'';
  setLoading(level);setError('');
  void list(level,parent).then(items=>{if(!active||run!==version.current)return;if(!items.length)throw Error('Daftar wilayah belum tersedia. Coba lagi atau pilih wilayah lain.');setPath(p=>({...p,[level]:items}));}).catch(e=>{if(active&&run===version.current)setError(e.message);}).finally(()=>{if(active&&run===version.current)setLoading('');});
  return()=>{active=false};
 },[path.provinceId,path.cityId,path.districtId,path.provinces.length,path.cities.length,path.districts.length,path.areas.length,reload,list]);
 function change(level:'provinceId'|'cityId'|'districtId'|'areaId',id:string){
  version.current++;locationRun.current++;setLocating(false);setSuggestion(null);setLocationNote('');setError('');const next=resetAddressPath(path,level,id);setPath(next);callback.current(regionFromPath(next));
 }
 async function locate(){
  if(!window.isSecureContext){
   setLocationNote('GPS hanya tersedia pada koneksi HTTPS. Buka vapmart.id langsung di Safari atau Chrome.');
   return;
  }
  if(!navigator.geolocation){
   setLocationNote('GPS tidak tersedia di browser ini. Buka vapmart.id langsung di Safari/Chrome dan izinkan akses Lokasi.');
   return;
  }
  const run=++locationRun.current;
  setLocating(true);setSuggestion(null);setLocationNote('Meminta izin GPS perangkat...');
  const requestPosition=(highAccuracy:boolean,timeout:number,maximumAge:number)=>
   new Promise<GeolocationPosition>((resolve,reject)=>
    navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:highAccuracy,timeout,maximumAge}));
  let gps:{latitude:number;longitude:number;accuracy:number}|null=null;
  try{
   let position:GeolocationPosition;
   try{
    position=await requestPosition(true,12000,0);
   }catch(e){
    // Indoor GPS on Safari can time out; retry Wi-Fi/cell-based location.
    // Never retry a denied permission or silently infer location by IP.
    if((e as GeolocationPositionError)?.code!==3)throw e;
    if(mounted.current&&run===locationRun.current)setLocationNote('GPS presisi belum tersedia. Mencoba lokasi Wi-Fi atau jaringan seluler...');
    position=await requestPosition(false,12000,120000);
   }
   if(!mounted.current||run!==locationRun.current)return;
   const {latitude,longitude,accuracy}=position.coords;
   if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude< -11.5||latitude>6.5||longitude<94.5||longitude>141.5)
    throw Error('Lokasi GPS terdeteksi di luar Indonesia. Pastikan lokasi perangkat benar.');
   gps={latitude:Number(latitude.toFixed(6)),longitude:Number(longitude.toFixed(6)),accuracy:Math.round(accuracy)};
   setLocationNote('GPS terdeteksi. Mencocokkan wilayah hingga kelurahan...');
   const r=await fetch('/api/shipping/reverse-location',{
    method:'POST',cache:'no-store',signal:AbortSignal.timeout(12000),
    headers:{'content-type':'application/json'},
    body:JSON.stringify({latitude:gps.latitude,longitude:gps.longitude})
   });
   const raw=await r.json().catch(()=>({message:'Respons lokasi tidak valid.'}));
   if(!r.ok)throw Error(typeof raw.message==='string'?raw.message:'Wilayah lokasi belum dapat ditemukan.');
   if(!mounted.current||run!==locationRun.current)return;
   const found=await pathFromLocation(raw,list);
   if(!mounted.current||run!==locationRun.current)return;
   version.current++;
   setPath(found);
   const region=regionFromPath(found);
   callback.current(region);
   coordinateCallback.current?.(gps);
   setSuggestion(null);
   const needed=locationCompletion(found);
   setLocationNote((accuracy>1000?'Akurasi lokasi rendah. ':'')+
    (region?'Alamat wilayah terisi otomatis sampai kode pos. Periksa dan konfirmasi detail penerima sebelum menyimpan.':
    'GPS berhasil. Wilayah terdeteksi sebagian. Pilih '+needed+' dari daftar untuk melengkapi alamat.'+
    (typeof raw.postcode==='string'&&/^\d{5}$/.test(raw.postcode)?' Saran kode pos GPS: '+raw.postcode+'.':''))
   );
  }catch(e){
   if(!mounted.current||run!==locationRun.current)return;
   // Even if the geocoder fails, the confirmed GPS location remains available
   // as a candidate pin while customers choose the region manually.
   if(gps)coordinateCallback.current?.(gps);
   const geolocation=e as GeolocationPositionError;
   if(typeof geolocation?.code==='number'){
    setLocationNote(geolocation.code===1
     ?'Izin lokasi ditolak. Di iPhone: Pengaturan > Privasi & Keamanan > Layanan Lokasi > Safari Websites, izinkan Saat App Digunakan. Di Safari, buka pengaturan situs vapmart.id dan pilih Lokasi > Izinkan, lalu coba lagi.'
     :geolocation.code===2?'Sinyal GPS tidak tersedia. Aktifkan layanan lokasi, cek jaringan, atau pilih alamat secara manual.'
     :'GPS belum merespons. Coba di area dengan sinyal lebih baik atau pilih alamat secara manual.');
   }else{
    setLocationNote((e instanceof Error?e.message:'Pencarian lokasi gagal.')+
     (gps?' Titik GPS tersedia, tetapi wilayah belum lengkap. Pilih wilayah secara manual dan periksa pin sebelum menyimpan.':' Pilih wilayah secara manual.'));
   }
  }finally{if(mounted.current&&run===locationRun.current)setLocating(false);}
 }
 const selected=regionFromPath(path),suggested=suggestion?regionFromPath(suggestion):null;
 const fields=[['provinceId','provinces','Provinsi',''],['cityId','cities','Kota / Kabupaten',path.provinceId],['districtId','districts','Kecamatan / Distrik',path.cityId],['areaId','areas','Kelurahan / Desa',path.districtId]] as const;
 return <section className="vm-address-picker" aria-label="Wilayah alamat Indonesia">
  <div className="vm-address-location"><button type="button" className="vco26-secondary" disabled={locating} onClick={()=>void locate()}>{locating?'Mencari lokasi...':'⌖ Gunakan lokasi saat ini'}</button>
   <small>Lokasi GPS yang Anda izinkan diperiksa melalui Vapmart dan BigDataCloud untuk mencocokkan wilayah. Periksa hasil sebelum menyimpan.</small></div>
  {locationNote&&<p role="status" className="vm-address-note">{locationNote}</p>}
  {suggestion&&<div className="vm-address-suggestion"><strong>Saran wilayah</strong><p>{suggested?.label||[suggestion.provinces.find(x=>x.id===suggestion.provinceId)?.name,suggestion.cities.find(x=>x.id===suggestion.cityId)?.name,suggestion.districts.find(x=>x.id===suggestion.districtId)?.name].filter(Boolean).join(', ')}</p><button type="button" onClick={()=>{version.current++;locationRun.current++;setPath(suggestion);callback.current(regionFromPath(suggestion));setSuggestion(null);setError('');setLocationNote(suggested?'Wilayah dipilih. Periksa kembali detail alamat pengiriman.':'Saran diterapkan. Lanjutkan memilih kecamatan dan kelurahan yang sesuai.');}}>Gunakan saran wilayah</button></div>}
  <p className="vm-address-help">Pilih berurutan dari provinsi. Kode pos mengikuti kelurahan/desa yang dipilih.</p>
  <div className="vm-address-grid">{fields.map(([key,items,label,parent],i)=><label key={key}>{label}<select aria-label={label} value={path[key]} required disabled={i>0&&(!parent||!path[items].length)||loading===items} onChange={e=>change(key,e.target.value)}>
   <option value="">{loading===items?'Memuat...':i>0&&!parent?'Pilih '+fields[i-1][2].toLowerCase()+' dahulu':'Pilih '+label.toLowerCase()}</option>{path[items].map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>)}
   <label>Kode pos<input aria-label="Kode pos" value={selected?.postalCode||''} readOnly required placeholder="Terisi setelah memilih kelurahan"/></label></div>
  {error&&<div className="vm-address-note" role="alert">{error} <button type="button" onClick={()=>setReload(x=>x+1)}>Coba muat lagi</button></div>}
  {selected&&<div className="vm-address-preview"><small>WILAYAH PENGIRIMAN</small><p>{selected.label}</p></div>}
 </section>;
}
