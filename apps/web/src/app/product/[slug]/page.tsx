import Link from 'next/link';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {getProduct} from '@/lib/api';
import {formatIDR} from '@/lib/types';
import {AddToCart} from '@/components/add-to-cart';

export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;const product=await getProduct(slug);
  return {title:product?.name||'Produk tidak ditemukan',robots:{index:false,follow:false}};
}
export default async function ProductPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;const product=await getProduct(slug);if(!product)notFound();
  return <main className="main-container detail-page"><Link href="/#shop" className="back-link">← Kembali ke katalog</Link><div className="detail-layout"><div className="detail-visual">{product.image_url?<img src={product.image_url} alt={product.name}/>:<div className="product-placeholder detail-placeholder"><span>✦</span><small>VAPMART OBJECTS</small></div>}</div><div className="detail-copy"><p className="eyebrow">{product.category.toUpperCase()} / VAPMART</p><h1>{product.name}</h1><div className="detail-price">{formatIDR(product.price_idr)}</div><div className="detail-rule"/><p>{product.description||'Produk pilihan Vapmart untuk melengkapi aktivitas sehari-hari.'}</p><div className="stock"><span className={product.stock_qty>0?'stock-dot':'stock-dot out'}/>{product.stock_qty>0?`Tersedia · ${product.stock_qty} item`:'Stok habis'}</div><AddToCart product={product}/><p className="fine-print">Pembayaran belum tersedia di lingkungan staging.</p></div></div></main>;
}
