import Link from 'next/link';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {ArchiveCard} from '@/components/archive-card';
import {archiveCategories,categoryArchiveItems,isArchiveCategory} from '@/lib/archive-catalog';

export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const {slug}=await params;
 return {title:isArchiveCategory(slug)?archiveCategories[slug].label:'Kategori',robots:{index:false,follow:false}};
}
export default async function CategoryPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!isArchiveCategory(slug))notFound();
 const category=archiveCategories[slug];
 const items=categoryArchiveItems(slug);
 return <main className="vm-category-page" data-legacy-category={slug}>
   <h1 className="vm-lined-heading"><span>Rekomendasi {category.label} Untuk Kamu</span></h1>
   {items.length>0?
     <div className="vm-reference-grid">{items.map(item=><ArchiveCard item={item} key={item.slug}/>)}</div>
     :<div className="vm-category-empty"><h2>Belum ada data arsip kategori yang terverifikasi.</h2>
       <p>Template kategori siap digunakan. Konten lengkap memerlukan export katalog WordPress agar SKU dan media tidak salah pasangan.</p>
       <Link href="/catalog">Lihat katalog pengujian →</Link></div>}
   <div className="vm-category-bottom">Referensi visual produk dari snapshot WordPress. Harga historis, transaksi dinonaktifkan. <Link href="/catalog">Katalog produk DEMO</Link></div>
 </main>;
}
