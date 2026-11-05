'use client';
import {useEffect,useState,useRef,type FormEvent} from 'react';
import type {Product} from '@/lib/types';
import {ShippingRegionPicker,type ShippingRegion} from './shipping-region-picker';
type Config={provider:string;rateLookupEnabled:boolean;bookingEnabled:boolean;paymentEnabled:boolean;rateType:string;requiresArea:boolean;originLabel:string;insuranceIncluded:boolean};
type Rate={courierCode:string;courierName:string;serviceCode:string;serviceName:string;priceIdr:number;duration:string;insuranceIdr?:number};
export function ShippingPanel({token,products}:{token:string|null;products:Product[]}){
 const [config,setConfig]=useState<Config|null>(null),[productId,setProductId]=useState(''),[postal,setPostal]=useState(''),[rates,setRates]=useState<Rate[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const requestId=useRef(0);
 function invalidate(){requestId.current++;setRates([]);setBusy(false);setMessage('');}
 const [region,setRegion]=useState<ShippingRegion|null>(null);
 useEffect(()=>{fetch('/api/shipping/config',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Courier API tidak tersedia');return r.json();}).then(setConfig).catch(e=>setMessage(e.message));},[]);
 const eligible=products.filter(p=>p.is_active&&!p.slug.startsWith('demo-')&&p.weight_grams&&p.weight_grams>0&&(!config?.requiresArea||(p.length_cm&&p.width_cm&&p.height_cm)));
 useEffect(()=>{if(!eligible.some(p=>p.id===productId))setProductId(eligible[0]?.id||'');},[products,productId,config?.requiresArea]);
 async function quote(e:FormEvent){e.preventDefault();if(!token||!productId)return;const request=++requestId.current;setBusy(true);setMessage('');setRates([]);
  try{const r=await fetch('/api/shipping/rates',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({destinationPostalCode:postal,...(region?{destinationAreaId:region.areaId}:{}),items:[{productId,quantity:1}]})});
   const x=await r.json();if(request!==requestId.current)return;if(!r.ok)throw new Error(x?.message||x?.code||'Tarif belum tersedia');setRates(x.rates||[]);}
  catch(e){if(request===requestId.current)setMessage(e instanceof Error?e.message:'Gagal cek ongkir');}finally{if(request===requestId.current)setBusy(false);}}
 return <section className="vma26-panel"><p className="vma26-eyebrow">SHIPPING OPERATIONS</p><h2>Courier API</h2>
  <p>{config?.provider==='jubelio'?'Cek tarif langsung dari Jubelio Shipment. Tarif mencakup asuransi; promo bersyarat belum diterapkan.':'Periksa estimasi tarif pengiriman.'}</p>
  <div className="vma26-gate-row"><span>Provider adapter</span><strong>{config?.provider||'Memeriksa...'}</strong></div>
  <div className="vma26-gate-row"><span>Cek ongkir</span><strong>{config?.rateLookupEnabled?'Siap':'Belum dikonfigurasi'}</strong></div>
  {config?.originLabel&&<div className="vma26-gate-row"><span>Asal pengiriman</span><strong>{config.originLabel}</strong></div>}
  <div className="vma26-gate-row"><span>Booking kurir / pickup</span><strong>Nonaktif</strong></div>
  <div className="vma26-gate-row"><span>Gateway pembayaran</span><strong>OFF</strong></div>
  <p>Lengkapi berat dan dimensi produk agar ongkir dapat dihitung. Pengecekan tarif belum membuat resi atau memesan pickup.</p>
  {config?.provider==='jubelio'&&<button type="button" className="vma26-btn-dark" disabled={!token||busy} onClick={async()=>{setBusy(true);setMessage('');try{
   const r=await fetch('/api/shipping/connection',{headers:{authorization:'Bearer '+token},cache:'no-store'});const d=await r.json();
   if(!r.ok)throw Error(d.message||'Koneksi belum tersedia');setMessage('Jubelio terhubung · '+d.courierServiceCount+' layanan kurir tersedia');
  }catch(e){setMessage(e instanceof Error?e.message:'Koneksi gagal');}finally{setBusy(false);}}}>Periksa koneksi Jubelio</button>}
  <form className="vma26-login" onSubmit={quote}>
   <label>Pilih produk<select value={productId} onChange={e=>{setProductId(e.target.value);invalidate();}} required><option value="">Pilih produk</option>{eligible.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
   <label>Kode pos tujuan<input value={postal} inputMode="numeric" pattern="[0-9]{5}" maxLength={5} onChange={e=>{setPostal(e.target.value);setRegion(null);invalidate();}} required placeholder="40115"/></label>
   {config?.requiresArea&&<ShippingRegionPicker postalCode={postal} token={token} value={region?.areaId||''} onChange={r=>{setRegion(r);invalidate();}}/>}
   <button className="vma26-btn-dark" type="submit" disabled={!config?.rateLookupEnabled||!productId||busy||(config.requiresArea&&!region)}>{busy?'Memeriksa tarif...':'Cek ongkir'}</button>
  </form>
  {message&&<p role="status">{message}</p>}
  {rates.map((r,i)=><div key={r.courierCode+r.serviceCode+i} className="vma26-gate-row"><span>{r.serviceName} · {r.duration}{r.insuranceIdr!==undefined?' · termasuk asuransi':''}</span><strong>Rp {r.priceIdr.toLocaleString('id-ID')}</strong></div>)}
 </section>;
}
