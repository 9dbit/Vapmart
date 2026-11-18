'use client';
import {useEffect,useRef,useState} from 'react';
import dynamic from 'next/dynamic';
import {googleMapsPinUrl,type DeliveryPin} from '@/lib/delivery-pin';
import '../app/delivery-pin.css';
const DestinationMap = dynamic(() => import('./destination-map'), {ssr:false,loading:()=> <p>Memuat peta…</p>});
export function DeliveryPinPicker({value,onChange,address='',region='',title='Pin titik antar'}:{value:DeliveryPin|null;onChange:(pin:DeliveryPin|null)=>void;address?:string;region?:string;title?:string}){
 const [input,setInput]=useState(''),[candidate,setCandidate]=useState<DeliveryPin|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [mapOpen,setMapOpen]=useState(false);
 const request=useRef(0);
 useEffect(()=>()=>{request.current++;},[]);
 useEffect(()=>{if(!value)setCandidate(null);},[value]);
 function clear(){request.current++;setCandidate(null);setMessage('');setBusy(false);onChange(null);}
 async function locate(){
  clear();const id=++request.current;setBusy(true);
  if(!navigator.geolocation){setMessage('Perangkat tidak mendukung lokasi. Tempel tautan atau koordinat Google Maps.');setBusy(false);return;}
  navigator.geolocation.getCurrentPosition(position=>{
   if(id!==request.current)return;
   const p={latitude:Number(position.coords.latitude.toFixed(6)),longitude:Number(position.coords.longitude.toFixed(6)),confirmed:true as const};
   if(p.latitude< -11.5||p.latitude>6.5||p.longitude<94.5||p.longitude>141.5){setMessage('Lokasi berada di luar Indonesia. Pilih titik pengiriman di Google Maps.');setBusy(false);return;}
   setCandidate(p);setBusy(false);setMessage('Perkiraan akurasi GPS '+Math.round(position.coords.accuracy)+' m. Periksa titik di Google Maps, lalu konfirmasi.');
  },error=>{if(id!==request.current)return;setBusy(false);setMessage(error.code===1?'Akses lokasi ditolak. Tempel tautan atau koordinat Google Maps.':'Lokasi belum terbaca. Coba lagi atau tempel koordinat Google Maps.');},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
 }
 async function parse(){clear();const id=++request.current;setBusy(true);
  try{const r=await fetch('/api/shipping/map-pin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input}),cache:'no-store'}),d=await r.json();if(id!==request.current)return;if(!r.ok)throw Error(d.message||'Pin belum terbaca');setCandidate(d.pin);setMessage('Periksa titik di Google Maps sebelum mengonfirmasi alamat tujuan.');}
  catch(e){if(id===request.current)setMessage(e instanceof Error?e.message:'Pin belum terbaca');}finally{if(id===request.current)setBusy(false);}
 }
 const preview=value||candidate;
 return <section className="vm-pin" aria-label={title}>
  <div className="vm-pin-head"><strong>{title}</strong><span>{value?'Terkonfirmasi':'Untuk GoSend / GrabExpress'}</span></div>
  <p>Pastikan pin tepat di pintu masuk tujuan. Pin diperlukan untuk layanan Instant / Same Day yang tersedia.</p>
  {region&&<button type="button" aria-expanded={mapOpen} onClick={()=>setMapOpen(!mapOpen)}>{mapOpen?'Tutup peta':value?'Sesuaikan titik antar':'Tentukan titik antar di peta'}</button>}
  {mapOpen&&<DestinationMap initial={value||candidate} region={region} onConfirm={(p:DeliveryPin)=>{request.current++;setBusy(false);setInput('');setCandidate(null);onChange(p);setMapOpen(false);setMessage('Titik antar tersimpan untuk estimasi ongkir dan pengiriman.');}}/>}
  <div className="vm-pin-actions"><button type="button" onClick={()=>void locate()} disabled={busy}>⌖ Ambil lokasi perangkat</button><a target="_blank" rel="noopener noreferrer" href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address||'Indonesia')}>Pilih titik di Google Maps ↗</a></div>
  <label>Tautan Google Maps atau latitude, longitude<input value={input} maxLength={2048} placeholder="-6.200000, 106.816666 atau tautan Maps" onChange={e=>{setInput(e.target.value);clear();}}/></label>
  <p className="vm-pin-help">Di Google Maps, tahan/klik titik tujuan, lalu salin tautan pin atau koordinatnya ke sini.</p>
  <button type="button" onClick={()=>void parse()} disabled={busy||!input.trim()}>{busy?'Memeriksa pin...':'Periksa pin'}</button>
  {preview&&<div className="vm-pin-preview"><a target="_blank" rel="noopener noreferrer" href={googleMapsPinUrl(preview)}>📍 Lihat pin di Google Maps ↗</a><small>{preview.latitude}, {preview.longitude}</small>{!value&&<button type="button" onClick={()=>{if(candidate){onChange(candidate);setMessage('Pin dikonfirmasi. Estimasi ongkir diperbarui sesuai titik ini.');}}}>Konfirmasi pin sesuai alamat</button>}{value&&<button type="button" onClick={clear}>Hapus / ubah pin</button>}</div>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
