'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useWishlist} from '@/lib/wishlist';
import {useCustomerAuth} from '@/lib/customer-auth';
import {formatIDR,type Product} from '@/lib/types';
import type {ActiveBrand} from '@/lib/api';
import {Icon} from '@/components/store-icon';
type Tab='produk'|'brand';
function FavoriteHeart({active,label,onClick,disabled=false}:{active:boolean;label:string;onClick:()=>void;disabled?:boolean}){
 return <button type="button" disabled={disabled} onClick={onClick}
  aria-label={active?'Hapus '+label+' dari favorit':'Simpan '+label+' ke favorit'}
  aria-pressed={active} className={active?'vm26-favorite-heart is-saved':'vm26-favorite-heart'}>
  <Icon name="heart"/></button>;
}
export function FavoritesDashboard({products,brands,productsError,brandsError}:{
 products:Product[];brands:ActiveBrand[];productsError?:boolean;brandsError?:boolean;
}){
 const saved=useWishlist(),auth=useCustomerAuth();
 const [tab,setTab]=useState<Tab>('produk');
 const [brandSearch,setBrandSearch]=useState('');
 useEffect(()=>{
  if(new URLSearchParams(window.location.search).get('tab')==='brand')setTab('brand');
 },[]);
 function switchTab(next:Tab){
  setTab(next);
  const url=next==='brand'?'/favorit?tab=brand':'/favorit';
  window.history.replaceState(window.history.state,'',url);
 }
 const productSet=new Set(saved.savedIds);
 const brandSet=new Set(saved.brandIds);
 const favoriteProducts=useMemo(()=>products.filter(p=>p.is_active&&productSet.has(p.id)),[products,saved.savedIds]);
 const favoriteBrands=useMemo(()=>brands.filter(b=>b.is_active&&brandSet.has(b.id)),[brands,saved.brandIds]);
 const otherBrands=useMemo(()=>brands.filter(b=>b.is_active&&!brandSet.has(b.id)),[brands,saved.brandIds]);
 const matchingBrands=favoriteBrands.filter(b=>(b.name+' '+b.description).toLocaleLowerCase('id-ID').includes(brandSearch.toLocaleLowerCase('id-ID')));
 return <main className="vm26-customer-page vm26-favorites" data-page="favorites">
  <div className="vm26-page-head"><div><span className="vm26-eyebrow">VAPMART / FAVORITES</span>
   <h1>Favorit Saya</h1><p>Simpan produk dan brand pilihan untuk ditemukan kembali dengan cepat.</p></div>
   <Link href="/akun" className="vm26-text-link">Akun Saya <Icon name="next"/></Link>
  </div>
  {saved.syncState==='guest'&&<p className="vm26-favorites-hint"><Icon name="user"/>
   <span>Favorit disimpan sementara di browser. <Link href="/login?next=/favorit">Masuk akun</Link> untuk sinkronisasi lintas perangkat.</span></p>}
  {saved.syncState==='loading'&&<p role="status" className="vm26-favorites-hint">Memuat favorit akun…</p>}
  {saved.syncError&&<div role="status" className="vm26-inline-error">{saved.syncError}
   {auth.user&&<button type="button" onClick={saved.reload}>Coba sinkronkan lagi</button>}</div>}
  <div className="vm26-favorite-tabs" role="tablist" aria-label="Kategori favorit">
   <button type="button" role="tab" aria-selected={tab==='produk'} className={tab==='produk'?'is-current':''}
    onClick={()=>switchTab('produk')}><Icon name="heart"/>Produk Favorit <span>{saved.savedIds.length}</span></button>
   <button type="button" role="tab" aria-selected={tab==='brand'} className={tab==='brand'?'is-current':''}
    onClick={()=>switchTab('brand')}><Icon name="store"/>Brand Favorit <span>{saved.brandIds.length}</span></button>
  </div>
  {tab==='produk'?<section role="tabpanel" aria-label="Produk Favorit">
   {productsError?<div className="vm26-empty" role="alert"><h2>Katalog sedang tidak tersedia</h2>
    <p>Favorit tetap tercatat. Coba lagi ketika layanan produk sudah tersedia.</p>
    <Link href="/catalog" className="vm26-secondary">Buka katalog</Link></div>:
    favoriteProducts.length>0?<div className="vm26-fav-products">
      {favoriteProducts.map(p=><article className="vm26-fav-product" key={p.id}>
       <div className="vm26-fav-product-visual">
        <Link href={'/product/'+encodeURIComponent(p.slug)}>
         {p.image_url?<img src={p.image_url} alt={p.name} width={320} height={320} loading="lazy" decoding="async"/>:
          <span className="vm26-fav-noimage"><Icon name="bag"/></span>}
         {p.stock_qty<=0&&<small>Stok Habis</small>}
        </Link>
        <FavoriteHeart label={p.name} active={true} disabled={saved.syncState==='loading'} onClick={()=>saved.toggle(p.id)}/>
       </div>
       <Link className="vm26-fav-name" href={'/product/'+encodeURIComponent(p.slug)}>{p.name}</Link>
       <strong className="vm26-fav-price">{p.price_idr>0?formatIDR(p.price_idr):'Harga belum tersedia'}</strong>
      </article>)}
     </div>:<div className="vm26-empty"><Icon name="heart"/><h2>Belum ada produk favorit</h2>
       <p>Ketuk ikon hati pada produk yang kamu suka. Produk tersebut akan muncul di sini.</p>
       <Link href="/catalog" className="vm26-primary">Jelajahi Produk</Link>
      </div>}
   </section>:<section role="tabpanel" aria-label="Brand Favorit">
    {brandsError?<div className="vm26-empty" role="alert"><h2>Brand belum dapat dimuat</h2><p>Daftar favorit tetap tersimpan pada akun.</p></div>:<>
     {favoriteBrands.length>0&&<label className="vm26-brand-search"><Icon name="search"/>
       <input aria-label="Cari brand favorit" placeholder="Cari brand favorit" value={brandSearch}
        onChange={e=>setBrandSearch(e.target.value)} maxLength={80}/></label>}
     {matchingBrands.length>0?<div className="vm26-brand-list">
      {matchingBrands.map(b=><article key={b.id} className="vm26-brand-row">
       <Link href={'/catalog?brand='+encodeURIComponent(b.id)} className="vm26-brand-logo" aria-label={'Lihat produk '+b.name}>
        {b.logo_url?<img src={b.logo_url} width={68} height={68} alt={b.name} loading="lazy"/>:<Icon name="store"/>}
       </Link>
       <div><Link href={'/catalog?brand='+encodeURIComponent(b.id)}>{b.name}</Link>
        <p>{b.description||'Lihat koleksi produk brand ini di Vapmart'}</p></div>
       <FavoriteHeart label={b.name} active={true} disabled={saved.syncState==='loading'} onClick={()=>saved.toggleBrand(b.id)}/>
      </article>)}
     </div>:<div className="vm26-empty"><Icon name="store"/>
      <h2>{brandSearch?'Brand favorit tidak ditemukan':'Belum ada brand favorit'}</h2>
      <p>{brandSearch?'Coba kata kunci lain.':'Pilih brand yang ingin disimpan untuk kunjungan berikutnya.'}</p>
     </div>}
     {otherBrands.length>0&&<div className="vm26-brand-discover">
      <div className="vm26-section-heading"><h2>Jelajahi Brand</h2><Link href="/catalog">Lihat katalog <Icon name="next"/></Link></div>
      <div className="vm26-brand-list">{otherBrands.slice(0,6).map(b=><article key={b.id} className="vm26-brand-row">
       <Link href={'/catalog?brand='+encodeURIComponent(b.id)} className="vm26-brand-logo" aria-label={'Lihat produk '+b.name}>
        {b.logo_url?<img src={b.logo_url} alt={b.name} width={68} height={68} loading="lazy"/>:<Icon name="store"/>}</Link>
       <div><Link href={'/catalog?brand='+encodeURIComponent(b.id)}>{b.name}</Link><p>{b.description||'Koleksi brand Vapmart'}</p></div>
       <FavoriteHeart label={b.name} active={false} disabled={saved.syncState==='loading'} onClick={()=>saved.toggleBrand(b.id)}/>
      </article>)}</div>
     </div>}
    </>}
   </section>}
 </main>;
}
