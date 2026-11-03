'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useCustomerAuth} from '@/lib/customer-auth';
import {formatIDR} from '@/lib/types';
import '../catalog-store.css';
export default function Orders(){const auth=useCustomerAuth();const [data,setData]=useState<any>(null),[error,setError]=useState(''),[page,setPage]=useState(1),[rev,setRev]=useState(0);
 useEffect(()=>{if(!auth.accessToken)return;const ac=new AbortController();setError('');fetch('/api/customer/catalog/orders?page='+page+'&pageSize=20',{headers:{authorization:'Bearer '+auth.accessToken},cache:'no-store',signal:ac.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.message||'Gagal membaca pesanan');setData(d)}).catch(e=>{if(!ac.signal.aborted)setError(e.message)});return()=>ac.abort()},[auth.accessToken,page,rev]);
 return <main className="main-container vcs-history"><h1>Pesanan saya</h1><p>Draft dan status pesanan milik akun Anda. Pembayaran belum diaktifkan.</p>{auth.loading?<p>Memeriksa sesi...</p>:!auth.accessToken?<Link href="/login?next=/pesanan">Masuk untuk melihat pesanan</Link>:error?<p role="alert">{error} <button onClick={()=>setRev(x=>x+1)}>Coba lagi</button></p>:!data?<p role="status">Memuat pesanan...</p>:<>{!data.items.length&&<p>Belum ada pesanan.</p>}{data.items.map((o:any)=><article key={o.id} className="vcs-history-row"><Link href={'/pesanan/'+o.id}><strong>{o.id.slice(0,8).toUpperCase()}</strong><br/>{new Date(o.created_at).toLocaleString('id-ID')}</Link><div>{o.status} / {o.payment_status}<br/>{o.city}</div><strong>{formatIDR(Number(o.total_idr))}</strong></article>)}<div className="vcs-actions"><button disabled={page===1} onClick={()=>setPage(x=>x-1)}>Sebelumnya</button><span>{page}</span><button disabled={!data.hasMore} onClick={()=>setPage(x=>x+1)}>Berikutnya</button></div></>}<p><Link href="/catalog">Kembali ke katalog</Link></p></main>;
}
