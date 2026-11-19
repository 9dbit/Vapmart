'use client';
import Link from 'next/link';
import '../app/catalog-store.css';
import {useEffect,useMemo,useRef,useState,type KeyboardEvent} from 'react';
import {useCart} from '@/lib/cart';
import {useWishlist} from '@/lib/wishlist';
import {Icon,type IconName} from './store-icon';
import {FavoriteButton} from '@/components/favorite-button';
import {formatIDR,type Product} from '@/lib/types';

const categoryIcons:Record<string,IconName>={all:'categories',home:'home',accessories:'bag',lifestyle:'star',decor:'decor',electronics:'electronics'};
const sortOptions=[['newest','Terbaru'],['priceLow','Harga terendah'],['priceHigh','Harga tertinggi']] as const;

function ProductCard({product,index}:{product:Product;index:number}){
  const {add}=useCart();
  const soldOut=product.stock_qty<=0,unpriced=product.price_idr<=0,unavailable=product.available===false;
  const canAdd=!soldOut&&!unpriced&&!unavailable;
  return <article className="product-card"><Link href={`/product/${product.slug}`} className={`product-art product-art-${index%4}`} aria-label={`Lihat ${product.name}`}>
    {product.image_url?<img src={product.image_url} alt={product.name} loading="lazy" decoding="async" />:<div className="product-placeholder"><span className="placeholder-spark">✦</span><span>VAPMART OBJECTS</span></div>}
    {soldOut&&<span className="soldout-tag">Stok habis</span>}{!soldOut&&unpriced&&<span className="soldout-tag">Harga menyusul</span>}{!soldOut&&!unpriced&&unavailable&&<span className="soldout-tag">Belum tersedia</span>}
  </Link><FavoriteButton id={product.id} name={product.name} className="vm-cp17-card-favorite"/><div className="product-description"><div className="product-copy"><p className="eyebrow">{product.brand_name?product.brand_name+' · ':''}{product.category}{product.sku?` · SKU ${product.sku}`:''}</p><Link href={`/product/${product.slug}`}><h3>{product.name}</h3></Link><span className="vcs-price">{product.promo_active&&product.product_type!=='variable'&&<del>{formatIDR(product.regular_price_idr||product.price_idr)}</del>}<strong>{unpriced?'Harga belum tersedia':(product.product_type==='variable'?'Mulai ':'')+formatIDR(product.price_idr)}</strong></span></div>{product.product_type==='variable'?<Link href={`/product/${product.slug}`} className="add-circle" aria-label={`Pilih variasi ${product.name}`}><Icon name="plus"/></Link>:<button type="button" disabled={!canAdd} onClick={()=>add(product)} className="add-circle" aria-label={`Tambahkan ${product.name} ke keranjang`}><Icon name="plus"/></button>}</div></article>;
}
const normalize=(value:string)=>value.toLocaleLowerCase('id-ID').trim();
const match=(p:Product,query:string)=>normalize([p.name,p.sku??'',p.brand_name??'',p.description,p.category].join(' ')).includes(query);
export function ProductGrid({products,initialCategory='all',initialTerm=''}:{products:Product[];initialCategory?:string;initialTerm?:string}){
  const [category,setCategory]=useState(initialCategory);
  const [categoryTree,setCategoryTree]=useState<any[]>([]);
  useEffect(()=>{const ac=new AbortController();fetch('/api/catalog/categories',{cache:'no-store',signal:ac.signal}).then(r=>r.ok?r.json():null).then(d=>{if(d?.items)setCategoryTree(d.items)}).catch(()=>{});return()=>ac.abort()},[]);
  const categories=[{value:'all',label:'Semua Pilihan'},...(categoryTree.length?categoryTree.map(c=>({value:c.slug,label:c.name})):Array.from(new Set(products.map(p=>p.category))).map(c=>({value:c,label:c})))];
  const categoryMatch=(p:Product)=>{if(category==='all')return true;const selected=new Set([category]);let added=true;while(added){added=false;for(const c of categoryTree){const parent=categoryTree.find(x=>x.id===c.parent_id);if(parent&&selected.has(parent.slug)&&!selected.has(c.slug)){selected.add(c.slug);added=true;}}}return [p.category,...p.category_slugs||[]].some(c=>selected.has(c));};
  const [term,setTerm]=useState(initialTerm);
  const [sort,setSort]=useState('newest');
  const [searchOpen,setSearchOpen]=useState(Boolean(initialTerm));
  const searchToggle=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(searchOpen)searchRef.current?.focus({preventScroll:true})},[searchOpen]);
  const [favoritesOnly,setFavoritesOnly]=useState(false);
 const [visibleCount,setVisibleCount]=useState(24);
  const {savedIds}=useWishlist();
  const [showSuggestions,setShowSuggestions]=useState(false);
  const [activeSuggestion,setActiveSuggestion]=useState(-1);
  const searchRef=useRef<HTMLInputElement>(null);
  const query=normalize(term);
  const activeProducts=useMemo(()=>products.filter(p=>p.is_active),[products]);
  const suggestions=useMemo(()=>query?activeProducts.filter(p=>match(p,query)).slice(0,5):[],[activeProducts,query]);
  const filtered=useMemo(()=>{
    let result=activeProducts.filter(p=>categoryMatch(p)&&(!query||match(p,query))&&(!favoritesOnly||savedIds.includes(p.id)));
    if(sort==='priceLow')result=[...result].sort((a,b)=>a.price_idr-b.price_idr);
    if(sort==='priceHigh')result=[...result].sort((a,b)=>b.price_idr-a.price_idr);
    return result;
  },[activeProducts,category,query,sort,favoritesOnly,savedIds,categoryTree]);
  useEffect(()=>setVisibleCount(24),[category,query,sort,favoritesOnly]);
  const pick=(p:Product)=>{setTerm(p.name);setCategory('all');setShowSuggestions(false);setActiveSuggestion(-1);searchRef.current?.focus();};
  const reset=()=>{setCategory('all');setTerm('');setSort('newest');setFavoritesOnly(false);setShowSuggestions(false);setActiveSuggestion(-1);searchRef.current?.focus();};
  const onSearchKey=(event:KeyboardEvent<HTMLInputElement>)=>{
    if(event.key==='Escape'){setShowSuggestions(false);setActiveSuggestion(-1);setSearchOpen(false);searchToggle.current?.focus();return;}
    if(!suggestions.length)return;
    if(event.key==='ArrowDown'){event.preventDefault();setShowSuggestions(true);setActiveSuggestion(n=>(n+1)%suggestions.length);}
    if(event.key==='ArrowUp'){event.preventDefault();setShowSuggestions(true);setActiveSuggestion(n=>(n-1+suggestions.length)%suggestions.length);}
    if(event.key==='Enter'&&showSuggestions&&activeSuggestion>=0){event.preventDefault();pick(suggestions[activeSuggestion]!);}
  };
  return <section className="shop-section vm-collection" id="shop">
    <header className="vm-collection-heading"><h2>Produk Pilihan</h2><p>Temukan favorit baru untuk keseharianmu.</p></header>
    <div className="vm-collection-bar">
      <button ref={searchToggle} type="button" className="vm-tool-circle" aria-label="Cari produk" title="Cari produk" aria-expanded={searchOpen}
        aria-controls="vm-search-drawer" onClick={()=>{setSearchOpen(!searchOpen);setShowSuggestions(false)}}><Icon name="search"/></button>
      <button type="button" className="vm-tool-circle vm-favorites-control"
        aria-label="Tampilkan hanya produk favorit" aria-pressed={favoritesOnly}
        title={favoritesOnly?'Nonaktifkan filter favorit':`Favorit (${savedIds.length} tersimpan)`}
        onClick={()=>setFavoritesOnly(value=>!value)}><Icon name="heart"/></button>
      <label className="vm-tool-circle vm-sort-control" data-selected={sort!=='newest'} title={'Urutkan: '+sortOptions.find(([value])=>value===sort)?.[1]}>
        <Icon name="sort"/><select id="sort-products" aria-label="Urutkan produk" value={sort} onChange={e=>setSort(e.target.value)}>
          {sortOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <div className="vm-category-tabs" role="group" aria-label="Filter kategori">
        {categories.map(c=><button type="button" key={c.value} onClick={()=>{setCategory(c.value);setShowSuggestions(false)}} aria-pressed={category===c.value}>
          <Icon name={categoryIcons[c.value]||'tag'}/>{c.label}
        </button>)}
      </div>
    </div>
    <div id="vm-search-drawer" className="vm-search-drawer" hidden={!searchOpen}>
      <div className="vm-search-combobox">
          <label className="sr-only" htmlFor="shop-search">Cari produk atau SKU</label>
          <input ref={searchRef} id="shop-search" className="search" value={term} onChange={e=>{setTerm(e.target.value.slice(0,80));setShowSuggestions(true);setActiveSuggestion(-1)}} onKeyDown={onSearchKey} onFocus={()=>setShowSuggestions(true)} onBlur={()=>window.setTimeout(()=>setShowSuggestions(false),120)} placeholder="Cari produk atau SKU..." autoComplete="off" maxLength={80} role="combobox" aria-autocomplete="list" aria-expanded={showSuggestions&&suggestions.length>0} aria-controls="vm-catalog-suggestions" aria-activedescendant={showSuggestions&&activeSuggestion>=0?`vm-suggestion-${activeSuggestion}`:undefined}/>
          {term&&<button type="button" className="vm-search-clear" onClick={()=>{setTerm('');setShowSuggestions(false);searchRef.current?.focus()}} aria-label="Hapus kata pencarian">×</button>}
          {showSuggestions&&query&&suggestions.length>0&&<ul id="vm-catalog-suggestions" role="listbox" className="vm-search-suggestions">{suggestions.map((p,i)=><li id={`vm-suggestion-${i}`} key={p.id} role="option" aria-selected={activeSuggestion===i}><button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>pick(p)}><span>{p.name}</span><small>{p.sku?`SKU ${p.sku}`:'Produk'} · {formatIDR(p.price_idr)}</small></button></li>)}</ul>}
        </div>
    </div>
    <div className="vm-results-row">
      <div className="results-meta" role="status" aria-live="polite">{filtered.length} produk ditemukan{query?` untuk “${term.trim()}”`:''}</div>
      {(query||category!=='all'||sort!=='newest'||favoritesOnly)&&<div className="vm-cp17-result-actions">
        <button type="button" className="vm-reset-filters" onClick={reset}>Reset filter ×</button>
      </div>}
    </div>
    {filtered.length>0?<><div className="product-grid">{filtered.slice(0,visibleCount).map((p,i)=><ProductCard product={p} key={p.id} index={i}/>)}</div>{visibleCount<filtered.length&&<div className="vcs-more-row"><span>Menampilkan {Math.min(visibleCount,filtered.length)} dari {filtered.length} produk</span><button type="button" className="vcs-show-more" onClick={()=>setVisibleCount(n=>n+24)}>Lihat 24 produk berikutnya</button></div>}</>:<div className="empty-collection" role="status"><div className="empty-illustration" aria-hidden="true">✳</div><h3>{activeProducts.length===0?'Koleksi segera hadir.':favoritesOnly?'Belum ada favorit yang cocok.':'Belum ada produk yang cocok.'}</h3><p>{activeProducts.length===0?'Vapmart sedang menyiapkan koleksi baru.':favoritesOnly?'Gunakan ikon hati di kartu produk untuk menyimpan favorit, atau matikan filter favorit.':'Tidak ada hasil untuk pencarian atau kategori ini. Coba istilah lain atau reset filter.'}</p>{activeProducts.length>0&&<button type="button" className="vm-reset-filters vm-empty-reset" onClick={reset}>Tampilkan semua produk ↗</button>}<Link href="/" className="vm-empty-home">Kembali ke beranda</Link></div>}
  </section>;
}
