import Link from 'next/link';
import {ProductGrid} from '@/components/product-grid';
import {getProducts} from '@/lib/api';
export const dynamic='force-dynamic';
export const metadata={title:'Katalog Staging | Vapmart',robots:{index:false,follow:false}};
export default async function CatalogPage({searchParams}:{searchParams:Promise<{category?:string;q?:string}>}){
  const params=await searchParams;
  const category=typeof params.category==='string'?params.category:'all';
  const q=typeof params.q==='string'?params.q.slice(0,80):'';
  const allowed=['all','home','lifestyle','decor','accessories','electronics','other'];
  const products=await getProducts();
  return <main className="main-container legacy-product-wrapper vm-catalog-page">
    <div className="vm-catalog-intro">
      <Link href="/" className="back-link">← Kembali ke homepage Vapmart</Link>
      <h1>Katalog Pengujian</h1>
      <p>Produk DEMO untuk menguji pencarian, kategori, detail, dan keranjang. Checkout dan pembayaran tidak aktif.</p>
    </div>
    <ProductGrid products={products} initialTerm={q} initialCategory={allowed.includes(category)?category:'all'}/>
  </main>;
}
