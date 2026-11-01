import Link from 'next/link';
import {getProducts,getBrands} from '@/lib/api';
import {ProductGrid} from '@/components/product-grid';
import {BrandRail} from '@/components/brand-rail';
import './commerce-home.css';
export const dynamic='force-dynamic';
const groups=[{label:'Home',id:'home'},{label:'Lifestyle',id:'lifestyle'},{label:'Decor',id:'decor'},{label:'Accessories',id:'accessories'},{label:'Electronics',id:'electronics'}] as const;
export default async function Home(){
 const [products,brands]=await Promise.all([getProducts(),getBrands()]);
 const published=products.filter(p=>p.is_active&&!p.slug.startsWith('demo-'));
 return <main className="vm-commerce-home" id="home">
  <section className="main-container vm-commerce-hero">
   <div><span className="vm-commerce-eyebrow">VAPMART / CURATED MARKETPLACE</span>
    <h1>Discover better.<br/><em>Every day.</em></h1>
    <p>Pilihan produk baru yang dikurasi Vapmart. Jelajahi katalog dan temukan brand favorit dalam satu tempat.</p>
    <div className="vm-commerce-hero-actions"><Link href="/catalog" className="vm-commerce-primary">Explore catalog ↗</Link><Link href="/brand-partner" className="vm-commerce-secondary">Our brands</Link></div>
   </div><div className="vm-commerce-hero-art" aria-hidden="true"><span className="vm-commerce-orb"/><strong>v</strong><span className="vm-commerce-stamp">VAPMART®<br/>NEW COLLECTION</span></div>
  </section>
  <section className="main-container vm-commerce-categories">
   <div className="vm-commerce-section-head"><div><span className="vm-commerce-eyebrow">SHOP BY CATEGORY</span><h2>Explore categories.</h2></div><Link href="/catalog">Lihat semua ↗</Link></div>
   <div className="vm-commerce-categories-row">{groups.map((x,i)=><Link href={'/catalog?category='+x.id} className="vm-commerce-category" key={x.id}><small>{String(i+1).padStart(2,'0')}</small><strong>{x.label}</strong><span>↗</span></Link>)}</div>
  </section>
  {published.length>0?<section className="main-container vm-commerce-products"><ProductGrid products={published}/></section>:<section className="main-container vm-commerce-empty" id="shop"><span className="vm-commerce-eyebrow">COMING SOON</span><h2>Koleksi baru sedang disiapkan.</h2><p>Produk akan tampil setelah brand, stok, harga, dan foto disetujui oleh tim Vapmart. Tidak ada produk contoh atau arsip di etalase ini.</p><Link href="/brand-partner" className="vm-commerce-primary">Lihat brand ↗</Link></section>}
  {brands.length>0&&<section className="main-container vm-commerce-brand"><div className="vm-commerce-section-head"><div><span className="vm-commerce-eyebrow">OUR PARTNERS</span><h2>Brand Partner.</h2></div><Link href="/brand-partner">Explore brands ↗</Link></div><BrandRail brands={brands}/></section>}
  <section className="main-container vm-commerce-member"><span className="vm-commerce-eyebrow">THE VAPMART CLUB</span><h2>Made for members.</h2><p>Akses akun, favorit dan benefit dalam satu ruang.</p><Link href="/member-2">Explore membership ↗</Link></section>
 </main>;
}
