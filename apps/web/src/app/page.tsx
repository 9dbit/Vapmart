import Link from 'next/link';
import {getHeroResult} from '@/lib/hero-banners';
import {getProductsResult,getBrandsResult} from '@/lib/api';
import {DataStatus} from '@/components/data-status';
import {HeroCarousel} from '@/components/hero-carousel';
import {ParallaxAmbient} from '@/components/parallax-ambient';
import {ProductGrid} from '@/components/product-grid';
import {ReferenceVisualGrid} from '@/components/reference-visual-grid';
import {archivedNews} from '@/lib/archived-reference';
import {featuredArchiveItems} from '@/lib/archive-catalog';
import {homepageCategoryTiles,brandPartners} from '@/lib/merchandising';
import {BrandRail} from '@/components/brand-rail';
import './restored-home.css';

export const dynamic='force-dynamic';

export default async function Home(){
 const [productResult,brandResult,heroResult]=await Promise.all([getProductsResult(),getBrandsResult(),getHeroResult()]);
 const products=productResult.items,brands=brandResult.items;
 const active=products.filter(p=>p.is_active&&!p.slug.startsWith('demo-'));
 return <main className="legacy-home vm-reference-home vm-trendora-home vm-storefront-restored" id="home" data-vapmart-ui="restored-cp32">
   {heroResult.ok&&heroResult.items.length>0&&<div className="vm-hero-stage vm-trendora-hero">
     <ParallaxAmbient />
     <HeroCarousel slides={heroResult.items}/>
   </div>}
   {!heroResult.ok&&<DataStatus kind="banner" code={heroResult.error}/>}
   {heroResult.items.some(s=>s.reference)&&<p className="main-container vm-restored-media-note">Materi banner terdahulu ditampilkan sebagai referensi visual, bukan penawaran atau promosi aktif. Pembayaran dan pemesanan masih nonaktif.</p>}

   <section className="main-container vm-trendora-categories" id="categories">
     <div className="vm-trendora-section-heading">
       <div><span className="vm-trendora-eyebrow">EXPLORE MORE</span><h2>Kategori</h2></div>
       <Link href="/catalog" className="vm-trendora-see-all">Lihat semua <span aria-hidden="true">↗</span></Link>
     </div>
     <div className="vm-trendora-category-grid">
       {homepageCategoryTiles.map(item=><Link
         href={item.legacy_key==='brand'?'/brand-partner':'/catalog?reference='+encodeURIComponent(item.legacy_key)+'#archive-gallery'}
         key={item.name} className="vm-trendora-category" aria-label={'Lihat referensi kategori '+item.name}>
         <span className="vm-trendora-category-image"><img src={item.image} width={1080} height={1080} alt="" loading="eager"/></span>
         <span className="vm-trendora-category-title">{item.name}</span>
       </Link>)}
     </div>
   </section>

   {!productResult.ok?<DataStatus kind="produk" code={productResult.error}/>:active.length>0?
     <section className="main-container vm-active-products vm-trendora-featured" aria-label="Katalog aktif">
       <ProductGrid products={active}/>
     </section>:
     <section className="main-container vm-reference-products vm-trendora-featured" id="shop" aria-label="Referensi koleksi asli Vapmart">
       <div className="vm-trendora-section-heading vm-ref-section-head">
         <div><span className="vm-trendora-eyebrow">VISUAL ARCHIVE / READ ONLY</span><h2>Featured Products</h2></div>
         <Link href="/catalog#archive-gallery" className="vm-trendora-see-all">Lihat seluruh referensi <span aria-hidden="true">↗</span></Link>
       </div>
       <ReferenceVisualGrid items={featuredArchiveItems}/>
       <p className="vm-reference-disclaimer">Galeri ini hanya dokumentasi tampilan lama. Belum ada SKU, stok, atau harga aktif yang diverifikasi di PostgreSQL; gambar tidak bisa dipesan.</p>
     </section>}

   <section className="main-container vm-trendora-member" id="promo">
     <div className="vm-trendora-member-copy">
       <span className="vm-trendora-eyebrow">THE VAPMART CLUB</span>
       <h2>A little more, just for you.</h2>
       <p>Temukan akun, koleksi, dan fitur member dalam satu tempat.</p>
       <Link id="member" href="/member-2" className="vm-trendora-member-link">Explore member <span aria-hidden="true">↗</span></Link>
     </div>
     <div className="vm-trendora-member-mark" aria-hidden="true">V<span>✳</span></div>
   </section>

   <section className="main-container vm-ref-brands vm-trendora-brands" id="brand">
     <div className="vm-trendora-section-heading vm-section-line">
       <div><span className="vm-trendora-eyebrow">EXPLORE THE NAMES</span><h2>Brand Partner</h2></div>
       <Link href="/brand-partner" className="vm-trendora-see-all">Lihat semua <span aria-hidden="true">↗</span></Link>
     </div>
     {!brandResult.ok?<DataStatus kind="brand" code={brandResult.error}/>:brands.length>0?<BrandRail brands={brands}/>:<div className="vm-brand-rail vm-restored-archived-brands">
       <div className="vm-brand-logos" role="list" aria-label="Logo brand dalam arsip visual">
       {brandPartners.map(item=><div className="vm-brand-logo vm-brand-card" role="listitem" key={item.slug}>
         <span className="vm-brand-stage"><img src={item.image} width={400} height={400} loading="lazy" alt={'Logo referensi '+item.name}/></span>
         <span className="vm-brand-name">{item.name}</span>
       </div>)}
       </div>
       <p className="vm-restored-media-note">Logo dari arsip desain, bukan konfirmasi brand aktif atau ketersediaan produk.</p>
     </div>}
   </section>

   <section className="main-container vm-ref-news vm-trendora-news" id="news">
     <div className="vm-trendora-section-heading">
       <div><span className="vm-trendora-eyebrow">THE JOURNAL</span><h2>Inspirasi &amp; News</h2></div>
       <span className="vm-trendora-see-all">Referensi halaman lama</span>
     </div>
     <div className="vm-reference-news-grid">
       {archivedNews.map((article,index)=><article className="vm-reference-news-card" key={article.image}>
         <img src={article.image} alt="" width={300} height={169} loading="lazy"/>
         <div>Dokumentasi artikel {String(index+1).padStart(2,'0')} · Arsip visual</div>
       </article>)}
     </div>
   </section>
   <p className="main-container vm-archive-end-note">Tampilan Vapmart dipulihkan dari struktur sebelum CP33. Produk arsip dan banner historis adalah referensi visual, bukan stok maupun penawaran yang dapat dibeli.</p>
 </main>;
}
