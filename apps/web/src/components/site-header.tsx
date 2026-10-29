'use client';
import Link from 'next/link';
import {useCart} from '@/lib/cart';
import {formatIDR} from '@/lib/types';

export function SiteHeader(){
  const {items,count,subtotal,setOpen,open,setQuantity,remove}=useCart();
  return <>
    <div className="legacy-topbar">
      <div className="main-container legacy-topbar-inner">
        <span>VAPMART · NEW COLLECTION</span>
        <div className="legacy-topbar-actions">
          <span className="vm-preview-notice">PREVIEW NON-NIKOTIN</span>
          <button type="button" onClick={()=>setOpen(true)} aria-label="Buka keranjang dari header">{formatIDR(subtotal)} <span>{count} Cart</span></button>
          <Link href="/akun">Login</Link>
        </div>
      </div>
    </div>
    <header className="legacy-header">
      <div className="main-container vm-header-main">
        <Link href="/" className="legacy-logo" aria-label="Beranda Vapmart">
          <img src="/legacy/vapmart-logo-white.webp" alt="Vapmart" width="176" height="39"/>
        </Link>
        <form action="/" method="GET" className="vm-header-search-form" role="search">
          <label htmlFor="vm-header-search" className="sr-only">Cari produk Vapmart</label>
          <input id="vm-header-search" type="search" name="q" maxLength={80} placeholder="Cari produk Vapmart..." autoComplete="off"/>
          <button type="submit" aria-label="Cari produk">⌕</button>
        </form>
        <div className="legacy-header-actions">
          <Link href="/akun" className="legacy-header-account" aria-label="Akun pelanggan"><span aria-hidden="true">♙</span></Link>
          <button type="button" className="cart-icon legacy-cart-trigger" onClick={()=>setOpen(true)} aria-label={`Buka keranjang, ${count} barang`}>
            <span aria-hidden="true">▤</span><span className="cart-count">{count}</span>
          </button>
        </div>
      </div>
      <div className="vm-navigation-wrap">
        <nav className="main-container legacy-main-nav" aria-label="Menu utama">
          <Link href="/">Home</Link>
          <Link href="/#categories">Kategori Produk</Link>
          <Link href="/#promo">Promo</Link>
          <Link href="/#brand">Brand Partner</Link>
          <Link href="/#shop">Produk Pilihan</Link>
          <Link href="/#news">News</Link>
        </nav>
      </div>
    </header>
    <nav className="legacy-mobile-nav" aria-label="Navigasi seluler">
      <Link href="/"><span aria-hidden="true">⌂</span>Home</Link>
      <Link href="/#categories"><span aria-hidden="true">⊞</span>Kategori</Link>
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
