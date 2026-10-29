'use client';
import Link from 'next/link';
import {useCart} from '@/lib/cart';
import {formatIDR} from '@/lib/types';

export function CartPageContent(){
 const {items,count,subtotal,setQuantity,remove}=useCart();
 return <div className="vm-cart-layout">
   <section className="vm-cart-main" aria-label="Barang di keranjang">
     <header className="vm-cart-title"><h1>Keranjang</h1><span>{count} barang</span></header>
     {!items.length?<div className="vm-cart-empty">
       <div aria-hidden="true" className="vm-cart-empty-icon">▢</div>
       <h2>Keranjang kamu masih kosong</h2>
       <p>Tambahkan produk DEMO untuk menguji pengalaman belanja Vapmart.</p>
       <Link href="/catalog" className="vm-cart-primary">Jelajahi Katalog</Link>
     </div>:<div className="vm-cart-items">{items.map(({product,quantity})=>
       <article className="vm-cart-item" key={product.id}>
         <div className="vm-cart-item-media">{product.image_url?
           <img src={product.image_url} alt={product.name}/>:<span aria-hidden="true">✦</span>}</div>
         <div className="vm-cart-item-info">
           <Link href={'/product/'+product.slug}><h2>{product.name}</h2></Link>
           <p>Produk pengujian · {product.category}</p>
           <strong>{formatIDR(product.price_idr)}</strong>
           <div className="vm-cart-item-actions">
             <div className="vm-cart-qty" aria-label={'Jumlah '+product.name}>
               <button type="button" disabled={quantity<=1} onClick={()=>setQuantity(product.id,quantity-1)} aria-label={'Kurangi '+product.name}>−</button>
               <span aria-live="polite">{quantity}</span>
               <button type="button" disabled={quantity>=product.stock_qty} onClick={()=>setQuantity(product.id,quantity+1)} aria-label={'Tambah '+product.name}>+</button>
             </div>
             <button type="button" className="vm-cart-remove" onClick={()=>remove(product.id)}>Hapus</button>
           </div>
         </div>
         <strong className="vm-cart-line-total">{formatIDR(product.price_idr*quantity)}</strong>
       </article>)}</div>}
       {items.length>0&&<Link href="/catalog" className="vm-cart-continue">← Lanjut belanja</Link>}
   </section>
   <aside className="vm-cart-summary" aria-label="Ringkasan keranjang">
     <h2>Ringkasan Belanja</h2>
     <div className="vm-cart-summary-row"><span>Jumlah barang</span><strong>{count}</strong></div>
     <div className="vm-cart-summary-row"><span>Subtotal sementara</span><strong>{formatIDR(subtotal)}</strong></div>
     <div className="vm-cart-summary-total"><span>Total pratinjau</span><strong>{formatIDR(subtotal)}</strong></div>
     <button type="button" disabled className="vm-cart-checkout">Checkout belum tersedia</button>
     <p>Semua angka berasal dari item DEMO dalam browser. Belum ada pemesanan, pengiriman, pembayaran atau reservasi stok.</p>
   </aside>
 </div>;
}
