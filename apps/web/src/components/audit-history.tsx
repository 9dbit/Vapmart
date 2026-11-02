 'use client';
import {useEffect,useState} from 'react';
type Change={id:string;action:string;actor_id:string;before_data:Record<string,unknown>|null;after_data:Record<string,unknown>;created_at:string};
export function AuditHistory({token,entityType,entityId}:{token:string|null;entityType:string;entityId:string}){
 const [items,setItems]=useState<Change[]>([]),[error,setError]=useState('');
 useEffect(()=>{if(!token)return;const ac=new AbortController();setItems([]);setError('');
  fetch('/api/admin/audit-log?entityType='+entityType+'&entityId='+entityId+'&pageSize=20',{headers:{authorization:'Bearer '+token},cache:'no-store',signal:ac.signal})
   .then(async r=>{if(!r.ok)throw Error('Riwayat perubahan belum dapat dimuat');return r.json();}).then(d=>setItems(d.items||[]))
   .catch(e=>{if(!ac.signal.aborted)setError(e.message);});return()=>ac.abort();
 },[token,entityType,entityId]);
 return <section className="vma26-panel" aria-label="Audit perubahan"><h2>Riwayat perubahan</h2>
  <p>20 perubahan terbaru, tersimpan bersama perubahan data. Waktu, operator, dan versi tidak dapat diubah dari panel.</p>
  {error?<p role="alert">{error}</p>:!items.length?<p>Belum ada perubahan tercatat sejak fitur audit diaktifkan.</p>:items.map(x=><details key={x.id}>
   <summary>{new Date(x.created_at).toLocaleString('id-ID')} - {x.action} - operator {x.actor_id.slice(0,8)}</summary>
   <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify({before:x.before_data,after:x.after_data},null,2)}</pre>
  </details>)}
 </section>;
}
