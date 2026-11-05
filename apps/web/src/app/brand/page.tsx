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
type Location={code:string;warehouse_name:string;city:string;product_id:string;sku:string|null;product_name:string;on_hand:number;reserved:number;available:number;is_dispatch_enabled:boolean};
type Fulfillment={id:string;order_id:string;state:string;warehouse_code:string;units:number;created_at:string;carrier_state:string|null;provider_status:string|null;tracking_number:string|null};
const rupiah=(v:string|number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
export default function BrandPortalPage(){
 const auth=useCustomerAuth(),router=useRouter();
 const [grants,setGrants]=useState<BrandGrant[]>([]),[selected,setSelected]=useState('');
 const [overview,setOverview]=useState<Summary|null>(null),[products,setProducts]=useState<BrandProduct[]>([]),[sales,setSales]=useState<Sale[]>([]),[locations,setLocations]=useState<Location[]>([]),[fulfillments,setFulfillments]=useState<Fulfillment[]>([]);
 const [busy,setBusy]=useState(true),[error,setError]=useState(''),[tab,setTab]=useState<'stock'|'sales'|'warehouses'|'fulfillment'>('stock');
 const [activityNote,setActivityNote]=useState(''),[activityBusy,setActivityBusy]=useState(false),[activityMessage,setActivityMessage]=useState('');
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
  Promise.all(['overview','products','sales','warehouses','fulfillment'].map(async endpoint=>{
   const r=await fetch('/api/brand-portal/'+encodeURIComponent(selected)+'/'+endpoint,{headers,cache:'no-store',signal:ac.signal});
   const x=await r.json();if(!r.ok)throw new Error(x?.message||'Gagal memuat '+endpoint);return x;
  })).then(data=>{if(ac.signal.aborted)return;setOverview(data[0]);setProducts(data[1].items||[]);setSales(data[2].items||[]);setLocations(data[3].items||[]);setFulfillments(data[4].items||[]);})
  .catch(e=>{if(!ac.signal.aborted)setError(e.message);})
  .finally(()=>{if(!ac.signal.aborted)setBusy(false);});
  return()=>ac.abort();
 },[selected,auth.accessToken]);
 const grant=grants.find(g=>g.id===selected);
 const mayProcess=grant?.role==='owner'||grant?.role==='manager';
 const nextStatus:Record<string,string>={reserved:'picking',picking:'packed',packed:'ready_for_carrier'};
 async function progressBatch(batch:Fulfillment){
  const next=nextStatus[batch.state];if(!mayProcess||!next||activityBusy||!auth.accessToken)return;
  if(activityNote.trim().length<6){setActivityMessage('Catatan minimal 6 karakter diperlukan');return;}
  setActivityBusy(true);setActivityMessage('');
  try{
   const r=await fetch('/api/brand-portal/'+encodeURIComponent(selected)+'/fulfillment/'+encodeURIComponent(batch.id)+'/state',{
    method:'POST',headers:{authorization:'Bearer '+auth.accessToken,'content-type':'application/json'},
    body:JSON.stringify({state:next,notes:activityNote.trim()})});
   const data=await r.json();if(!r.ok)throw new Error(data?.message||'Tidak dapat memproses batch');
   const refresh=await fetch('/api/brand-portal/'+encodeURIComponent(selected)+'/fulfillment',{headers:{authorization:'Bearer '+auth.accessToken},cache:'no-store'});
   if(!refresh.ok)throw Error('Status diperbarui tetapi penyegaran gagal');
   const updated=await refresh.json();setFulfillments(updated.items||[]);
   setActivityNote('');setActivityMessage('Status picking/packing brand diperbarui. Booking kurir diproses admin melalui Courier Ops.');
  }catch(e){setActivityMessage(e instanceof Error?e.message:'Operasi tidak tersedia');}
  finally{setActivityBusy(false);}
 }

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
     <div className="vm-brand-tabs">
      <button type="button" className={tab==='stock'?'active':''} onClick={()=>setTab('stock')}>Stok & SKU</button>
      <button type="button" className={tab==='sales'?'active':''} onClick={()=>setTab('sales')}>Penjualan</button>
      <button type="button" className={tab==='warehouses'?'active':''} onClick={()=>setTab('warehouses')}>Stok per Gudang</button>
      <button type="button" className={tab==='fulfillment'?'active':''} onClick={()=>setTab('fulfillment')}>Fulfillment</button>
     </div>
     <section className="vm-brand-panel"><h2>{tab==='stock'?'Inventory brand':tab==='sales'?'Penjualan terverifikasi':tab==='warehouses'?'Lokasi stok':'Fulfillment brand'}</h2>
      <p>Data hanya untuk brand yang dipilih. Semua informasi stok, pergerakan, dan fulfillment ini bersifat read-only; alamat pelanggan dan transaksi brand lain tidak ditampilkan.</p>
      <div className="vm-brand-table-wrap">
       {tab==='stock'&&<table><thead><tr><th>SKU</th><th>Produk</th><th>Available</th><th>Status</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td>{p.sku||'—'}</td><td>{p.name}</td><td>{p.stock_qty}</td><td>{p.is_active?'Published':'Draft'}</td></tr>)}</tbody></table>}
       {tab==='sales'&&<table><thead><tr><th>SKU</th><th>Produk</th><th>Unit lunas</th><th>Gross sales</th></tr></thead><tbody>{sales.map(p=><tr key={p.product_id}><td>{p.sku||'—'}</td><td>{p.name}</td><td>{p.units_sold}</td><td>{rupiah(p.gross_item_sales_idr)}</td></tr>)}</tbody></table>}
       {tab==='warehouses'&&<table><thead><tr><th>SKU / Produk</th><th>Gudang</th><th>On-hand</th><th>Reserved</th><th>Available</th></tr></thead><tbody>{locations.map((p,i)=><tr key={p.product_id+p.code+i}><td>{p.sku||'—'} · {p.product_name}</td><td>{p.code} · {p.city||'—'}</td><td>{p.on_hand}</td><td>{p.reserved}</td><td>{p.available}</td></tr>)}</tbody></table>}
       {tab==='fulfillment'&&<div>
        {mayProcess&&<label style={{display:'grid',gap:7,marginBottom:16,fontSize:12}}>Catatan proses gudang
          <textarea value={activityNote} onChange={e=>setActivityNote(e.target.value)} rows={2} minLength={6} maxLength={300}
           placeholder="Nama petugas / referensi picking dan packing" style={{padding:12,borderRadius:12,border:'1px solid #e7dded'}}/>
        </label>}
        <table><thead><tr><th>Order ID</th><th>Gudang</th><th>Qty</th><th>Status internal</th><th>Kurir / AWB</th><th>Proses</th></tr></thead>
         <tbody>{fulfillments.map(p=><tr key={p.id}><td>{p.order_id.slice(0,8)}</td><td>{p.warehouse_code}</td><td>{p.units}</td><td>{p.state.replaceAll('_',' ')}</td><td>{p.provider_status||p.carrier_state||'Tidak dipesan'}<small style={{display:'block'}}>{p.tracking_number||'Resi belum tersedia'}</small></td>
         <td>{mayProcess&&nextStatus[p.state]?
          <button type="button" disabled={activityBusy||activityNote.trim().length<6} onClick={()=>progressBatch(p)}
           style={{border:0,padding:'9px 12px',borderRadius:99,background:'#8526d0',color:'#fff',cursor:'pointer'}}>
           Set {nextStatus[p.state].replaceAll('_',' ')}
          </button>:<span>{mayProcess?'Menunggu kurir':'Read-only'}</span>}</td></tr>)}</tbody>
        </table>{activityMessage&&<p role="status">{activityMessage}</p>}
       </div>}
       {(tab==='stock'?products.length:tab==='sales'?sales.length:tab==='warehouses'?locations.length:fulfillments.length)===0&&<p>Belum ada data untuk brand ini.</p>}
      </div>
     </section>
    </>}
   </>}
 </div></main>;
}
