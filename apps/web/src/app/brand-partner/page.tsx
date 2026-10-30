import Link from 'next/link';
import {featuredArchiveItems} from '@/lib/archive-catalog';
import {ArchiveCard} from '@/components/archive-card';
import {brandPartners} from '@/lib/merchandising';

export const metadata={title:'Brand Partner | Vapmart',robots:{index:false,follow:false}};
export default function BrandPartnerPage(){
  return <main className="vm-brand-page vm-partner-page">
    <div className="vm-partner-intro">
      <Link href="/" className="back-link">← Kembali ke beranda</Link>
      <span className="vm-trendora-eyebrow">THE ORIGINAL COLLECTION</span>
      <h1>Brand Partner</h1>
      <p>Logo original dari arsip Vapmart. Informasi kerja sama aktif belum diverifikasi pada platform baru.</p>
    </div>
    <div className="vm-partner-logos" role="list" aria-label="Daftar 12 brand dari media Vapmart existing">
      {brandPartners.map(brand=><article id={'brand-'+brand.slug} role="listitem"
        className="vm-brand-logo vm-brand-card vm-partner-card" key={brand.slug}>
        <span className="vm-brand-stage">
          <img src={brand.image} alt={'Logo '+brand.name} width={400} height={400} loading="lazy" decoding="async"/>
        </span>
        <span className="vm-brand-name">{brand.name}</span>
      </article>)}
    </div>
    <h2 className="vm-lined-heading"><span>Produk dari Arsip</span></h2>
    <div className="vm-reference-grid">{featuredArchiveItems.slice(0,6).map(p=><ArchiveCard key={p.slug} item={p}/>)}</div>
    <Link href="/" className="vm-secondary-link">← Kembali ke beranda</Link>
  </main>;
}
