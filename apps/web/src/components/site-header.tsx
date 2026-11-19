'use client';
import Link from 'next/link';
import {useEffect,useRef,useState,type CSSProperties,type MouseEvent} from 'react';
import {usePathname} from 'next/navigation';
import {useCart} from '@/lib/cart';
import {CartDrawer} from '@/components/cart-drawer';
import {ThemeSwitcher} from '@/components/theme-switcher';
import {BrandLogo} from '@/components/brand-logo';
import {useCustomerAuth} from '@/lib/customer-auth';

import {Icon} from './store-icon';
import type {IconName} from './store-icon';

export function SiteHeader(){
  const {count,setOpen,open}=useCart();
  const customer=useCustomerAuth();
  const pathname=usePathname();
  const searchRef=useRef<HTMLDetailsElement>(null);
  const [navigationIntent,setNavigationIntent]=useState<number|null>(null);
  const navigationTimer=useRef<number|null>(null);
  const isSubpage=/^\/(product\/|product-category\/|catalog|brand-partner|keranjang-2|checkout|pesanan|login|akun|member-2|asset-review)/.test(pathname);
  const categoryName:Record<string,string>={pod:'Pod',mod:'Mod',cartridge:'Cartridge','e-juice':'Liquid'};
  const segment=pathname.split('/')[2]||'';
  const caption=pathname.startsWith('/product-category/')?(categoryName[segment]||'Kategori'):pathname.startsWith('/product/')?'Detail Produk':pathname==='/catalog'?'Katalog':pathname==='/keranjang-2'?'Keranjang':pathname==='/checkout'?'Checkout':pathname.startsWith('/pesanan/')?'Pesanan':pathname==='/brand-partner'?'Brand Partner':pathname==='/member-2'?'Member':pathname==='/login'||pathname==='/akun'?'Akun':'';
  // Keep the brand anchored in the same header position across every route.
  // Back is a dedicated control below the sticky header, never inserted before the logo.
  const backHref=pathname.startsWith('/product/')||pathname.startsWith('/product-category/')?'/catalog':
    pathname==='/login'||pathname==='/akun'?'/member-2':
    pathname==='/checkout'?'/keranjang-2':pathname.startsWith('/pesanan/')?'/catalog':pathname==='/keranjang-2'?'/catalog':'/';
  const routeIndex=pathname==='/'
    ? 0
    : pathname==='/catalog'||pathname.startsWith('/product/')||pathname.startsWith('/product-category/')||pathname==='/asset-review'
      ? 1
      : pathname==='/brand-partner'
        ? 2
        : pathname==='/member-2'||pathname==='/login'||pathname==='/akun'
          ? 3
          : pathname==='/keranjang-2'||pathname==='/checkout'||pathname.startsWith('/pesanan/')
            ? 4
            : 0;
  const activeIndex=navigationIntent??(open?4:routeIndex);
  const onNavigationClick=(event:MouseEvent<HTMLAnchorElement>,index:number,href:string)=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    if(href===pathname){setNavigationIntent(null);return;}
    // Move the active pill immediately, while Next.js loads the destination.
    setNavigationIntent(index);
    if(navigationTimer.current!==null)window.clearTimeout(navigationTimer.current);
    navigationTimer.current=window.setTimeout(()=>{
      setNavigationIntent(null);
      navigationTimer.current=null;
    },4500);
  };
  useEffect(()=>()=>{if(navigationTimer.current!==null)window.clearTimeout(navigationTimer.current);},[]);
  useEffect(()=>{
    if(searchRef.current)searchRef.current.open=false;
    setOpen(false);
    setNavigationIntent(null);
    if(navigationTimer.current!==null){
      window.clearTimeout(navigationTimer.current);
      navigationTimer.current=null;
    }
  },[pathname,setOpen]);
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        if(searchRef.current?.open)searchRef.current.open=false;
        if(open)setOpen(false);
      }
    };
    document.addEventListener('keydown',onKey);
    return()=>document.removeEventListener('keydown',onKey);
  },[open,setOpen]);
  useEffect(()=>{
    const onOutside=(event:PointerEvent)=>{
      if(searchRef.current?.open&&!searchRef.current.contains(event.target as Node)){
        searchRef.current.open=false;
      }
    };
    document.addEventListener('pointerdown',onOutside);
    return()=>document.removeEventListener('pointerdown',onOutside);
  },[]);
  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=previous;};
  },[open]);

  const menu=[
    {href:'/',label:'Beranda',icon:'home' as const,active:routeIndex===0},
    {href:'/catalog',label:'Katalog',icon:'categories' as const,active:routeIndex===1},
    {href:'/brand-partner',label:'Brand',icon:'star' as const,active:routeIndex===2},
    {href:'/member-2',label:'Member',icon:'tag' as const,active:routeIndex===3},
  ];
  return <>
    <header className={isSubpage?'legacy-header vm-reference-header vm-subpage vm-modern-header':'legacy-header vm-reference-header vm-modern-header'}>
      <div className="main-container vm-header-main">
        <Link href="/" className="legacy-logo" aria-label="Beranda Vapmart"><BrandLogo variant="header"/></Link>
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
          <details ref={searchRef} className="vm-search-disclosure">
            <summary aria-label="Cari produk" title="Cari produk"><Icon name="search"/></summary>
            <form action="/catalog" role="search">
              <label className="sr-only" htmlFor="vm-popover-search">Cari produk</label>
              <input id="vm-popover-search" name="q" placeholder="Cari produk..." maxLength={80}/>
              <button type="submit">Cari</button>
            </form>
          </details>
          <ThemeSwitcher/>
          <button type="button" className="vm-reference-cart" onClick={()=>setOpen(true)} aria-label={'Buka keranjang, '+count+' barang'} aria-haspopup="dialog" aria-expanded={open}>
            <Icon name="cart"/><span className="cart-count">{count}</span>
          </button>
          <Link href={customer.user?'/member-2':'/login'} className="vm-reference-login"><Icon name="user"/><span>{customer.user?'Akun':'Masuk'}</span></Link>
        </div>
      </div>
    </header>
    {isSubpage&&<nav className="vm22-backbar" aria-label="Navigasi kembali">
      <div className="main-container vm22-backbar-inner">
        <Link href={backHref} className="vm22-back-link" aria-label={'Kembali dari '+caption}>
          <span className="vm22-back-icon"><Icon name="back"/></span>
          <span>Kembali</span>
        </Link>
        <span className="vm22-back-caption">{caption}</span>
      </div>
    </nav>}
    <nav className="legacy-mobile-nav vm-reference-mobile-nav vm-modern-mobile-nav"
      aria-label="Navigasi seluler" data-active-index={activeIndex} data-nav-pending={navigationIntent!==null?'true':undefined}
      style={{'--vm-active-index':activeIndex,'--vm-active-offset':`${activeIndex*100}%`} as CSSProperties}>
      <span className="vm-liquid-active-pill" aria-hidden="true"/>
      {menu.map((item,index)=><Link key={item.href} href={item.href} prefetch={true}
        onClick={event=>onNavigationClick(event,index,item.href)}
        className={activeIndex===index?'is-active':''} aria-current={item.active?'page':undefined}>
        <Icon name={item.icon}/><span>{item.label}</span>
      </Link>)}
      <Link href="/keranjang-2" prefetch={true} onClick={event=>onNavigationClick(event,4,'/keranjang-2')} className={activeIndex===4?'is-active':''}
        aria-current={pathname==='/keranjang-2'?'page':undefined}
        aria-label={'Keranjang, '+count+' barang'}>
        <Icon name="cart"/><span>Keranjang</span>{count>0&&<b className="vm-mobile-cart-count">{count}</b>}
      </Link>
    </nav>
    <CartDrawer/>
  </>;
}
