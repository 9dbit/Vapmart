'use client';
import {useRouter} from 'next/navigation';
import {useCart} from '@/lib/cart';
import {Icon} from './store-icon';
import type {Product} from '@/lib/types';

export function AddToCart({product}:{product:Product}){
  const {add,setOpen}=useCart();
  const router=useRouter();
  const disabled=product.available===false||!product.is_active||product.stock_qty<=0||product.product_type==='variable'||product.price_idr<=0;
  const label=product.product_type==='variable'?'Pilih variasi untuk menambahkan ke keranjang':product.stock_qty<=0?'Stok habis':product.price_idr<=0?'Harga belum ditetapkan':'Tambahkan ke keranjang';
  return <div className="vcs-cta-row">
    <button type="button" className="button product-action vcs-buy-cta" disabled={disabled} onClick={()=>{add(product);setOpen(false);router.push('/checkout')}}>{disabled&&product.product_type!=='variable'?(product.stock_qty<=0?'Stok habis':'Belum tersedia'):'Beli sekarang'}</button>
    <button type="button" className="button product-action vcs-cart-cta" disabled={disabled} aria-label={label} title={label} onClick={()=>add(product)}><Icon name="cart"/></button>
  </div>;
}
