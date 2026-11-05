'use client';
import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import '../app/warehouse-ops.css';
type Batch={batch_id:string;order_id:string;brand_name:string;warehouse_code:string;state:string;manifest_id:string|null;
 manifest_state:string|null;pickup_method:string|null;pickup_date:string|null;pickup_time:string|null;
 total_weight_grams:number|null;carrier_state:string|null;provider_status:string|null;tracking_number:string|null;provider_events:number};
type ReturnRow={id:string;batch_id:string;order_id:string;status:string;reason:string;brand_name:string;origin_warehouse:string;review_note:string|null;received_warehouse_id:string|null};
type Location={id:string;code:string;name:string;is_system_hold:boolean;is_active:boolean};
type Preview={batchId:string;state:string;bookingBlockers:string[];weightGrams:number;manifest:{id:string}|null;
 items:{sku:string|null;name:string;quantity:number;weightGrams:number|null;dimensionsCm:(number|null)[]}[];
 origin:{warehouse:string;city:string;postalCode:string|null};destination:{city:string;postalCode:string|null};
 courier:{code:string|null;service:string|null}};
type Slip={type:string;awb:null;slip:{manifest_id:string;brand_name:string;order_id:string;warehouse_name:string;warehouse_address:string;warehouse_city:string;warehouse_province:string;warehouse_postal_code:string;
 receiver_name:string;receiver_phone:string;receiver_address:string;receiver_city:string;receiver_province:string;receiver_postal_code:string;
 total_weight_grams:number;pickup_date:string|null;pickup_time:string|null};items:{name:string;sku:string|null;quantity:number;weight_grams:number}[]};
type CarrierEvent={id:string;event_type:string;provider_status:string|null;waybill_id:string|null;observed_fee_idr:string|null;is_applied:boolean;received_at:string};
const explain:Record<string,string>={
 VERIFIED_PAYMENT_REQUIRED:'Pembayaran belum terverifikasi',PACKING_NOT_READY:'Picking dan packing belum selesai',
 WAREHOUSE_DISPATCH_NOT_VERIFIED:'Lokasi gudang belum aktif untuk dispatch',
 WAREHOUSE_ADDRESS_INCOMPLETE:'Alamat pengirim belum lengkap',
 WAREHOUSE_PICKUP_CONTACT_REQUIRED:'Kontak pickup belum lengkap',
 RECIPIENT_ADDRESS_INCOMPLETE:'Alamat penerima belum lengkap',
 PRODUCT_WEIGHT_UNVERIFIED:'Berat SKU perlu verifikasi',PARCEL_DIMENSIONS_UNVERIFIED:'Dimensi produk belum tersedia',
 SPLIT_ORIGIN_RATES_REQUIRED:'Diperlukan ongkir per gudang untuk pesanan gabungan',
 WAREHOUSE_SPECIFIC_COURIER_QUOTE_REQUIRED:'Quote ongkir dari gudang aktual belum tersedia',
 COURIER_SERVICE_NOT_SELECTED:'Layanan kurir belum dipilih',
 EXTERNAL_BOOKING_DISABLED:'Booking eksternal dinonaktifkan sampai persetujuan'};
