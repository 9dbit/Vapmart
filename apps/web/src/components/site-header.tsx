'use client';
import Link from 'next/link';
import {useCart} from '@/lib/cart';
import {formatIDR} from '@/lib/types';

export function SiteHeader(){
  const {items,count,subtotal,setOpen,open,setQuantity,remove}=useCart();
  return <>
    <div className="legacy-topbar">
      <div className="main-container legacy-topbar-inner">
        <span>Vapmart Store · Preview Katalog Non-Nikotin</span>
        <div className="legacy-topbar-actions">
          <button type="button" onClick={()=>setOpen(true)} aria-label="Buka keranjang dari header">
            {formatIDR(subtotal)} <span>{count} Cart</span>
          </button>
          <Link href="/akun">Login</Link>
        </div>
      </div>
    </div>
    <header className="legacy-header">
      <div className="main-container legacy-header-inner">
        <Link href="/" className="legacy-logo" aria-label="Vapmart beranda">
          <span className="legacy-logo-icon" aria-hidden="true">V</span>
          <span>Vap<span>Mart</span></span>
        </Link>
        <nav className="legacy-main-nav" aria-label="Menu utama">
          <Link href="/">Home</Link>
          <Link href="/#categories">Kategori Produk</Link>
          <Link href="/#shop">Produk Pilihan</Link>
          <Link href="/#promo">Promo</Link>
          <Link href="/#brand">Brand Partner</Link>
        </nav>
        <div className="legacy-header-actions">
          <Link href="/#shop" className="legacy-header-search" aria-label="Cari produk">⌕</Link>
          <Link href="/akun" className="legacy-header-account" aria-label="Akun">♙</Link>
          <button type="button" className="cart-icon legacy-cart-trigger" onClick={()=>setOpen(true)} aria-label={`Buka keranjang, ${count} barang`}>
            <span aria-hidden="true">▤</span><span className="cart-count">{count}</span>
          </button>
        </div>
      </div>
    </header>
    <nav className="legacy-mobile-nav" aria-label="Navigasi seluler">
      <Link href="/"><span aria-hidden="true">⌂</span>Home</Link>
      <Link href="/#member"><span aria-hidden="true">♧</span>Member</Link>
      <Link href="/#promo"><span aria-hidden="true">◇</span>Promo</Link>
      <button type="button" onClick={()=>setOpen(true)}><span aria-hidden="true">▤</span>Keranjang</button>
      <Link href="/akun"><span aria-hidden="true">♙</span>Akun</Link>
    </nav>
    {open&&<div className="drawer-shell" role="presentation"><button className="drawer-shade" onClick={()=>setOpen(false)} aria-label="Tutup keranjang"/><aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Keranjang belanja"><div className="drawer-head"><div><div className="eyebrow">YOUR BAG</div><h2>Keranjang <span className="muted">{count}</span></h2></div><button className="close-btn" onClick={()=>setOpen(false)} aria-label="Tutup">×</button></div>
      <div className="drawer-items">{items.length===0?<div className="cart-empty"><div className="big-mark">✳</div><h3>Keranjang masih kosong.</h3><p>Temukan produk favoritmu di koleksi Vapmart.</p><button className="button button-dark" onClick={()=>setOpen(false)}>Jelajahi produk</button></div>:items.map(({product,quantity})=><div key={product.id} className="cart-row"><div className="tiny-product">{product.image_url?<img src={product.image_url} alt="" />:<span>✦</span>}</div><div className="cart-row-info"><strong>{product.name}</strong><span>{formatIDR(product.price_idr)}</span><div className="quantity"><button onClick={()=>setQuantity(product.id,quantity-1)} disabled={quantity<=1} aria-label="Kurangi jumlah">−</button><span>{quantity}</span><button onClick={()=>setQuantity(product.id,quantity+1)} disabled={quantity>=product.stock_qty} aria-label="Tambah jumlah">+</button></div></div><button className="remove" onClick={()=>remove(product.id)} aria-label={`Hapus ${product.name}`}>×</button></div>)}</div>
      <div className="drawer-foot"><div className="summary"><span>Subtotal</span><strong>{formatIDR(subtotal)}</strong></div><button className="button button-dark checkout-disabled" disabled>Checkout belum tersedia</button><p className="fine-print">Preview staging. Pembayaran dan pemesanan belum diaktifkan.</p></div>
    </aside></div>}
  </>;
}
