import Link from 'next/link';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {getProduct} from '@/lib/api';
import {formatIDR} from '@/lib/types';
import {CatalogPurchase} from '@/components/catalog-purchase';
import {CatalogPublicReviews} from '@/components/catalog-public-reviews';
import {FavoriteButton} from '@/components/favorite-button';
import {ArchiveGallery} from '@/components/archive-gallery';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const {slug}=await params;const product=await getProduct(slug);
 return {title:product?.name||'Produk tidak ditemukan',robots:{index:false,follow:false}};
}
export default async function ProductPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const product=await getProduct(slug);
 if(!product)notFound();
 return <main className="vm-detail-page vm-product-detail">
   <div className="vm-detail-main">
    {(product.image_url||product.gallery_urls?.length)?<ArchiveGallery images={[product.image_url,...(product.gallery_urls||[])].filter((image):image is string=>Boolean(image))} title={product.name}/>:<div className="vm-detail-gallery">
      <div className="vm-detail-hero-image vm-cp17-demo-placeholder" role="img" aria-label={`Placeholder gambar untuk ${product.name}`}>
        <div className="vm-cp17-demo-placeholder-inner" aria-hidden="true"><span>✦</span><strong>VAPMART OBJECTS</strong><small>Preview Collection</small></div>
      </div>
    </div>}
    <section className="vm-detail-content">
      <nav className="vm-detail-breadcrumb" aria-label="Breadcrumb"><Link href="/">Vapmart</Link><span>/</span><Link href="/catalog">Katalog</Link></nav>
      <h1>{product.name}</h1>{product.brand_name&&<p className="vm-cp17-brand-name">Brand: {product.brand_name}</p>}
      <span className="vm-detail-archive-label">KATALOG VAPMART · PEMBAYARAN BELUM AKTIF</span>
      <div className="vm-detail-description"><h2>Deskripsi</h2><p>{product.description||'Detail produk sedang disiapkan.'}</p></div>
      <CatalogPurchase product={product}/>
      <div className="vm-cp17-detail-actions"><FavoriteButton id={product.id} name={product.name} className="vm-cp17-detail-favorite"/></div>
      <p className="vm-detail-bottom-note">Checkout dapat meninjau harga dan menyimpan draft pesanan. Pembayaran menunggu integrasi gateway resmi.</p>
    </section>
   </div>
   <CatalogPublicReviews slug={product.slug}/>
 </main>;
}
