'use client';

import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {useCustomerAuth} from '@/lib/customer-auth';
import {formatIDR,type Product} from '@/lib/types';
import {IndonesiaAddressPicker} from '@/components/indonesia-address-picker';
import {Icon} from '@/components/store-icon';
import type {AddressSelection} from '@/lib/address-location';

type ShippingConfig={provider:string;rateLookupEnabled:boolean;requiresArea:boolean;originLabel?:string};
type ShippingRate={courierCode:string;courierName:string;serviceCode:string;serviceName:string;priceIdr:number;duration?:string;estimateOnly?:boolean;quoteId?:string};
const validRegion=(raw:unknown):raw is AddressSelection=>{
 if(!raw||typeof raw!=='object')return false;
 const x=raw as Record<string,unknown>;
 return ['provinceId','cityId','districtId','areaId','postalCode','label'].every(k=>typeof x[k]==='string')
  &&/^[0-9]{5}$/.test(String(x.postalCode));
};

/** Uses only authenticated live provider rates. No synthetic vouchers or ETA. */
export function ShippingQuote({product,quantity}:{product:Product|null;quantity:number}){
 const auth=useCustomerAuth();
 const [config,setConfig]=useState<ShippingConfig|null>(null);
 const [region,setRegion]=useState<AddressSelection|null>(null);
 const [editing,setEditing]=useState(false);
 const [loading,setLoading]=useState(false);
 const [rates,setRates]=useState<ShippingRate[]>([]);
 const [error,setError]=useState('');
 const [selected,setSelected]=useState('');
 const request=useRef(0);

 useEffect(()=>{
  let alive=true;
  fetch('/api/shipping/config',{cache:'no-store'}).then(async response=>{
   if(!response.ok)throw Error('Pengaturan pengiriman tidak tersedia.');
   return await response.json() as ShippingConfig;
  }).then(data=>{if(alive)setConfig(data);})
   .catch(e=>{if(alive)setError(e instanceof Error?e.message:'Layanan pengiriman belum tersedia.');});
  return()=>{alive=false;};
 },[]);

 useEffect(()=>{
  setRegion(null);setRates([]);setSelected('');
  if(!auth.user)return;
  try{
   const raw=localStorage.getItem('vapmart.shipping.region.'+auth.user.id);
   if(raw){const parsed:unknown=JSON.parse(raw);if(validRegion(parsed))setRegion(parsed);}
  }catch{}
 },[auth.user?.id]);

 const onRegion=(next:AddressSelection|null)=>{
  // Province/city changes produce incomplete drafts. Keep the last confirmed
  // destination until a complete new region is selected or editor is closed.
  if(!next){setError('');return;}
  request.current++;setRegion(next);setRates([]);setSelected('');setError('');
  if(auth.user)try{
   const key='vapmart.shipping.region.'+auth.user.id;
   if(next)localStorage.setItem(key,JSON.stringify(next));
   else localStorage.removeItem(key);
  }catch{}
  if(next)setEditing(false);
 };

 useEffect(()=>{
  if(!region||!product||!config?.rateLookupEnabled||!auth.accessToken)return;
  if(product.stock_qty<quantity||!product.is_active||!product.weight_grams)return;
  const ticket=++request.current;
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   setLoading(true);setRates([]);setError('');
   try{
    const response=await fetch('/api/shipping/rates',{
     method:'POST',cache:'no-store',signal:controller.signal,
     headers:{authorization:'Bearer '+auth.accessToken,'content-type':'application/json'},
     body:JSON.stringify({items:[{productId:product.id,quantity}],destinationPostalCode:region.postalCode,
      ...(config.requiresArea?{destinationAreaId:region.areaId,destinationProvinceId:region.provinceId}:{})})
    });
    const data=await response.json();
    if(!response.ok)throw Error(typeof data.message==='string'?data.message:data.code||'Tarif pengiriman tidak tersedia.');
    if(ticket!==request.current||controller.signal.aborted)return;
    const available=((Array.isArray(data.rates)?data.rates:[]) as ShippingRate[])
      .filter(x=>Number.isFinite(x.priceIdr)&&x.priceIdr>=0&&typeof x.courierCode==='string'&&typeof x.serviceCode==='string')
      .sort((a,b)=>a.priceIdr-b.priceIdr);
    setRates(available);
    if(!available.length)setError('Belum ada layanan kurir yang tersedia untuk tujuan ini.');
   }catch(e){if(!controller.signal.aborted&&ticket===request.current)setError(e instanceof Error?e.message:'Cek ongkir gagal.');}
   finally{if(ticket===request.current&&!controller.signal.aborted)setLoading(false);}
  },320);
  return()=>{clearTimeout(timer);controller.abort();request.current++;};
 },[region,product?.id,product?.weight_grams,product?.stock_qty,product?.is_active,quantity,config?.requiresArea,config?.rateLookupEnabled,auth.accessToken]);

 const address=typeof auth.user?.user_metadata?.address_line==='string'?auth.user.user_metadata.address_line.trim():'';
 const destination=region?.label||address||'Wilayah tujuan belum dipilih';
 const chosenRate=rates.find(x=>selected===x.courierCode+':'+x.serviceCode);

 return <div className="vpd-shipping-body">
  <section className="vpd-ship-route" aria-label="Rute pengiriman">
   <div className="vpd-ship-route-point">
    <span className="vpd-ship-route-icon" aria-hidden="true"><Icon name="store"/></span>
    <span className="vpd-ship-route-detail"><small>Dari</small><strong>{config?.originLabel?.trim()||'Vapmart'}</strong></span>
   </div>
   <div className="vpd-ship-route-point">
    <span className="vpd-ship-route-icon" aria-hidden="true"><Icon name="package"/></span>
    <span className="vpd-ship-route-detail"><small>Dikirim ke</small><strong>{destination}</strong>
     {region&&address&&<small className="vpd-ship-street">{address}</small>}
    </span>
   </div>
   {auth.user&&<button type="button" className="vpd-ship-change"
      aria-expanded={editing} aria-controls={editing?'vpd-shipping-editor':undefined}
      onClick={()=>setEditing(value=>!value)}>
      {editing?'Tutup':'Ubah alamat'} <span aria-hidden="true">›</span>
    </button>}
  </section>

  {product?.weight_grams&&product.weight_grams>0&&<p className="vpd-ship-weight">
   Berat ({quantity} pcs): <strong>{(product.weight_grams*quantity).toLocaleString('id-ID')} g</strong>
   <span aria-hidden="true"> · </span>Ongkir final dihitung saat checkout
  </p>}

  {!auth.user?<div className="vpd-ship-state">
   <p>Masuk untuk memilih tujuan dan melihat biaya pengiriman.</p>
   <Link className="vpd-ship-action" href="/login?next=/akun">Masuk Akun</Link>
  </div>:<>
   {editing&&<section className="vpd-ship-address-editor" id="vpd-shipping-editor" aria-label="Ubah wilayah tujuan">
    <h3>Atur alamat pengiriman</h3>
    <p>Pilih provinsi hingga kelurahan yang sesuai dengan alamat penerima.</p>
    <IndonesiaAddressPicker initialValue={region||undefined} onChange={onRegion}/>
   </section>}
   {!region&&!editing&&<div className="vpd-ship-state vpd-ship-select">
    <p>Wilayah pengiriman belum dipilih. Pilih lokasi agar tarif dan estimasi kurir tersedia.</p>
    <button type="button" className="vpd-ship-action" onClick={()=>setEditing(true)}>Pilih wilayah tujuan</button>
   </div>}
   {region&&!editing&&<section className="vpd-shipping-options" aria-label="Opsi kurir">
    <header className="vpd-shipping-options-heading">
     <h3>Pilihan pengiriman</h3>
     {rates.length>0&&<span>{rates.length} layanan tersedia</span>}
    </header>
    {product&&!product.weight_grams&&<p role="status" className="vpd-ship-helper">Berat produk belum tersedia. Ongkir belum bisa dihitung.</p>}
    {config&&!config.rateLookupEnabled&&<p className="vpd-ship-helper">Tarif kurir real-time belum aktif. Ongkir final diperiksa saat checkout jika layanan tersedia.</p>}
    {!config&&!error&&<p className="vpd-ship-helper">Memeriksa layanan pengiriman…</p>}
    {loading&&<p role="status" className="vpd-ship-helper">Menghitung ongkir untuk wilayah ini…</p>}
    {error&&<p role="alert" className="vpd-ship-helper vpd-ship-error">{error}</p>}
    {rates.length>0&&<div className="vpd-shipping-rate-list" role="radiogroup" aria-label="Estimasi pilihan kurir">
     {rates.map((rate,index)=>{
      const id=rate.courierCode+':'+rate.serviceCode;
      return <label key={id} className={selected===id?'is-selected':''}>
       <input type="radio" name="vpd-shipping-rate" checked={selected===id} value={id} onChange={()=>setSelected(id)}/>
       <span className="vpd-ship-rate-text">
        <strong>{rate.courierName} · {rate.serviceName}</strong>
        <small>{rate.duration?'Estimasi tiba '+rate.duration:'Estimasi tiba dikonfirmasi saat checkout'}</small>
       </span>
       <span className="vpd-ship-rate-value"><b>{formatIDR(rate.priceIdr)}</b>
        {index===0&&rates.length>1&&<small>Termurah</small>}
       </span>
      </label>;
     })}
    </div>}
    {chosenRate&&<p role="status" className="vpd-ship-selected">Estimasi {chosenRate.courierName} {chosenRate.serviceName}: {formatIDR(chosenRate.priceIdr)}.</p>}
    {rates.length>0&&<p className="vpd-ship-disclaimer">Pilihan dan biaya kurir final dikonfirmasi saat checkout.</p>}
   </section>}
   {!region&&error&&<p role="alert" className="vpd-ship-helper vpd-ship-error">{error}</p>}
  </>}
 </div>;
}
