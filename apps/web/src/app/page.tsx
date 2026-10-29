import Link from 'next/link';
import {ProductGrid} from '@/components/product-grid';
import {getProducts} from '@/lib/api';

export const dynamic='force-dynamic';

const categoryTiles=[
  {slug:'home',name:'Home',glyph:'⌂'},
  {slug:'lifestyle',name:'Lifestyle',glyph:'✧'},
  {slug:'decor',name:'Decor',glyph:'◇'},
  {slug:'accessories',name:'Accessories',glyph:'⊞'},
  {slug:'electronics',name:'Electronics',glyph:'⚡'},
];

export default async function Home({searchParams}:{searchParams:Promise<{category?:string}>}){
  const {category}=await searchParams;
  const selectedCategory=typeof category==='string'&&['home','lifestyle','decor','accessories','electronics','other'].includes(category)?category:'all';
  const products=await getProducts();
  return <main className="legacy-home" id="home">
    <section className="main-container legacy-categories" id="categories">
      <div className="legacy-section-title"><h1>Kategori Produk</h1><span>Jelajahi kategori</span></div>
      <div className="legacy-category-tiles">
        {categoryTiles.map(tile=><Link key={tile.slug} className="legacy-category-tile" href={`/?category=${tile.slug}#shop`}>
          <span className="legacy-category-icon" aria-hidden="true">{tile.glyph}</span>
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
      <div className="legacy-partner-panel">
        <div className="legacy-partner-slot" aria-hidden="true"><span>V</span></div>
        <p>Brand partner baru akan ditampilkan setelah materi dan hak penggunaan logo diverifikasi.</p>
      </div>
    </section>
    <div className="main-container legacy-product-wrapper">
      <ProductGrid key={selectedCategory} products={products} initialCategory={selectedCategory}/>
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
