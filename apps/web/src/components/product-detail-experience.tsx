'use client';
import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useCart} from '@/lib/cart';
import {useCustomerAuth} from '@/lib/customer-auth';
import {formatIDR,type Product} from '@/lib/types';
import {ArchiveGallery} from '@/components/archive-gallery';
import {FavoriteButton} from '@/components/favorite-button';
import {CatalogPublicReviews} from '@/components/catalog-public-reviews';
import {IndonesiaAddressPicker} from '@/components/indonesia-address-picker';
import {Icon} from '@/components/store-icon';
import type {AddressSelection} from '@/lib/address-location';

type Sheet='variants'|'shipping'|null;
type Intent='cart'|'buy';
type ShippingConfig={provider:string;rateLookupEnabled:boolean;requiresArea:boolean;originLabel?:string};
type ShippingRate={courierCode:string;courierName:string;serviceCode:string;serviceName:string;priceIdr:number;duration?:string;estimateOnly?:boolean;quoteId?:string};
const chatUrl='https://chatvice.app/widget/m_d74410c444e2726c';
const validRegion=(raw:unknown):raw is AddressSelection=>{
 if(!raw||typeof raw!=='object')return false;
 const x=raw as Record<string,unknown>;
 return ['provinceId','cityId','districtId','areaId','postalCode','label'].every(k=>typeof x[k]==='string')
   &&/^[0-9]{5}$/.test(String(x.postalCode));
};
function uniquePhotos(product:Product){
 return [...new Set([product.image_url,...(product.gallery_urls||[])].filter((url):url is string=>typeof url==='string'&&url.length>0))];
}
function SectionTabs(){
 const tabs=[['ulasan','Ulasan'],['detail-produk','Detail produk'],['rekomendasi','Rekomendasi']] as const;
 const [active,setActive]=useState('detail-produk');
 useEffect(()=>{
  const observer=new IntersectionObserver(entries=>{
   const visible=entries.filter(x=>x.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
   if(visible)setActive(visible.target.id);
  },{rootMargin:'-150px 0px -42% 0px',threshold:[0,.25,.5]});
  for(const [id] of tabs){const node=document.getElementById(id);if(node)observer.observe(node);}
  return()=>observer.disconnect();
 },[]);
 return <nav className="vpd-tabs" aria-label="Navigasi detail produk">
  {tabs.map(([id,label])=><button type="button" key={id} className={active===id?'is-current':''}
    aria-current={active===id?'location':undefined}
    onClick={()=>{setActive(id);document.getElementById(id)?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}}>
    {label}</button>)}
 </nav>;
}
function ShippingQuote({product,quantity}:{product:Product|null;quantity:number}){
 const auth=useCustomerAuth();
 const [config,setConfig]=useState<ShippingConfig|null>(null);
 const [region,setRegion]=useState<AddressSelection|null>(null);
 const [loading,setLoading]=useState(false);
 const [rates,setRates]=useState<ShippingRate[]>([]);
 const [error,setError]=useState('');
 const [selected,setSelected]=useState('');
 const [restore,setRestore]=useState<AddressSelection|null>(null);
 const request=useRef(0);
 useEffect(()=>{
  let alive=true;
  fetch('/api/shipping/config',{cache:'no-store'}).then(async r=>{
   if(!r.ok)throw Error('Pengaturan pengiriman tidak tersedia');
   return await r.json() as ShippingConfig;
  }).then(x=>{if(alive)setConfig(x)}).catch(e=>{if(alive)setError(e.message)});
  return()=>{alive=false};
 },[]);
 useEffect(()=>{
  if(!auth.user)return;
  try{
   const raw=localStorage.getItem('vapmart.shipping.region.'+auth.user.id);
   if(raw){const parsed:unknown=JSON.parse(raw);if(validRegion(parsed))setRestore(parsed);}
  }catch{}
 },[auth.user?.id]);
 const onRegion=(next:AddressSelection|null)=>{
  request.current++;setRegion(next);setRates([]);setSelected('');setError('');
  if(next&&auth.user)try{localStorage.setItem('vapmart.shipping.region.'+auth.user.id,JSON.stringify(next))}catch{}
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
    if(!response.ok)throw Error(typeof data.message==='string'?data.message:data.code||'Tarif pengiriman tidak tersedia');
    if(ticket!==request.current||controller.signal.aborted)return;
    const choices=(Array.isArray(data.rates)?data.rates:[]) as ShippingRate[];
    choices.sort((a,b)=>a.priceIdr-b.priceIdr);
    setRates(choices);
    if(!choices.length)setError('Belum ada layanan kurir yang tersedia untuk alamat ini.');
   }catch(e){if(!controller.signal.aborted&&ticket===request.current)setError(e instanceof Error?e.message:'Cek ongkir gagal');}
   finally{if(ticket===request.current&&!controller.signal.aborted)setLoading(false);}
  },320);
  return()=>{clearTimeout(timer);controller.abort();request.current++};
 },[region,product?.id,product?.weight_grams,product?.stock_qty,product?.is_active,quantity,config?.requiresArea,config?.rateLookupEnabled,auth.accessToken]);
 const address=typeof auth.user?.user_metadata?.address_line==='string'?auth.user.user_metadata.address_line.trim():'';
 const chosenRate=rates.find(x=>selected===x.courierCode+':'+x.serviceCode);
 return <div className="vpd-shipping-body">
  {config?.originLabel&&<p className="vpd-soft">Asal pengiriman: {config.originLabel}</p>}
  {!auth.user?<div className="vpd-shipping-empty">
   <p>Masuk untuk menggunakan alamat akun dan melihat tarif kurir yang tersedia.</p>
   <Link className="vpd-secondary-link" href="/login?next=/akun">Masuk Akun</Link>
  </div>:<>
   <p className="vpd-soft">Alamat akun: <strong>{address||'Belum tersimpan'}</strong></p>
   {!address&&<Link href="/akun" className="vpd-secondary-link">Lengkapi alamat di Akun Saya</Link>}
   <p className="vpd-soft">Pilih wilayah tujuan yang sesuai dengan alamat Anda. Data wilayah disimpan pada perangkat ini untuk pemeriksaan ongkir berikutnya.</p>
   <IndonesiaAddressPicker onChange={onRegion} initialValue={restore||undefined}/>
   {region&&<p className="vpd-region-selected">Tujuan: {region.label}</p>}
   {product&&!product.weight_grams&&<p role="status" className="vpd-notice">Berat produk belum dilengkapi penjual. Ongkir belum dapat dihitung.</p>}
   {config&&!config.rateLookupEnabled&&<p className="vpd-notice">Cek ongkir real-time belum aktif. Biaya final akan diperiksa di checkout bila layanan tersedia.</p>}
   {!auth.user.email_confirmed_at&&<p className="vpd-notice">Verifikasi email diperlukan sebelum cek ongkir live.</p>}
   {loading&&<p role="status" className="vpd-notice">Menghitung ongkir dari provider…</p>}
   {error&&<p role="alert" className="vpd-notice">{error}</p>}
   {rates.length>0&&<div role="radiogroup" aria-label="Opsi layanan pengiriman" className="vpd-rates">
    {rates.map(rate=>{
     const id=rate.courierCode+':'+rate.serviceCode;
     return <label key={id} className={selected===id?'is-selected':''}>
      <input type="radio" name="vpd-shipping-rate" value={id} checked={selected===id} onChange={()=>setSelected(id)}/>
      <span><strong>{rate.courierName} · {rate.serviceName}</strong>
       <small>{rate.duration||'Estimasi tiba diberikan kurir saat checkout'}</small></span>
      <b>{formatIDR(rate.priceIdr)}</b>
     </label>;
    })}
   </div>}
   {chosenRate&&<p role="status" className="vpd-notice">Estimasi {chosenRate.courierName}: {formatIDR(chosenRate.priceIdr)}. Pilihan kurir dan tarif final dikonfirmasi ulang ketika checkout.</p>}
  </>}
 </div>;
}
function ReviewRecommendations({items}:{items:Product[]}){
 return <section className="vpd-reco" id="rekomendasi" aria-labelledby="vpd-reco-title">
  <div className="vpd-section-heading"><h2 id="vpd-reco-title">Mungkin kamu suka ini</h2><Link href="/catalog">Lihat katalog</Link></div>
  {items.length?<div className="vpd-reco-grid">{items.map(p=>{
   const discounted=p.product_type!=='variable'&&p.promo_active&&typeof p.regular_price_idr==='number'&&p.regular_price_idr>p.price_idr;
   return <article key={p.id} className="vpd-reco-item">
    <Link href={'/product/'+encodeURIComponent(p.slug)} className="vpd-reco-image">
     {p.image_url?<img src={p.image_url} alt={p.name} width={380} height={380} loading="lazy"/>:
      <span className="vpd-reco-empty">Vapmart</span>}
     {p.stock_qty<=0&&<span className="vpd-reco-soldout">Stok Habis</span>}
    </Link>
    <Link className="vpd-reco-name" href={'/product/'+encodeURIComponent(p.slug)}>{p.name}</Link>
    <div className="vpd-reco-prices">
     <strong>{p.price_idr>0?formatIDR(p.price_idr):'Harga belum tersedia'}</strong>
     {discounted&&<del>{formatIDR(p.regular_price_idr!)}</del>}
    </div>
   </article>;
  })}</div>:<p className="vpd-soft">Belum ada rekomendasi produk lain yang tersedia.</p>}
 </section>;
}
function ProductDetailExperienceInner({product,recommended}:{product:Product;recommended:Product[]}){
 const router=useRouter(),cart=useCart();
 const [selection,setSelection]=useState<Record<string,string>>({});
 const [quantity,setQuantity]=useState(1);
 const [sheet,setSheet]=useState<Sheet>(null);
 const [intent,setIntent]=useState<Intent>('cart');
 const [expanded,setExpanded]=useState(false);
 const [notice,setNotice]=useState('');
 const defs=product.attributes||[];
 const variable=product.product_type==='variable';
 const variants=product.variants||[];
 const chosen=useMemo(()=>variable?variants.find(v=>defs.every(d=>selection[d.name]&&v.option_values?.[d.name]===selection[d.name]))||null:product,
  [variable,variants,defs,selection,product]);
 const optionsAvailable=(attribute:string,value:string)=>variants.some(v=>v.is_active&&v.option_values?.[attribute]===value&&defs.every(d=>d.name===attribute||!selection[d.name]||v.option_values?.[d.name]===selection[d.name]));
 const chosenImage=chosen?.image_url||product.image_url;
 const active=chosen?{...chosen,parent_slug:variable?product.slug:undefined,brand_name:product.brand_name}:null;
 const canBuy=Boolean(active&&active.is_active&&active.available!==false&&active.stock_qty>=quantity&&active.price_idr>0);
 const isDiscounted=Boolean(chosen&&chosen.promo_active&&chosen.regular_price_idr&&chosen.regular_price_idr>chosen.price_idr);
 const imageList=uniquePhotos(product);
 useEffect(()=>{setQuantity(1);setNotice('');},[selection]);
 useEffect(()=>{
  if(!sheet)return;
  const before=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const onEscape=(e:KeyboardEvent)=>{if(e.key==='Escape')setSheet(null)};
  window.addEventListener('keydown',onEscape);
  return()=>{document.body.style.overflow=before;window.removeEventListener('keydown',onEscape)};
 },[sheet]);
 function purchase(type:Intent){
  setNotice('');
  if(!chosen){setIntent(type);setSheet('variants');return;}
  if(!canBuy){setNotice(chosen.stock_qty<=0?'Stok habis.':'Produk, harga, atau jumlah belum tersedia.');return;}
  if(!active)return;
  cart.add(active,quantity);
  setSheet(null);
  if(type==='buy'){
   cart.setQuantity(active.id,quantity);
   cart.setOpen(false);
   router.push('/checkout?buyNow='+encodeURIComponent(active.id));
  }else{setNotice(quantity+' produk ditambahkan ke keranjang.');}
 }
 function openChat(){
  const care=window as Window & {chatvice?:{open:()=>void}};
  if(care.chatvice?.open){care.chatvice.open();return;}
  window.open(chatUrl,'_blank','noopener,noreferrer');
 }
 const priceText=chosen?chosen.price_idr>0?formatIDR(chosen.price_idr):'Harga belum ditetapkan':
  product.price_idr>0?formatIDR(product.price_idr)+(product.price_max_idr&&product.price_max_idr>product.price_idr?' – '+formatIDR(product.price_max_idr):''):'Pilih varian untuk melihat harga';
 return <main className="vm-detail-page vpd-page" data-product-detail-upgrade="v2">
  <div className="vpd-top">
   <div className="vpd-gallery">
    {imageList.length?<ArchiveGallery images={imageList} title={product.name}/>:
      <div className="vpd-photo-placeholder" role="img" aria-label={'Foto '+product.name+' belum tersedia'}>VAPMART</div>}
   </div>
   <div className="vpd-hero-content">
    <nav aria-label="Breadcrumb" className="vpd-breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/catalog">Produk</Link></nav>
    <div className="vpd-price-row" aria-live="polite"><strong className="vpd-selling-price">{priceText}</strong>
     {isDiscounted&&<del>{formatIDR(chosen!.regular_price_idr!)}</del>}
     {chosen&&!chosen.price_idr&&<span className="vpd-muted">Hubungi admin untuk harga</span>}
    </div>
    <div className="vpd-title-row">
     <h1>{product.name}</h1>
     <FavoriteButton id={product.id} name={product.name} className="vm-cp17-detail-favorite vpd-heart"/>
    </div>
    {product.brand_name&&<div className="vpd-brand">
      {product.brand_logo_url&&<img src={product.brand_logo_url} alt="" width={32} height={32}/>}
      <span>{product.brand_name}</span>
     </div>}
    {variable&&<button type="button" className="vpd-info-row" onClick={()=>{setIntent('cart');setSheet('variants');}}
      aria-haspopup="dialog"><span><strong>Pilih varian</strong><small>{chosen?defs.map(d=>selection[d.name]).join(' · '):defs.map(d=>d.name).join(' · ')}</small></span><Icon name="next"/></button>}
    <button type="button" className="vpd-info-row" onClick={()=>setSheet('shipping')} aria-haspopup="dialog">
      <span><strong>Pengiriman</strong><small>Cek ongkir dan layanan kurir sesuai alamat</small></span><Icon name="next"/>
    </button>
    <div className="vpd-inventory">
     {chosen?<span className={chosen.stock_qty>0?'':'vpd-sold-out'}>{chosen.stock_qty>0?'Stok tersedia: '+chosen.stock_qty:'Stok Habis'}</span>:<span>Pilih kombinasi varian untuk melihat stok.</span>}
     {chosen?.sku&&<small>SKU {chosen.sku}</small>}
    </div>
    {notice&&<p className="vpd-notice" role="status">{notice}</p>}
   </div>
  </div>
  <SectionTabs/>
  <div className="vpd-sections">
   <section id="ulasan" className="vpd-review-section" aria-label="Ulasan pembeli">
    <CatalogPublicReviews slug={product.slug}/>
   </section>
   <section id="detail-produk" className="vpd-details" aria-labelledby="vpd-details-title">
    <div className="vpd-section-heading"><h2 id="vpd-details-title">Detail produk</h2></div>
    <h3>Spesifikasi</h3>
    <dl>
     {product.brand_name&&<><dt>Merek</dt><dd>{product.brand_name}</dd></>}
     <dt>Kategori</dt><dd>{product.category}</dd>
     {product.sku&&<><dt>SKU</dt><dd>{product.sku}</dd></>}
     {product.weight_grams&&<><dt>Berat</dt><dd>{product.weight_grams} g</dd></>}
     {product.length_cm&&product.width_cm&&product.height_cm&&<><dt>Dimensi</dt><dd>{product.length_cm} × {product.width_cm} × {product.height_cm} cm</dd></>}
     {defs.map(d=><><dt key={'d-'+d.name}>{d.name}</dt><dd key={'v-'+d.name}>{d.values.join(', ')}</dd></>)}
    </dl>
    <h3>Deskripsi</h3>
    {product.description?<><p className={expanded?'vpd-description is-expanded':'vpd-description'}>{product.description}</p>
      {product.description.length>170&&<button type="button" className="vpd-text-expand" onClick={()=>setExpanded(x=>!x)} aria-expanded={expanded}>{expanded?'Sembunyikan':'Selengkapnya'}</button>}</>:
      <p className="vpd-soft">Deskripsi produk belum tersedia.</p>}
   </section>
   <ReviewRecommendations items={recommended}/>
  </div>
  <div className="vpd-purchase-bar" role="group" aria-label="Tindakan pembelian">
   <button type="button" className="vpd-chat" onClick={openChat} title="Chat Vapmart Care" aria-label="Chat Vapmart Care"><Icon name="whatsapp"/></button>
   <button type="button" className="vpd-buy" disabled={Boolean(chosen&&!canBuy)} onClick={()=>purchase('buy')}>Beli Sekarang</button>
   <button type="button" className="vpd-add" disabled={Boolean(chosen&&!canBuy)} onClick={()=>purchase('cart')}>+ Keranjang</button>
  </div>
  {sheet&&<div className="vpd-sheet-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSheet(null)}}>
   <section role="dialog" aria-modal="true" aria-label={sheet==='variants'?'Pilih varian':'Detail pengiriman'} className="vpd-bottom-sheet">
    <header className="vpd-sheet-header">
     <h2>{sheet==='variants'?'Pilih varian':'Detail pengiriman'}</h2>
     <button type="button" onClick={()=>setSheet(null)} aria-label="Tutup panel">×</button>
    </header>
    {sheet==='variants'?<>
      <div className="vpd-sheet-body">
       <div className="vpd-variant-head">
        {chosenImage?<img src={chosenImage} width={90} height={90} alt={product.name}/>:<div className="vpd-variant-image-empty">V</div>}
        <div><strong className="vpd-variant-price">{priceText}</strong>
         {isDiscounted&&<del>{formatIDR(chosen!.regular_price_idr!)}</del>}
         <small>{chosen?chosen.stock_qty>0?'Stok '+chosen.stock_qty:'Stok habis':'Pilih varian untuk melihat harga dan stok'}</small></div>
       </div>
       {defs.map(d=><fieldset key={d.name} className="vpd-option-group">
        <legend>{d.name}: <strong>{selection[d.name]||'Belum dipilih'}</strong></legend>
        <div className="vpd-option-list">{d.values.map(v=>{
          const available=optionsAvailable(d.name,v);
          return <button key={v} type="button" disabled={!available} className={selection[d.name]===v?'is-selected':''}
            aria-pressed={selection[d.name]===v}
            onClick={()=>setSelection(prev=>({...prev,[d.name]:v}))}>{v}</button>;
        })}</div>
       </fieldset>)}
       <div className="vpd-quantity">
        <div><strong>Jumlah</strong><small>{chosen?.stock_qty?chosen.stock_qty+' tersedia':'Stok mengikuti varian'}</small></div>
        <div className="vpd-counter">
         <button type="button" aria-label="Kurangi jumlah" disabled={quantity<=1} onClick={()=>setQuantity(x=>Math.max(1,x-1))}>−</button>
         <output aria-label="Jumlah produk">{quantity}</output>
         <button type="button" aria-label="Tambah jumlah" disabled={!chosen||quantity>=Math.min(chosen.stock_qty,99)}
          onClick={()=>setQuantity(x=>Math.min(Math.max(1,chosen?.stock_qty||1),99,x+1))}>+</button>
        </div>
       </div>
       {notice&&<p className="vpd-notice" role="status">{notice}</p>}
      </div>
      <div className="vpd-sheet-purchase">
       <button type="button" className="vpd-buy" disabled={!canBuy} onClick={()=>purchase('buy')}>Beli Sekarang</button>
       <button type="button" className="vpd-add" disabled={!canBuy} onClick={()=>purchase('cart')}>+ Keranjang</button>
      </div>
    </>:<ShippingQuote product={chosen} quantity={quantity}/>}
   </section>
  </div>}
 </main>;
}
export function ProductDetailExperience(props:{product:Product;recommended:Product[]}){
 return <ProductDetailExperienceInner {...props}/>;
}
