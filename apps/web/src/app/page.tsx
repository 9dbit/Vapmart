import {ProductGrid} from '@/components/product-grid';
import {getProducts} from '@/lib/api';
import Link from 'next/link';

export const dynamic='force-dynamic';
export default async function Home(){
  const products=await getProducts();
  return <main><section className="hero"><div className="hero-content"><p className="eyebrow hero-eyebrow"><span className="live-orb"/> NEW CHAPTER / VAPMART</p><h1>Objects for<br/><span className="serif-italic">better living.</span></h1><p className="hero-description">Pilihan produk untuk ruang, rutinitas, dan setiap momen kecil yang berarti.</p><Link href="/#shop" className="button button-light">Explore collection <span>↗</span></Link><div className="hero-micro"><span>EST. INDONESIA</span><span>CURATED WITH INTENTION</span></div></div><div className="hero-visual" aria-hidden="true"><div className="chrome-orbit orbit-outer"/><div className="chrome-orbit orbit-inner"/><div className="hero-sphere"><div className="sphere-reflection"/></div><div className="floating-word">LESS, BUT BETTER.</div><div className="visual-label">01 / NEW PERSPECTIVE</div></div></section>
    <div className="value-strip"><span>DISCOVER SOMETHING DIFFERENT</span><span>✳</span><span>DESIGNED FOR EVERYDAY</span><span>✳</span><span>YOUR SPACE, YOUR STYLE</span></div>
    <div className="main-container"><section className="intro-section" id="about"><div><p className="eyebrow">THE VAPMART EDIT</p><h2>Less noise.<br/><em>More intention.</em></h2></div><p>Ruang untuk menemukan barang yang berguna, relevan, dan punya desain menarik. Koleksi ini akan bertumbuh bersama kebutuhanmu, tanpa produk nikotin.</p></section><ProductGrid products={products}/>
    <section className="category-feature" id="categories"><div className="category-feature-text"><p className="eyebrow">EXPLORE THE EDIT</p><h2>Good things,<br/><em>on your terms.</em></h2><p>Home essentials, lifestyle, decor, accessories, dan lebih banyak lagi.</p><Link href="/#shop" className="outline-link">Discover all products <span>↗</span></Link></div><div className="category-feature-art"><div className="feature-ring"/><div className="feature-disk"/><span>OBJECTS / 2026</span></div></section></div></main>;
}
