import Link from 'next/link';
import {featuredArchiveItems} from '@/lib/archive-catalog';
import {ArchiveCard} from '@/components/archive-card';
import {brandPartners} from '@/lib/merchandising';
import {getBrands} from '@/lib/api';

export const metadata={title:'Brand Partner | Vapmart',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function BrandPartnerPage(){
  const brands=await getBrands();
  const partnerList=brands.length>0?brands.map(b=>({name:b.name,slug:b.slug,image:b.logo_url||''})):brandPartners;
  return <main className="vm-brand-page vm-partner-page">
    <div className="vm-partner-intro">
      <Link href="/" className="back-link">← Kembali ke beranda</Link>
      <span className="vm-trendora-eyebrow">THE ORIGINAL COLLECTION</span>
      <h1>Brand Partner</h1>
      <p>{brands.length>0?'Brand aktif terdaftar pada katalog Vapmart.':'Logo original dari arsip Vapmart. Informasi kerja sama aktif belum diverifikasi pada platform baru.'}</p>
    </div>
    <div className="vm-partner-logos" role="list" aria-label="Direktori brand Vapmart">
      {partnerList.map(brand=><article id={'brand-'+brand.slug} role="listitem"
        className="vm-brand-logo vm-brand-card vm-partner-card" key={brand.slug}>
        <span className="vm-brand-stage">
          {brand.image?<img src={brand.image} alt={'Logo '+brand.name} width={400} height={400} loading="lazy" decoding="async"/>:<span style={{fontWeight:800,fontSize:34,color:'#7f2dc4'}}>{brand.name.slice(0,2).toUpperCase()}</span>}
        </span>
        <span className="vm-brand-name">{brand.name}</span>
      </article>)}
    </div>
    {brands.length===0&&<h2 className="vm-lined-heading"><span>Produk dari Arsip</span></h2>}
    {brands.length===0&&<div className="vm-reference-grid">{featuredArchiveItems.slice(0,6).map(p=><ArchiveCard key={p.slug} item={p}/>)}</div>}
    <Link href="/" className="vm-secondary-link">← Kembali ke beranda</Link>
  </main>;
}
