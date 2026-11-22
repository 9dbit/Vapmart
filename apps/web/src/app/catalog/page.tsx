import Link from 'next/link';
import {ProductGrid} from '@/components/product-grid';
import {ReferenceVisualGrid} from '@/components/reference-visual-grid';
import {allArchiveItems,isArchiveCategory,archiveCategories} from '@/lib/archive-catalog';
import {getProductsResult} from '@/lib/api';
import {DataStatus} from '@/components/data-status';
import '../restored-home.css';
export const dynamic='force-dynamic';
export const metadata={title:'Katalog | Vapmart',robots:{index:false,follow:false}};
export default async function CatalogPage({searchParams}:{searchParams:Promise<{category?:string;q?:string;reference?:string;brand?:string}>}){
 const params=await searchParams;
 const category=typeof params.category==='string'?params.category:'all';
 const query=typeof params.q==='string'?params.q.slice(0,80):'';
 const ref=typeof params.reference==='string'?params.reference:'all';
 const brandId=typeof params.brand==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(params.brand)?params.brand:'';
 const validCategory=/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category)&&category.length<=120;
 const result=await getProductsResult();
 const active=result.items.filter(p=>p.is_active&&!p.slug.startsWith('demo-'));
 const referenceItems=isArchiveCategory(ref)?allArchiveItems.filter(p=>p.category===ref):allArchiveItems;
 return <main className="main-container legacy-product-wrapper vm-catalog-page vm-restored-catalog">
   <h1 className="sr-only">Katalog Vapmart</h1>
   {!result.ok?<DataStatus kind="produk" code={result.error}/>:active.length>0?<ProductGrid products={active} initialTerm={query} initialCategory={validCategory?category:'all'} initialBrandId={brandId}/>:
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
