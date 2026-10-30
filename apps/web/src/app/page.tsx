import Link from 'next/link';
import {getProducts} from '@/lib/api';
import {HeroCarousel} from '@/components/hero-carousel';
import {ParallaxAmbient} from '@/components/parallax-ambient';
import {ProductGrid} from '@/components/product-grid';
import {archivedNews} from '@/lib/archived-reference';
import {featuredArchiveItems} from '@/lib/archive-catalog';
import {ArchiveCard} from '@/components/archive-card';

export const dynamic='force-dynamic';

const categories=[
 {name:'Brand',image:'/legacy/categories/brand.png',href:'/brand-partner'},
 {name:'Pod',image:'/legacy/categories/pod.png',href:'/product-category/pod'},
 {name:'Mod',image:'/legacy/categories/mod.png',href:'/product-category/mod'},
 {name:'Cartridge',image:'/legacy/categories/cartridge.png',href:'/product-category/cartridge'},
 {name:'Liquid',image:'/legacy/categories/liquid.png',href:'/product-category/e-juice'}
] as const;
const brands=['OXVA','FOOM','IQOS','INTO','JOIWAY','SP2S','LANAVAPE','E-SUPER','ROLV','LIQUID CULT','TAZE','SEVEN LIQUID'];

export default async function Home(){
  const products=await getProducts();
  const verifiedProducts=products.filter(p=>!p.slug.startsWith('demo-'));
  return <main className="legacy-home vm-reference-home vm-trendora-home" id="home" data-vapmart-ui="cp16">
    <section className="main-container vm-home-intro" aria-label="Selamat datang di Vapmart">
      <div className="vm-home-intro-row">
        <div>
          <p className="vm-trendora-eyebrow"><span className="vm-trendora-spark" aria-hidden="true">✳</span> VAPMART / DISCOVER</p>
          <h1>Find your next favorite.</h1>
          <p className="vm-home-subtitle">Jelajahi koleksi, temukan inspirasi, dan nikmati pengalaman Vapmart yang baru.</p>
        </div>
        <Link href="/catalog" className="vm-home-discover">Explore collection <span aria-hidden="true">↗</span></Link>
      </div>
      <form className="vm-home-quicksearch" action="/catalog" role="search">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.7" cy="10.7" r="6.7"/><path d="m16 16 5 5"/></svg>
        <label className="sr-only" htmlFor="vm-home-q">Cari di Vapmart</label>
        <input type="search" id="vm-home-q" name="q" placeholder="Cari produk, kategori, brand..." maxLength={80} autoComplete="off"/>
        <button type="submit" aria-label="Cari produk">Cari <span aria-hidden="true">↗</span></button>
      </form>
    </section>

    <div className="vm-hero-stage vm-trendora-hero">
      <ParallaxAmbient />
      <HeroCarousel />
    </div>

    <section className="main-container vm-trendora-categories" id="categories">
      <div className="vm-trendora-section-heading">
        <div><span className="vm-trendora-eyebrow">EXPLORE MORE</span><h2>Kategori</h2></div>
        <Link href="/catalog" className="vm-trendora-see-all">Lihat semua <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="vm-trendora-category-grid">
        {categories.map(item=><Link href={item.href} key={item.name} className="vm-trendora-category" aria-label={'Lihat kategori '+item.name}>
          <span className="vm-trendora-category-image"><img src={item.image} width={1080} height={1080} alt="" loading="eager"/></span>
          <span className="vm-trendora-category-title">{item.name}</span>
        </Link>)}
      </div>
    </section>

    {verifiedProducts.length>0?
      <div className="main-container vm-active-products vm-trendora-featured">
        <ProductGrid products={verifiedProducts}/>
      </div>
    :<section className="main-container vm-reference-products vm-trendora-featured" id="shop" aria-label="Referensi koleksi Vapmart">
      <div className="vm-trendora-section-heading vm-ref-section-head">
        <div><span className="vm-trendora-eyebrow">HANDPICKED FOR YOU</span><h2>Featured Products</h2></div>
        <Link href="/catalog" className="vm-trendora-see-all">Lihat katalog <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="vm-reference-grid">
        {featuredArchiveItems.map(item=><ArchiveCard item={item} key={item.slug}/>)}
      </div>
      <p className="vm-reference-disclaimer">Produk pada galeri ini adalah arsip visual. Harga ditampilkan sebagai referensi historis dan tidak menerima transaksi. <Link href="/catalog">Buka katalog ↗</Link></p>
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
      <div className="vm-brand-logos" aria-label="Logo brand dari website Vapmart original">
        {brands.map((brand,index)=><div className="vm-brand-logo" key={brand} title={brand}><img src={'/legacy/brands/brand-'+String(index+1).padStart(2,'0')+'.png'} width="100" height="100" alt={'Logo '+brand} loading="lazy"/></div>)}
      </div>
    </section>

    <section className="main-container vm-ref-news vm-trendora-news" id="news">
      <div className="vm-trendora-section-heading">
        <div><span className="vm-trendora-eyebrow">THE JOURNAL</span><h2>Inspirasi & News</h2></div>
        <Link href="/#news" className="vm-trendora-see-all">Explore stories <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="vm-reference-news-grid">
        {archivedNews.map(article=><article className="vm-reference-news-card" key={article.image}>
          <img src={article.image} alt="" width="300" height="169" loading="lazy"/>
          <div>{article.title}</div>
        </article>)}
      </div>
    </section>
    <p className="main-container vm-archive-end-note">Preview desain Vapmart. Konten arsip ditampilkan untuk peninjauan visual, bukan penawaran aktif.</p>
  </main>;
}
