'use client';
import {useEffect,useRef,useState} from 'react';
export type ShippingRegion={areaId:string;postalCode:string;label:string;province:string;city:string;district:string;area:string};
export function ShippingRegionPicker({postalCode,token,value,onChange}:{postalCode:string;token:string|null;value:string;onChange:(region:ShippingRegion|null)=>void}){
 const [regions,setRegions]=useState<ShippingRegion[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const callback=useRef(onChange);callback.current=onChange;
 useEffect(()=>{
  setRegions([]);setError('');callback.current(null);setLoading(false);
  if(!token||!/^\d{5}$/.test(postalCode))return;
  const controller=new AbortController();
  const timer=setTimeout(()=>{setLoading(true);
   fetch('/api/shipping/regions?q='+encodeURIComponent(postalCode),{headers:{authorization:'Bearer '+token},cache:'no-store',signal:controller.signal})
    .then(async r=>{const d=await r.json();if(!r.ok)throw Error(typeof d.message==='string'?d.message:'Wilayah belum dapat dimuat');return d.regions as ShippingRegion[];})
    .then(items=>{if(controller.signal.aborted)return;const matching=items.filter(r=>r.postalCode===postalCode);setRegions(matching);
     if(matching.length===1)callback.current(matching[0]);if(!matching.length)setError('Kode pos belum ditemukan. Periksa kembali kode pos tujuan.');})
    .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Pencarian wilayah gagal');})
    .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  },300);
  return()=>{clearTimeout(timer);controller.abort();};
 },[postalCode,token]);
 return <div style={{display:'grid',gap:8}}><label>Kelurahan / kecamatan tujuan
  <select aria-label="Kelurahan / kecamatan tujuan" value={value} onChange={e=>onChange(regions.find(r=>r.areaId===e.target.value)||null)} disabled={loading||!regions.length} required>
   <option value="">{loading?'Memuat wilayah...':!token?'Masuk untuk memilih wilayah':'Pilih wilayah tujuan'}</option>
   {regions.map(r=><option key={r.areaId} value={r.areaId}>{r.label}</option>)}
  </select></label>{error&&<p role="status">{error}</p>}
 </div>;
}
