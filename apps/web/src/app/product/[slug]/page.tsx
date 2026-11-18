import Link from 'next/link';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {getProduct} from '@/lib/api';
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
      {product.brand_name&&<div className="vm-product-brand">
        {product.brand_logo_url&&<img src={product.brand_logo_url} alt="" width={68} height={34}/>}
        <span>{product.brand_name}</span>
      </div>}
      <h1>{product.name}</h1>
      <div className="vm-detail-description"><h2>Deskripsi</h2><p>{product.description||'Detail produk sedang disiapkan.'}</p></div>
      <CatalogPurchase product={product}/>
      <div className="vm-cp17-detail-actions"><FavoriteButton id={product.id} name={product.name} className="vm-cp17-detail-favorite"/></div>

    </section>
   </div>
   <CatalogPublicReviews slug={product.slug}/>
 </main>;
}