export function CourierOpsPanel({token}:{token:string|null}){
 const [batches,setBatches]=useState<Batch[]>([]),[rmas,setRmas]=useState<ReturnRow[]>([]),
  [locations,setLocations]=useState<Location[]>([]);
 const [selected,setSelected]=useState(''),[preview,setPreview]=useState<Preview|null>(null),[slip,setSlip]=useState<Slip|null>(null),
  [events,setEvents]=useState<CarrierEvent[]>([]);
 const [mode,setMode]=useState('pickup'),[pickupDate,setPickupDate]=useState(''),[pickupTime,setPickupTime]=useState(''),
  [manifestNotes,setManifestNotes]=useState('');
 const [note,setNote]=useState(''),[decision,setDecision]=useState<'approved'|'rejected'>('approved'),
  [warehouseId,setWarehouseId]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const manifestKey=useRef<string|null>(null),restockKeys=useRef<Record<string,string>>({});
 const current=batches.find(x=>x.batch_id===selected);
 async function api(path:string,method:'GET'|'POST'='GET',body?:unknown){
  if(!token)throw Error('Silakan login sebagai admin');
  const r=await fetch(path,{method,headers:{authorization:'Bearer '+token,...(body===undefined?{}:{'content-type':'application/json'})},
    cache:'no-store',...(body===undefined?{}:{body:JSON.stringify(body)})});
  const x=await r.json();if(!r.ok)throw Error(Array.isArray(x?.message)?x.message.join(', '):x?.message||x?.code||'HTTP '+r.status);return x;
 }
 async function reload(){
  const [a,b,c]=await Promise.all([api('/api/admin/courier/batches'),api('/api/admin/courier-returns'),api('/api/admin/warehouses')]);
  setBatches(a.items||[]);setRmas(b.items||[]);setLocations((c.warehouses||[]).filter((w:Location)=>w.is_active&&!w.is_system_hold));
 }
 useEffect(()=>{if(!token)return;let active=true;
  Promise.all(['/api/admin/courier/batches','/api/admin/courier-returns','/api/admin/warehouses'].map(path=>
   fetch(path,{headers:{authorization:'Bearer '+token},cache:'no-store'}).then(async r=>{const x=await r.json();if(!r.ok)throw Error(x?.message||path);return x;})))
   .then(([a,b,c])=>{if(active){setBatches(a.items||[]);setRmas(b.items||[]);
    setLocations((c.warehouses||[]).filter((w:Location)=>w.is_active&&!w.is_system_hold));}})
   .catch(e=>{if(active)setMessage(e instanceof Error?e.message:'Data tidak tersedia');});
  return()=>{active=false;};
 },[token]);
 useEffect(()=>{if(!batches.some(b=>b.batch_id===selected))setSelected(batches[0]?.batch_id||'');},[batches,selected]);
 useEffect(()=>{if(!locations.some(w=>w.id===warehouseId))setWarehouseId(locations[0]?.id||'');},[locations,warehouseId]);
 async function act(task:()=>Promise<void>){if(busy)return;setBusy(true);setMessage('');
  try{await task();}catch(e){setMessage(e instanceof Error?e.message:'Operasi gagal');}finally{setBusy(false);}
 }
 async function show(batchId:string){
  setSelected(batchId);setPreview(null);setSlip(null);setEvents([]);
  await act(async()=>{
   const [p,e]=await Promise.all([api('/api/admin/courier/batches/'+batchId+'/preview'),
    api('/api/admin/courier/batches/'+batchId+'/events')]);
   setPreview(p);setEvents(e.items||[]);
  });
 }
 async function prepare(e:FormEvent){
  e.preventDefault();if(!selected)return;
  await act(async()=>{
   manifestKey.current??=crypto.randomUUID();
   await api('/api/admin/courier/batches/'+selected+'/manifest','POST',{
    idempotencyKey:manifestKey.current,notes:manifestNotes.trim(),pickupMethod:mode,
    pickupDate:pickupDate||null,pickupTime:pickupTime||null
   });
   manifestKey.current=null;await reload();
   setPreview(await api('/api/admin/courier/batches/'+selected+'/preview'));
   setMessage('Packing manifest disimpan. Pickup ini hanya rencana internal; kurir belum dipesan.');
  });
 }
 async function slipPreview(){
  if(!selected)return;await act(async()=>{
   setSlip(await api('/api/admin/courier/batches/'+selected+'/packing-slip'));
   setMessage('Packing slip internal, bukan AWB atau label resmi kurir.');
  });
 }
 async function review(r:ReturnRow){
  await act(async()=>{
   await api('/api/admin/courier-returns/'+r.id+'/review','POST',{decision,notes:note.trim()});
   await reload();setNote('');
   setMessage('Review retur dicatat. Tidak ada refund maupun reverse booking otomatis.');
  });
 }
 async function receive(r:ReturnRow){
  await act(async()=>{
   await api('/api/admin/courier-returns/'+r.id+'/receive','POST',{warehouseId,notes:note.trim()});
   await reload();setNote('');
   setMessage('Barang retur dicatat telah diterima. Stok belum otomatis kembali.');
  });
 }
 async function restock(r:ReturnRow){
  if(!window.confirm('Konfirmasi barang retur sudah diperiksa dan layak masuk stok gudang yang dipilih sebelumnya?'))return;
  await act(async()=>{
   const key=restockKeys.current[r.id]??crypto.randomUUID();restockKeys.current[r.id]=key;
   await api('/api/admin/courier-returns/'+r.id+'/restock','POST',{idempotencyKey:key,notes:note.trim()});
   delete restockKeys.current[r.id];await reload();setNote('');
   setMessage('Stok retur ditambahkan persis sekali ke gudang penerima. Refund tetap OFF.');
  });
 }
 const count=useMemo(()=>({
  manifests:batches.filter(x=>x.manifest_id).length,
  noManifests:batches.filter(x=>x.state==='ready_for_carrier'&&!x.manifest_id).length,
  waybills:batches.filter(x=>x.tracking_number).length,
  returns:rmas.filter(x=>x.status==='requested').length
 }),[batches,rmas]);
 return <section className="vm-courier-ops vm-fulfillment">
  <header className="vm-fulfillment-heading"><div><span className="vma26-eyebrow">CP36 / COURIER OPERATIONS</span>
   <h2>Courier & Order Automation</h2><p>Manifest, jadwal pickup internal, tracking terpercaya, serta return management. Booking dan payment OFF.</p></div>
   <button type="button" className="vm-ops-secondary" disabled={busy} onClick={()=>act(reload)}>↻ Refresh</button></header>
  <div className="vm-ops-stats"><div><small>Manifest</small><strong>{count.manifests}</strong></div><div><small>Siap dibuat</small><strong>{count.noManifests}</strong></div>
   <div><small>AWB terverifikasi</small><strong>{count.waybills}</strong></div><div><small>Return requests</small><strong>{count.returns}</strong></div></div>
  <div className="vm-ops-panels">
   <section className="vma26-panel vm-ops-form"><span className="vma26-eyebrow">PARCEL PREPARATION</span><h3>Manifest per batch</h3>
    <label>Fulfillment batch<select value={selected} onChange={e=>{setSelected(e.target.value);setPreview(null);setEvents([]);setSlip(null);manifestKey.current=null;}}>
     {batches.map(b=><option key={b.batch_id} value={b.batch_id}>{b.brand_name} · {b.warehouse_code} · {b.order_id.slice(0,8)}</option>)}</select></label>
    <div className="vm-fulfillment-actions"><button type="button" disabled={!selected||busy} onClick={()=>show(selected)}>Periksa kesiapan & events</button>
     {current?.manifest_id&&<button type="button" disabled={busy} onClick={slipPreview}>Lihat packing slip</button>}</div>
    {preview&&<div><p><strong>{preview.weightGrams.toLocaleString('id-ID')} gram</strong> · {preview.origin.warehouse}, {preview.origin.city} → {preview.destination.city}</p>
     <div className="vm-ops-table"><table><thead><tr><th>SKU</th><th>Produk</th><th>Qty</th><th>Berat/unit</th></tr></thead><tbody>{preview.items.map((x,i)=><tr key={i}><td>{x.sku||'—'}</td><td>{x.name}</td><td>{x.quantity}</td><td>{x.weightGrams||'Belum ada'}</td></tr>)}</tbody></table></div>
     <strong>Booking blockers</strong><div className="vm-courier-blockers">{preview.bookingBlockers.map(v=><span key={v}>{explain[v]||v}</span>)}</div>
    </div>}
    {current?.state==='ready_for_carrier'&&!current.manifest_id&&<form onSubmit={prepare} className="vm-ops-form">
      <label>Penyerahan<select value={mode} onChange={e=>{setMode(e.target.value);manifestKey.current=null;}}>
        <option value="pickup">Rencana pickup</option><option value="drop_off">Rencana drop-off</option></select></label>
      <div className="vm-ops-input-grid"><label>Tanggal internal<input type="date" value={pickupDate} onChange={e=>{setPickupDate(e.target.value);manifestKey.current=null;}}/></label>
        <label>Jam internal<input type="time" value={pickupTime} onChange={e=>{setPickupTime(e.target.value);manifestKey.current=null;}}/></label></div>
      <label>Catatan paket<textarea required rows={2} minLength={6} maxLength={300} value={manifestNotes} onChange={e=>{setManifestNotes(e.target.value);manifestKey.current=null;}} placeholder="Nomor packing checklist, jumlah koli, bukti timbang"/></label>
      <button className="vm-ops-primary" type="submit" disabled={busy||manifestNotes.trim().length<6||(Boolean(pickupDate)!==Boolean(pickupTime))}>Buat manifest internal</button>
     </form>}
   </section>
   <section className="vma26-panel vm-ops-form"><span className="vma26-eyebrow">REAL COURIER EVENTS</span><h3>AWB & tracking</h3>
    <p className="vm-ops-hint">Resi hanya muncul setelah event provider untuk shipment yang sudah terdaftar. Tidak bisa mengisi AWB secara manual.</p>
    {current&&<><p><strong>{current.tracking_number||'Belum ada resi resmi'}</strong></p><span className="vm-fulfillment-state">{current.provider_status||current.carrier_state||'Booking OFF'}</span></>}
    <div className="vm-fulfillment-timeline">{events.map(e=><div key={e.id}><strong>{e.event_type} · {e.provider_status||'—'}</strong>
      <small>{e.waybill_id||''} {e.observed_fee_idr?' · Koreksi tarif '+new Intl.NumberFormat('id-ID').format(Number(e.observed_fee_idr))+' perlu review':''}</small>
      <small>{new Date(e.received_at).toLocaleString('id-ID')} · {e.is_applied?'Teraplikasi':'Audit saja / diabaikan'}</small></div>)}</div>
    {!events.length&&<p className="vm-ops-hint">Belum ada event provider terverifikasi. Webhook pelacakan belum diaktifkan.</p>}
    <p className="vm-ops-hint">Nomor resi dan label resmi hanya berasal dari provider pengiriman. Fitur booking membutuhkan persetujuan terpisah.</p>
    <button type="button" className="vm-ops-secondary" disabled>Booking Kurir · OFF</button>
   </section>
  </div>
  <section className="vma26-panel"><h3>Parcels by brand & warehouse</h3>
    <div className="vm-ops-table"><table><thead><tr><th>Brand</th><th>Gudang</th><th>Order</th><th>Fulfillment</th><th>Manifest</th><th>Kurir</th></tr></thead>
    <tbody>{batches.map(b=><tr key={b.batch_id}><td>{b.brand_name}</td><td>{b.warehouse_code}</td><td>{b.order_id.slice(0,8)}</td>
     <td>{b.state}</td><td>{b.manifest_id?'Prepared':'Pending'}</td><td>{b.provider_status||'Tidak dipesan'}</td></tr>)}</tbody></table>
    {batches.length===0&&<p>Belum ada batch fulfilled. Tidak ada shipment sintetis dibuat.</p>}</div></section>
  <section className="vma26-panel vm-ops-form"><span className="vma26-eyebrow">RETURN MANAGEMENT</span><h3>Retur & pemeriksaan fisik</h3>
    <p className="vm-ops-hint">Retur hanya dapat diminta pelanggan jika shipment benar-benar delivered. Refund, retur berbayar, dan reverse booking tetap OFF.</p>
    <div className="vm-ops-input-grid"><label>Keputusan<select value={decision} onChange={e=>setDecision(e.target.value as 'approved'|'rejected')}><option value="approved">Approve</option><option value="rejected">Reject</option></select></label>
    <label>Gudang penerimaan<select value={warehouseId} onChange={e=>setWarehouseId(e.target.value)}>{locations.map(w=><option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></label></div>
    <label>Catatan bukti & inspeksi<textarea rows={2} minLength={8} maxLength={300} value={note} onChange={e=>setNote(e.target.value)} placeholder="Alasan keputusan atau kondisi barang diterima"/></label>
    <div className="vm-ops-table"><table><thead><tr><th>Brand / Gudang</th><th>Order</th><th>Alasan</th><th>Status</th><th>Proses</th></tr></thead><tbody>
    {rmas.map(r=><tr key={r.id}><td>{r.brand_name}<small>{r.origin_warehouse}</small></td><td>{r.order_id.slice(0,8)}</td><td>{r.reason}</td><td>{r.status}</td>
      <td><div className="vm-fulfillment-actions">
       {r.status==='requested'&&<button type="button" disabled={busy||note.trim().length<8} onClick={()=>review(r)}>Simpan keputusan</button>}
       {r.status==='approved'&&<button type="button" disabled={busy||!warehouseId||note.trim().length<8} onClick={()=>receive(r)}>Terima fisik</button>}
       {r.status==='received'&&<button type="button" disabled={busy||note.trim().length<8} onClick={()=>restock(r)}>Restock diverifikasi</button>}
       {['rejected','restocked'].includes(r.status)&&<span>Selesai</span>}
      </div></td></tr>)}</tbody></table>
    {rmas.length===0&&<p>Belum ada permintaan retur.</p>}</div>
  </section>
  {slip&&<div className="vma26-panel vm-internal-packing-slip">
    <p className="vma26-eyebrow">VAPMART · INTERNAL ONLY</p><h2>PACKING SLIP</h2>
    <p><strong>BUKAN LABEL KURIR. AWB BELUM ADA.</strong></p>
    <p>Manifest {slip.slip.manifest_id.slice(0,8)} · Order {slip.slip.order_id.slice(0,8)}</p>
    <p><strong>Brand:</strong> {slip.slip.brand_name}</p>
    <div className="vm-ops-panels"><div><h3>Pengirim</h3><p>{slip.slip.warehouse_name}</p><p>{slip.slip.warehouse_address}</p>
      <p>{slip.slip.warehouse_city}, {slip.slip.warehouse_province} {slip.slip.warehouse_postal_code}</p></div>
      <div><h3>Penerima</h3><p>{slip.slip.receiver_name} · {slip.slip.receiver_phone}</p><p>{slip.slip.receiver_address}</p>
      <p>{slip.slip.receiver_city}, {slip.slip.receiver_province} {slip.slip.receiver_postal_code}</p></div></div>
    <div className="vm-ops-table"><table><thead><tr><th>SKU</th><th>Produk</th><th>Qty</th><th>Berat</th></tr></thead>
    <tbody>{slip.items.map((x,i)=><tr key={i}><td>{x.sku||'—'}</td><td>{x.name}</td><td>{x.quantity}</td><td>{x.weight_grams}g</td></tr>)}</tbody></table></div>
    <p>Total berat: {slip.slip.total_weight_grams} gram. Booking kurir belum dibuat.</p>
    <div className="vm-courier-print-actions"><button type="button" className="vm-ops-primary" onClick={()=>window.print()}>Cetak packing slip internal</button></div>
  </div>}
  {message&&<p className="vm-ops-feedback" role="status">{message}</p>}
 </section>;
}
