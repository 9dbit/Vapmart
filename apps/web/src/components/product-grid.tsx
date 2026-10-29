'use client';
import Link from 'next/link';
import {useMemo,useRef,useState,type KeyboardEvent} from 'react';
import {useCart} from '@/lib/cart';
import {categories,formatIDR,type Product} from '@/lib/types';

function ProductCard({product,index}:{product:Product;index:number}){
  const {add}=useCart();
  const soldOut=product.stock_qty<=0;
  return <article className="product-card"><Link href={`/product/${product.slug}`} className={`product-art product-art-${index%4}`} aria-label={`Lihat ${product.name}`}>
    {product.image_url?<img src={product.image_url} alt={product.name} loading="lazy" decoding="async" />:<div className="product-placeholder"><span className="placeholder-spark">✦</span><span>VAPMART OBJECTS</span></div>}
    <span className="product-index">VM / {String(index+1).padStart(2,'0')}</span>{soldOut&&<span className="soldout-tag">Stok habis</span>}
  </Link><div className="product-description"><div className="product-copy"><p className="eyebrow">{product.category}{product.sku?` · SKU ${product.sku}`:''}</p><Link href={`/product/${product.slug}`}><h3>{product.name}</h3></Link><strong>{formatIDR(product.price_idr)}</strong></div><button type="button" disabled={soldOut} onClick={()=>add(product)} className="add-circle" aria-label={`Tambahkan ${product.name} ke keranjang`}>+</button></div></article>;
}
const normalize=(value:string)=>value.toLocaleLowerCase('id-ID').trim();
const match=(p:Product,query:string)=>normalize([p.name,p.sku??'',p.description,p.category].join(' ')).includes(query);
export function ProductGrid({products,initialCategory='all',initialTerm=''}:{products:Product[];initialCategory?:string;initialTerm?:string}){
  const [category,setCategory]=useState(initialCategory);
  const [term,setTerm]=useState(initialTerm);
  const [sort,setSort]=useState('newest');
  const [showSuggestions,setShowSuggestions]=useState(false);
  const [activeSuggestion,setActiveSuggestion]=useState(-1);
  const searchRef=useRef<HTMLInputElement>(null);
  const query=normalize(term);
  const activeProducts=useMemo(()=>products.filter(p=>p.is_active),[products]);
  const suggestions=useMemo(()=>query?activeProducts.filter(p=>match(p,query)).slice(0,5):[],[activeProducts,query]);
  const filtered=useMemo(()=>{
    let result=activeProducts.filter(p=>(category==='all'||p.category===category)&&(!query||match(p,query)));
    if(sort==='priceLow')result=[...result].sort((a,b)=>a.price_idr-b.price_idr);
    if(sort==='priceHigh')result=[...result].sort((a,b)=>b.price_idr-a.price_idr);
    return result;
  },[activeProducts,category,query,sort]);
  const pick=(p:Product)=>{setTerm(p.name);setCategory('all');setShowSuggestions(false);setActiveSuggestion(-1);searchRef.current?.focus();};
  const reset=()=>{setCategory('all');setTerm('');setSort('newest');setShowSuggestions(false);setActiveSuggestion(-1);searchRef.current?.focus();};
  const onSearchKey=(event:KeyboardEvent<HTMLInputElement>)=>{
    if(event.key==='Escape'){setShowSuggestions(false);setActiveSuggestion(-1);return;}
    if(!suggestions.length)return;
    if(event.key==='ArrowDown'){event.preventDefault();setShowSuggestions(true);setActiveSuggestion(n=>(n+1)%suggestions.length);}
    if(event.key==='ArrowUp'){event.preventDefault();setShowSuggestions(true);setActiveSuggestion(n=>(n-1+suggestions.length)%suggestions.length);}
    if(event.key==='Enter'&&showSuggestions&&activeSuggestion>=0){event.preventDefault();pick(suggestions[activeSuggestion]!);}
  };
  return <section className="shop-section" id="shop"><div className="section-heading"><div><p className="eyebrow">KATALOG PENGUJIAN</p><h2>Produk Pilihan</h2></div><p>Jelajahi produk contoh non-nikotin. Keranjang hanya simulasi, checkout belum tersedia.</p></div>
    <div className="shop-toolbar"><div className="category-scroller" role="group" aria-label="Filter kategori">{categories.map(c=><button type="button" key={c.value} className={category===c.value?'category active':'category'} onClick={()=>{setCategory(c.value);setShowSuggestions(false)}} aria-pressed={category===c.value}>{c.label}</button>)}</div>
      <div className="shop-controls">
        <div className="vm-search-combobox">
          <label className="sr-only" htmlFor="shop-search">Cari produk atau SKU</label>
          <input ref={searchRef} id="shop-search" className="search" value={term} onChange={e=>{setTerm(e.target.value.slice(0,80));setShowSuggestions(true);setActiveSuggestion(-1)}} onKeyDown={onSearchKey} onFocus={()=>setShowSuggestions(true)} onBlur={()=>window.setTimeout(()=>setShowSuggestions(false),120)} placeholder="Cari produk atau SKU..." autoComplete="off" maxLength={80} role="combobox" aria-autocomplete="list" aria-expanded={showSuggestions&&suggestions.length>0} aria-controls="vm-catalog-suggestions" aria-activedescendant={showSuggestions&&activeSuggestion>=0?`vm-suggestion-${activeSuggestion}`:undefined}/>
          {term&&<button type="button" className="vm-search-clear" onClick={()=>{setTerm('');setShowSuggestions(false);searchRef.current?.focus()}} aria-label="Hapus kata pencarian">×</button>}
          {showSuggestions&&query&&suggestions.length>0&&<ul id="vm-catalog-suggestions" role="listbox" className="vm-search-suggestions">{suggestions.map((p,i)=><li id={`vm-suggestion-${i}`} key={p.id} role="option" aria-selected={activeSuggestion===i}><button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>pick(p)}><span>{p.name}</span><small>{p.sku?`SKU ${p.sku}`:'Produk demo'} · {formatIDR(p.price_idr)}</small></button></li>)}</ul>}
        </div>
        <label className="sr-only" htmlFor="sort-products">Urutkan</label><select id="sort-products" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Terbaru</option><option value="priceLow">Harga rendah</option><option value="priceHigh">Harga tinggi</option></select>
      </div>
    </div>
    <div className="vm-results-row"><div className="results-meta" role="status" aria-live="polite">{filtered.length} produk ditemukan{query?` untuk “${term.trim()}”`:''}</div>{(query||category!=='all'||sort!=='newest')&&<button type="button" className="vm-reset-filters" onClick={reset}>Reset filter ×</button>}</div>
    {filtered.length>0?<div className="product-grid">{filtered.map((p,i)=><ProductCard product={p} key={p.id} index={i}/>)}</div>:<div className="empty-collection" role="status"><div className="empty-illustration" aria-hidden="true">✳</div><h3>{activeProducts.length===0?'Koleksi segera hadir.':'Belum ada produk yang cocok.'}</h3><p>{activeProducts.length===0?'Vapmart sedang menyiapkan koleksi non-nikotin.':'Tidak ada hasil untuk pencarian atau kategori ini. Coba istilah lain, atau tampilkan semua produk contoh.'}</p>{activeProducts.length>0&&<button type="button" className="vm-reset-filters vm-empty-reset" onClick={reset}>Tampilkan semua produk ↗</button>}<Link href="/" className="vm-empty-home">Kembali ke beranda</Link></div>}
  </section>;
}
