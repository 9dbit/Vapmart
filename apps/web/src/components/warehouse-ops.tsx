'use client';
import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import type {Product} from '@/lib/types';
import '../app/warehouse-ops.css';
type Warehouse={id:string;code:string;name:string;city:string;province:string;address_line:string;postal_code:string|null;is_active:boolean;is_dispatch_enabled:boolean;is_system_hold:boolean};
type Stock={warehouse_id:string;product_id:string;sku:string|null;product_name:string;brand_name:string|null;on_hand:number;reserved:number;available:number;is_dispatch_enabled:boolean;is_system_hold:boolean};
type Event={id:string;delta_on_hand:number;delta_reserved:number;on_hand_before:number;on_hand_after:number;reserved_before:number;reserved_after:number;reason:string;notes:string;created_at:string};
type Data={warehouses:Warehouse[];stock:Stock[]};
const initial={code:'',name:'',address:'',city:'',province:'',postalCode:''};
const showError=(v:unknown)=>v instanceof Error?v.message:'Tidak dapat menyimpan perubahan';
export function WarehouseOps({token,products,onUpdated}:{token:string|null;products:Product[];onUpdated:()=>Promise<void>}){
 const [data,setData]=useState<Data>({warehouses:[],stock:[]}),[creating,setCreating]=useState(initial);
 const [warehouseId,setWarehouseId]=useState(''),[productId,setProductId]=useState('');
 const [qty,setQty]=useState('1'),[direction,setDirection]=useState<'in'|'out'>('in'),[reason,setReason]=useState('receipt'),[notes,setNotes]=useState('');
 const [source,setSource]=useState(''),[destination,setDestination]=useState(''),[transferQty,setTransferQty]=useState('1'),[transferNotes,setTransferNotes]=useState('');
 const [events,setEvents]=useState<Event[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[message,setMessage]=useState('');
 const [tab,setTab]=useState<'balances'|'adjust'|'transfer'>('balances');
 const adjustKey=useRef<string|null>(null),transferKey=useRef<string|null>(null);
 async function req(path:string,method:'GET'|'POST'|'PATCH'='GET',body?:unknown){
  if(!token)throw Error('Admin login diperlukan');
  const r=await fetch(path,{method,headers:{authorization:'Bearer '+token,...(body===undefined?{}:{'content-type':'application/json'})},cache:'no-store',...(body===undefined?{}:{body:JSON.stringify(body)})});
  const x=await r.json();if(!r.ok)throw Error(Array.isArray(x?.message)?x.message.join(', '):x?.message||x?.code||'HTTP '+r.status);
  return x;
 }
 async function refresh(){
  const result=await req('/api/admin/warehouses');setData(result);
 }
 useEffect(()=>{if(!token)return;let active=true;setLoading(true);
  fetch('/api/admin/warehouses',{headers:{authorization:'Bearer '+token},cache:'no-store'})
   .then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.message||'Gagal memuat gudang');if(active)setData(x);})
   .catch(e=>{if(active)setMessage(showError(e));}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[token]);
 const actual=data.warehouses.filter(w=>!w.is_system_hold&&w.is_active);
 const selected=products.find(p=>p.id===productId)||null;
 const eligible=data.stock.filter(s=>s.on_hand>0);
 const sum=useMemo(()=>({hand:data.stock.reduce((n,s)=>n+s.on_hand,0),reserved:data.stock.reduce((n,s)=>n+s.reserved,0),
  sellable:data.stock.filter(s=>s.is_dispatch_enabled).reduce((n,s)=>n+s.available,0)}),[data.stock]);
 useEffect(()=>{if(!products.some(p=>p.id===productId))setProductId(products[0]?.id||'');},[products,productId]);
 useEffect(()=>{if(!actual.some(w=>w.id===warehouseId))setWarehouseId(actual[0]?.id||'');},[data.warehouses,warehouseId]);
 useEffect(()=>{if(!eligible.some(s=>s.warehouse_id===source&&s.product_id===productId))setSource(eligible.find(s=>s.product_id===productId)?.warehouse_id||'');},[productId,data.stock,source]);
 useEffect(()=>{if(!actual.some(w=>w.id===destination))setDestination(actual[0]?.id||'');},[data.warehouses,destination]);
 useEffect(()=>{if(!warehouseId||!productId||!token){setEvents([]);return;}
  const ac=new AbortController();
  fetch('/api/admin/warehouses/'+encodeURIComponent(warehouseId)+'/stock/'+encodeURIComponent(productId)+'/events',{headers:{authorization:'Bearer '+token},signal:ac.signal,cache:'no-store'})
   .then(async r=>{if(r.ok){const x=await r.json();setEvents(x.items||[]);}}).catch(()=>{});
  return()=>ac.abort();
 },[warehouseId,productId,token,data.stock]);
 async function change(mode:string,op:()=>Promise<unknown>){
  if(busy)return;setBusy(true);setMessage('');
  try{await op();await refresh();await onUpdated();setMessage(mode+' berhasil disimpan. Semua perubahan dicatat.');}
  catch(e){setMessage(showError(e));}
  finally{setBusy(false);}
 }
 async function create(e:FormEvent){e.preventDefault();await change('Gudang baru',async()=>{
  await req('/api/admin/warehouses','POST',{...creating,postalCode:creating.postalCode||null});setCreating(initial);
 });}
 async function toggle(w:Warehouse){
  if(!window.confirm(w.is_dispatch_enabled?'Nonaktifkan gudang ini dari pengiriman? Reservasi aktif akan memblokir operasi.':'Aktifkan lokasi ini untuk stok jual setelah alamat dan stok fisik diverifikasi?'))return;
  await change('Status gudang',()=>req('/api/admin/warehouses/'+w.id,'PATCH',{dispatchEnabled:!w.is_dispatch_enabled}));
 }
 async function adjust(e:FormEvent){e.preventDefault();
  const delta=(direction==='out'?-1:1)*Number(qty);
  if(!Number.isSafeInteger(delta)||Math.abs(delta)<1||Math.abs(delta)>100000){setMessage('Kuantitas harus 1 sampai 100.000');return;}
  await change('Pergerakan stok',async()=>{
   adjustKey.current??=crypto.randomUUID();
   await req('/api/admin/warehouses/stock/adjust','POST',{warehouseId,productId,delta,reason,notes:notes.trim(),idempotencyKey:adjustKey.current});
   adjustKey.current=null;setNotes('');setQty('1');
  });
 }
 async function transfer(e:FormEvent){e.preventDefault();
  await change('Transfer fisik',async()=>{
   transferKey.current??=crypto.randomUUID();
   await req('/api/admin/warehouses/stock/transfer','POST',{fromWarehouseId:source,toWarehouseId:destination,productId,quantity:Number(transferQty),notes:transferNotes.trim(),idempotencyKey:transferKey.current});
   transferKey.current=null;setTransferNotes('');setTransferQty('1');
  });
 }
 const currentStock=data.stock.filter(s=>s.product_id===productId);
 return <section className="vm-warehouse">
  <header className="vm-warehouse-heading"><div><span className="vma26-eyebrow">CP35 / WAREHOUSE OPERATIONS</span><h2>Gudang & Inventory</h2><p>Stok per lokasi dengan ledger, transfer, dan status dispatch terverifikasi.</p></div>
   <button type="button" className="vm-ops-secondary" onClick={()=>change('Refresh',refresh)} disabled={busy}>↻ Refresh</button></header>
  <div className="vm-ops-stats">
   <div><small>Warehouse</small><strong>{data.warehouses.filter(w=>!w.is_system_hold).length}</strong></div>
   <div><small>On-hand (all locations)</small><strong>{sum.hand}</strong></div>
   <div><small>Reserved</small><strong>{sum.reserved}</strong></div>
   <div><small>Sellable available</small><strong>{sum.sellable}</strong></div>
  </div>
  <div className="vm-ops-panels">
   <section className="vma26-panel"><span className="vma26-eyebrow">LOCATIONS</span><h3>Daftar gudang</h3>
    {loading?<p>Memuat gudang...</p>:data.warehouses.map(w=><div className="vm-ops-location" key={w.id}>
     <div><strong>{w.code} · {w.name}</strong><small>{w.is_system_hold?'Saldo historis belum diverifikasi':(w.city||'Lokasi belum lengkap')+' · '+(w.postal_code||'Kode pos belum ada')}</small></div>
     <span className={'vm-ops-status'+(w.is_dispatch_enabled?' active':'')}>{w.is_system_hold?'HOLD':w.is_dispatch_enabled?'Dispatch ON':'Dispatch OFF'}</span>
     {!w.is_system_hold&&<button type="button" className="vm-ops-secondary" disabled={busy} onClick={()=>toggle(w)}>{w.is_dispatch_enabled?'Nonaktifkan':'Aktifkan'}</button>}
    </div>)}
    <p className="vm-ops-hint">LEGACY-HOLD adalah stok lama yang belum punya lokasi nyata. Pindahkan setelah pemeriksaan fisik, jangan dipakai untuk checkout.</p>
   </section>
   <form className="vma26-panel vm-ops-form" onSubmit={create}><span className="vma26-eyebrow">NEW WAREHOUSE</span><h3>Tambah gudang</h3>
    <div className="vm-ops-input-grid">
    <label>Kode gudang<input required maxLength={24} placeholder="BDG-01" value={creating.code} onChange={e=>setCreating(x=>({...x,code:e.target.value.toUpperCase()}))}/></label>
    <label>Nama gudang<input required maxLength={100} placeholder="Warehouse Bandung" value={creating.name} onChange={e=>setCreating(x=>({...x,name:e.target.value}))}/></label>
    <label>Alamat operasional<input maxLength={300} placeholder="Jalan, nomor, kawasan" value={creating.address} onChange={e=>setCreating(x=>({...x,address:e.target.value}))}/></label>
    <label>Kota<input maxLength={100} value={creating.city} onChange={e=>setCreating(x=>({...x,city:e.target.value}))}/></label>
    <label>Provinsi<input maxLength={100} value={creating.province} onChange={e=>setCreating(x=>({...x,province:e.target.value}))}/></label>
    <label>Kode pos<input inputMode="numeric" maxLength={5} pattern="[0-9]{5}" value={creating.postalCode} onChange={e=>setCreating(x=>({...x,postalCode:e.target.value}))}/></label>
    </div>
    <p className="vm-ops-hint">Gudang baru selalu berstatus Dispatch OFF. Aktifkan setelah alamat dan stok siap.</p>
    <button className="vm-ops-primary" disabled={busy} type="submit">{busy?'Menyimpan...':'+ Tambah gudang'}</button>
   </form>
  </div>
  <nav className="vm-ops-tabs" aria-label="Warehouse Operations">
   <button className={tab==='balances'?'active':''} type="button" onClick={()=>setTab('balances')}>Saldo lokasi</button>
   <button className={tab==='adjust'?'active':''} type="button" onClick={()=>setTab('adjust')}>Stok masuk / keluar</button>
   <button className={tab==='transfer'?'active':''} type="button" onClick={()=>setTab('transfer')}>Transfer antar gudang</button>
  </nav>
  {tab==='balances'&&<section className="vma26-panel">
   <h3>Stok per lokasi</h3><div className="vm-ops-table"><table><thead><tr><th>Produk / SKU</th><th>Gudang</th><th>On-hand</th><th>Reserved</th><th>Available</th><th>Dispatch</th></tr></thead>
   <tbody>{data.stock.map(s=><tr key={s.product_id+s.warehouse_id}><td><strong>{s.product_name}</strong><small>{s.sku||'Tanpa SKU'} · {s.brand_name||'Tanpa brand'}</small></td>
    <td>{data.warehouses.find(w=>w.id===s.warehouse_id)?.code||'—'}</td><td>{s.on_hand}</td><td>{s.reserved}</td><td>{s.available}</td><td>{s.is_dispatch_enabled?'Aktif':s.is_system_hold?'HOLD':'Tertutup'}</td></tr>)}</tbody></table>
   {data.stock.length===0&&<p>Belum ada saldo gudang. Tambah gudang dan catat penerimaan stok terlebih dahulu.</p>}</div>
  </section>}
  {tab==='adjust'&&<div className="vm-ops-panels"><form className="vma26-panel vm-ops-form" onSubmit={adjust}>
   <h3>Catat stok fisik</h3>
   <label>Gudang<select required value={warehouseId} onChange={e=>{setWarehouseId(e.target.value);adjustKey.current=null;}}>{actual.map(w=><option value={w.id} key={w.id}>{w.code} · {w.name}</option>)}</select></label>
   <label>Produk<select required value={productId} onChange={e=>{setProductId(e.target.value);adjustKey.current=null;}}>{products.map(p=><option value={p.id} key={p.id}>{p.name} · {p.sku||'Tanpa SKU'}</option>)}</select></label>
   <div className="vm-ops-input-grid"><label>Perubahan<select value={direction} onChange={e=>{setDirection(e.target.value as 'in'|'out');setReason(e.target.value==='in'?'receipt':'adjustment');adjustKey.current=null;}}><option value="in">Stok masuk (+)</option><option value="out">Stok keluar (-)</option></select></label>
   <label>Kuantitas<input type="number" min={1} max={100000} required value={qty} onChange={e=>{setQty(e.target.value);adjustKey.current=null;}}/></label></div>
   <label>Alasan<select value={reason} onChange={e=>{setReason(e.target.value);adjustKey.current=null;}}><option value="receipt">Penerimaan</option><option value="adjustment">Penyesuaian fisik</option><option value="return">Retur ke stok</option></select></label>
   <label>Catatan audit<textarea required minLength={6} maxLength={300} rows={3} value={notes} onChange={e=>{setNotes(e.target.value);adjustKey.current=null;}} placeholder="Cantumkan dokumen penerimaan dan hasil stock opname"/></label>
   <button className="vm-ops-primary" type="submit" disabled={busy||!warehouseId||!productId}>Simpan perubahan stok</button>
   <p className="vm-ops-hint">Operasi mengunci saldo di database. Stok yang sudah reserved tidak dapat dikeluarkan begitu saja.</p>
  </form><section className="vma26-panel"><h3>Audit lokasi terpilih</h3>
   <p className="vm-ops-hint">{selected?.name||'Pilih produk'} · {data.warehouses.find(w=>w.id===warehouseId)?.code||'Pilih gudang'}</p>
   <div className="vm-ops-table"><table><thead><tr><th>Waktu</th><th>Alasan</th><th>On-hand</th><th>Reserved</th></tr></thead>
   <tbody>{events.map(e=><tr key={e.id}><td>{new Date(e.created_at).toLocaleString('id-ID')}</td><td><strong>{e.reason}</strong><small>{e.notes}</small></td>
    <td>{e.on_hand_before} → {e.on_hand_after}</td><td>{e.reserved_before} → {e.reserved_after}</td></tr>)}</tbody></table>
   {!events.length&&<p>Belum ada pergerakan di lokasi ini.</p>}</div>
  </section></div>}
  {tab==='transfer'&&<form className="vma26-panel vm-ops-form vm-ops-transfer" onSubmit={transfer}>
   <h3>Transfer antar gudang</h3><p className="vm-ops-hint">Gunakan transfer untuk memindahkan stok LEGACY-HOLD setelah diverifikasi secara fisik. Saldo total tidak bertambah otomatis.</p>
   <div className="vm-ops-input-grid"><label>Produk<select required value={productId} onChange={e=>{setProductId(e.target.value);transferKey.current=null;}}>{products.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
   <label>Jumlah fisik<input required type="number" min={1} max={100000} value={transferQty} onChange={e=>{setTransferQty(e.target.value);transferKey.current=null;}}/></label>
   <label>Gudang asal<select required value={source} onChange={e=>{setSource(e.target.value);transferKey.current=null;}}>{eligible.filter(x=>x.product_id===productId).map(x=><option value={x.warehouse_id} key={x.warehouse_id}>{data.warehouses.find(w=>w.id===x.warehouse_id)?.code} · available {x.available}</option>)}</select></label>
   <label>Gudang tujuan<select required value={destination} onChange={e=>{setDestination(e.target.value);transferKey.current=null;}}>{actual.map(w=><option value={w.id} key={w.id}>{w.code} · {w.name}</option>)}</select></label>
   </div>
   <label>Dokumen transfer & verifikasi<textarea required rows={3} minLength={6} maxLength={300} value={transferNotes} onChange={e=>{setTransferNotes(e.target.value);transferKey.current=null;}} placeholder="Nomor surat jalan / hasil hitung fisik"/></label>
   <button className="vm-ops-primary" type="submit" disabled={busy||!source||!destination||source===destination||!productId}>Catat transfer fisik</button>
  </form>}
  {message&&<p className="vm-ops-feedback" role="status">{message}</p>}
 </section>;
}
