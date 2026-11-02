'use client';
import {useCart} from '@/lib/cart';
import type {Product} from '@/lib/types';
export function AddToCart({product}:{product:Product}){
  const {add}=useCart();
  return <button type="button" className="button button-dark product-action" disabled={!product.is_active||product.stock_qty<=0} onClick={()=>add(product)}>{product.stock_qty<=0?'Stok habis':'Tambahkan ke keranjang'} <span>↗</span></button>;
}
