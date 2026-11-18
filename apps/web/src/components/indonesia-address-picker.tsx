'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {pathFromLocation,regionFromPath,resetAddressPath,type AddressPath,type AddressSelection,type AddressList} from '@/lib/address-location';
const empty:AddressPath={provinces:[],cities:[],districts:[],areas:[],provinceId:'',cityId:'',districtId:'',areaId:''};
export function IndonesiaAddressPicker({onChange,initialValue}:{onChange:(region:AddressSelection|null)=>void;initialValue?:AddressSelection}){
 const [path,setPath]=useState<AddressPath>(()=>({...empty,provinceId:initialValue?.provinceId||'',cityId:initialValue?.cityId||'',districtId:initialValue?.districtId||'',areaId:initialValue?.areaId||''})),[loading,setLoading]=useState('provinces'),[error,setError]=useState(''),[reload,setReload]=useState(0),[locating,setLocating]=useState(false),[suggestion,setSuggestion]=useState<AddressPath|null>(null),[locationNote,setLocationNote]=useState('');
 const callback=useRef(onChange);callback.current=onChange;
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
  if(!navigator.geolocation){setLocationNote('Perangkat ini belum mendukung lokasi. Pilih wilayah secara manual.');return;}
  const run=++locationRun.current;setLocating(true);setSuggestion(null);setLocationNote('');
  try{
   const position=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
   if(!mounted.current||run!==locationRun.current)return;
   // Only the calling device's current, permission-granted location is sent.
   // No IP fallback, background lookup, proxy or stored coordinates are used.
   const q=new URLSearchParams({latitude:String(position.coords.latitude),longitude:String(position.coords.longitude),localityLanguage:'id'});
   const r=await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?'+q,{credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error('Wilayah lokasi belum dapat ditemukan. Pilih secara manual.');const raw=await r.json();
   const found=await pathFromLocation(raw,list);if(!mounted.current||run!==locationRun.current)return;
   setSuggestion(found);setLocationNote((position.coords.accuracy>1000?'Akurasi lokasi rendah. ':'')+'Periksa saran wilayah sebelum digunakan. Nomor rumah dan RT/RW tetap perlu diisi.');
  }catch(e){if(mounted.current&&run===locationRun.current)setLocationNote(typeof (e as GeolocationPositionError)?.code==='number'?(e as GeolocationPositionError).code===1?'Izin lokasi ditolak. Anda tetap bisa memilih wilayah secara manual.':'Lokasi belum tersedia atau waktu pencarian habis. Coba lagi atau pilih manual.':e instanceof Error?e.message:'Lokasi belum tersedia.');}
  finally{if(mounted.current&&run===locationRun.current)setLocating(false);}
 }
 const selected=regionFromPath(path),suggested=suggestion?regionFromPath(suggestion):null;
 const fields=[['provinceId','provinces','Provinsi',''],['cityId','cities','Kota / Kabupaten',path.provinceId],['districtId','districts','Kecamatan / Distrik',path.cityId],['areaId','areas','Kelurahan / Desa',path.districtId]] as const;
 return <section className="vm-address-picker" aria-label="Wilayah alamat Indonesia">
  <div className="vm-address-location"><button type="button" className="vco26-secondary" disabled={locating} onClick={()=>void locate()}>{locating?'Mencari lokasi...':'⌖ Gunakan lokasi saat ini'}</button>
   <small>Dengan memilih lokasi saat ini, lokasi perangkat dikirim ke BigDataCloud untuk saran wilayah. Periksa hasilnya sebelum digunakan.</small></div>
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
