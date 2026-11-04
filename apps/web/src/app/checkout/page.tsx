'use client';
import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useCart} from '@/lib/cart';
import {useCustomerAuth} from '@/lib/customer-auth';
import {isDigitalProduct} from '@/lib/digital-products';
import {formatIDR} from '@/lib/types';
import '../checkout-v26.css';

type QuoteItem={productId:string;sku:string|null;name:string;unitPriceIdr:number;quantity:number;lineTotalIdr:number;stockQty:number};
type Quote={items:QuoteItem[];subtotalIdr:number;discountIdr:number;voucherCode:string|null;shippingFeeIdr:number|null;totalIdr:number|null;shippingEstimate:boolean;paymentEnabled:boolean;paymentMethods:string[]};
type ShippingOption={quoteId:string;expiresAt:string;courierCode:string;courierName:string;serviceCode:string;serviceName:string;priceIdr:number;duration:string};
type ShippingConfig={rateLookupEnabled:boolean;bookingEnabled:boolean;paymentEnabled:boolean;rateType:string};
type DraftForm={name:string;phone:string;address:string;city:string;province:string;postalCode:string;paymentMethod:'bank_transfer'|'qris'|'virtual_account'|'ewallet'};
const initial:DraftForm={name:'',phone:'',address:'',city:'',province:'',postalCode:'',paymentMethod:'bank_transfer'};
const methods=[{id:'bank_transfer',name:'Bank Transfer',hint:'Buat pesanan sekarang; pembayaran diverifikasi manual oleh admin'},{id:'qris',name:'QRIS',hint:'Menunggu integrasi payment gateway'},{id:'virtual_account',name:'Virtual Account',hint:'Menunggu integrasi payment gateway'},{id:'ewallet',name:'E-Wallet',hint:'Menunggu integrasi payment gateway'}] as const;
export default function CheckoutPage(){
 const {items,count}=useCart();
 const auth=useCustomerAuth();
 const router=useRouter();
 const [form,setForm]=useState<DraftForm>(initial);
 const [voucherDraft,setVoucherDraft]=useState('');
 const [appliedVoucher,setAppliedVoucher]=useState('');
 const [quote,setQuote]=useState<Quote|null>(null);
 const [shippingConfig,setShippingConfig]=useState<ShippingConfig|null>(null);
 const [shippingRates,setShippingRates]=useState<ShippingOption[]>([]);
 const [selectedQuoteId,setSelectedQuoteId]=useState('');
 const [shippingLoading,setShippingLoading]=useState(false);
 const [quoting,setQuoting]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [order,setOrder]=useState<{id:string;status:string;paymentStatus:string}|null>(null);
 const requestKey=useRef<string|null>(null);
 const physical=useMemo(()=>items.filter(x=>!isDigitalProduct(x.product)),[items]);
 const includesDigital=items.some(x=>isDigitalProduct(x.product));
 const requestItems=useMemo(()=>physical.map(x=>({productId:x.product.id,quantity:x.quantity})),[physical]);
 const key=JSON.stringify({items:requestItems,voucherCode:appliedVoucher});
 const selectedShipping=shippingRates.find(r=>r.quoteId===selectedQuoteId)||null;
 const shippingPrice=selectedShipping?.priceIdr??quote?.shippingFeeIdr??null;
 const totalPreview=quote&&shippingPrice!==null?quote.subtotalIdr-quote.discountIdr+shippingPrice:null;
 useEffect(()=>{fetch('/api/shipping/config',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(Error('Shipping unavailable'))).then(setShippingConfig).catch(()=>setShippingConfig({rateLookupEnabled:false,bookingEnabled:false,paymentEnabled:false,rateType:'disabled'}));},[]);
 useEffect(()=>{
  if(includesDigital||requestItems.length===0){setQuote(null);setError('');return;}
  const controller=new AbortController();
  requestKey.current=null;setQuoting(true);setError('');setQuote(null);setShippingRates([]);setSelectedQuoteId('');
  fetch('/api/checkout/quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({items:requestItems,...(appliedVoucher?{voucherCode:appliedVoucher}:{})}),signal:controller.signal,cache:'no-store'})
   .then(async response=>{
    const result=await response.json();
    if(!response.ok)throw new Error(typeof result?.message==='string'?result.message:'Harga atau stok tidak dapat diperiksa, coba lagi.');
    setQuote(result as Quote);
   }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Koneksi terputus');})
   .finally(()=>{if(!controller.signal.aborted)setQuoting(false);});
  return()=>controller.abort();
 // Cart is transformed to stable primitive signature to prevent repeated quotes during unrelated renders.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[key,includesDigital]);
 const change=(name:keyof DraftForm,value:string)=>{
  setForm(previous=>({...previous,[name]:value}));setOrder(null);requestKey.current=null;
  if(name==='postalCode'){setShippingRates([]);setSelectedQuoteId('');}
 };
 async function loadShippingRates(){
  if(!auth.accessToken){setError('Login dan verifikasi email untuk cek ongkir.');return;}
  if(!shippingConfig?.rateLookupEnabled){setError('API ongkir sandbox belum diaktifkan.');return;}
  if(!/^[0-9]{5}$/.test(form.postalCode)){setError('Masukkan kode pos tujuan 5 angka.');return;}
  setShippingLoading(true);setError('');setShippingRates([]);setSelectedQuoteId('');
  try{
   const response=await fetch('/api/shipping/rates',{method:'POST',headers:{authorization:'Bearer '+auth.accessToken,'content-type':'application/json'},
    body:JSON.stringify({items:requestItems,destinationPostalCode:form.postalCode})});
   const data=await response.json();if(!response.ok)throw Error(data?.message||data?.code||'Tarif kurir belum tersedia');
   setShippingRates(Array.isArray(data.rates)?data.rates:[]);
   if(!data.rates?.length)setError('Tidak ada tarif kurir untuk kombinasi alamat dan produk ini.');
  }catch(e){setError(e instanceof Error?e.message:'Tidak dapat cek ongkir');}
  finally{setShippingLoading(false);}
 }
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();setError('');
  if(!quote||totalPreview===null||includesDigital||!requestItems.length||(shippingConfig?.rateLookupEnabled&&!selectedShipping)){setError('Biaya pengiriman atau stok belum siap. Pilih kurir jika tersedia.');return;}
  if(!auth.accessToken){setError('Silakan masuk terlebih dahulu.');return;}
  setBusy(true);
  try{
   requestKey.current??=crypto.randomUUID();
   const response=await fetch('/api/checkout/orders',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+auth.accessToken},
    body:JSON.stringify({...form,items:requestItems,idempotencyKey:requestKey.current,...(appliedVoucher?{voucherCode:appliedVoucher}:{}),...(selectedShipping?{shippingQuoteId:selectedShipping.quoteId}:{})})});
   const result=await response.json();
   if(!response.ok)throw new Error(typeof result?.message==='string'?result.message:result?.code||'Gagal menyimpan draft pesanan');
   setOrder({id:result.id,status:result.status,paymentStatus:result.paymentStatus});
   router.push('/pesanan/'+encodeURIComponent(result.id));
  }catch(e){setError(e instanceof Error?e.message:'Gagal membuat draft pesanan');}
  finally{setBusy(false);}
 };
 return <main className="vco26-root main-container">
  <div className="vco26-intro">
   <p className="vco26-eyebrow">VAPMART / SECURE CHECKOUT PREVIEW</p><h1>Checkout</h1>
   <p>Tinjau barang, penerima, ongkos kirim, dan metode pembayaran. Pembayaran baru diproses setelah gateway resmi dihubungkan.</p>
   <div className="vco26-steps"><span className="done">1. Keranjang</span><span className="current">2. Checkout</span><span>3. Pembayaran</span></div>
  </div>
  {items.length===0?<section className="vco26-card"><h2>Belum ada barang.</h2><p>Pilih produk di katalog terlebih dahulu.</p><Link href="/catalog" className="vco26-button">Lihat katalog</Link></section>:
  includesDigital?<section className="vco26-card"><h2>Produk digital diproses terpisah</h2><p>Pisahkan Coin atau Membership dari barang fisik sebelum checkout. Saldo dan benefit hanya berlaku setelah pembayaran terverifikasi.</p><Link href="/keranjang-2" className="vco26-button">Kembali ke keranjang</Link></section>:
  <div className="vco26-grid">
   <form className="vco26-card vco26-form" onSubmit={submit}>
    <div className="vco26-card-heading"><span>01</span><div><h2>Detail penerima</h2><p>Isi tujuan pengiriman dan kontak yang bisa dihubungi.</p></div></div>
    <label>Nama lengkap<input value={form.name} onChange={e=>change('name',e.target.value)} minLength={2} maxLength={100} required autoComplete="name" placeholder="Nama penerima"/></label>
    <label>Nomor telepon<input value={form.phone} onChange={e=>change('phone',e.target.value)} minLength={9} maxLength={22} required inputMode="tel" autoComplete="tel" placeholder="08xxxxxxxxxx"/></label>
    <label>Alamat lengkap<textarea value={form.address} onChange={e=>change('address',e.target.value)} minLength={8} maxLength={300} required rows={3} placeholder="Jalan, nomor, RT/RW, kecamatan"/></label>
    <div className="vco26-fields"><label>Kota / Kabupaten<input value={form.city} onChange={e=>change('city',e.target.value)} maxLength={90} required/></label><label>Provinsi<input value={form.province} onChange={e=>change('province',e.target.value)} maxLength={90} required/></label></div>
    <label>Kode pos<input value={form.postalCode} onChange={e=>change('postalCode',e.target.value)} pattern="[0-9]{5}" inputMode="numeric" maxLength={5} required placeholder="40115"/></label>
    <div className="vco26-card-heading vco26-payment-head"><span>02</span><div><h2>Kurir & Ongkos Kirim</h2><p>Lihat estimasi biaya dan waktu kirim sebelum membuat pesanan. Belum ada booking kurir maupun resi.</p></div></div>
    {shippingConfig?.rateLookupEnabled?<div style={{display:'grid',gap:12,marginBottom:24}}>
     <button type="button" className="vco26-button" disabled={!auth.user||shippingLoading||!/^[0-9]{5}$/.test(form.postalCode)||!requestItems.length} onClick={loadShippingRates}>{shippingLoading?'Memeriksa tarif...':'Cek estimasi ongkir'}</button>
     {shippingRates.map(r=><label key={r.quoteId} className={'vco26-method'+(selectedQuoteId===r.quoteId?' selected':'')}>
      <input type="radio" name="shippingRate" value={r.quoteId} checked={selectedQuoteId===r.quoteId} onChange={()=>{setSelectedQuoteId(r.quoteId);requestKey.current=null;}}/>
      <span><strong>{r.courierName} · {r.serviceName}</strong><small>{r.duration||'Estimasi waktu belum tersedia'} · Berlaku 15 menit</small></span>
      <em>{formatIDR(r.priceIdr)}</em>
     </label>)}
    </div>:<p className="vco26-disclaimer">Pilihan jasa kurir live belum diaktifkan. Estimasi tarif standar tetap ditampilkan bila tersedia.</p>}
    <div className="vco26-card-heading vco26-payment-head"><span>03</span><div><h2>Voucher</h2><p>Gunakan kode voucher aktif bila tersedia.</p></div></div>
    <div className="vco26-voucher"><input aria-label="Kode voucher" value={voucherDraft} maxLength={32} placeholder="Kode voucher" onChange={e=>setVoucherDraft(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,''))}/><button type="button" className="vco26-secondary" onClick={()=>{setAppliedVoucher(voucherDraft.trim());requestKey.current=null;}}>{appliedVoucher?'Perbarui voucher':'Terapkan voucher'}</button>{appliedVoucher&&<button type="button" className="vco26-secondary" onClick={()=>{setVoucherDraft('');setAppliedVoucher('');requestKey.current=null;}}>Hapus</button>}</div>
    <div className="vco26-card-heading vco26-payment-head"><span>04</span><div><h2>Metode pembayaran</h2><p>Bank Transfer dapat dipakai untuk menguji checkout tanpa payment gateway. Metode gateway lain tetap belum aktif.</p></div></div>
    <div className="vco26-methods">{methods.map(method=><label className={'vco26-method'+(form.paymentMethod===method.id?' selected':'')} key={method.id}>
      <input type="radio" name="paymentMethod" value={method.id} checked={form.paymentMethod===method.id} onChange={()=>change('paymentMethod',method.id)}/>
      <span><strong>{method.name}</strong><small>{method.hint}</small></span><em>{method.id==='bank_transfer'?'Manual':'Gateway OFF'}</em>
    </label>)}</div>
    <p className="vco26-disclaimer">Bank Transfer membuat pesanan berstatus menunggu pembayaran agar flow dashboard dapat diuji. Halaman ini tidak menampilkan nomor rekening dan tidak menandai pembayaran sebagai lunas secara otomatis.</p>
    {!auth.configured?<div className="vco26-warning">Autentikasi pelanggan belum dikonfigurasi. Draft pesanan belum dapat dibuat.</div>:
     !auth.user?<Link className="vco26-button" href="/login?next=/checkout">Masuk sebelum checkout ↗</Link>:
     <button className="vco26-button" type="submit" disabled={busy||quoting||shippingLoading||!quote||totalPreview===null||(shippingConfig?.rateLookupEnabled&&!selectedShipping)}>{busy?'Membuat pesanan...':'Buat pesanan ↗'}</button>}
    {error&&<p role="alert" className="vco26-error">{error}</p>}
    {order&&<p className="vco26-success">Pesanan #{order.id} dibuat dan masuk dashboard. Status pembayaran: {order.paymentStatus}.</p>}
   </form>
   <aside className="vco26-card vco26-summary">
    <div className="vco26-card-heading"><span>05</span><div><h2>Ringkasan pesanan</h2><p>{count} item di keranjang</p></div></div>
    {physical.map(({product,quantity})=><div className="vco26-line" key={product.id}>
      <div className="vco26-thumb">{product.image_url?<img src={product.image_url} alt=""/>:<strong>V</strong>}</div>
      <div><strong>{product.name}</strong><small>{product.sku||'SKU belum tersedia'} · {quantity} pcs</small></div>
      <b>{formatIDR((quote?.items.find(x=>x.productId===product.id)?.unitPriceIdr??product.price_idr)*quantity)}</b>
    </div>)}
    {quoting?<p className="vco26-quiet">Memeriksa harga dan stok terkini...</p>:quote?<div className="vco26-totals">
      <div><span>Subtotal aktual</span><b>{formatIDR(quote.subtotalIdr)}</b></div>
      {quote.discountIdr>0&&<div><span>Voucher {quote.voucherCode||''}</span><b>-{formatIDR(quote.discountIdr)}</b></div>}
      <div><span>{selectedShipping?selectedShipping.courierName+' · '+selectedShipping.serviceName:'Ongkir standar (estimasi)'}</span><b>{shippingPrice===null?'Belum tersedia':formatIDR(shippingPrice)}</b></div>
      <div className="vco26-total"><span>Total estimasi</span><strong>{totalPreview===null?'Belum tersedia':formatIDR(totalPreview)}</strong></div>
    </div>:<p className="vco26-quiet">Harga aktual hanya tampil setelah diverifikasi oleh server.</p>}
    <p className="vco26-footnote">Tarif pilihan sandbox disimpan sebagai snapshot draft, tidak menciptakan resi atau memesan kurir. Ongkir final, pajak, dan biaya tambahan harus diverifikasi sebelum pembayaran sungguhan diaktifkan.</p>
    <Link href="/keranjang-2" className="vco26-secondary">← Edit keranjang</Link>
   </aside>
  </div>}
 </main>;
}
