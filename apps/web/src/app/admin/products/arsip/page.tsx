'use client';
import {useRouter} from 'next/navigation';
import {useCustomerAuth} from '@/lib/customer-auth';
import {AdminProductRecords} from '@/components/admin-product-records';
export default function ArchiveConversionPage(){
 const auth=useCustomerAuth(),router=useRouter();
 return <div className="vc-root">
  <div className="vc-toolbar"><div><h2>Arsip & Konversi Produk</h2><p className="vc-muted">Arsip historis tetap read-only. Pilih satu produk untuk membuat draft operasional berharga Rp0, stok 0, dan tanpa publikasi otomatis.</p></div></div>
  <AdminProductRecords token={auth.accessToken||''} products={[]}
   onEdit={p=>router.push('/admin/products/'+p.id)}
   onPublish={p=>router.push('/admin/products/'+p.id)}
   onNew={()=>router.push('/admin/products/new')} onSynced={()=>{}} busy={false}/>
 </div>;
}
