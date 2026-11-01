import Link from 'next/link';
import {getBrands} from '@/lib/api';
export const dynamic='force-dynamic';
export const metadata={title:'Brand Partner | Vapmart',robots:{index:false,follow:false}};
export default async function BrandPartnerPage(){
 const brands=await getBrands();
 return <main className="vm-brand-page vm-partner-page">
  <div className="vm-partner-intro"><Link href="/" className="back-link">← Kembali ke beranda</Link>
   <span className="vm-trendora-eyebrow">VAPMART PARTNERS</span><h1>Brand Partner</h1>
   <p>Brand aktif dan terverifikasi yang tersedia di katalog Vapmart.</p>
  </div>
  {brands.length?<div className="vm-partner-logos" role="list" aria-label="Daftar brand aktif">{brands.map(b=><article id={'brand-'+b.slug} role="listitem" className="vm-brand-logo vm-brand-card vm-partner-card" key={b.id}>
   <span className="vm-brand-stage">{b.logo_url?<img src={b.logo_url} alt={'Logo '+b.name} width={400} height={400} loading="lazy" decoding="async"/>:<strong>{b.name.slice(0,2).toUpperCase()}</strong>}</span>
   <span className="vm-brand-name">{b.name}</span></article>)}</div>:
  <section className="main-container vm-commerce-empty"><h2>Brand segera hadir.</h2><p>Brand hanya ditampilkan setelah terdaftar dan diaktifkan oleh tim Vapmart.</p></section>}
  <Link href="/catalog" className="vm-secondary-link">Lihat katalog ↗</Link>
 </main>;
}
