'use client';
import {useRouter} from 'next/navigation';
import {useCustomerAuth} from '@/lib/customer-auth';
import {AdminProductRecords} from '@/components/admin-product-records';
export default function ArchiveConversionPage(){
 const auth=useCustomerAuth(),router=useRouter();
 return <div className="vc-root">
  <div className="vc-toolbar"><div><h2>Arsip & Konversi Produk</h2><p className="vc-muted">Pilih produk arsip dan klik Publish ke Katalog. Foto dan nama dipindahkan ke draft baru, lalu lengkapi SKU, deskripsi, kategori, harga, stok dan minimal 3 foto sebelum produk dapat ditayangkan. Data arsip asli tetap aman.</p></div></div>
  <AdminProductRecords archiveMode token={auth.accessToken||''} products={[]}
   onEdit={p=>router.push('/admin/products/'+p.id)}
   onPublish={p=>router.push('/admin/products/'+p.id)}
   onNew={()=>router.push('/admin/products/new')} onSynced={()=>{}} busy={false}/>
 </div>;
}
