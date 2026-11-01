import Link from 'next/link';
import {ProductGrid} from '@/components/product-grid';
import {ReferenceVisualGrid} from '@/components/reference-visual-grid';
import {allArchiveItems,isArchiveCategory,archiveCategories} from '@/lib/archive-catalog';
import {getProducts} from '@/lib/api';
import '../restored-home.css';
export const dynamic='force-dynamic';
export const metadata={title:'Katalog | Vapmart',robots:{index:false,follow:false}};
export default async function CatalogPage({searchParams}:{searchParams:Promise<{category?:string;q?:string;reference?:string}>}){
 const params=await searchParams;
 const category=typeof params.category==='string'?params.category:'all';
 const query=typeof params.q==='string'?params.q.slice(0,80):'';
 const ref=typeof params.reference==='string'?params.reference:'all';
 const allowed=['all','home','lifestyle','decor','accessories','electronics','other'];
 const active=(await getProducts()).filter(p=>p.is_active&&!p.slug.startsWith('demo-'));
 const referenceItems=isArchiveCategory(ref)?allArchiveItems.filter(p=>p.category===ref):allArchiveItems;
 return <main className="main-container legacy-product-wrapper vm-catalog-page vm-restored-catalog">
   <div className="vm-catalog-intro">
     <Link href="/" className="back-link">← Kembali ke beranda</Link>
     <span className="vm-trendora-eyebrow">DISCOVER VAPMART</span>
     <h1>Explore the catalog.</h1>
     <p>Struktur katalog diperbarui tanpa menghilangkan referensi visual dari website sebelum rebuild.</p>
     <span className="vm-catalog-preview">Produk aktif hanya ditampilkan dari PostgreSQL setelah verifikasi. Pembayaran belum aktif.</span>
   </div>
   {active.length>0?<ProductGrid products={active} initialTerm={query} initialCategory={allowed.includes(category)?category:'all'}/>:
    <section className="vm-restored-catalog-status" aria-label="Status katalog aktif"><span className="vm-trendora-eyebrow">LIVE CATALOG</span>
      <h2>Katalog aktif sedang diverifikasi</h2>
      <p>Belum ada SKU dengan status tayang di PostgreSQL. Galeri foto referensi lama tetap dapat dilihat di bawah tanpa harga, stok, atau pembelian.</p>
    </section>}
   <section className="vm-reference-products vm-restored-catalog-reference" id="archive-gallery" aria-label="Referensi visual produk sebelum rebuild">
     <div className="vm-trendora-section-heading vm-ref-section-head">
       <div><span className="vm-trendora-eyebrow">ORIGINAL ASSET REFERENCES</span><h2>Referensi katalog sebelumnya</h2></div>
       <span className="vm-restored-media-note">Read only</span>
     </div>
     <nav className="vm-restored-reference-filters" aria-label="Filter galeri visual">
       <Link className={ref==='all'?'is-current':''} href="/catalog#archive-gallery">Semua</Link>
       {(Object.keys(archiveCategories) as Array<keyof typeof archiveCategories>).map(key=><Link key={key}
         className={ref===key?'is-current':''}
         href={'/catalog?reference='+encodeURIComponent(key)+'#archive-gallery'}>{archiveCategories[key].label}</Link>)}
     </nav>
     <ReferenceVisualGrid items={referenceItems}/>
     {referenceItems.length===0&&<p className="vm-restored-media-note">Tidak ada foto referensi untuk kategori ini.</p>}
     <p className="vm-reference-disclaimer">Ini dokumentasi media historis, bukan katalog produk aktif. Tidak ada harga, SKU, stok, tombol keranjang, atau alur pembayaran untuk arsip ini.</p>
   </section>
 </main>;
}
