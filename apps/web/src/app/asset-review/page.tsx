import Link from 'next/link';
import {archivedProducts,archivedNews} from '@/lib/archived-reference';
export const metadata={title:'Review Aset WordPress | Vapmart',robots:{index:false,follow:false}};
const banners=[1,2,3].map(n=>'/legacy/banners/desktop-'+String(n).padStart(2,'0')+'.png');
export default function AssetReview(){
  return <main className="vm-asset-review">
    <Link href="/" className="back-link">← Kembali ke storefront</Link>
    <h1>Vapmart / Original Asset Review</h1>
    <p>Referensi visual dari backup WordPress 2026 untuk QA migrasi, tanpa tombol membeli, checkout, atau aktivasi produk. Harga pada arsip tidak menentukan harga katalog baru.</p>
    <h2>Banner original</h2>
    <div className="vm-asset-grid vm-asset-wide">
      {banners.map((src,i)=><figure className="vm-asset-figure" key={src}>
        <img src={src} alt={'Banner WordPress '+(i+1)} width={1024} height={320} loading="eager"/>
        <figcaption>Banner desktop {i+1}</figcaption></figure>)}
    </div>
    <h2 id="product-archive">Foto produk WordPress</h2>
    <div className="vm-asset-grid">
      {archivedProducts.map((item,i)=><figure className="vm-asset-figure" key={item.image}>
        <img src={item.image} alt={item.name} width={300} height={300} loading="eager"/>
        <figcaption>{String(i+1).padStart(2,'0')}. {item.name}</figcaption></figure>)}
    </div>
    <h2>Thumbnail news WordPress</h2>
    <div className="vm-asset-grid">
      {archivedNews.map((item,i)=><figure className="vm-asset-figure" key={item.image}>
        <img src={item.image} alt={item.title} width={300} height={169} loading="eager"/>
        <figcaption>{String(i+1).padStart(2,'0')}. {item.title}</figcaption></figure>)}
    </div>
  </main>;
}
