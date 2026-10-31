'use client';
import {useEffect,useRef} from 'react';
import Link from 'next/link';
import {useCart} from '@/lib/cart';
import {isDigitalProduct} from '@/lib/digital-products';
import {formatIDR} from '@/lib/types';

function EmptyBagIcon(){
 return <svg viewBox="0 0 112 112" width="96" height="96" fill="none" role="img" aria-label="Ilustrasi tas belanja Vapmart" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
   <rect x="20" y="40" width="72" height="61" rx="13"/><path d="M40 47V33c0-11 7-18 16-18s16 7 16 18v14"/><path d="M43 70h26m-13-13v26" strokeWidth="3"/>
 </svg>;
}

export function CartDrawer(){
 const {items,count,subtotal,open,setOpen,setQuantity,remove}=useCart();
 const dialogRef=useRef<HTMLElement>(null);
 useEffect(()=>{
   if(!open)return;
   const target=dialogRef.current;
   const previous=document.activeElement as HTMLElement|null;
   target?.querySelector<HTMLElement>('.vm21-drawer-close')?.focus();
   const onKey=(e:KeyboardEvent)=>{
     if(e.key!=='Tab'||!target)return;
     const focusables=[...target.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])')];
     if(!focusables.length)return;
     const first=focusables[0],last=focusables[focusables.length-1];
     if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
     if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
   };
   document.addEventListener('keydown',onKey);
   return()=>{document.removeEventListener('keydown',onKey);previous?.focus();};
 },[open]);
 if(!open)return null;
 return <div className="drawer-shell vm21-cart-shell" role="presentation">
   <button type="button" className="drawer-shade" onClick={()=>setOpen(false)} aria-label="Tutup keranjang"/>
   <aside ref={dialogRef} className="cart-drawer vm21-cart-drawer" role="dialog" aria-modal="true" aria-labelledby="vm21-cart-drawer-title">
     <div className="vm21-drawer-handle" aria-hidden="true"/>
     <header className="vm21-drawer-header">
       <div><span className="vm21-eyebrow">YOUR VAPMART BAG</span>
         <h2 id="vm21-cart-drawer-title">Keranjang <span>{count}</span></h2>
       </div>
       <button type="button" className="vm21-drawer-close" onClick={()=>setOpen(false)} aria-label="Tutup keranjang">×</button>
     </header>
     {items.length===0?
       <div className="vm21-drawer-empty">
         <div className="vm21-drawer-bag-illustration"><EmptyBagIcon/></div>
         <h3>Keranjang masih kosong.</h3>
         <p>Temukan pilihan favoritmu di koleksi Vapmart.</p>
         <Link className="vm21-primary" href="/catalog" onClick={()=>setOpen(false)}>Jelajahi Katalog <span aria-hidden="true">↗</span></Link>
       </div>:
       <>
         <div className="vm21-drawer-items">
           {items.map(({product,quantity})=><article className="vm21-drawer-item" key={product.id}>
             <div className="vm21-drawer-item-illustration">
               {product.image_url?<img src={product.image_url} alt=""/>:<span aria-hidden="true">{isDigitalProduct(product)?'V':'✦'}</span>}
             </div>
             <div className="vm21-drawer-item-body">
               <small>{isDigitalProduct(product)?'DIGITAL PRODUCT':'PRODUK'}</small>
               <strong>{product.name}</strong>
               <span>{formatIDR(product.price_idr)}</span>
               {isDigitalProduct(product)?<span className="vm21-digital-qty">Qty 1 · digital</span>:
               <div className="vm21-drawer-qty"><button type="button" disabled={quantity<=1} onClick={()=>setQuantity(product.id,quantity-1)} aria-label={'Kurangi '+product.name}>−</button><span>{quantity}</span><button type="button" disabled={quantity>=product.stock_qty} onClick={()=>setQuantity(product.id,quantity+1)} aria-label={'Tambah '+product.name}>+</button></div>}
             </div>
             <button type="button" className="vm21-drawer-item-remove" onClick={()=>remove(product.id)} aria-label={'Hapus '+product.name}>×</button>
           </article>)}
         </div>
         <footer className="vm21-drawer-footer">
           <div><span>Subtotal</span><strong>{formatIDR(subtotal)}</strong></div>
           <Link className="vm21-primary" href="/keranjang-2" onClick={()=>setOpen(false)}>Tinjau Keranjang <span aria-hidden="true">↗</span></Link>
           <p>Transaksi hanya dapat diproses setelah checkout dan gateway resmi diaktifkan.</p>
         </footer>
       </>}
   </aside>
 </div>;
}
