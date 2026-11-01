'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useCustomerAuth} from '@/lib/customer-auth';
import '../brand-portal.css';
type BrandGrant={id:string;name:string;slug:string;role:string};
type Summary={brandId:string;role:string;inventory:{products:number;published:number;total_stock:string;low_stock:number};sales:{paid_orders:string;units_sold:string;gross_item_sales_idr:string};salesBasis:string};
type BrandProduct={id:string;sku:string|null;name:string;price_idr:string;stock_qty:number;is_active:boolean;weight_grams:number|null};
type Sale={product_id:string;sku:string|null;name:string;units_sold:string;gross_item_sales_idr:string};
const rupiah=(v:string|number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
export default function BrandPortalPage(){
 const auth=useCustomerAuth(),router=useRouter();
 const [grants,setGrants]=useState<BrandGrant[]>([]),[selected,setSelected]=useState('');
 const [overview,setOverview]=useState<Summary|null>(null),[products,setProducts]=useState<BrandProduct[]>([]),[sales,setSales]=useState<Sale[]>([]);
 const [busy,setBusy]=useState(true),[error,setError]=useState(''),[tab,setTab]=useState<'stock'|'sales'>('stock');
 useEffect(()=>{
  if(auth.loading)return;
  if(!auth.accessToken){router.replace('/brand/login');setBusy(false);return;}
  const ac=new AbortController();setBusy(true);
  fetch('/api/brand-portal/me',{headers:{authorization:'Bearer '+auth.accessToken},cache:'no-store',signal:ac.signal})
   .then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data?.message||'Gagal memeriksa akses');setGrants(data.brands||[]);
     setSelected(p=>p||(data.brands?.[0]?.id||''));})
   .catch(e=>{if(!ac.signal.aborted)setError(e.message);})
   .finally(()=>{if(!ac.signal.aborted)setBusy(false);});
  return()=>ac.abort();
 },[auth.loading,auth.accessToken,router]);
 useEffect(()=>{
  if(!selected||!auth.accessToken)return;
  const ac=new AbortController();const headers={authorization:'Bearer '+auth.accessToken};
  setBusy(true);setError('');setOverview(null);
  Promise.all(['overview','products','sales'].map(async endpoint=>{
   const r=await fetch('/api/brand-portal/'+encodeURIComponent(selected)+'/'+endpoint,{headers,cache:'no-store',signal:ac.signal});
   const x=await r.json();if(!r.ok)throw new Error(x?.message||'Gagal memuat '+endpoint);return x;
  })).then(data=>{if(ac.signal.aborted)return;setOverview(data[0]);setProducts(data[1].items||[]);setSales(data[2].items||[]);})
  .catch(e=>{if(!ac.signal.aborted)setError(e.message);})
  .finally(()=>{if(!ac.signal.aborted)setBusy(false);});
  return()=>ac.abort();
 },[selected,auth.accessToken]);
 const grant=grants.find(g=>g.id===selected);
 return <main className="vm-brand-portal-root"><div className="vm-brand-dashboard">
  <header className="vm-brand-dashboard-header"><div><span className="vm-brand-eyebrow">VAPMART / PARTNER ACCESS</span><h1>Brand Portal.</h1><p>Stock visibility and verified paid sales, scoped to your brand.</p></div>
   <div className="vm-brand-dashboard-actions"><Link href="/">Lihat Vapmart ↗</Link><button type="button" onClick={()=>auth.signOut().then(()=>router.replace('/brand/login'))}>Keluar</button></div>
  </header>
  {!auth.user?<p>Silakan <Link href="/brand/login">masuk</Link> menggunakan akun mitra.</p>:
   grants.length===0&&!busy?<section className="vm-brand-panel"><h2>Akses brand belum ditugaskan.</h2><p>Daftar akun berhasil, tetapi admin Vapmart perlu menautkan akun ini ke brand yang sah. Tidak ada data brand lain yang dapat dilihat.</p></section>:
   <>
    <div className="vm-brand-toolbar"><label>Pilih brand <select value={selected} onChange={e=>setSelected(e.target.value)}>{grants.map(b=><option key={b.id} value={b.id}>{b.name} ({b.role})</option>)}</select></label><span>Hak akses: {grant?.role||'Menunggu'}</span></div>
    {busy?<p role="status">Memuat data brand...</p>:error?<p role="alert">{error}</p>:overview&&<>
     <div className="vm-brand-kpis"><div><small>Total produk</small><strong>{overview.inventory.products}</strong></div><div><small>SKU Published</small><strong>{overview.inventory.published}</strong></div><div><small>Stok tersedia</small><strong>{overview.inventory.total_stock}</strong></div><div><small>Stok rendah</small><strong>{overview.inventory.low_stock}</strong></div><div><small>Pesanan lunas</small><strong>{overview.sales.paid_orders}</strong></div><div><small>Gross item sales</small><strong>{rupiah(overview.sales.gross_item_sales_idr)}</strong></div></div>
     <div className="vm-brand-tabs"><button type="button" className={tab==='stock'?'active':''} onClick={()=>setTab('stock')}>Stok & SKU</button><button type="button" className={tab==='sales'?'active':''} onClick={()=>setTab('sales')}>Laporan Penjualan</button></div>
     <section className="vm-brand-panel"><h2>{tab==='stock'?'Inventory brand':'Penjualan terverifikasi'}</h2>
      <p>{tab==='stock'?'Data hanya untuk produk brand yang dipilih. Pengubahan stok memerlukan persetujuan admin.':'Hanya pesanan dengan pembayaran terverifikasi yang dihitung; tidak termasuk draft, ongkir, pajak, atau settlement.'}</p>
      <div className="vm-brand-table-wrap"><table><thead><tr><th>SKU</th><th>Nama produk</th><th>{tab==='stock'?'Stok':'Unit terjual'}</th><th>{tab==='stock'?'Status':'Gross sales'}</th></tr></thead><tbody>
       {tab==='stock'?products.map(p=><tr key={p.id}><td>{p.sku||'—'}</td><td>{p.name}</td><td>{p.stock_qty}</td><td>{p.is_active?'Tayang':'Draft'}</td></tr>):
       sales.map(s=><tr key={s.product_id}><td>{s.sku||'—'}</td><td>{s.name}</td><td>{s.units_sold}</td><td>{rupiah(s.gross_item_sales_idr)}</td></tr>)}
      </tbody></table>{(tab==='stock'?products:sales).length===0&&<p>Belum ada produk untuk brand ini.</p>}</div>
     </section>
    </>}
   </>}
 </div></main>;
}
