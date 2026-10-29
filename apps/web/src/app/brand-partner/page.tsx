import Link from 'next/link';
import {featuredArchiveItems} from '@/lib/archive-catalog';
import {ArchiveCard} from '@/components/archive-card';
export const metadata={title:'Brand Partner | Vapmart',robots:{index:false,follow:false}};
const brands=['OXVA','FOOM','IQOS','INTO','JOIWAY','SP2S','LANAVAPE','E-SUPER','ROLV','LIQUID CULT','TAZE','SEVEN LIQUID'];
export default function BrandPartnerPage(){
 return <main className="vm-brand-page">
   <h1>Brand Partner</h1>
   <p>Logo dan foto diambil dari media WordPress existing untuk pengecekan tampilan. Relasi kerja sama aktif belum diverifikasi pada sistem baru.</p>
   <div className="vm-partner-logos">{brands.map((brand,i)=><div className="vm-brand-logo" key={brand}>
     <img src={'/legacy/brands/brand-'+String(i+1).padStart(2,'0')+'.png'} alt={brand} width={100} height={100} loading="lazy"/>
     <span>{brand}</span>
   </div>)}</div>
   <h2 className="vm-lined-heading"><span>Produk dari Arsip</span></h2>
   <div className="vm-reference-grid">{featuredArchiveItems.slice(0,6).map(p=><ArchiveCard key={p.slug} item={p}/>)}</div>
   <Link href="/" className="vm-secondary-link">← Kembali ke beranda</Link>
 </main>;
}
