'use client';
import {useRouter} from 'next/navigation';
import {useCart} from '@/lib/cart';
import type {Product} from '@/lib/types';

export function AddToCart({product}:{product:Product}){
  const {add}=useCart();
  const router=useRouter();
  const disabled=!product.is_active||product.stock_qty<=0||product.product_type==='variable'||product.price_idr<=0;
  const label=product.stock_qty<=0?'Stok habis':product.price_idr<=0?'Harga belum ditetapkan':'Tambahkan ke keranjang';
  return <div className="vcs-cta-row">
    <button type="button" className="button product-action vcs-cart-cta" disabled={disabled} onClick={()=>add(product)}>{label} <span>+</span></button>
    <button type="button" className="button button-dark product-action vcs-buy-cta" disabled={disabled} onClick={()=>{add(product);router.push('/checkout')}}>{disabled?(product.stock_qty<=0?'Stok habis':'Belum tersedia'):'Beli sekarang'} <span>↗</span></button>
  </div>;
}
