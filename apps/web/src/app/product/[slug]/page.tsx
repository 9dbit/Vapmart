import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {getProduct,getProducts} from '@/lib/api';
import type {Product} from '@/lib/types';
import {ProductDetailExperience} from '@/components/product-detail-experience';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const {slug}=await params;
 const product=await getProduct(slug);
 return {title:product?.name||'Produk tidak ditemukan',robots:{index:false,follow:false}};
}
export default async function ProductPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const product=await getProduct(slug);
 if(!product)notFound();
 let candidates:Product[]=[];
 try{candidates=await getProducts();}catch{/* Recommendations are optional; never fabricate products. */}
 const recommended=candidates.filter(p=>p.is_active&&p.available!==false&&p.stock_qty>0&&p.price_idr>0
  &&p.id!==product.id&&p.slug!==product.slug&&p.category===product.category
  &&p.product_type!=='variation').slice(0,8);
 return <ProductDetailExperience key={product.id} product={product} recommended={recommended}/>;
}
