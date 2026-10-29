'use client';
import Link from 'next/link';
import {useCart} from '@/lib/cart';
import {usePathname} from 'next/navigation';
import {formatIDR} from '@/lib/types';

export function SiteHeader(){
  const {items,count,subtotal,setOpen,open,setQuantity,remove}=useCart();
  const pathname=usePathname();
  const isSubpage=/^\/(product\/|product-category\/|brand-partner|keranjang-2|login|akun|member-2)/.test(pathname);
  const categoryName:Record<string,string>={pod:'Pod',mod:'Mod',cartridge:'Cartridge','e-juice':'Liquid'};
  const segment=pathname.split('/')[2]||'';
  const caption=pathname.startsWith('/product-category/')?(categoryName[segment]||'Kategori'):pathname==='/keranjang-2'?'Keranjang':pathname==='/member-2'?'Member':pathname==='/login'||pathname==='/akun'?'Login':'';
  return <>
    <header className={isSubpage?"legacy-header vm-reference-header vm-subpage":"legacy-header vm-reference-header"}>
      <div className="main-container vm-header-main">
        {isSubpage&&<Link href="/" className="vm-subpage-back" aria-label="Kembali ke beranda">←</Link>}
        {isSubpage&&<span className="vm-subpage-caption">{caption}</span>}
        <Link href="/" className="legacy-logo" aria-label="Beranda Vapmart"><img src="/legacy/vapmart-logo-white.webp" alt="Vapmart" width="120" height="26"/></Link>
        <div className="vm-reference-actions">
          <details className="vm-search-disclosure">
            <summary aria-label="Cari produk" title="Cari produk">⌕</summary>
            <form action="/catalog" role="search">
              <label className="sr-only" htmlFor="vm-popover-search">Cari produk</label>
              <input id="vm-popover-search" name="q" placeholder="Cari produk..." maxLength={80}/>
              <button type="submit">Cari</button>
            </form>
          </details>
          <button type="button" className="vm-reference-cart" onClick={()=>setOpen(true)} aria-label={'Buka keranjang, '+count+' barang'}>
            <span aria-hidden="true">♧</span><span className="cart-count">{count}</span>
          </button>
          <Link href="/login" className="vm-reference-login">Login</Link>
        </div>
      </div>
    </header>
    <nav className={isSubpage?"legacy-mobile-nav vm-reference-mobile-nav vm-subpage-mobile-nav":"legacy-mobile-nav vm-reference-mobile-nav"} aria-label="Navigasi seluler">
      <Link href="/"><span aria-hidden="true">⌂</span>Home</Link>
      <Link href="/member-2"><span aria-hidden="true">♧</span>Member</Link>
      <Link href="/#promo"><span aria-hidden="true">▤</span>Promo</Link>
      <button type="button" onClick={()=>setOpen(true)}><span aria-hidden="true">🛒</span>Keranjang</button>
      <Link href="/login"><span aria-hidden="true">♙</span>Akun</Link>
    </nav>
    {open&&<div className="drawer-shell" role="presentation"><button className="drawer-shade" onClick={()=>setOpen(false)} aria-label="Tutup keranjang"/><aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Keranjang belanja"><div className="drawer-head"><div><div className="eyebrow">YOUR BAG</div><h2>Keranjang <span className="muted">{count}</span></h2></div><button className="close-btn" onClick={()=>setOpen(false)} aria-label="Tutup">×</button></div>
      <div className="drawer-items">{items.length===0?<div className="cart-empty"><div className="big-mark">✳</div><h3>Keranjang masih kosong.</h3><p>Temukan produk favoritmu di koleksi Vapmart.</p><Link href="/catalog" className="button button-dark" onClick={()=>setOpen(false)}>Jelajahi produk</Link></div>:items.map(({product,quantity})=><div key={product.id} className="cart-row"><div className="tiny-product">{product.image_url?<img src={product.image_url} alt="" />:<span>✦</span>}</div><div className="cart-row-info"><strong>{product.name}</strong><span>{formatIDR(product.price_idr)}</span><div className="quantity"><button onClick={()=>setQuantity(product.id,quantity-1)} disabled={quantity<=1} aria-label="Kurangi jumlah">−</button><span>{quantity}</span><button onClick={()=>setQuantity(product.id,quantity+1)} disabled={quantity>=product.stock_qty} aria-label="Tambah jumlah">+</button></div></div><button className="remove" onClick={()=>remove(product.id)} aria-label={`Hapus ${product.name}`}>×</button></div>)}</div>
      <div className="drawer-foot"><div className="summary"><span>Subtotal</span><strong>{formatIDR(subtotal)}</strong></div><Link href="/keranjang-2" className="vm-view-cart-link" onClick={()=>setOpen(false)}>Lihat keranjang</Link><button className="button button-dark checkout-disabled" disabled>Checkout belum tersedia</button><p className="fine-print">Preview staging. Pembayaran dan pemesanan belum diaktifkan.</p></div>
    </aside></div>}
  </>;
}
