'use client';
import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useCart} from '@/lib/cart';
import {useCustomerAuth} from '@/lib/customer-auth';
import {isDigitalProduct} from '@/lib/digital-products';
import {formatIDR,type Product} from '@/lib/types';
import {IndonesiaAddressPicker} from '@/components/indonesia-address-picker';
import {DeliveryAddressManager} from '@/components/delivery-address-manager';
import {CHOSEN_COURIER_KEY,checkoutAddressLine,legacyAccountAddress,type SavedDeliveryAddress} from '@/lib/delivery-address-book';
import type {AddressSelection} from '@/lib/address-location';
import '../checkout-v26.css';
import {DeliveryPinPicker} from '@/components/delivery-pin-picker';
import type {DeliveryPin} from '@/lib/delivery-pin';

type QuoteItem={productId:string;sku:string|null;name:string;unitPriceIdr:number;quantity:number;lineTotalIdr:number;stockQty:number};
type Quote={items:QuoteItem[];subtotalIdr:number;discountIdr:number;voucherDiscountIdr:number;voucherCode:string|null;promotionDiscountIdr:number;promotionEventId:string|null;promotionTitle:string|null;shippingFeeIdr:number|null;totalIdr:number|null;shippingEstimate:boolean;paymentEnabled:boolean;paymentMethods:string[]};
type ShippingOption={quoteId:string;expiresAt:string;courierCode:string;courierName:string;serviceCode:string;serviceName:string;priceIdr:number;duration:string;insuranceIdr?:number;estimateOnly?:boolean;providerServiceId?:number};
type ShippingConfig={rateLookupEnabled:boolean;bookingEnabled:boolean;paymentEnabled:boolean;rateType:string;requiresArea?:boolean;provider?:string;originLabel?:string};
type DraftForm={name:string;phone:string;address:string;city:string;province:string;postalCode:string;paymentMethod:'bank_transfer'|'qris'|'virtual_account'|'ewallet'};
const initial:DraftForm={name:'',phone:'',address:'',city:'',province:'',postalCode:'',paymentMethod:'bank_transfer'};
type CheckoutConfig={paymentEnabled:boolean;providerConnected:boolean;methods:DraftForm['paymentMethod'][];gateway?:{provider:string|null;status:string;environment:string}};
const methods=[{id:'bank_transfer',name:'Bank Transfer',hint:'Buat pesanan sekarang; pembayaran diverifikasi manual oleh admin'},{id:'qris',name:'QRIS',hint:'Menunggu integrasi payment gateway'},{id:'virtual_account',name:'Virtual Account',hint:'Menunggu integrasi payment gateway'},{id:'ewallet',name:'E-Wallet',hint:'Menunggu integrasi payment gateway'}] as const;
export default function CheckoutPage(){
 const {items}=useCart();
 const [buyNowId,setBuyNowId]=useState<string|null>(null);
 const [buyNowQty,setBuyNowQty]=useState(1);
 const [buyNowProduct,setBuyNowProduct]=useState<Product|null>(null);
 const [buyNowLoading,setBuyNowLoading]=useState(false);
 const [buyNowError,setBuyNowError]=useState('');
 const [scopeReady,setScopeReady]=useState(false);
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const id=params.get('buyNow');
  const requested=Number(params.get('qty')||'1');
  setBuyNowId(id&&/^[0-9a-f-]{36}$/i.test(id)?id:null);
  setBuyNowQty(Number.isSafeInteger(requested)?Math.min(99,Math.max(1,requested)):1);
  setScopeReady(true);
 },[]);
 useEffect(()=>{
  if(!scopeReady||!buyNowId)return;
  const ac=new AbortController();
  setBuyNowLoading(true);setBuyNowError('');
  // Buy Now must survive an SPA navigation and even a reload with an
  // otherwise empty cart. Product data is reloaded only from published API.
  fetch('/api/catalog/selection?ids='+encodeURIComponent(buyNowId),{cache:'no-store',signal:ac.signal})
   .then(async r=>{
    const data=await r.json();
    if(!r.ok)throw Error('Produk belum dapat diverifikasi');
    const product=Array.isArray(data.items)?data.items.find((p:Product)=>p.id===buyNowId):null;
    if(!product||!product.is_active||product.price_idr<=0||product.stock_qty<=0||product.available===false)
     throw Error('Produk yang dipilih belum tersedia untuk checkout');
    if(!ac.signal.aborted)setBuyNowProduct(product);
   })
   .catch(e=>{if(!ac.signal.aborted)setBuyNowError(e instanceof Error?e.message:'Produk belum dapat diverifikasi')})
   .finally(()=>{if(!ac.signal.aborted)setBuyNowLoading(false)});
  return()=>ac.abort();
 },[buyNowId,scopeReady]);
 const auth=useCustomerAuth();
 const router=useRouter();
 const [form,setForm]=useState<DraftForm>(initial);
 const [checkoutConfig,setCheckoutConfig]=useState<CheckoutConfig|null>(null);
 const [voucherDraft,setVoucherDraft]=useState('');
 const [appliedVoucher,setAppliedVoucher]=useState('');
 const [quote,setQuote]=useState<Quote|null>(null);
 const [shippingConfig,setShippingConfig]=useState<ShippingConfig|null>(null);
 const [shippingRates,setShippingRates]=useState<ShippingOption[]>([]);
 const [destination,setDestination]=useState<AddressSelection|null>(null);
 const [selectedAddressId,setSelectedAddressId]=useState('');
 const [destinationPin,setDestinationPin]=useState<DeliveryPin|null>(null);
 const [pinNotice,setPinNotice]=useState('');
 const [selectedQuoteId,setSelectedQuoteId]=useState('');
 const [shippingLoading,setShippingLoading]=useState(false);
 const [shippingError,setShippingError]=useState('');
 const [shippingRetry,setShippingRetry]=useState(0);
 const [quoting,setQuoting]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [order,setOrder]=useState<{id:string;status:string;paymentStatus:string}|null>(null);
 const requestKey=useRef<string|null>(null);
 const shippingRequest=useRef(0);
 const physical=useMemo(()=>{
  if(!scopeReady)return [];
  if(!buyNowId)return items.filter(x=>!isDigitalProduct(x.product));
  // Use current, published server data for Buy Now when possible; the
  // existing cart is only a fallback while that request is in flight.
  const selected=buyNowProduct||items.find(x=>x.product.id===buyNowId)?.product;
  if(!selected||isDigitalProduct(selected))return [];
  return [{product:selected,quantity:Math.max(1,Math.min(buyNowQty,selected.stock_qty||1,99))}];
 },[items,buyNowId,buyNowProduct,buyNowQty,scopeReady]);
 const includesDigital=!scopeReady||(!buyNowId&&items.some(x=>isDigitalProduct(x.product)));
 const scopedCount=physical.reduce((total,item)=>total+item.quantity,0);
 const requestItems=useMemo(()=>physical.map(x=>({productId:x.product.id,quantity:x.quantity})),[physical]);
 const key=JSON.stringify({items:requestItems,voucherCode:appliedVoucher});
 const selectedShipping=shippingRates.find(r=>r.quoteId===selectedQuoteId)||null;
 const shippingPrice=shippingConfig?.rateLookupEnabled?(selectedShipping?.priceIdr??null):(quote?.shippingFeeIdr??null);
 const totalPreview=quote&&shippingPrice!==null?quote.subtotalIdr-quote.discountIdr+shippingPrice:null;
 useEffect(()=>{fetch('/api/checkout/config',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(Error('Gateway config unavailable')))
  .then(raw=>{
   // A partial or outdated response must never crash the purchase screen.
   const methods=Array.isArray(raw?.methods)?raw.methods.filter((m:unknown)=>['bank_transfer','qris','virtual_account','ewallet'].includes(String(m))):[];
   setCheckoutConfig({...raw,paymentEnabled:Boolean(raw?.paymentEnabled),providerConnected:Boolean(raw?.providerConnected),methods});
  }).catch(()=>setCheckoutConfig({paymentEnabled:false,providerConnected:false,methods:['bank_transfer']}));},[]);
 useEffect(()=>{fetch('/api/shipping/config',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(Error('Shipping unavailable'))).then(setShippingConfig).catch(()=>setShippingError('Pengaturan ongkir belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.'));},[]);
 useEffect(()=>{
  if(includesDigital||requestItems.length===0){setQuote(null);setError('');return;}
  const controller=new AbortController();
  requestKey.current=null;shippingRequest.current++;setShippingLoading(false);setQuoting(true);setError('');setQuote(null);setShippingRates([]);setSelectedQuoteId('');setShippingError('');
  fetch('/api/checkout/quote',{method:'POST',headers:{'content-type':'application/json',...(auth.accessToken?{authorization:'Bearer '+auth.accessToken}:{})},body:JSON.stringify({items:requestItems,...(appliedVoucher?{voucherCode:appliedVoucher}:{})}),signal:controller.signal,cache:'no-store'})
   .then(async response=>{
    const result=await response.json();
    if(!response.ok)throw new Error(typeof result?.message==='string'?result.message:'Harga atau stok tidak dapat diperiksa, coba lagi.');
    setQuote(result as Quote);
   }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Koneksi terputus');})
   .finally(()=>{if(!controller.signal.aborted)setQuoting(false);});
  return()=>controller.abort();
 // Cart is transformed to stable primitive signature to prevent repeated quotes during unrelated renders.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[key,includesDigital,auth.accessToken]);
 useEffect(()=>{
  const postalReady=/^[0-9]{5}$/.test(form.postalCode);
  const areaReady=!shippingConfig?.requiresArea||Boolean(destination&&destination.postalCode===form.postalCode);
  if(!shippingConfig?.rateLookupEnabled||!postalReady||!requestItems.length||!areaReady){
   shippingRequest.current++;setShippingLoading(false);setShippingRates([]);setSelectedQuoteId('');
   return;
  }
  const sequence=++shippingRequest.current,controller=new AbortController();
  setShippingLoading(true);setShippingError('');setShippingRates([]);setSelectedQuoteId('');
  const timer=setTimeout(async()=>{
   try{
    const response=await fetch(auth.accessToken?'/api/shipping/rates':'/api/shipping/estimate',{method:'POST',headers:{...(auth.accessToken?{authorization:'Bearer '+auth.accessToken}:{}),'content-type':'application/json'},
     body:JSON.stringify({items:requestItems,destinationPostalCode:form.postalCode,...(destinationPin?{destinationPin}:{}),...(destination?{destinationAreaId:destination.areaId,destinationProvinceId:destination.provinceId}:{})}),
     signal:controller.signal,cache:'no-store'});
    const data=await response.json();if(!response.ok)throw Error(data?.message||data?.code||'Tarif kurir belum tersedia');
    if(sequence!==shippingRequest.current)return;
    setPinNotice(data.pinNotice||'');
    const rates=(Array.isArray(data.rates)?data.rates:[]).map((r:ShippingOption)=>({...r,quoteId:r.quoteId||'estimate:'+r.courierCode+':'+(r.providerServiceId||r.serviceCode)})).sort((a:ShippingOption,b:ShippingOption)=>a.priceIdr-b.priceIdr);
    let preferredKey='';
    try{preferredKey=sessionStorage.getItem(CHOSEN_COURIER_KEY)||'';}catch{}
    const remembered=rates.find((r:ShippingOption)=>r.courierCode+':'+(r.providerServiceId||r.serviceCode)===preferredKey);
    setShippingRates(rates);setSelectedQuoteId((remembered||rates[0])?.quoteId||'');
    if(!rates.length)setShippingError('Tidak ada tarif kurir untuk kombinasi alamat dan produk ini.');
   }catch(e){
    if(sequence===shippingRequest.current&&!controller.signal.aborted)setShippingError(e instanceof Error?e.message:'Tidak dapat menghitung ongkir.');
   }finally{
    if(sequence===shippingRequest.current&&!controller.signal.aborted)setShippingLoading(false);
   }
  },350);
  return()=>{clearTimeout(timer);controller.abort();if(shippingRequest.current===sequence)shippingRequest.current++;};
 },[shippingConfig?.rateLookupEnabled,shippingConfig?.requiresArea,auth.accessToken,form.postalCode,form.city,form.province,
  destination?.areaId,destination?.provinceId,destination?.postalCode,requestItems,key,shippingRetry,destinationPin]);
 const change=(name:keyof DraftForm,value:string)=>{
  if(name==='address')setDestinationPin(null);
  setForm(previous=>({...previous,[name]:value}));setOrder(null);requestKey.current=null;
  if(['postalCode','city','province'].includes(name)){shippingRequest.current++;setShippingLoading(false);setShippingRates([]);setSelectedQuoteId('');setShippingError('');if(name==='postalCode')setDestination(null);}
 };
 function applySavedAddress(addr:SavedDeliveryAddress|null){
  if(!addr)return;
  setSelectedAddressId(addr.id);setDestination(addr.region);setDestinationPin(addr.pin);
  setForm(previous=>({...previous,name:addr.recipientName,phone:addr.phone,
    address:checkoutAddressLine(addr),city:addr.region.city,province:addr.region.province,postalCode:addr.region.postalCode}));
  setOrder(null);requestKey.current=null;
 }
 useEffect(()=>{
  if(!auth.user)return;
  const legacy=legacyAccountAddress(auth.user.user_metadata);
  if(legacy)setForm(current=>current.address?current:{
   ...current,name:legacy.recipientName,phone:legacy.phone,address:legacy.street
  });
 },[auth.user?.id]);
 const live=checkoutConfig?.gateway?.environment==='live';
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();setError('');
  if(form.paymentMethod!=='bank_transfer'&&!checkoutConfig?.methods.includes(form.paymentMethod)){setError('Metode pembayaran belum aktif. Gunakan transfer manual.');return;}
  if(!destination){setError('Pilih wilayah dari provinsi hingga kelurahan terlebih dahulu.');return;}
  if(!quote||totalPreview===null||includesDigital||!requestItems.length||(shippingConfig?.rateLookupEnabled&&!selectedShipping)){setError('Biaya pengiriman atau stok belum siap. Tunggu estimasi otomatis dan pilih layanan kurir.');return;}
  if(!auth.accessToken){setError('Silakan masuk terlebih dahulu.');return;}
  setBusy(true);
  try{
   requestKey.current??=crypto.randomUUID();
   const response=await fetch('/api/checkout/orders',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+auth.accessToken},
    body:JSON.stringify({...form,items:requestItems,idempotencyKey:requestKey.current,...(appliedVoucher?{voucherCode:appliedVoucher}:{}),...(selectedShipping?{shippingQuoteId:selectedShipping.quoteId}:{}),...(destinationPin?{destinationPin}:{}),...(destination?{destinationAreaId:destination.areaId,destinationProvinceId:destination.provinceId}:{})})});
   const result=await response.json();
   if(!response.ok)throw new Error(typeof result?.message==='string'?result.message:result?.code||'Gagal menyimpan draft pesanan');
   setOrder({id:result.id,status:result.status,paymentStatus:result.paymentStatus});
   router.push('/pesanan/'+encodeURIComponent(result.id));
  }catch(e){setError(e instanceof Error?e.message:'Gagal membuat draft pesanan');}
  finally{setBusy(false);}
 };
 if(!scopeReady)return <main className="vco26-root main-container"><p role="status">Menyiapkan checkout…</p></main>;
 return <main className="vco26-root main-container">
  <div className="vco26-intro">
   <p className="vco26-eyebrow">VAPMART / CHECKOUT</p><h1>Checkout</h1>
   <p>Tinjau barang, penerima, ongkos kirim, dan metode pembayaran. {live?'Pilih kanal pembayaran Xendit atau transfer manual.':'Pilih transfer manual atau kanal Xendit sandbox yang tersedia.'}</p>
   <div className="vco26-steps"><span className="done">1. Keranjang</span><span className="current">2. Checkout</span><span>3. Pembayaran</span></div>
  </div>
  {buyNowId&&buyNowError&&<p role="alert" className="vco26-footnote">{buyNowError}. Silakan periksa kembali ketersediaan produk.</p>}
  {buyNowId&&buyNowLoading&&physical.length===0?<section className="vco26-card" role="status">Memeriksa produk untuk Beli Sekarang…</section>:
   (buyNowId?physical.length===0:items.length===0)?<section className="vco26-card"><h2>Belum ada barang.</h2><p>Pilih produk di katalog terlebih dahulu.</p><Link href="/catalog" className="vco26-button">Lihat katalog</Link></section>:
  includesDigital?<section className="vco26-card"><h2>Produk digital diproses terpisah</h2><p>Pisahkan Coin atau Membership dari barang fisik sebelum checkout. Saldo dan benefit hanya berlaku setelah pembayaran terverifikasi.</p><Link href="/keranjang-2" className="vco26-button">Kembali ke keranjang</Link></section>:
  <div className="vco26-grid">
   <form className="vco26-card vco26-form" onSubmit={submit}>
    <div className="vco26-card-heading"><span>01</span><div><h2>Detail penerima</h2><p>Isi tujuan pengiriman dan kontak yang bisa dihubungi.</p></div></div>
    <label>Nama lengkap<input value={form.name} onChange={e=>change('name',e.target.value)} minLength={2} maxLength={100} required autoComplete="name" placeholder="Nama penerima"/></label>
    <label>Nomor telepon<input value={form.phone} onChange={e=>change('phone',e.target.value)} minLength={9} maxLength={22} required inputMode="tel" autoComplete="tel" placeholder="08xxxxxxxxxx"/></label>
    <div className="vco-checkout-address-book"><DeliveryAddressManager onSelected={applySavedAddress}/></div>
    <details className="vco-checkout-manual-region"><summary>Ubah wilayah secara manual</summary>
     <IndonesiaAddressPicker key={selectedAddressId||'manual'} initialValue={destination||undefined} onChange={r=>{
      setDestination(r);setDestinationPin(null);shippingRequest.current++;setShippingLoading(false);
      setShippingRates([]);setSelectedQuoteId('');setShippingError('');setOrder(null);requestKey.current=null;
      setForm(f=>({...f,city:r?.city||'',province:r?.province||'',postalCode:r?.postalCode||''}));
     }}/></details>
    <label>Detail alamat<textarea value={form.address} onChange={e=>change('address',e.target.value)} minLength={8} maxLength={300} required rows={3} autoComplete="street-address" placeholder="Nama jalan, nomor rumah/gedung, RT/RW, patokan"/></label>
    <p className="vm-address-help">Isi jalan dan nomor rumah di sini. Wilayah dan kode pos mengikuti pilihan di atas.</p>
    <DeliveryPinPicker key={(destination?.areaId||'none')+form.address} value={destinationPin} onChange={p=>{setDestinationPin(p);requestKey.current=null;}} region={destination?.label||''} address={[form.address,destination?.label].filter(Boolean).join(', ')}/>
    <div className="vco26-card-heading vco26-payment-head"><span>02</span><div><h2>Kurir & Ongkos Kirim</h2><p>Lihat estimasi biaya dan waktu kirim sebelum membuat pesanan. Belum ada booking kurir maupun resi.</p></div></div>
    {shippingConfig?.rateLookupEnabled?<div className="vco26-shipping-picker">
     <p className="vco26-shipping-status" aria-live="polite">{!/^[0-9]{5}$/.test(form.postalCode)?'Masukkan kode pos tujuan untuk menghitung ongkir.':shippingConfig.requiresArea&&!destination?'Pilih kelurahan tujuan agar tarif sesuai alamat.':shippingLoading?'Menghitung estimasi ongkir...':shippingRates.length?shippingRates.length+' layanan tersedia. Pilihan termurah dipilih sebagai awal.':'Estimasi akan dihitung otomatis setelah alamat lengkap.'}</p>
     {shippingRates.length>0&&<label className="vco26-courier-select">Kurir & layanan
      <select aria-label="Pilih kurir dan layanan" value={selectedQuoteId} onChange={e=>{setSelectedQuoteId(e.target.value);requestKey.current=null;
       const chosen=shippingRates.find(r=>r.quoteId===e.target.value);
       if(chosen)try{sessionStorage.setItem(CHOSEN_COURIER_KEY,chosen.courierCode+':'+(chosen.providerServiceId||chosen.serviceCode));}catch{}
      }}>
       {shippingRates.map(r=><option key={r.quoteId} value={r.quoteId}>{r.courierName} · {r.serviceName} · {formatIDR(r.priceIdr)}{r.duration?' · '+r.duration:''}</option>)}
      </select>
     </label>}
     {pinNotice&&<p className="vco26-shipping-status">{pinNotice}</p>}
     {!auth.accessToken&&shippingRates.length>0&&<p className="vco26-shipping-status">Estimasi tersedia sebelum login. Masuk untuk menyimpan pesanan; tarif akan diperiksa kembali.</p>}
     {selectedShipping&&<div className="vco26-shipping-selected"><div><strong>{selectedShipping.courierName}</strong><span>{selectedShipping.serviceName} · {selectedShipping.duration||'Estimasi waktu belum tersedia'}{selectedShipping.insuranceIdr!==undefined?' · termasuk asuransi':''}</span></div><strong>{formatIDR(selectedShipping.priceIdr)}</strong></div>}
     {shippingError&&<div className="vco26-shipping-error"><p role="alert">{shippingError}</p><button type="button" onClick={()=>setShippingRetry(v=>v+1)} disabled={shippingLoading}>Coba hitung lagi</button></div>}
    </div>:<p className="vco26-disclaimer" role="status">{shippingError||(!shippingConfig?'Memuat pengaturan ongkir...':'Pilihan jasa kurir live belum diaktifkan. Estimasi tarif standar ditampilkan bila tersedia.')}</p>}
    <div className="vco26-card-heading vco26-payment-head"><span>03</span><div><h2>Voucher</h2><p>Gunakan kode voucher aktif bila tersedia.</p></div></div>
    <div className="vco26-voucher"><input aria-label="Kode voucher" value={voucherDraft} maxLength={32} placeholder="Kode voucher" onChange={e=>setVoucherDraft(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,''))}/><button type="button" className="vco26-secondary" onClick={()=>{setAppliedVoucher(voucherDraft.trim());requestKey.current=null;}}>{appliedVoucher?'Perbarui voucher':'Terapkan voucher'}</button>{appliedVoucher&&<button type="button" className="vco26-secondary" onClick={()=>{setVoucherDraft('');setAppliedVoucher('');requestKey.current=null;}}>Hapus</button>}</div>
    <div className="vco26-card-heading vco26-payment-head"><span>04</span><div><h2>Metode pembayaran</h2><p>{live?'Pembayaran Xendit diverifikasi otomatis oleh server. Transfer manual diverifikasi admin.':'Transfer bank diverifikasi admin. Kanal Xendit berlabel Sandbox digunakan untuk simulasi, tanpa dana nyata.'}</p></div></div>
    <div className="vco26-methods">{methods.map(method=><label className={'vco26-method'+(form.paymentMethod===method.id?' selected':'')+(!checkoutConfig?.methods.includes(method.id)?' is-unavailable':'')} key={method.id}>
      <input type="radio" name="paymentMethod" value={method.id} checked={form.paymentMethod===method.id} disabled={!checkoutConfig?.methods.includes(method.id)} onChange={()=>change('paymentMethod',method.id)}/>
      <span><strong>{method.name}</strong><small>{method.id==='bank_transfer'?method.hint:checkoutConfig?.methods.includes(method.id)?(live?'Pembayaran melalui checkout Xendit':'Simulasi melalui checkout Xendit · tanpa dana nyata'):'Kanal ini belum diaktifkan'}</small></span><em>{method.id==='bank_transfer'?'Manual':checkoutConfig?.methods.includes(method.id)?(live?'Aktif':'Sandbox aktif'):'Belum aktif'}</em>
    </label>)}</div>
    <p className="vco26-disclaimer">{live?'Pembayaran diproses di halaman aman Xendit. Status lunas diperbarui setelah verifikasi server.':'Transfer manual memerlukan konfirmasi dana oleh admin. Xendit Sandbox hanya untuk pengujian dan tidak memicu pengiriman barang. Kanal yang belum tersedia tidak dapat dipilih.'}</p>
    {!auth.configured?<div className="vco26-warning">Autentikasi pelanggan belum dikonfigurasi. Draft pesanan belum dapat dibuat.</div>:
     !auth.user?<Link className="vco26-button" href="/login?next=/checkout">Masuk sebelum checkout ↗</Link>:
     <button className="vco26-button" type="submit" disabled={busy||quoting||shippingLoading||!quote||totalPreview===null||(shippingConfig?.rateLookupEnabled&&!selectedShipping)}>{busy?'Membuat pesanan...':'Buat pesanan ↗'}</button>}
    {error&&<p role="alert" className="vco26-error">{error}</p>}
    {order&&<p className="vco26-success">Pesanan #{order.id} dibuat dan masuk dashboard. Status pembayaran: {order.paymentStatus}.</p>}
   </form>
   <aside className="vco26-card vco26-summary">
    <div className="vco26-card-heading"><span>05</span><div><h2>Ringkasan pesanan</h2><p>{scopedCount} item {buyNowId?'Beli Sekarang':'di keranjang'}</p></div></div>
    {physical.map(({product,quantity})=><div className="vco26-line" key={product.id}>
      <div className="vco26-thumb">{product.image_url?<img src={product.image_url} alt=""/>:<strong>V</strong>}</div>
      <div><strong>{product.name}</strong><small>{product.sku||'SKU belum tersedia'} · {quantity} pcs</small></div>
      <b>{formatIDR((quote?.items.find(x=>x.productId===product.id)?.unitPriceIdr??product.price_idr)*quantity)}</b>
    </div>)}
    {quoting?<p className="vco26-quiet">Memeriksa harga dan stok terkini...</p>:quote?<div className="vco26-totals">
      <div><span>Subtotal aktual</span><b>{formatIDR(quote.subtotalIdr)}</b></div>
      <div><span>{selectedShipping?selectedShipping.courierName+' · '+selectedShipping.serviceName:shippingConfig?.rateLookupEnabled?(shippingLoading?'Menghitung ongkir...':'Ongkos kirim'):'Ongkir standar (estimasi)'}</span><b>{shippingPrice===null?(shippingLoading?'Sedang dihitung':shippingError?'Tarif belum tersedia':!destination?'Pilih wilayah tujuan':'Pilih layanan kurir'):formatIDR(shippingPrice)}</b></div>
      {quote.voucherDiscountIdr>0&&<div><span>Voucher {quote.voucherCode||''}</span><b>-{formatIDR(quote.voucherDiscountIdr)}</b></div>}
      {quote.promotionDiscountIdr>0&&<div><span>Promo otomatis {quote.promotionTitle||''}</span><b>-{formatIDR(quote.promotionDiscountIdr)}</b></div>}
      <div className="vco26-total"><span>Total estimasi</span><strong>{totalPreview===null?'Belum tersedia':formatIDR(totalPreview)}</strong></div>
    </div>:<p className="vco26-quiet">Harga aktual hanya tampil setelah diverifikasi oleh server.</p>}
    <p className="vco26-footnote">{shippingConfig?.provider==='jubelio'?'Tarif live dari Jubelio Shipment sudah termasuk asuransi, belum termasuk promo bersyarat. ':'Tarif live disimpan sebagai snapshot pesanan. '}Estimasi dihitung otomatis dan berlaku 15 menit. Resi dibuat admin melalui Courier Ops setelah pembayaran terverifikasi dan paket siap dikirim.</p>
    <Link href="/keranjang-2" className="vco26-secondary">← Edit keranjang</Link>
   </aside>
  </div>}
 </main>;
}
