'use client';
import {useEffect,useState,type ReactNode} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {AdminBrandLogo} from '@/components/admin-brand-logo';
import '../app/admin-v27.css';

export type AdminSection='overview'|'products'|'warehouses'|'brands'|'orders'|'vouchers'|'fulfillment'|'courier'|'shipping'|'media'|'settings';
const sections:{key:AdminSection;name:string;symbol:string;hint?:string}[]=[
 {key:'settings',name:'Pengaturan',symbol:'⚙'},
 {key:'overview',name:'Ringkasan',symbol:'▦'},
 {key:'products',name:'Produk & SKU',symbol:'◫'},
 {key:'media',name:'Media & Aset',symbol:'▧'},
 {key:'brands',name:'Brand & Akses',symbol:'◇'},
 {key:'warehouses',name:'Gudang & Stok',symbol:'▤'},
 {key:'orders',name:'Pesanan',symbol:'≡'},
 {key:'vouchers',name:'Voucher & Promo',symbol:'%'}, 
 {key:'fulfillment',name:'Fulfillment',symbol:'◎'},
 {key:'courier',name:'Courier Ops',symbol:'⇥'},
 {key:'shipping',name:'Pengiriman',symbol:'⌁'}
];
export const adminTitles:Record<AdminSection,string>={
 settings:'Pengaturan',overview:'Dashboard',products:'Produk & SKU',media:'Media & Aset',brands:'Brand & Akses',
 warehouses:'Gudang & Stok',orders:'Pesanan',vouchers:'Voucher & Promo',fulfillment:'Fulfillment',
 courier:'Courier Ops',shipping:'Pengiriman'
};
export const adminDescriptions:Record<AdminSection,string>={
 settings:'Kelola profil dan identitas toko.',
 overview:'Seluruh aktivitas toko dalam satu tampilan.',
 products:'Kelola SKU, informasi, foto, dan publikasi secara terukur.',
 media:'Tinjau dan atur media asli dari sumber yang terlindungi.',
 brands:'Kelola identitas brand dan hak akses mitra.',
 warehouses:'Lacak stok fisik, reservasi, dan pergerakan antar lokasi.',
 orders:'Pantau pesanan dan status pembayaran yang terverifikasi.',
 vouchers:'Buat, jadwalkan, aktifkan, dan pantau penggunaan voucher checkout.',
 fulfillment:'Tindak lanjuti picking, packing, dan persiapan pengiriman.',
 courier:'Siapkan manifest dan tinjau tracking serta retur.',
 shipping:'Konfigurasi pengiriman dan estimasi ongkir yang aman.'
};
export function AdminWorkspace({active,onNavigate,onLogout,email,children}:{
 active:AdminSection;onNavigate:(section:AdminSection)=>void;onLogout:()=>void|Promise<void>;email:string|null|undefined;children:ReactNode;
}){
 const [open,setOpen]=useState(false);const router=useRouter();
 useEffect(()=>setOpen(false),[active]);
 const navigate=(s:AdminSection)=>{setOpen(false);if(s==='settings'){router.push('/admin/settings');return;}if(s==='products'){router.push('/admin/products');return;}if(s==='orders'){router.push('/admin/orders');return;}if(s==='vouchers'){router.push('/admin/vouchers');return;}onNavigate(s);};
 return <div className="vma27-workspace">
  <a className="vma27-skip-link" href="#admin-main">Langsung ke konten</a>
  {open&&<button type="button" className="vma27-nav-backdrop" aria-label="Tutup navigasi lewat overlay" onClick={()=>setOpen(false)}/>}
  <aside className={'vma27-sidebar'+(open?' is-open':'')} aria-label="Navigasi administrator">
   <div className="vma27-sidebar-brand">
    <AdminBrandLogo placement="sidebar"/>
    <button type="button" className="vma27-close-nav" aria-label="Tutup menu" onClick={()=>setOpen(false)}>×</button>
   </div>
   <div className="vma27-sidebar-section">WORKSPACE</div>
   <nav id="vma27-admin-menu" className="vma27-side-links" aria-label="Menu Control Panel">
    {sections.map(({key,name,symbol})=><button type="button" key={key}
     className={'vma27-side-link'+(active===key?' is-active':'')} aria-current={active===key?'page':undefined}
     onClick={()=>navigate(key)}>
      <span className="vma27-side-symbol" aria-hidden="true">{symbol}</span><span>{name}</span>
      {active===key&&<span className="vma27-side-marker" aria-hidden="true"/>}
     </button>)}
   </nav>
   <div className="vma27-sidebar-bottom">
    <div className="vma27-locked-card"><span className="vma27-lock-icon" aria-hidden="true">●</span><strong>Operasional terlindungi</strong>
     <p>Pembayaran gateway nonaktif. Booking kurir melalui Courier Ops.</p></div>
    <Link href="/" className="vma27-storefront-link">↗ Lihat storefront</Link>
   </div>
  </aside>
  <div className="vma27-content">
   <header className="vma27-topbar">
    <div className="vma27-topbar-start">
     <button type="button" className="vma27-menu-toggle" aria-expanded={open} aria-controls="vma27-admin-menu"
      aria-label={open?'Tutup navigasi':'Buka navigasi'} onClick={()=>setOpen(x=>!x)}>☰</button>
     <div className="vma27-topbar-title"><small>VAPMART / ADMIN</small><strong>{adminTitles[active]}</strong></div>
    </div>
    <div className="vma27-topbar-actions">
     <span className="vma27-secure-state"><span aria-hidden="true"/> Sesi terverifikasi</span>
     <span className="vma27-user-email" title={email||'Administrator'}>{email||'Administrator'}</span>
     <button type="button" className="vma27-signout" onClick={()=>void onLogout()}>Keluar</button>
    </div>
   </header>
   <main className="vma26-root vma27-main" id="admin-main" tabIndex={-1}>
    {children}
   </main>
  </div>
 </div>;
}
