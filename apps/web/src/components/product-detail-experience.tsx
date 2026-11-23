'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {flushSync} from 'react-dom';
import {useCart} from '@/lib/cart';
import {formatIDR,type Product} from '@/lib/types';
import {ProductDetailGallery} from '@/components/product-detail-gallery';
import {ProductReviewSummary} from '@/components/product-review-summary';
import {FavoriteButton} from '@/components/favorite-button';
import {CatalogPublicReviews} from '@/components/catalog-public-reviews';
import {ShippingQuote} from '@/components/shipping-quote';
import {ShippingEmblem} from '@/components/shipping-emblem';
import {Icon} from '@/components/store-icon';

type Sheet='variants'|'shipping'|null;
type Intent='cart'|'buy';
const chatUrl='https://chatvice.app/widget/m_d74410c444e2726c';
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
 const galleryImages=[...new Set([chosen?.image_url,...imageList].filter((url):url is string=>typeof url==='string'&&url.trim().length>0))].slice(0,10);
 const discountPercent=isDiscounted&&chosen?.regular_price_idr?Math.round((1-chosen.price_idr/chosen.regular_price_idr)*100):0;
 useEffect(()=>{setQuantity(1);setNotice('');},[selection]);
 useEffect(()=>{
  if(!sheet)return;
  const node=document.querySelector<HTMLElement>('.vpd-bottom-sheet');
  const previouslyFocused=document.activeElement instanceof HTMLElement?document.activeElement:null;
  node?.querySelector<HTMLButtonElement>('[aria-label="Tutup panel"]')?.focus();
  const before=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const onEscape=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){setSheet(null);return;}
   if(e.key!=='Tab'||!node)return;
   const focusable=Array.from(node.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]'))
    .filter(x=>x.getClientRects().length>0);
   if(!focusable.length)return;
   const first=focusable[0],last=focusable[focusable.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  window.addEventListener('keydown',onEscape);
  return()=>{document.body.style.overflow=before;window.removeEventListener('keydown',onEscape);previouslyFocused?.focus();};
 },[sheet]);
 function purchase(type:Intent){
  setNotice('');
  if(!chosen){setIntent(type);setSheet('variants');return;}
  if(!canBuy){setNotice(chosen.stock_qty<=0?'Stok habis.':'Produk, harga, atau jumlah belum tersedia.');return;}
  if(!active)return;
  if(type==='buy'){
   // Commit the selected product and quantity before client-side navigation.
   // WebKit can otherwise render checkout ahead of a batched cart update.
   flushSync(()=>{
    cart.add(active,quantity);
    cart.setQuantity(active.id,quantity);
    cart.setOpen(false);
    setSheet(null);
   });
   router.push('/checkout?buyNow='+encodeURIComponent(active.id)+'&qty='+quantity);
  }else{
   cart.add(active,quantity);
   setSheet(null);
   setNotice(quantity+' produk ditambahkan ke keranjang.');
  }
 }
 function openChat(){
  const care=window as Window & {chatvice?:{open:()=>void}};
  if(care.chatvice?.open){care.chatvice.open();return;}
  window.open(chatUrl,'_blank','noopener,noreferrer');
 }
 const priceText=chosen?chosen.price_idr>0?formatIDR(chosen.price_idr):'Harga belum ditetapkan':
  product.price_idr>0?formatIDR(product.price_idr)+(product.price_max_idr&&product.price_max_idr>product.price_idr?' – '+formatIDR(product.price_max_idr):''):'Pilih varian untuk melihat harga';
 return <main className="vm-detail-page vpd-page" data-product-detail-upgrade="v3">
  <div className="vpd-top">
   <div className="vpd-gallery">
    <ProductDetailGallery images={galleryImages} title={product.name}/>
   </div>
   <div className="vpd-hero-content">
    <nav aria-label="Breadcrumb" className="vpd-breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/catalog">Produk</Link></nav>
    <div className="vpd-price-row" aria-live="polite">
     <strong className="vpd-selling-price">{priceText}</strong>
     {isDiscounted&&<div className="vpd-price-promo">
      {discountPercent>0&&<span className="vpd-discount-label">Hemat {discountPercent}%</span>}
      <del>{formatIDR(chosen!.regular_price_idr!)}</del>
     </div>}
     {chosen&&!chosen.price_idr&&<span className="vpd-muted">Hubungi admin untuk harga</span>}
    </div>
    <div className="vpd-title-row">
     <h1>{product.name}</h1>
     <FavoriteButton id={product.id} name={product.name} className="vm-cp17-detail-favorite vpd-heart"/>
    </div>
    <ProductReviewSummary slug={product.slug}/>
    {product.brand_name&&<div className="vpd-brand">
      {product.brand_logo_url&&<img src={product.brand_logo_url} alt="" width={32} height={32}/>}
      <span>{product.brand_name}</span>
     </div>}
    {variable&&defs.length>0&&<section className="vpd-inline-variants" aria-label="Pilihan varian produk">
     {defs.map(d=><fieldset key={d.name} className="vpd-inline-option-group">
      <legend>{d.name}: <strong>{selection[d.name]||'Pilih '+d.name}</strong></legend>
      <div className="vpd-inline-options">{d.values.map(value=>{
       const available=optionsAvailable(d.name,value);
       return <button type="button" key={value} disabled={!available}
         aria-pressed={selection[d.name]===value}
         className={selection[d.name]===value?'is-selected':''}
         onClick={()=>setSelection(previous=>({...previous,[d.name]:value}))}>{value}</button>;
      })}</div>
     </fieldset>)}
     {!chosen&&<p className="vpd-variant-hint">Pilih varian untuk melihat harga dan ketersediaan.</p>}
    </section>}
    {variable&&defs.length===0&&<button type="button" className="vpd-info-row" onClick={()=>{setIntent('cart');setSheet('variants');}}
     aria-haspopup="dialog"><span><strong>Pilih varian</strong><small>Pilih produk yang tersedia</small></span><Icon name="next"/></button>}
    <button type="button" className="vpd-info-row vpd-delivery-row" onClick={()=>setSheet('shipping')} aria-haspopup="dialog">
     <ShippingEmblem className="vpd-delivery-icon"/>
     <span className="vpd-info-text"><strong>Pengiriman</strong><small>Cek ongkir &amp; estimasi tiba ke alamatmu</small></span>
     <Icon name="next"/>
    </button>
    <div className="vpd-inventory">
     {chosen?<span className={chosen.stock_qty>0?'':'vpd-sold-out'}>{chosen.stock_qty>0?'Stok tersedia: '+chosen.stock_qty:'Stok Habis'}</span>:<span>Pilih kombinasi varian untuk melihat stok.</span>}
     {chosen?.sku&&<small>SKU {chosen.sku}</small>}
    </div>
    {!variable&&chosen&&chosen.stock_qty>0&&chosen.price_idr>0&&<div className="vpd-simple-quantity vpd-quantity">
      <div><strong>Jumlah</strong><small>Maks. {Math.min(chosen.stock_qty,99)} per pesanan</small></div>
      <div className="vpd-counter">
       <button type="button" aria-label="Kurangi jumlah" disabled={quantity<=1} onClick={()=>setQuantity(n=>Math.max(1,n-1))}>−</button>
       <output aria-label="Jumlah produk">{quantity}</output>
       <button type="button" aria-label="Tambah jumlah" disabled={quantity>=Math.min(chosen.stock_qty,99)}
        onClick={()=>setQuantity(n=>Math.min(n+1,chosen.stock_qty,99))}>+</button>
      </div>
     </div>}
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
     {defs.map(d=><div className="vpd-spec-variation" key={d.name}><dt>{d.name}</dt><dd>{d.values.join(', ')}</dd></div>)}
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
   <section role="dialog" aria-modal="true" aria-label={sheet==='variants'?'Pilih varian':'Detail pengiriman'} className={sheet==='shipping'?'vpd-bottom-sheet vpd-shipping-sheet':'vpd-bottom-sheet'}>
    <header className={sheet==='shipping'?'vpd-sheet-header vpd-shipping-header':'vpd-sheet-header'}>
     {sheet==='shipping'&&<button type="button" className="vpd-shipping-close" onClick={()=>setSheet(null)} aria-label="Tutup panel">×</button>}
     <h2>{sheet==='variants'?'Pilih varian':'Detail pengiriman'}</h2>
     {sheet==='variants'&&<button type="button" onClick={()=>setSheet(null)} aria-label="Tutup panel">×</button>}
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
