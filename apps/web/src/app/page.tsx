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
];
const brands=['OXVA','FOOM','IQOS','INTO','JOIWAY','SP2S','LANAVAPE','E-SUPER','ROLV','LIQUID CULT','TAZE','SEVEN LIQUID'];
export default async function Home(){
  const products=await getProducts();
  const verifiedProducts=products.filter(p=>!p.slug.startsWith('demo-'));
  return <main className="legacy-home vm-reference-home" id="home" data-vapmart-ui="cp12">
    <div className="vm-hero-stage">
      <ParallaxAmbient />
      <HeroCarousel />
      <div className="vm-hero-underrail">
        <span className="vm-hero-underrail-status"><i aria-hidden="true"/> VAPMART / NEW EXPERIENCE <span className="vm-subtle-sep">·</span> Preview staging</span>
        <Link href="/catalog" className="vm-hero-underrail-link">Lihat katalog baru <span aria-hidden="true">↗</span></Link>
      </div>
    </div>
    <div className="main-container vm-legacy-benefits"><img src="/legacy/banners/benefits-cta.png" width="4300" height="241" alt="Layanan COD, poin, dan customer care dari website Vapmart lama"/></div>
    <section className="main-container vm-feature-section">
      <div className="vm-feature-panel">
        <div className="vm-feature-categories" id="categories">
          <h2>Jelajahi Kategori</h2>
          <div className="vm-feature-category-list">
            {categories.map(item=><Link href={item.href} key={item.name} className="vm-feature-category" aria-label={'Lihat referensi '+item.name}>
              <span className="vm-feature-category-circle"><img src={item.image} width="1080" height="1080" alt="" loading="eager"/></span>
              <span>{item.name}</span>
            </Link>)}
          </div>
        </div>
        <div className="vm-feature-promo" id="promo">
          <h2>Member & Katalog</h2>
          <Link href="/catalog" className="vm-feature-banner"><span aria-hidden="true">✦</span><span>Katalog baru <small>Produk pengganti sedang disiapkan</small></span><span className="vm-pill-arrow" aria-hidden="true">↗</span></Link>
          <Link href="/member-2" className="vm-member-row" id="member"><span>Member</span><span aria-hidden="true">›</span></Link>
          <div className="vm-feature-points">0 Points</div>
        </div>
      </div>
    </section>
    <section className="main-container vm-ref-brands" id="brand">
      <div className="vm-section-line"><div><span className="vm-section-eyebrow">OUR COLLABORATORS</span><h2>Brand Partner</h2></div><Link href="/brand-partner" className="vm-small-pill-link">Lihat semua <span aria-hidden="true">↗</span></Link></div>
      <div className="vm-brand-logos" aria-label="Logo brand partner dari website original">
        {brands.map((brand,index)=><div className="vm-brand-logo" key={brand} title={brand}><img src={'/legacy/brands/brand-'+String(index+1).padStart(2,'0')+'.png'} width="100" height="100" alt={'Logo '+brand} loading="eager"/></div>)}
      </div>
    </section>
    {verifiedProducts.length>0?
      <div className="main-container vm-active-products">
        <ProductGrid products={verifiedProducts}/>
      </div>
    :<section className="main-container vm-reference-products" id="shop" aria-label="Preview visual katalog WordPress">
      <div className="vm-ref-section-head"><div><span className="vm-section-eyebrow">THE COLLECTION</span><h2>Produk Pilihan</h2></div><Link href="/catalog" className="vm-small-pill-link">Katalog baru <span aria-hidden="true">↗</span></Link></div>
      <div className="vm-reference-grid">
        {featuredArchiveItems.map(item=><ArchiveCard item={item} key={item.slug}/>)}
      </div>
      <p className="vm-reference-disclaimer">Referensi visual dari arsip WordPress 2026. Harga historis, bukan penawaran aktif. Transaksi dinonaktifkan. <Link href="/catalog">Buka katalog pengujian →</Link></p>
    </section>}
    <section className="main-container vm-ref-news" id="news">
      <div className="vm-ref-news-heading"><span/> <h2>Inspirasi & News</h2> <span/></div>
      <div className="vm-reference-news-grid">
        {archivedNews.map((article,index)=><article className="vm-reference-news-card" key={article.image}>
          <img src={article.image} alt="" width="300" height="169" loading="eager"/>
          <div>{article.title}</div>
        </article>)}
      </div>
    </section>
    <p className="main-container vm-archive-end-note">Halaman ini merupakan referensi visual konten WordPress untuk QA staging. Katalog aktif pengganti masih disiapkan.</p>
  </main>;
}
