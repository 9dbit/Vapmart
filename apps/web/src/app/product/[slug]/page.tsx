import Link from 'next/link';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {getProduct} from '@/lib/api';
import {formatIDR} from '@/lib/types';
import {AddToCart} from '@/components/add-to-cart';
import {ArchiveCard} from '@/components/archive-card';
import {ArchiveGallery} from '@/components/archive-gallery';
import {archiveBySlug,archiveCategories,categoryArchiveItems,featuredArchiveItems,type ArchiveItem} from '@/lib/archive-catalog';

export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const {slug}=await params;
 const archived=archiveBySlug.get(slug);
 if(archived)return {title:archived.name,description:'Arsip referensi visual Vapmart. Bukan katalog aktif atau penawaran pembelian.',robots:{index:false,follow:false}};
 const product=await getProduct(slug);
 return {title:product?.name||'Produk tidak ditemukan',robots:{index:false,follow:false}};
}

function ArchivedProductView({item}:{item:ArchiveItem}){
 const images=item.slug==='into-mission-replacement-pods'
  ?['/legacy/products/mission-main.png','/legacy/products/mission-gallery-02.png']
  :[item.image];
 const others=(item.category==='pod'?categoryArchiveItems('pod'):featuredArchiveItems)
  .filter(p=>p.slug!==item.slug).slice(0,6);
 const category=archiveCategories[item.category];
 return <main className="vm-detail-page vm-archive-detail">
  <div className="vm-detail-main">
   <ArchiveGallery images={images} title={item.name}/>
   <section className="vm-detail-content">
    <nav className="vm-detail-breadcrumb" aria-label="Breadcrumb"><Link href="/">Vapmart</Link><span>/</span>
      <Link href={'/product-category/'+category.slug}>{category.label}</Link><span>/</span><span>Arsip</span></nav>
    <h1>{item.name}</h1>
    <div className="vm-detail-price">{item.originalPrice&&<del>{item.originalPrice}</del>} <strong>{item.price}</strong></div>
    <span className="vm-detail-archive-label">HARGA HISTORIS · TIDAK UNTUK TRANSAKSI</span>
    {item.slug==='into-mission-replacement-pods'&&<div className="vm-detail-variations">
      <h2>Ukuran</h2><div className="vm-variation-values"><span>0.6Ω</span><span>0.9Ω</span></div>
    </div>}
    <div className="vm-detail-disabled-actions">
      <button type="button" disabled title="Produk arsip tidak tersedia untuk pembelian">Tambah</button>
      <button type="button" disabled title="Checkout produk arsip dinonaktifkan">Beli Sekarang</button>
    </div>
    <div className="vm-detail-description"><h2>Deskripsi</h2>
      <p>Produk ini merupakan dokumentasi katalog Vapmart existing. Foto, nama, kategori, dan harga berasal dari arsip WordPress.</p>
      <details><summary>Baca Selengkapnya</summary><p>Informasi stok, variasi aktif, harga terbaru, dan kelayakan jual belum diverifikasi. Halaman arsip ini tidak menerima pemesanan ataupun pembayaran.</p></details>
    </div>
    <div className="vm-detail-partner"><div className="vm-detail-partner-icon">{item.brand==="Into"?<img src="/legacy/brands/brand-into-detail.png" alt="Into" width={100} height={100}/>:item.brand.slice(0,1)}</div>
      <div className="vm-detail-partner-content"><strong>{item.brand}</strong>
        <Link href="/brand-partner">Lihat Brand Partner</Link></div></div>
   </section>
  </div>
  <section className="vm-detail-recommendations">
    <h2 className="vm-lined-heading"><span>Dari Arsip Vapmart</span></h2>
    <div className="vm-reference-grid">{others.map(p=><ArchiveCard key={p.slug} item={p}/>)}</div>
  </section>
  <p className="vm-detail-bottom-note">Seluruh item di halaman ini merupakan referensi tampilan, bukan produk aktif. <Link href="/catalog">Katalog pengujian</Link></p>
 </main>;
}
export default async function ProductPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const archived=archiveBySlug.get(slug);
 if(archived)return <ArchivedProductView item={archived}/>;
 const product=await getProduct(slug);
 if(!product)notFound();
 return <main className="vm-detail-page vm-demo-detail">
   <div className="vm-detail-main">
    <ArchiveGallery images={product.image_url?[product.image_url]:['/legacy/vapmart-logo-white.webp']} title={product.name}/>
    <section className="vm-detail-content">
      <nav className="vm-detail-breadcrumb" aria-label="Breadcrumb"><Link href="/">Vapmart</Link><span>/</span><Link href="/catalog">Katalog DEMO</Link></nav>
      <h1>{product.name}</h1><div className="vm-detail-price"><strong>{formatIDR(product.price_idr)}</strong></div>
      <span className="vm-detail-archive-label">PRODUK DEMO · CHECKOUT DINONAKTIFKAN</span>
      <div className="vm-detail-description"><h2>Deskripsi</h2><p>{product.description||'Produk contoh untuk pengujian katalog.'}</p></div>
      <div className="vm-demo-stock">{product.stock_qty>0?'Stok pengujian: '+product.stock_qty:'Stok habis'}</div>
      <AddToCart product={product}/>
      <p className="vm-detail-bottom-note">Keranjang hanya untuk uji UI. Checkout dan pembayaran belum aktif.</p>
    </section>
   </div>
 </main>;
}
