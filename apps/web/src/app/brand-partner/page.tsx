import Link from 'next/link';
import {getBrands} from '@/lib/api';
import {brandPartners} from '@/lib/merchandising';
import '../restored-home.css';
export const dynamic='force-dynamic';
export const metadata={title:'Brand Partner | Vapmart',robots:{index:false,follow:false}};
export default async function BrandPartnerPage(){
 const brands=await getBrands();
 return <main className="vm-brand-page vm-partner-page">
   <div className="vm-partner-intro"><Link href="/" className="back-link">← Kembali ke beranda</Link>
     <span className="vm-trendora-eyebrow">VAPMART PARTNERS</span><h1>Brand Partner</h1>
     <p>Brand aktif berasal dari database. Logo historis dari website lama tersedia sebagai referensi tampilan.</p>
   </div>
   {brands.length>0?<div className="vm-partner-logos" role="list" aria-label="Daftar brand aktif">
     {brands.map(b=><article id={'brand-'+b.slug} role="listitem" className="vm-brand-logo vm-brand-card vm-partner-card" key={b.id}>
       <span className="vm-brand-stage">{b.logo_url?<img src={b.logo_url} alt={'Logo '+b.name} width={400} height={400} loading="lazy" decoding="async"/>:<strong>{b.name.slice(0,2).toUpperCase()}</strong>}</span>
       <span className="vm-brand-name">{b.name}</span>
     </article>)}
   </div>:<section className="vm-restored-brand-reference"><h2>Logo brand dari arsip desain</h2>
     <p>Belum ada partner aktif yang diverifikasi dalam database. Logo di bawah hanya materi referensi historis.</p>
     <div className="vm-partner-logos" role="list" aria-label="Logo historis">
       {brandPartners.map(b=><article className="vm-brand-logo vm-brand-card vm-partner-card" role="listitem" key={b.slug}>
         <span className="vm-brand-stage"><img src={b.image} width={400} height={400} loading="lazy" alt={'Logo referensi '+b.name}/></span>
         <span className="vm-brand-name">{b.name}</span>
       </article>)}
     </div>
   </section>}
   <Link href="/catalog" className="vm-secondary-link">Lihat katalog ↗</Link>
 </main>;
}
