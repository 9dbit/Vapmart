'use client';
import {useEffect,useState,type FormEvent} from 'react';
import type {Product} from '@/lib/types';
type Config={provider:string;rateLookupEnabled:boolean;bookingEnabled:boolean;paymentEnabled:boolean;rateType:string};
type Rate={courierCode:string;courierName:string;serviceCode:string;serviceName:string;priceIdr:number;duration:string};
export function ShippingPanel({token,products}:{token:string|null;products:Product[]}){
 const [config,setConfig]=useState<Config|null>(null),[productId,setProductId]=useState(''),[postal,setPostal]=useState(''),[rates,setRates]=useState<Rate[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{fetch('/api/shipping/config',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Courier API tidak tersedia');return r.json();}).then(setConfig).catch(e=>setMessage(e.message));},[]);
 const eligible=products.filter(p=>p.is_active&&!p.slug.startsWith('demo-')&&p.weight_grams&&p.weight_grams>0);
 useEffect(()=>{if(!eligible.some(p=>p.id===productId))setProductId(eligible[0]?.id||'');},[products,productId]);
 async function quote(e:FormEvent){e.preventDefault();if(!token||!productId)return;setBusy(true);setMessage('');setRates([]);
  try{const r=await fetch('/api/shipping/rates',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({destinationPostalCode:postal,items:[{productId,quantity:1}]})});
   const x=await r.json();if(!r.ok)throw new Error(x?.message||x?.code||'Tarif belum tersedia');setRates(x.rates||[]);}
  catch(e){setMessage(e instanceof Error?e.message:'Gagal cek ongkir');}finally{setBusy(false);}}
 return <section className="vma26-panel"><p className="vma26-eyebrow">SHIPPING OPERATIONS</p><h2>Courier API</h2>
  <p>Perhitungan tarif tersedia sebagai sandbox-only, tidak membuat resi, pickup, order kurir, atau pembayaran.</p>
  <div className="vma26-gate-row"><span>Provider adapter</span><strong>{config?.provider||'Memeriksa...'}</strong></div>
  <div className="vma26-gate-row"><span>Rates API</span><strong>{config?.rateLookupEnabled?'Sandbox siap':'Belum dikonfigurasi'}</strong></div>
  <div className="vma26-gate-row"><span>Booking kurir / pickup</span><strong>Nonaktif</strong></div>
  <div className="vma26-gate-row"><span>Gateway pembayaran</span><strong>OFF</strong></div>
  <p>Untuk mengaktifkan cek ongkir, lengkapi berat produk, kode pos gudang, dan API key Biteship **test** pada variabel Railway. Tariff live tetap membutuhkan verifikasi lanjutan.</p>
  <form className="vma26-login" onSubmit={quote}>
   <label>Pilih produk berberat valid<select value={productId} onChange={e=>setProductId(e.target.value)} required><option value="">Pilih produk</option>{eligible.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
   <label>Kode pos tujuan<input value={postal} inputMode="numeric" pattern="[0-9]{5}" maxLength={5} onChange={e=>setPostal(e.target.value)} required placeholder="40115"/></label>
   <button className="vma26-btn-dark" type="submit" disabled={!config?.rateLookupEnabled||!productId||busy}>{busy?'Memeriksa tarif...':'Cek ongkir sandbox'}</button>
  </form>
  {message&&<p role="status">{message}</p>}
  {rates.map((r,i)=><div key={r.courierCode+r.serviceCode+i} className="vma26-gate-row"><span>{r.courierName} · {r.serviceName} · {r.duration}</span><strong>Rp {r.priceIdr.toLocaleString('id-ID')}</strong></div>)}
 </section>;
}
