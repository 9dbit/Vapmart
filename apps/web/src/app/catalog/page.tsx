import Link from 'next/link';
import {ProductGrid} from '@/components/product-grid';
import {getProducts} from '@/lib/api';
export const dynamic='force-dynamic';
export const metadata={title:'Katalog | Vapmart',robots:{index:false,follow:false}};
export default async function CatalogPage({searchParams}:{searchParams:Promise<{category?:string;q?:string}>}){
  const params=await searchParams;
  const category=typeof params.category==='string'?params.category:'all';
  const q=typeof params.q==='string'?params.q.slice(0,80):'';
  const allowed=['all','home','lifestyle','decor','accessories','electronics','other'];
  const products=await getProducts();
  return <main className="main-container legacy-product-wrapper vm-catalog-page">
    <div className="vm-catalog-intro">
      <Link href="/" className="back-link">← Kembali ke beranda</Link>
      <span className="vm-trendora-eyebrow">DISCOVER VAPMART</span>
      <h1>Explore the catalog.</h1>
      <p>Jelajahi pilihan produk, cari berdasarkan nama atau SKU, lalu saring menurut kategori.</p>
      <span className="vm-catalog-preview">Checkout tersedia untuk meninjau pesanan · Gateway pembayaran belum aktif</span>
    </div>
    <ProductGrid products={products} initialTerm={q} initialCategory={allowed.includes(category)?category:'all'}/>
  </main>;
}
