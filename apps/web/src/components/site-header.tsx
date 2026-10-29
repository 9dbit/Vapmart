'use client';
import Link from 'next/link';
import {useCart} from '@/lib/cart';
import {formatIDR} from '@/lib/types';

export function SiteHeader(){
  const {items,count,subtotal,setOpen,open,setQuantity,remove}=useCart();
  return <>
    <header className="site-header"><div className="header-inner">
      <Link href="/" aria-label="Vapmart home" className="brand"><span className="brand-mark">V</span><span>vapmart<span className="brand-dot">.</span></span></Link>
      <nav aria-label="Navigasi utama" className="nav-links"><Link href="/#shop">Shop</Link><Link href="/#categories">Categories</Link><Link href="/#about">About</Link></nav>
      <div className="header-actions"><span className="staging-chip">PREVIEW STORE</span><button className="cart-icon" onClick={()=>setOpen(true)} aria-label={`Buka keranjang, ${count} barang`}><span aria-hidden>▣</span><span className="cart-count">{count}</span></button></div>
    </div></header>
    {open&&<div className="drawer-shell" role="presentation"><button className="drawer-shade" onClick={()=>setOpen(false)} aria-label="Tutup keranjang"/><aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Keranjang belanja"><div className="drawer-head"><div><div className="eyebrow">YOUR BAG</div><h2>Keranjang <span className="muted">{count}</span></h2></div><button className="close-btn" onClick={()=>setOpen(false)} aria-label="Tutup">×</button></div>
      <div className="drawer-items">{items.length===0?<div className="cart-empty"><div className="big-mark">✳</div><h3>Keranjang masih kosong.</h3><p>Temukan produk favoritmu di koleksi Vapmart.</p><button className="button button-dark" onClick={()=>setOpen(false)}>Jelajahi produk</button></div>:items.map(({product,quantity})=><div key={product.id} className="cart-row"><div className="tiny-product">{product.image_url?<img src={product.image_url} alt="" />:<span>✦</span>}</div><div className="cart-row-info"><strong>{product.name}</strong><span>{formatIDR(product.price_idr)}</span><div className="quantity"><button onClick={()=>setQuantity(product.id,quantity-1)} disabled={quantity<=1} aria-label="Kurangi jumlah">−</button><span>{quantity}</span><button onClick={()=>setQuantity(product.id,quantity+1)} disabled={quantity>=product.stock_qty} aria-label="Tambah jumlah">+</button></div></div><button className="remove" onClick={()=>remove(product.id)} aria-label={`Hapus ${product.name}`}>×</button></div>)}</div>
      <div className="drawer-foot"><div className="summary"><span>Subtotal</span><strong>{formatIDR(subtotal)}</strong></div><button className="button button-dark checkout-disabled" disabled>Checkout belum tersedia</button><p className="fine-print">Preview staging. Pembayaran dan pemesanan belum diaktifkan.</p></div>
    </aside></div>}
  </>;
}
