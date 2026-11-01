'use client';
import {useEffect,useState,type FormEvent} from 'react';
import type {Product} from '@/lib/types';
type Movement={id:string;product_id:string;delta_qty:number;stock_before:number|null;stock_after:number|null;reason:string;notes:string;created_at:string;actor_id:string|null};
export function InventoryLedger({token,products,onUpdated}:{token:string|null;products:Product[];onUpdated:()=>Promise<void>}){
 const [id,setId]=useState(''),[direction,setDirection]=useState('in'),[quantity,setQuantity]=useState('1'),[reason,setReason]=useState('stock_receipt'),[notes,setNotes]=useState(''),[events,setEvents]=useState<Movement[]>([]);
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{if(!products.some(p=>p.id===id))setId(products[0]?.id||'');},[products,id]);
 useEffect(()=>{
  if(!token||!id){setEvents([]);return;}
  const controller=new AbortController();setLoading(true);
  fetch('/api/admin/inventory/'+encodeURIComponent(id)+'/movements',{headers:{authorization:'Bearer '+token},signal:controller.signal,cache:'no-store'})
   .then(async r=>{const x=await r.json();if(!r.ok)throw Error(x?.message||'Gagal memuat riwayat');setEvents(x.items||[]);})
   .catch(e=>{if(!controller.signal.aborted)setMessage(e.message);})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[id,token]);
 const selected=products.find(p=>p.id===id);
 async function submit(e:FormEvent){
  e.preventDefault();if(!token||!id||busy)return;
  const delta=(direction==='out'?-1:1)*Number(quantity);
  if(!Number.isSafeInteger(delta)||Math.abs(delta)<1||Math.abs(delta)>100000){setMessage('Kuantitas harus 1 sampai 100.000');return;}
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/admin/inventory/adjust',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify({productId:id,delta,reason,notes:notes.trim(),idempotencyKey:crypto.randomUUID()})});
   const result=await response.json();if(!response.ok)throw Error(result?.message||'Adjustment stok gagal');
   setMessage('Stok berubah dari '+result.movement.stock_before+' menjadi '+result.movement.stock_after+'. Perubahan tercatat.');
   setNotes('');setQuantity('1');await onUpdated();
   const fresh=await fetch('/api/admin/inventory/'+encodeURIComponent(id)+'/movements',{headers:{authorization:'Bearer '+token},cache:'no-store'});
   if(fresh.ok){const data=await fresh.json();setEvents(data.items||[]);}
  }catch(err){setMessage(err instanceof Error?err.message:'Stok tidak berubah');}
  finally{setBusy(false);}
 }
 return <div className="vma26-layout">
  <section className="vma26-panel">
   <p className="vma26-eyebrow">TRACEABLE STOCK</p><h2>Inventory Ledger</h2>
   <p>Stok masuk/keluar menggunakan transaksi PostgreSQL yang mengunci produk, mencegah stok negatif, dan menyimpan catatan operator. Draft pesanan tidak mereservasi stok.</p>
   <label>Produk<select value={id} onChange={e=>{setId(e.target.value);setMessage('');}}>{products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku||'tanpa SKU'}</option>)}</select></label>
   {selected&&<div className="vma26-gate-row"><span>Stok tersedia</span><strong>{selected.stock_qty}</strong></div>}
   <h3 style={{marginTop:26}}>Riwayat perubahan</h3>
   {loading?<p>Memuat riwayat...</p>:events.length===0?<p>Belum ada pergerakan stok untuk produk ini.</p>:
   <div style={{overflowX:'auto'}}><table style={{width:'100%',minWidth:420,textAlign:'left',fontSize:12}}>
   <thead><tr><th>Waktu</th><th>Alasan</th><th>Perubahan</th><th>Saldo</th></tr></thead>
   <tbody>{events.map(m=><tr key={m.id}><td>{new Date(m.created_at).toLocaleString('id-ID')}</td><td>{m.reason}<small style={{display:'block'}}>{m.notes}</small></td><td>{m.delta_qty>0?'+':''}{m.delta_qty}</td><td>{m.stock_before??'–'} → {m.stock_after??'–'}</td></tr>)}</tbody>
   </table></div>}
  </section>
  <form className="vma26-panel vma26-editor" onSubmit={submit}>
   <p className="vma26-eyebrow">STOCK MOVEMENT</p><h2>Catat stok</h2>
   <label>Jenis pergerakan<select value={direction} onChange={e=>{setDirection(e.target.value);setReason(e.target.value==='in'?'stock_receipt':'adjustment');}}>
    <option value="in">Stok masuk (+)</option><option value="out">Stok keluar (-)</option></select></label>
   <label>Alasan<select value={reason} onChange={e=>setReason(e.target.value)}>
    <option value="stock_receipt">Penerimaan stok</option><option value="adjustment">Koreksi fisik / kerusakan</option><option value="return">Pengembalian stok</option></select></label>
   <label>Kuantitas<input type="number" min="1" max="100000" required value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
   <label>Catatan audit<textarea required minLength={6} maxLength={300} rows={4} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Masukkan nomor dokumen dan alasan stok masuk/keluar"/></label>
   <button className="vma26-btn-dark" type="submit" disabled={busy||!id}>{busy?'Menyimpan...':'Simpan pergerakan stok'}</button>
   {message&&<p role="status">{message}</p>}
  </form>
 </div>;
}
