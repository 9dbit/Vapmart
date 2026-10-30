'use client';
import Link from 'next/link';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {useCart} from '@/lib/cart';
import {formatIDR} from '@/lib/types';

type IconName='search'|'cart'|'user'|'home'|'categories'|'star'|'tag'|'back';
function Icon({name}:{name:IconName}){
  const common={viewBox:'0 0 24 24',width:21,height:21,fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true as const};
  if(name==='search')return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>;
  if(name==='cart')return <svg {...common}><path d="M3 4h2l2.2 11.4a2 2 0 0 0 2 1.6h9.5a2 2 0 0 0 2-1.5L22 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="19" cy="20" r="1"/></svg>;
  if(name==='user')return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>;
  if(name==='home')return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/></svg>;
  if(name==='categories')return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>;
  if(name==='star')return <svg {...common}><path d="m12 2 2.9 6 6.6.9-4.8 4.7 1.1 6.6-5.8-3.1-5.8 3.1 1.1-6.6-4.8-4.7L9.1 8Z"/></svg>;
  if(name==='tag')return <svg {...common}><path d="M3 4h9l9 9-8 8-10-10V4Z"/><circle cx="8" cy="9" r="1"/></svg>;
  return <svg {...common}><path d="m15 18-6-6 6-6"/></svg>;
}

export function SiteHeader(){
  const {items,count,subtotal,setOpen,open,setQuantity,remove}=useCart();
  const pathname=usePathname();
  const isSubpage=/^\/(product\/|product-category\/|brand-partner|keranjang-2|login|akun|member-2)/.test(pathname);
  const categoryName:Record<string,string>={pod:'Pod',mod:'Mod',cartridge:'Cartridge','e-juice':'Liquid'};
  const segment=pathname.split('/')[2]||'';
  const caption=pathname.startsWith('/product-category/')?(categoryName[segment]||'Kategori'):pathname==='/keranjang-2'?'Keranjang':pathname==='/member-2'?'Member':pathname==='/login'||pathname==='/akun'?'Masuk':'';
  useEffect(()=>{
    if(!open)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};
    document.addEventListener('keydown',onKey);
    return()=>document.removeEventListener('keydown',onKey);
  },[open,setOpen]);

  const menu=[
    {href:'/',label:'Beranda',icon:'home' as const,active:pathname==='/'},
    {href:'/catalog',label:'Katalog',icon:'categories' as const,active:pathname==='/catalog'},
    {href:'/brand-partner',label:'Brand',icon:'star' as const,active:pathname==='/brand-partner'},
    {href:'/member-2',label:'Member',icon:'tag' as const,active:pathname==='/member-2'},
  ];
  return <>
    <header className={isSubpage?'legacy-header vm-reference-header vm-subpage vm-modern-header':'legacy-header vm-reference-header vm-modern-header'}>
      <div className="main-container vm-header-main">
        {isSubpage&&<Link href="/" className="vm-subpage-back" aria-label="Kembali ke beranda"><Icon name="back"/></Link>}
        {isSubpage&&<span className="vm-subpage-caption">{caption}</span>}
        <Link href="/" className="legacy-logo" aria-label="Beranda Vapmart"><img src="/branding/vapmart-logo.png" alt="Vapmart" width="180" height="36"/></Link>
        <nav className="vm-desktop-links" aria-label="Menu utama">
          {menu.map(item=><Link href={item.href} key={item.href} className={item.active?'is-active':''} aria-current={item.active?'page':undefined}>{item.label}</Link>)}
        </nav>
        <div className="vm-reference-actions">
          <form action="/catalog" role="search" className="vm-header-pill-search">
            <label className="sr-only" htmlFor="vm-header-query">Cari produk</label>
            <Icon name="search"/>
            <input id="vm-header-query" name="q" placeholder="Cari produk..." autoComplete="off" maxLength={80}/>
            <button type="submit" aria-label="Jalankan pencarian"><span>↗</span></button>
          </form>
          <details className="vm-search-disclosure">
            <summary aria-label="Cari produk" title="Cari produk"><Icon name="search"/></summary>
            <form action="/catalog" role="search">
              <label className="sr-only" htmlFor="vm-popover-search">Cari produk</label>
              <input id="vm-popover-search" name="q" placeholder="Cari produk..." maxLength={80}/>
              <button type="submit">Cari</button>
            </form>
          </details>
          <button type="button" className="vm-reference-cart" onClick={()=>setOpen(true)} aria-label={'Buka keranjang, '+count+' barang'}>
            <Icon name="cart"/><span className="cart-count">{count}</span>
          </button>
          <Link href="/login" className="vm-reference-login"><Icon name="user"/><span>Masuk</span></Link>
        </div>
      </div>
    </header>
    <nav className="legacy-mobile-nav vm-reference-mobile-nav vm-modern-mobile-nav" aria-label="Navigasi seluler">
      {menu.map(item=><Link key={item.href} href={item.href} className={item.active?'is-active':''} aria-current={item.active?'page':undefined}>
        <Icon name={item.icon}/><span>{item.label}</span>
      </Link>)}
      <button type="button" onClick={()=>setOpen(true)} aria-label={'Keranjang, '+count+' barang'}>
        <Icon name="cart"/><span>Keranjang</span>{count>0&&<b className="vm-mobile-cart-count">{count}</b>}
      </button>
    </nav>
    {open&&<div className="drawer-shell" role="presentation"><button className="drawer-shade" onClick={()=>setOpen(false)} aria-label="Tutup keranjang"/><aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Keranjang belanja"><div className="drawer-head"><div><div className="eyebrow">YOUR BAG</div><h2>Keranjang <span className="muted">{count}</span></h2></div><button className="close-btn" onClick={()=>setOpen(false)} aria-label="Tutup">×</button></div>
      <div className="drawer-items">{items.length===0?<div className="cart-empty"><div className="big-mark">✳</div><h3>Keranjang masih kosong.</h3><p>Temukan produk favoritmu di koleksi Vapmart.</p><Link href="/catalog" className="button button-dark" onClick={()=>setOpen(false)}>Jelajahi produk</Link></div>:items.map(({product,quantity})=><div key={product.id} className="cart-row"><div className="tiny-product">{product.image_url?<img src={product.image_url} alt="" />:<span>✦</span>}</div><div className="cart-row-info"><strong>{product.name}</strong><span>{formatIDR(product.price_idr)}</span><div className="quantity"><button onClick={()=>setQuantity(product.id,quantity-1)} disabled={quantity<=1} aria-label="Kurangi jumlah">−</button><span>{quantity}</span><button onClick={()=>setQuantity(product.id,quantity+1)} disabled={quantity>=product.stock_qty} aria-label="Tambah jumlah">+</button></div></div><button className="remove" onClick={()=>remove(product.id)} aria-label={`Hapus ${product.name}`}>×</button></div>)}</div>
      <div className="drawer-foot"><div className="summary"><span>Subtotal</span><strong>{formatIDR(subtotal)}</strong></div><Link href="/keranjang-2" className="vm-view-cart-link" onClick={()=>setOpen(false)}>Lihat keranjang</Link><button className="button button-dark checkout-disabled" disabled>Checkout belum tersedia</button><p className="fine-print">Preview staging. Pembayaran dan pemesanan belum diaktifkan.</p></div>
    </aside></div>}
  </>;
}
