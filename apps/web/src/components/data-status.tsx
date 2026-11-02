 'use client';
import {useTransition} from 'react';
import {useRouter} from 'next/navigation';
export function DataStatus({kind,code}:{kind:string;code:string|null}){
 const router=useRouter(),[pending,start]=useTransition();
 return <section role="alert" data-catalog-state="unavailable" className="main-container" style={{marginBlock:18,padding:22,borderRadius:18,background:'var(--vm-card,#f8f4fc)',border:'1px solid #d9cce4'}}>
  <strong>Data {kind} belum dapat dimuat.</strong>
  <p>Koneksi sedang terganggu. Ini bukan berarti data kosong atau terhapus. Tampilan dan aset tetap dipertahankan.</p>
  <small>Kode: {code||'SOURCE_UNAVAILABLE'}</small>{' '}
  <button type="button" disabled={pending} onClick={()=>start(()=>router.refresh())} style={{padding:'12px 18px',borderRadius:99,border:'1px solid currentColor',cursor:'pointer'}}>{pending?'Memuat ulang...':'Coba lagi'}</button>
 </section>;
}
