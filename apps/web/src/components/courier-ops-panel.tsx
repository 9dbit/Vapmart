'use client';
import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import '../app/warehouse-ops.css';
type Batch={batch_id:string;order_id:string;brand_name:string;warehouse_code:string;state:string;shipping_provider?:string|null;shipping_courier_code?:string|null;shipping_service_code?:string|null;shipping_courier_name?:string|null;shipping_service_name?:string|null;shipping_fee_idr?:string|null;manifest_id:string|null;
 manifest_state:string|null;pickup_method:string|null;pickup_date:string|null;pickup_time:string|null;
 booking_state:string|null;total_weight_grams:number|null;carrier_state:string|null;provider_status:string|null;tracking_number:string|null;provider_events:number};
type DispatchPreview={canBook:boolean;blockers:string[];fingerprint?:string;feeIdr?:number;originalFeeIdr?:number;service?:string;origin?:string;destination?:string;
 attempt?:{state:string;message:string;tracking_number:string|null}|null};
const rupiah=(v:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(v);
type ReturnRow={id:string;batch_id:string;order_id:string;status:string;reason:string;brand_name:string;origin_warehouse:string;review_note:string|null;received_warehouse_id:string|null};
type Location={id:string;code:string;name:string;is_system_hold:boolean;is_active:boolean};
type CourierConfig={provider:string;externalBookingEnabled:boolean;webhookEnabled:boolean;webhookRegistrationRequired?:boolean;labelType:string};
type Preview={batchId:string;state:string;bookingBlockers:string[];weightGrams:number;manifest:{id:string}|null;
 items:{sku:string|null;name:string;quantity:number;weightGrams:number|null;dimensionsCm:(number|null)[]}[];
 origin:{warehouse:string;city:string;postalCode:string|null};destination:{city:string;postalCode:string|null};
 courier:{provider?:string|null;code:string|null;service:string|null;name?:string|null;serviceName?:string|null;priceIdr?:number|null}};
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
 EXTERNAL_BOOKING_DISABLED:'Booking belum aktif',JUBELIO_BOOKING_DISABLED:'Booking Jubelio belum aktif',MANIFEST_REQUIRED:'Siapkan manifest terlebih dahulu',IMMEDIATE_PICKUP_REQUIRED:'Booking Jubelio mendukung pickup segera. Manifest dengan jadwal internal atau drop-off perlu diperiksa.'};
