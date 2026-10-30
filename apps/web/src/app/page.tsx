import Link from 'next/link';
import {getProducts} from '@/lib/api';
import {HeroCarousel} from '@/components/hero-carousel';
import {ParallaxAmbient} from '@/components/parallax-ambient';
import {ProductGrid} from '@/components/product-grid';
import {archivedNews} from '@/lib/archived-reference';
import {featuredArchiveItems} from '@/lib/archive-catalog';
import {ArchiveCard} from '@/components/archive-card';
import {homepageCategoryTiles} from '@/lib/merchandising';
import {BrandRail} from '@/components/brand-rail';

export const dynamic='force-dynamic';

export default async function Home(){
  const products=await getProducts();
  const verifiedProducts=products.filter(p=>!p.slug.startsWith('demo-'));
  return <main className="legacy-home vm-reference-home vm-trendora-home" id="home" data-vapmart-ui="cp22">
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
        {homepageCategoryTiles.map(item=><Link href={item.href} key={item.name} className="vm-trendora-category" aria-label={'Lihat kategori '+item.name}>
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
      <BrandRail />
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
