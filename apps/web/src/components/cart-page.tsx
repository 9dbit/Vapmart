'use client';
import Link from 'next/link';
import {useCart} from '@/lib/cart';
import {formatIDR} from '@/lib/types';
import {isDigitalProduct} from '@/lib/digital-products';
import {DigitalCheckoutAction} from './digital-checkout-action';

function EmptyCartImage(){
 return <svg viewBox="0 0 128 128" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
   <rect x="22" y="42" width="84" height="68" rx="17"/><path d="M45 50V34c0-12 8-20 19-20s19 8 19 20v16"/>
   <path d="M48 76h32m-16-16v32"/>
 </svg>;
}
export function CartPageContent(){
 const {items,count,subtotal,setQuantity,remove}=useCart();
 const digitalOnly=items.length===1&&items[0].quantity===1&&isDigitalProduct(items[0].product);
 return <div className="vm21-cart-page-content">
   <div className="vm21-cart-page-heading">
     <div><span className="vm21-eyebrow">YOUR VAPMART BAG</span><h1>Keranjang <span>{count}</span></h1>
     <p>Periksa pilihanmu sebelum melanjutkan.</p></div>
     <Link href="/catalog" className="vm21-secondary">Jelajahi Katalog <span aria-hidden="true">↗</span></Link>
   </div>
   {!items.length?
    <section className="vm21-cart-empty-page">
      <div className="vm21-drawer-bag-illustration"><EmptyCartImage/></div>
      <h2>Keranjang masih kosong.</h2>
      <p>Simpan pilihanmu di sini. Mulai dari katalog atau lihat paket Coin dalam Member Club.</p>
      <div><Link href="/catalog" className="vm21-primary">Jelajahi Katalog</Link><Link href="/member-2" className="vm21-secondary">Lihat Coin Store</Link></div>
    </section>:
    <div className="vm21-cart-layout">
      <section className="vm21-cart-items" aria-label="Isi keranjang">
        {items.map(({product,quantity})=><article className="vm21-cart-product" key={product.id}>
          <div className="vm21-cart-product-image">{product.image_url?<img src={product.image_url} alt={product.name}/>:<span aria-hidden="true">{isDigitalProduct(product)?'V':'✦'}</span>}</div>
          <div className="vm21-cart-product-body">
            <span className="vm21-eyebrow">{isDigitalProduct(product)?'DIGITAL · COIN / MEMBER':'PRODUK STAGING'}</span>
            {isDigitalProduct(product)?<Link href="/member-2"><h2>{product.name}</h2></Link>:<Link href={'/product/'+product.slug}><h2>{product.name}</h2></Link>}
            <p>{isDigitalProduct(product)?'Dikirim ke akun setelah pembayaran terverifikasi':product.category}</p>
            <strong>{formatIDR(product.price_idr)}</strong>
            <div className="vm21-cart-product-actions">
              {!isDigitalProduct(product)&&<div className="vm21-drawer-qty">
                <button type="button" disabled={quantity<=1} onClick={()=>setQuantity(product.id,quantity-1)} aria-label={'Kurangi '+product.name}>−</button><span>{quantity}</span>
                <button type="button" disabled={quantity>=product.stock_qty} onClick={()=>setQuantity(product.id,quantity+1)} aria-label={'Tambah '+product.name}>+</button>
              </div>}
              {isDigitalProduct(product)&&<span className="vm21-digital-qty">1 paket</span>}
              <button type="button" className="vm21-remove-action" onClick={()=>remove(product.id)} aria-label={'Hapus '+product.name}>Hapus</button>
            </div>
          </div>
          <strong className="vm21-line-total">{formatIDR(product.price_idr*quantity)}</strong>
        </article>)}
        <Link href="/catalog" className="vm21-text-link">← Lanjut belanja</Link>
      </section>
      <aside className="vm21-cart-order-summary">
        <span className="vm21-eyebrow">ORDER SUMMARY</span><h2>Ringkasan</h2>
        <div><span>Jumlah item</span><strong>{count}</strong></div>
        <div><span>Subtotal</span><strong>{formatIDR(subtotal)}</strong></div>
        <div className="vm21-cart-total"><span>Total</span><strong>{formatIDR(subtotal)}</strong></div>
        {digitalOnly?<DigitalCheckoutAction items={items} subtotal={subtotal}/>:
        <button className="vm21-primary" disabled type="button">Checkout produk belum tersedia</button>}
        <p>Preview staging. Tidak ada pembayaran, pengiriman, atau pemotongan saldo tanpa proses transaksi yang terverifikasi.</p>
      </aside>
    </div>}
 </div>;
}
