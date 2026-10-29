'use client';
import Link from 'next/link';
import {useMemo,useState} from 'react';
import {useCart} from '@/lib/cart';
import {categories,formatIDR,type Product} from '@/lib/types';

function ProductCard({product,index}:{product:Product;index:number}){
  const {add}=useCart();
  const soldOut=product.stock_qty<=0;
  return <article className="product-card"><Link href={`/product/${product.slug}`} className={`product-art product-art-${index%4}`} aria-label={`Lihat ${product.name}`}>
    {product.image_url?<img src={product.image_url} alt={product.name} loading="lazy" />:<div className="product-placeholder"><span className="placeholder-spark">✦</span><span>VAPMART OBJECTS</span></div>}
    <span className="product-index">VM / {String(index+1).padStart(2,'0')}</span>{soldOut&&<span className="soldout-tag">Sold out</span>}
  </Link><div className="product-description"><div className="product-copy"><p className="eyebrow">{product.category}</p><Link href={`/product/${product.slug}`}><h3>{product.name}</h3></Link><strong>{formatIDR(product.price_idr)}</strong></div><button type="button" disabled={soldOut} onClick={()=>add(product)} className="add-circle" aria-label={`Tambahkan ${product.name} ke keranjang`}>+</button></div></article>;
}

export function ProductGrid({products,initialCategory='all'}:{products:Product[];initialCategory?:string}){
  const [category,setCategory]=useState(initialCategory);
  const [term,setTerm]=useState('');
  const [sort,setSort]=useState('newest');
  const filtered=useMemo(()=>{
    let result=products.filter(p=>p.is_active&&(!category||category==='all'||p.category===category)&&(!term||`${p.name} ${p.description}`.toLowerCase().includes(term.toLowerCase().trim())));
    if(sort==='priceLow')result=[...result].sort((a,b)=>a.price_idr-b.price_idr);
    if(sort==='priceHigh')result=[...result].sort((a,b)=>b.price_idr-a.price_idr);
    return result;
  },[products,category,term,sort]);
  return <section className="shop-section" id="shop"><div className="section-heading"><div><p className="eyebrow">PRODUK PILIHAN</p><h2>Produk Pilihan</h2></div><p>Temukan produk pilihan Vapmart dengan kategori non-nikotin.</p></div>
    <div className="shop-toolbar"><div className="category-scroller" role="group" aria-label="Filter kategori">{categories.map(c=><button key={c.value} className={category===c.value?'category active':'category'} onClick={()=>setCategory(c.value)} aria-pressed={category===c.value}>{c.label}</button>)}</div><div className="shop-controls"><label className="sr-only" htmlFor="shop-search">Cari produk</label><input id="shop-search" className="search" value={term} onChange={e=>setTerm(e.target.value)} placeholder="Cari produk..." /><label className="sr-only" htmlFor="sort-products">Urutkan</label><select id="sort-products" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Terbaru</option><option value="priceLow">Harga rendah</option><option value="priceHigh">Harga tinggi</option></select></div></div>
    <div className="results-meta">{filtered.length} produk ditemukan</div>
    {filtered.length>0?<div className="product-grid">{filtered.map((p,i)=><ProductCard product={p} key={p.id} index={i}/>)}</div>:<div className="empty-collection"><div className="empty-illustration">✳</div><h3>{products.length===0?'Koleksi segera hadir.':'Belum ada produk yang cocok.'}</h3><p>{products.length===0?'Vapmart sedang menyiapkan koleksi non-nikotin. Produk akan tampil otomatis ketika admin mempublikasikannya.':'Coba kata kunci atau kategori lain.'}</p>{products.length>0&&<button className="text-link" onClick={()=>{setCategory('all');setTerm('');}}>Reset filter ↗</button>}</div>}
  </section>;
}