export function CourierOpsPanel({token}:{token:string|null}){
 const [batches,setBatches]=useState<Batch[]>([]),[rmas,setRmas]=useState<ReturnRow[]>([]),
  [locations,setLocations]=useState<Location[]>([]);
 const [selected,setSelected]=useState(''),[preview,setPreview]=useState<Preview|null>(null),[slip,setSlip]=useState<Slip|null>(null),[config,setConfig]=useState<CourierConfig|null>(null),
  [events,setEvents]=useState<CarrierEvent[]>([]);
 const [mode,setMode]=useState('pickup'),[pickupDate,setPickupDate]=useState(''),[pickupTime,setPickupTime]=useState(''),
  [manifestNotes,setManifestNotes]=useState('');
 const [note,setNote]=useState(''),[decision,setDecision]=useState<'approved'|'rejected'>('approved'),
  [warehouseId,setWarehouseId]=useState('');
 const [dispatchPreview,setDispatchPreview]=useState<DispatchPreview|null>(null),[labelUrl,setLabelUrl]=useState('');
 const bookingKeys=useRef<Record<string,string>>({});
 const focusedOrder=useRef('');
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
  const [a,b,c,d]=await Promise.all([api('/api/admin/courier/batches'),api('/api/admin/courier-returns'),api('/api/admin/warehouses'),api('/api/admin/courier/config')]);
  setBatches(a.items||[]);setRmas(b.items||[]);setLocations((c.warehouses||[]).filter((w:Location)=>w.is_active&&!w.is_system_hold));setConfig(d);
 }
 useEffect(()=>{if(!token)return;let active=true;
  Promise.all(['/api/admin/courier/batches','/api/admin/courier-returns','/api/admin/warehouses','/api/admin/courier/config'].map(path=>
   fetch(path,{headers:{authorization:'Bearer '+token},cache:'no-store'}).then(async r=>{const x=await r.json();if(!r.ok)throw Error(x?.message||path);return x;})))
   .then(([a,b,c,d])=>{if(active){setBatches(a.items||[]);setRmas(b.items||[]);
    setLocations((c.warehouses||[]).filter((w:Location)=>w.is_active&&!w.is_system_hold));setConfig(d);}})
   .catch(e=>{if(active)setMessage(e instanceof Error?e.message:'Data tidak tersedia');});
  return()=>{active=false;};
 },[token]);
 useEffect(()=>{
  const target=new URLSearchParams(window.location.search).get('orderId');
  if(target&&batches.length&&focusedOrder.current!==target){
   focusedOrder.current=target;
   const found=batches.find(b=>b.order_id===target);
   if(found){setSelected(found.batch_id);setPreview(null);setDispatchPreview(null);setLabelUrl('');}
   else setMessage('Pesanan ini belum mempunyai batch fulfillment. Konfirmasi pembayaran dan persiapkan paket di menu Fulfillment dahulu.');
   return;
  }
  if(!batches.some(b=>b.batch_id===selected))setSelected(batches[0]?.batch_id||'');
 },[batches,selected]);
 useEffect(()=>{if(!locations.some(w=>w.id===warehouseId))setWarehouseId(locations[0]?.id||'');},[locations,warehouseId]);
 async function act(task:()=>Promise<void>){if(busy)return;setBusy(true);setMessage('');
  try{await task();}catch(e){setMessage(e instanceof Error?e.message:'Operasi gagal');}finally{setBusy(false);}
 }
 async function show(batchId:string){
  setSelected(batchId);setPreview(null);setSlip(null);setEvents([]);setDispatchPreview(null);setLabelUrl('');
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
 async function checkBooking(batchId=selected){
  if(!batchId)return;
  setSelected(batchId);setDispatchPreview(null);setLabelUrl('');
  await act(async()=>{
   const result=await api('/api/admin/courier/batches/'+batchId+'/booking-preview');
   setDispatchPreview(result);
   if(result.canBook)setMessage('Paket siap. Periksa layanan dan biaya, lalu klik Konfirmasi & terbitkan AWB.');
   else if(result.attempt)setMessage(result.attempt.message||'Resi sedang diperiksa.');
   else setMessage('AWB belum dapat dibuat. Selesaikan persyaratan yang tercantum di bawah.');
  });
 }
 async function book(){
  if(!dispatchPreview?.canBook||dispatchPreview.feeIdr===undefined)return;
  if(!window.confirm('Buat resi dan minta pickup sekarang dengan estimasi biaya '+rupiah(dispatchPreview.feeIdr)+' dari saldo Jubelio? Tagihan akhir dapat berubah setelah pengukuran kurir.'))return;
  await act(async()=>{
   const key=bookingKeys.current[selected]??crypto.randomUUID();bookingKeys.current[selected]=key;
   const r=await api('/api/admin/courier/batches/'+selected+'/book','POST',{idempotencyKey:key,fingerprint:dispatchPreview.fingerprint,acceptedFeeIdr:dispatchPreview.feeIdr});
   setDispatchPreview({canBook:false,blockers:[],attempt:r});setMessage(r.message);await reload();
   setPreview(await api('/api/admin/courier/batches/'+selected+'/preview'));
   setEvents((await api('/api/admin/courier/batches/'+selected+'/events')).items||[]);
  });
 }
 async function dispatchAction(action:'reconcile'|'sync'|'label',batchId=selected){
  if(!batchId)return;setSelected(batchId);
  await act(async()=>{
   const r=await api('/api/admin/courier/batches/'+batchId+'/'+action,'POST',{});
   if(action==='label'){setLabelUrl(r.url);setMessage('Label resmi tersedia. Klik Buka label kurir.');return;}
   await reload();setEvents((await api('/api/admin/courier/batches/'+batchId+'/events')).items||[]);
   if(action==='reconcile')setDispatchPreview({canBook:false,blockers:[],attempt:r});
   setMessage(r.message||'Tracking diperiksa langsung ke Jubelio.');
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
  <header className="vm-fulfillment-heading"><div><span className="vma26-eyebrow">{config?.provider==='jubelio'?'JUBELIO SHIPMENT':'COURIER'} / OPERATIONS</span>
   <h2>Courier & Order Automation</h2><p>Booking resi, permintaan pickup, label kurir, tracking, dan pengelolaan retur.</p></div>
   <div className="vm-fulfillment-actions"><button type="button" className="vm-ops-secondary" disabled={busy} onClick={()=>act(reload)}>↻ Refresh</button>
   <button type="button" className="vm-ops-primary" disabled={busy||!selected} onClick={()=>current?.booking_state==='booked'?dispatchAction('label'):current?.booking_state?dispatchAction('reconcile'):checkBooking()}>Dapatkan Airwaybill (AWB)</button></div></header>
  <div className="vm-ops-connection"><div><small>Provider</small><strong>{config?.provider==='jubelio'?'Jubelio Shipment':config?.provider||'Memuat...'}</strong></div><div><small>Booking AWB</small><strong>{config?.externalBookingEnabled?'Aktif':'Belum aktif'}</strong></div><div><small>Webhook API</small><strong>{config?.webhookEnabled?'Endpoint aktif':'Belum aktif'}</strong></div><p>Alur resi: pembayaran terverifikasi → paket siap dikirim → buat manifest → periksa tarif → konfirmasi booking. Status endpoint tidak membuktikan webhook sudah didaftarkan di dashboard Jubelio.</p></div>
  <div className="vm-ops-stats"><div><small>Manifest</small><strong>{count.manifests}</strong></div><div><small>Siap dibuat</small><strong>{count.noManifests}</strong></div>
   <div><small>AWB terverifikasi</small><strong>{count.waybills}</strong></div><div><small>Return requests</small><strong>{count.returns}</strong></div></div>
  <div className="vm-ops-panels">
   <section className="vma26-panel vm-ops-form"><span className="vma26-eyebrow">PARCEL PREPARATION</span><h3>Manifest per batch</h3>
    <label>Fulfillment batch<select value={selected} onChange={e=>{setSelected(e.target.value);setPreview(null);setEvents([]);setSlip(null);setDispatchPreview(null);setLabelUrl('');manifestKey.current=null;}}>
     {batches.map(b=><option key={b.batch_id} value={b.batch_id}>{b.brand_name} · {b.warehouse_code} · {b.order_id.slice(0,8)}</option>)}</select></label>
    <div className="vm-fulfillment-actions"><button type="button" disabled={!selected||busy} onClick={()=>show(selected)}>Periksa kesiapan & events</button>
     {current?.manifest_id&&<button type="button" disabled={busy} onClick={slipPreview}>Lihat packing slip</button>}</div>
    {preview&&<div><p><strong>{preview.weightGrams.toLocaleString('id-ID')} gram</strong> · {preview.origin.warehouse}, {preview.origin.city} → {preview.destination.city}</p>
     <p><strong>Kurir pilihan:</strong> {preview.courier.name||preview.courier.code||'Belum dipilih'} · {preview.courier.serviceName||preview.courier.service||'Layanan belum dipilih'}{preview.courier.priceIdr!==null&&preview.courier.priceIdr!==undefined?' · '+rupiah(preview.courier.priceIdr):''}</p>
     <div className="vm-ops-table"><table><thead><tr><th>SKU</th><th>Produk</th><th>Qty</th><th>Berat/unit</th></tr></thead><tbody>{preview.items.map((x,i)=><tr key={i}><td>{x.sku||'—'}</td><td>{x.name}</td><td>{x.quantity}</td><td>{x.weightGrams||'Belum ada'}</td></tr>)}</tbody></table></div>
     <strong>Booking blockers</strong><div className="vm-courier-blockers">{preview.bookingBlockers.map(v=><span key={v}>{explain[v]||v}</span>)}</div>
    </div>}
    {current?.state==='ready_for_carrier'&&!current.manifest_id&&<form onSubmit={prepare} className="vm-ops-form">
      <p className="vm-ops-hint">Pickup diminta setelah tombol booking resi dikonfirmasi. Waktu kedatangan mengikuti konfirmasi kurir.</p>
      <label>Catatan paket<textarea required rows={2} minLength={6} maxLength={300} value={manifestNotes} onChange={e=>{setManifestNotes(e.target.value);manifestKey.current=null;}} placeholder="Nomor packing checklist, jumlah koli, bukti timbang"/></label>
      <button className="vm-ops-primary" type="submit" disabled={busy||manifestNotes.trim().length<6||(Boolean(pickupDate)!==Boolean(pickupTime))}>Buat manifest internal</button>
     </form>}
   </section>
   <section className="vma26-panel vm-ops-form"><span className="vma26-eyebrow">REAL COURIER EVENTS</span><h3>AWB & tracking</h3>
    <p className="vm-ops-hint">Resi dan label berasal dari Jubelio. Status pickup diperbarui setelah dikonfirmasi kurir.</p>
    {current&&<><p><strong>{current.tracking_number||'Belum ada resi resmi'}</strong></p><span className="vm-fulfillment-state">{current.provider_status||current.carrier_state||'Belum dipesan'}</span></>}
    <div className="vm-fulfillment-timeline">{events.map(e=><div key={e.id}><strong>{e.event_type} · {e.provider_status||'—'}</strong>
      <small>{e.waybill_id||''} {e.observed_fee_idr?' · Koreksi tarif '+new Intl.NumberFormat('id-ID').format(Number(e.observed_fee_idr))+' perlu review':''}</small>
      <small>{new Date(e.received_at).toLocaleString('id-ID')} · {e.is_applied?'Teraplikasi':'Audit saja / diabaikan'}</small></div>)}</div>
    {!events.length&&<p className="vm-ops-hint">Belum ada event tracking untuk paket ini.</p>}
    <div className="vm-fulfillment-actions">
     {!current?.booking_state&&<button type="button" disabled={busy||!selected} onClick={()=>checkBooking()}>Dapatkan Airwaybill</button>}
     {current?.booking_state&&current.booking_state!=='booked'&&<button type="button" disabled={busy} onClick={()=>dispatchAction('reconcile')}>Periksa hasil booking</button>}
     {current?.booking_state==='booked'&&<><button type="button" disabled={busy} onClick={()=>dispatchAction('sync')}>Perbarui tracking</button><button type="button" disabled={busy} onClick={()=>dispatchAction('label')}>Ambil label kurir</button></>}
    </div>
    {dispatchPreview&&<div className="vm-ops-form"><p className="vm-ops-hint">AWB hanya dibuat untuk pesanan berbayar terverifikasi, paket siap kirim, manifest siap, dan tarif kurir yang masih valid. Booking menggunakan saldo Jubelio dan memerlukan konfirmasi admin.</p>
     {dispatchPreview.blockers.map(v=><p key={v} className="vm-ops-hint">{explain[v]||v}</p>)}
     {dispatchPreview.attempt&&<p role="status">{dispatchPreview.attempt.message}</p>}
     {dispatchPreview.canBook&&<><strong>{dispatchPreview.service} · {rupiah(dispatchPreview.feeIdr||0)}</strong>
      <p>{dispatchPreview.origin} → {dispatchPreview.destination}</p>
      <p className="vm-ops-hint">Ongkir pada pesanan: {rupiah(dispatchPreview.originalFeeIdr||0)}. Biaya booking memakai saldo Jubelio; selisih tidak ditagihkan otomatis kepada pelanggan.</p>
      <button type="button" className="vm-ops-primary" disabled={busy} onClick={book}>Konfirmasi & terbitkan AWB</button></>}
    </div>}
    {labelUrl&&<a href={labelUrl} target="_blank" rel="noopener noreferrer" className="vm-ops-primary">Buka label kurir</a>}

   </section>
  </div>
  <section className="vma26-panel"><h3>Parcels by brand & warehouse</h3>
    <div className="vm-ops-table"><table><thead><tr><th>Brand</th><th>Gudang</th><th>Order</th><th>Fulfillment</th><th>Manifest</th><th>Kurir / layanan</th><th>Status / AWB</th><th>Aksi</th></tr></thead>
    <tbody>{batches.map(b=><tr key={b.batch_id}><td>{b.brand_name}</td><td>{b.warehouse_code}</td><td>{b.order_id.slice(0,8)}</td>
     <td>{b.state}</td><td>{b.manifest_id?'Prepared':'Pending'}</td><td><strong>{b.shipping_courier_name||b.shipping_courier_code||'Belum dipilih'}</strong><small>{b.shipping_service_name||b.shipping_service_code||''}</small></td><td><strong>{b.tracking_number||'AWB belum terbit'}</strong><small>{b.provider_status||b.carrier_state||'Belum dipesan'}</small></td><td><button type="button" className="vm-ops-secondary" disabled={busy} onClick={()=>b.booking_state==='booked'?dispatchAction('label',b.batch_id):b.booking_state?dispatchAction('reconcile',b.batch_id):checkBooking(b.batch_id)}>{b.booking_state==='booked'?'Ambil label AWB':b.booking_state?'Periksa AWB':'Dapatkan AWB'}</button></td></tr>)}</tbody></table>
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
    <p><strong>PACKING SLIP INTERNAL · Gunakan label kurir untuk pengiriman.</strong></p>
    <p>Manifest {slip.slip.manifest_id.slice(0,8)} · Order {slip.slip.order_id.slice(0,8)}</p>
    <p><strong>Brand:</strong> {slip.slip.brand_name}</p>
    <div className="vm-ops-panels"><div><h3>Pengirim</h3><p>{slip.slip.warehouse_name}</p><p>{slip.slip.warehouse_address}</p>
      <p>{slip.slip.warehouse_city}, {slip.slip.warehouse_province} {slip.slip.warehouse_postal_code}</p></div>
      <div><h3>Penerima</h3><p>{slip.slip.receiver_name} · {slip.slip.receiver_phone}</p><p>{slip.slip.receiver_address}</p>
      <p>{slip.slip.receiver_city}, {slip.slip.receiver_province} {slip.slip.receiver_postal_code}</p></div></div>
    <div className="vm-ops-table"><table><thead><tr><th>SKU</th><th>Produk</th><th>Qty</th><th>Berat</th></tr></thead>
    <tbody>{slip.items.map((x,i)=><tr key={i}><td>{x.sku||'—'}</td><td>{x.name}</td><td>{x.quantity}</td><td>{x.weight_grams}g</td></tr>)}</tbody></table></div>
    <p>Total berat: {slip.slip.total_weight_grams} gram.</p>
    <div className="vm-courier-print-actions"><button type="button" className="vm-ops-primary" onClick={()=>window.print()}>Cetak packing slip internal</button></div>
  </div>}
  {message&&<p className="vm-ops-feedback" role="status">{message}</p>}
 </section>;
}
