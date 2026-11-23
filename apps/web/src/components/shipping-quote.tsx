'use client';

import {useEffect,useRef,useState} from 'react';
import {formatIDR,type Product} from '@/lib/types';
import {DeliveryAddressManager} from '@/components/delivery-address-manager';
import {ShippingEmblem} from '@/components/shipping-emblem';
import {CHOSEN_COURIER_KEY,type SavedDeliveryAddress} from '@/lib/delivery-address-book';

type ShippingConfig={provider:string;rateLookupEnabled:boolean;requiresArea:boolean;originLabel?:string};
type ShippingRate={
 courierCode:string;courierName:string;serviceCode:string;serviceName:string;
 priceIdr:number;duration?:string;category?:string;codAvailable?:boolean;
 requiresPin?:boolean;estimateOnly?:boolean;quoteId?:string;providerServiceId?:number
};
type ShippingResponse={rates?:ShippingRate[];pinNotice?:string;message?:string;code?:string};
const bucket=(r:ShippingRate)=>{
 const key=(r.category||'')+' '+r.serviceName;
 if(/INSTANT/i.test(key))return 'Instant';
 if(/SAME[\s_-]?DAY/i.test(key))return 'Same Day';
 if(/NEXT[\s_-]?DAY/i.test(key))return 'Next Day';
 if(/EKONOMI|ECONOMY/i.test(key))return 'Ekonomi';
 if(/CARGO|KARGO/i.test(key))return 'Kargo';
 return 'Reguler';
};
const order=['Instant','Same Day','Next Day','Reguler','Ekonomi','Kargo'] as const;
const rateKey=(r:ShippingRate)=>r.courierCode+':'+(r.providerServiceId||r.serviceCode);
export function ShippingQuote({product,quantity}:{product:Product|null;quantity:number}){
 const [address,setAddress]=useState<SavedDeliveryAddress|null>(null);
 const [config,setConfig]=useState<ShippingConfig|null>(null);
 const [loading,setLoading]=useState(false),[rates,setRates]=useState<ShippingRate[]>([]);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [selected,setSelected]=useState('');
 const [retry,setRetry]=useState(0);
 const request=useRef(0);
 useEffect(()=>{
  let active=true;
  fetch('/api/shipping/config',{cache:'no-store'}).then(async response=>{
   if(!response.ok)throw Error('Pengaturan pengiriman belum tersedia.');
   return response.json() as Promise<ShippingConfig>;
  }).then(data=>{if(active)setConfig(data);})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'Pengaturan pengiriman belum tersedia.');});
  return()=>{active=false;};
 },[]);
 const region=address?.region;
 useEffect(()=>{
  if(!region||!product||!config?.rateLookupEnabled){
   request.current++;setLoading(false);setRates([]);setSelected('');return;
  }
  if(!product.is_active||!product.weight_grams||product.stock_qty<quantity){
   setRates([]);setError('Berat atau stok produk belum mendukung pengecekan ongkir.');return;
  }
  const ticket=++request.current,controller=new AbortController();
  setLoading(true);setError('');setNotice('');setRates([]);
  const timer=setTimeout(async()=>{
   try{
    const response=await fetch('/api/shipping/estimate',{
     method:'POST',cache:'no-store',signal:controller.signal,
     headers:{'content-type':'application/json'},
     body:JSON.stringify({
      items:[{productId:product.id,quantity}],destinationPostalCode:region.postalCode,
      ...(config.requiresArea?{destinationAreaId:region.areaId,destinationProvinceId:region.provinceId}:{}),
      ...(address?.pin?{destinationPin:address.pin}:{})
     })
    });
    const raw:ShippingResponse=await response.json();
    if(!response.ok)throw Error(typeof raw.message==='string'?raw.message:raw.code||'Cek ongkir belum tersedia.');
    if(ticket!==request.current||controller.signal.aborted)return;
    const received=(Array.isArray(raw.rates)?raw.rates:[]).filter(x=>
      Number.isSafeInteger(x.priceIdr)&&x.priceIdr>=0&&typeof x.courierCode==='string'&&typeof x.serviceCode==='string'
    ).sort((a,b)=>a.priceIdr-b.priceIdr);
    setRates(received);
    setSelected(received[0]?rateKey(received[0]):'');
    setNotice(raw.pinNotice||'');
    if(!received.length)setError('Belum ada layanan pengiriman untuk alamat dan produk ini.');
   }catch(e){
    if(!controller.signal.aborted&&ticket===request.current)
     setError(e instanceof Error?e.message:'Tarif pengiriman belum dapat dimuat.');
   }finally{if(!controller.signal.aborted&&ticket===request.current)setLoading(false);}
  },250);
  return()=>{clearTimeout(timer);controller.abort();request.current++;};
 },[address?.id,region?.areaId,region?.postalCode,address?.pin?.latitude,address?.pin?.longitude,
  config?.rateLookupEnabled,config?.requiresArea,product?.id,product?.weight_grams,
  product?.stock_qty,product?.is_active,quantity,retry]);

 const cheapest=rates.length?Math.min(...rates.map(x=>x.priceIdr)):null;
 const selectedRate=rates.find(r=>rateKey(r)===selected);
 const groups=order.map(name=>({name,items:rates.filter(r=>bucket(r)===name)})).filter(x=>x.items.length);
 return <div className="vpd-shipping-body">
  <section className="vpd-ship-route" aria-label="Asal dan tujuan pengiriman">
   <div className="vpd-ship-route-point">
    <ShippingEmblem kind="store" className="vpd-ship-route-icon"/>
    <span className="vpd-ship-route-detail"><small>Dari</small>
     <strong>{config?.originLabel?.trim()||'Gudang Vapmart'}</strong></span>
   </div>
   <DeliveryAddressManager onSelected={setAddress}/>
  </section>
  {product?.weight_grams&&product.weight_grams>0&&<p className="vpd-ship-weight">
   Berat ({quantity} pcs): <strong>{(product.weight_grams*quantity).toLocaleString('id-ID')} g</strong>
   <span aria-hidden="true"> · </span>Tarif final dikonfirmasi saat checkout
  </p>}
  <section className="vpd-shipping-options" aria-label="Jenis dan biaya pengiriman">
   <div className="vpd-shipping-options-heading"><h3>Pilihan pengiriman</h3>
    {rates.length>0&&<span>{rates.length} layanan tersedia</span>}</div>
   {!address?.region&&<p className="vpd-ship-helper">Pilih atau lengkapi alamat tujuan untuk melihat jenis kurir dan harganya.</p>}
   {!config&&!error&&<p className="vpd-ship-helper">Memuat layanan pengiriman…</p>}
   {config&&!config.rateLookupEnabled&&<p className="vpd-ship-helper">Cek ongkir real-time belum aktif. Pilihan kurir akan tersedia setelah konfigurasi selesai.</p>}
   {loading&&<p role="status" className="vpd-ship-helper">Mencari tipe pengiriman dan tarif untuk alamat terpilih…</p>}
   {error&&<p role="alert" className="vpd-ship-helper vpd-ship-error">{error} {address?.region&&config?.rateLookupEnabled&&
    <button type="button" className="vpd-shipping-retry" disabled={loading} onClick={()=>setRetry(x=>x+1)}>Coba lagi</button>}</p>}
   {rates.length>0&&<div className="vpd-shipping-rate-list" role="radiogroup" aria-label="Pilih estimasi layanan kurir">
    {groups.map(group=><div className="vpd-shipping-group" key={group.name}>
     <h4>{group.name}</h4>
     {group.items.map(rate=>{
      const id=rateKey(rate);
      return <label key={id} className={selected===id?'is-selected':''}>
       <input type="radio" name="vpd-shipping-rate" value={id} checked={selected===id}
        onChange={()=>{setSelected(id);try{sessionStorage.setItem(CHOSEN_COURIER_KEY,id);}catch{}}}/>
       <span className="vpd-ship-rate-text">
        <strong>{rate.courierName} · {rate.serviceName}</strong>
        <small>{rate.duration?'Estimasi '+rate.duration:'Estimasi tiba dikonfirmasi oleh kurir'}</small>
        <span className="vpd-shipping-badges">
         {group.name==='Instant'&&<em className="is-fast">Tercepat</em>}
         {rate.priceIdr===cheapest&&<em className="is-cheapest">Termurah</em>}
         {rate.codAvailable===true&&<em className="is-cod">Kurir mendukung COD</em>}
        </span>
       </span>
       <span className="vpd-ship-rate-value"><b>{formatIDR(rate.priceIdr)}</b></span>
      </label>;
     })}
    </div>)}
   </div>}
   {selectedRate&&<p role="status" className="vpd-ship-selected">
    Estimasi dipilih: {selectedRate.courierName} {selectedRate.serviceName} · {formatIDR(selectedRate.priceIdr)}.</p>}
   {notice&&<p className="vpd-ship-helper">{notice}</p>}
   {rates.some(x=>x.codAvailable===true)&&<p className="vpd-ship-disclaimer">
    Informasi dukungan COD berasal dari kurir. Pembayaran COD baru dapat digunakan jika tersedia sebagai metode pembayaran saat checkout.</p>}
   {rates.length>0&&<p className="vpd-ship-disclaimer">
    Harga dan estimasi dari penyedia kurir; dapat berubah saat checkout. Tidak ada klaim gratis ongkir atau voucher tanpa promo yang valid.</p>}
  </section>
 </div>;
}
