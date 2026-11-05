'use client';
import {useEffect,useRef,useState} from 'react';
import '../app/warehouse-ops.css';
export type FulfillmentOrder={id:string;status:string;payment_status:string;total_idr:string;payment_verified?:boolean};
type Batch={id:string;order_id:string;brand_name:string;warehouse_code:string;state:string;units:number};
type Line={id:string;product_name:string;quantity:number;locations:{warehouseCode:string;available:number}[]};
type Plan={orderId:string;eligible:boolean;lines:Line[]};
type Tracking={state:string;notes:string;created_at:string};
const labels:Record<string,string>={reserved:'Reserved',picking:'Picking',packed:'Packed',ready_for_carrier:'Menunggu Kurir',cancelled:'Dibatalkan'};
const next:Record<string,string>={reserved:'picking',picking:'packed',packed:'ready_for_carrier'};
export function FulfillmentPanel({token,orders}:{token:string|null;orders:FulfillmentOrder[]}){
 const [batches,setBatches]=useState<Batch[]>([]),[orderId,setOrderId]=useState(''),[plan,setPlan]=useState<Plan|null>(null);
 const [batchId,setBatchId]=useState(''),[timeline,setTimeline]=useState<Tracking[]>([]),[notes,setNotes]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const key=useRef<string|null>(null);
 async function api(path:string,method:'GET'|'POST'='GET',body?:unknown){
  if(!token)throw Error('Admin token tidak ada');
  const r=await fetch(path,{method,headers:{authorization:'Bearer '+token,...(body===undefined?{}:{'content-type':'application/json'})},cache:'no-store',...(body===undefined?{}:{body:JSON.stringify(body)})});
  const d=await r.json();if(!r.ok)throw Error(Array.isArray(d?.message)?d.message.join(', '):d?.message||'HTTP '+r.status);return d;
 }
 async function refresh(){setBatches((await api('/api/admin/fulfillment/batches')).items||[]);}
 useEffect(()=>{if(!token)return;let active=true;
  fetch('/api/admin/fulfillment/batches',{headers:{authorization:'Bearer '+token},cache:'no-store'})
   .then(async r=>{if(!r.ok)throw Error('Gagal memuat batch');return r.json();})
   .then(d=>{if(active)setBatches(d.items||[]);}).catch(e=>{if(active)setMessage(e.message);});
  return()=>{active=false;};
 },[token]);
 useEffect(()=>{if(!orders.some(o=>o.id===orderId))setOrderId(orders[0]?.id||'');},[orders,orderId]);
 async function action(work:()=>Promise<void>){setBusy(true);setMessage('');try{await work();}catch(e){setMessage(e instanceof Error?e.message:'Operasi gagal');}finally{setBusy(false);}}
 const selected=batches.find(b=>b.id===batchId);
 return <section className="vm-fulfillment">
  <header className="vm-fulfillment-heading"><div><span className="vma26-eyebrow">CP35 / FULFILLMENT</span><h2>Fulfillment per Brand</h2>
  <p>Alokasi dan packing setelah pembayaran terverifikasi. Lanjutkan booking resi dan pickup melalui menu Courier.</p></div>
  <button className="vm-ops-secondary" type="button" disabled={busy} onClick={()=>action(refresh)}>↻ Refresh</button></header>
  <div className="vm-ops-stats">
   <div><small>Batch</small><strong>{batches.length}</strong></div><div><small>Reserved</small><strong>{batches.filter(x=>x.state==='reserved').length}</strong></div>
   <div><small>Dalam proses</small><strong>{batches.filter(x=>['picking','packed'].includes(x.state)).length}</strong></div>
   <div><small>Menunggu kurir</small><strong>{batches.filter(x=>x.state==='ready_for_carrier').length}</strong></div>
  </div>
  <div className="vm-ops-panels">
   <section className="vma26-panel vm-fulfillment-panel"><span className="vma26-eyebrow">PAYMENT VERIFIED ONLY</span><h3>Rencana alokasi</h3>
    <p>Draft pesanan bisa ditinjau, tetapi tidak mereservasi stok.</p>
    <label>Pesanan<select style={{width:'100%',padding:12,borderRadius:12,border:'1px solid #e6dfef'}} value={orderId} onChange={e=>{setOrderId(e.target.value);setPlan(null);key.current=null;}}>
    {orders.map(o=><option key={o.id} value={o.id}>{o.id.slice(0,8)} · {o.status} · {o.payment_status}</option>)}</select></label>
    <div className="vm-fulfillment-actions"><button type="button" disabled={busy||!orderId} onClick={()=>action(async()=>{setPlan(await api('/api/admin/fulfillment/orders/'+orderId+'/plan'));})}>Lihat alokasi gudang</button></div>
    {plan&&<><p><span className="vm-fulfillment-state">{plan.eligible?'Pembayaran terverifikasi':'Reservasi dikunci: belum dibayar'}</span></p>
     <div className="vm-ops-table"><table><thead><tr><th>Produk</th><th>Qty</th><th>Lokasi tersedia</th></tr></thead><tbody>
      {plan.lines.map(l=><tr key={l.id}><td>{l.product_name}</td><td>{l.quantity}</td><td>{l.locations.map(w=>w.warehouseCode+' ('+w.available+')').join(', ')||'Belum tersedia'}</td></tr>)}
     </tbody></table></div>
     <div className="vm-fulfillment-actions"><button type="button" disabled={!plan.eligible||busy} onClick={()=>action(async()=>{
      key.current??=crypto.randomUUID();await api('/api/admin/fulfillment/orders/'+orderId+'/prepare','POST',{idempotencyKey:key.current});key.current=null;await refresh();setMessage('Stok ter-reserve. Tidak ada booking kurir.');
     })}>Reserve stok terverifikasi ↗</button></div></>}
    {orders.length===0&&<p>Belum ada pesanan. Tidak ada data transaksi simulasi yang dibuat.</p>}
   </section>
   <section className="vma26-panel vm-fulfillment-panel"><span className="vma26-eyebrow">INTERNAL EVENTS</span><h3>Timeline batch</h3>
    {selected?<><p><span className="vm-fulfillment-state">{selected.brand_name} · {labels[selected.state]||selected.state}</span></p>
     <div className="vm-fulfillment-timeline">{timeline.map((x,i)=><div key={i}><strong>{labels[x.state]||x.state}</strong><small>{new Date(x.created_at).toLocaleString('id-ID')}</small><small>{x.notes}</small></div>)}</div>
     {next[selected.state]&&<><label className="vm-ops-form">Catatan operator<textarea required minLength={6} maxLength={300} rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Catatan picking, packing atau handover"/></label>
      <div className="vm-fulfillment-actions"><button disabled={busy||notes.trim().length<6} type="button" onClick={()=>action(async()=>{
       await api('/api/admin/fulfillment/batches/'+selected.id+'/state','POST',{state:next[selected.state],notes:notes.trim()});
       await refresh();setTimeline((await api('/api/admin/fulfillment/batches/'+selected.id+'/timeline')).events||[]);setNotes('');
       setMessage('Status internal diperbarui, bukan tracking ekspedisi.');
      })}>Set {labels[next[selected.state]]}</button></div></>}
    </>:<p>Pilih batch di bawah untuk melihat aktivitas internal. Status in-transit/delivered tidak dapat diisi manual.</p>}
   </section>
  </div>
  <section className="vma26-panel"><h3>Batch berdasarkan brand & gudang</h3>
   <div className="vm-ops-table"><table><thead><tr><th>Brand</th><th>Gudang</th><th>Order</th><th>Qty</th><th>Status</th><th>Aktivitas</th></tr></thead>
    <tbody>{batches.map(b=><tr key={b.id}><td>{b.brand_name}</td><td>{b.warehouse_code}</td><td>{b.order_id.slice(0,8)}</td><td>{b.units}</td><td>{labels[b.state]||b.state}</td>
     <td><button className="vm-ops-secondary" type="button" onClick={()=>action(async()=>{setBatchId(b.id);setTimeline((await api('/api/admin/fulfillment/batches/'+b.id+'/timeline')).events||[]);})}>Timeline</button></td></tr>)}</tbody></table>
    {batches.length===0&&<p>Belum ada batch fulfillment. Aktivasi payment tetap tidak tersedia.</p>}</div>
  </section>
  {message&&<p className="vm-ops-feedback" role="status">{message}</p>}
 </section>;
}
