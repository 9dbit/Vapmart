import Link from 'next/link';
import {ProductGrid} from '@/components/product-grid';
import {getProducts} from '@/lib/api';
import {HeroCarousel} from '@/components/hero-carousel';

export const dynamic='force-dynamic';

const categoryTiles=[
  {slug:'brand',name:'Brand',image:'/legacy/categories/brand.png',href:'/#brand'},
  {slug:'pod',name:'Pod',image:'/legacy/categories/pod.png',href:'/#shop'},
  {slug:'mod',name:'Mod',image:'/legacy/categories/mod.png',href:'/#shop'},
  {slug:'cartridge',name:'Cartridge',image:'/legacy/categories/cartridge.png',href:'/#shop'},
  {slug:'liquid',name:'Liquid',image:'/legacy/categories/liquid.png',href:'/#shop'}
];

const brandLogos=[
  'OXVA','FOOM','IQOS','INTO','JOIWAY','SP2S',
  'LANAVAPE','E-SUPER','ROLV','LIQUID CULT','TAZE','SEVEN LIQUID'
];

export default async function Home({searchParams}:{searchParams:Promise<{category?:string;q?:string}>}){
  const {category,q}=await searchParams;
  const initialSearch=typeof q==='string'?q.slice(0,80):'';
  const selectedCategory=typeof category==='string'&&['home','lifestyle','decor','accessories','electronics','other'].includes(category)?category:'all';
  const products=await getProducts();
  return <main className="legacy-home" id="home"><HeroCarousel />
    <div className="main-container vm-legacy-benefits"><img src="/legacy/banners/benefits-cta.png" alt="Benefit belanja Vapmart pada website existing" width={4300} height={241}/></div>
    <section className="main-container legacy-categories" id="categories">
      <div className="legacy-section-title"><h1>Kategori Produk</h1><span>Jelajahi kategori</span></div>
      <div className="legacy-category-tiles">
        {categoryTiles.map(tile=><Link key={tile.slug} className="legacy-category-tile" href={tile.href}>
          <span className="legacy-category-icon vm-category-photo"><img src={tile.image} alt="" width={1080} height={1080} loading="lazy" /></span>
          <strong>{tile.name}</strong>
        </Link>)}
      </div>
    </section>
    <section className="main-container legacy-promo" id="promo">
      <div className="legacy-section-title"><h2>Promo</h2><span>Benefit belanja Vapmart</span></div>
      <div className="legacy-promo-tiles">
        <Link className="legacy-promo-main" href="/#shop">
          <span className="legacy-promo-label">PILIHAN VAPMART</span>
          <strong>Temukan Produk Pilihan</strong>
          <span>Lihat katalog terbaru <span aria-hidden="true">→</span></span>
        </Link>
        <a className="legacy-promo-member" href="#member">
          <span className="legacy-promo-label">MEMBER</span>
          <strong>Member</strong>
          <span>Informasi benefit anggota <span aria-hidden="true">→</span></span>
        </a>
        <div className="legacy-promo-points" id="member">
          <span className="legacy-promo-label">VAPMART POINTS</span>
          <strong>0 <span>Points</span></strong>
          <span className="legacy-points-note">Program rewards belum aktif di staging</span>
        </div>
      </div>
    </section>
    <section className="main-container legacy-partners" id="brand">
      <div className="legacy-section-title"><h2>Brand Partner</h2><Link href="/#shop">Lihat Semua <span aria-hidden="true">→</span></Link></div>
      <div className="vm-brand-logos" aria-label="Logo brand partner dari website Vapmart existing">
        {brandLogos.map((name,index)=><div className="vm-brand-logo" key={name} title={name}>
          <img src={'/legacy/brands/brand-'+String(index+1).padStart(2,'0')+'.png'} alt={'Logo '+name} width={100} height={100} loading="lazy" />
        </div>)}
      </div>
    </section>
    <div className="main-container legacy-product-wrapper">
      <ProductGrid key={selectedCategory} products={products} initialCategory={selectedCategory} initialTerm={initialSearch}/>
    </div>
    <section className="main-container legacy-news" id="news">
      <div className="legacy-section-title"><h2>News</h2><span>Informasi dari Vapmart</span></div>
      <div className="legacy-news-grid">
        <article className="legacy-news-card"><span className="legacy-news-thumbnail">VM</span><div><small>UPDATE</small><h3>Informasi terbaru Vapmart</h3><p>Konten baru akan tersedia setelah proses pembaruan marketplace selesai.</p></div></article>
        <article className="legacy-news-card"><span className="legacy-news-thumbnail">VM</span><div><small>PANDUAN</small><h3>Panduan belanja</h3><p>Informasi pemesanan akan dipublikasikan setelah checkout siap digunakan.</p></div></article>
        <article className="legacy-news-card"><span className="legacy-news-thumbnail">VM</span><div><small>MEMBER</small><h3>Program anggota</h3><p>Informasi poin dan benefit akan diumumkan setelah layanan anggota aktif.</p></div></article>
      </div>
    </section>
  </main>;
}
