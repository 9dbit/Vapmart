'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useCustomerAuth} from '@/lib/customer-auth';
type Session={state:string;paymentUrl:string|null;sessionId:string|null;expiresAt:string|null;message:string};
type State={readiness:{paymentEnabled:boolean;environment:string};session:Session|null};
export function XenditOrderPayment({orderId}:{orderId:string}){
 const {accessToken}=useCustomerAuth();
 const [state,setState]=useState<State|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const key=useRef<string|null>(null),locked=useRef(false);
 const path='/api/checkout/orders/'+encodeURIComponent(orderId)+'/payment-session';
 const load=useCallback(async(signal?:AbortSignal)=>{
  if(!accessToken)return;
  const r=await fetch(path,{headers:{authorization:'Bearer '+accessToken},cache:'no-store',signal});
  const x=await r.json();if(!r.ok)throw Error(x?.message||'Status pembayaran tidak tersedia');
  if(!signal?.aborted)setState(x);
 },[accessToken,path]);
 useEffect(()=>{const c=new AbortController();setState(null);setError('');key.current=null;
  void load(c.signal).catch(e=>{if(!c.signal.aborted)setError(e.message)});return()=>c.abort();
 },[load]);
 const check=useCallback(async()=>{
  if(!accessToken||locked.current)return;
  locked.current=true;setBusy(true);setError('');
  try{
   const r=await fetch(path+'/reconcile',{method:'POST',headers:{authorization:'Bearer '+accessToken,'content-type':'application/json'},body:'{}'});
   const x=await r.json();if(!r.ok)throw Error(x?.message||'Verifikasi belum tersedia. Coba lagi.');
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Gagal memeriksa pembayaran');}
  finally{locked.current=false;setBusy(false);}
 },[accessToken,path,load]);
 useEffect(()=>{
  if(!state?.readiness.paymentEnabled||!state.session?.sessionId||!['active','awaiting_reconciliation'].includes(state.session.state))return;
  void check();const timer=setInterval(()=>{if(document.visibilityState==='visible')void check()},10000);
  const visible=()=>{if(document.visibilityState==='visible')void check()};
  document.addEventListener('visibilitychange',visible);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visible)};
 },[state?.readiness.paymentEnabled,state?.session?.state,state?.session?.sessionId,check]);
 async function start(){
  if(!accessToken||locked.current)return;
  locked.current=true;setBusy(true);setError('');
  try{
   key.current??=crypto.randomUUID();
   const r=await fetch(path,{method:'POST',headers:{authorization:'Bearer '+accessToken,'content-type':'application/json'},body:JSON.stringify({idempotencyKey:key.current})});
   const x=await r.json();
   if(!r.ok){if(x?.code==='XENDIT_SESSION_REJECTED')key.current=null;await load();throw Error(x?.message||'Sesi belum dapat dibuat. Periksa status sebelum mencoba lagi.');}
   key.current=null;await load();
   if(x.paymentUrl){const u=new URL(x.paymentUrl);if(u.protocol!=='https:'||!['dev.xen.to','checkout-staging.xendit.co'].includes(u.hostname))throw Error('Alamat checkout tidak valid');window.location.assign(u.href);}
  }catch(e){setError(e instanceof Error?e.message:'Tidak dapat membuka pembayaran');}
  finally{locked.current=false;setBusy(false);}
 }
 const s=state?.session;
 const canCreate=state?.readiness.paymentEnabled&&(!s||['failed','expired','canceled'].includes(s.state));
 const resumable=s?.state==='active'&&s.paymentUrl&&(!s.expiresAt||Date.parse(s.expiresAt)>Date.now());
 return <section aria-label="Pembayaran Xendit sandbox" className="vm-xendit-panel">
  <h2>Xendit · Sandbox</h2>
  <p>Simulasi pembayaran. Jangan transfer uang nyata. Pesanan ini tidak otomatis diproses gudang.</p>
  {!state&&!error&&<p role="status">Memeriksa koneksi pembayaran...</p>}
  {s&&<p role="status"><strong>{s.state==='completed'?'Simulasi berhasil':s.state==='expired'?'Sesi kedaluwarsa':s.state==='active'?'Menunggu simulasi pembayaran':s.state==='awaiting_reconciliation'?'Memverifikasi pembayaran':s.state==='unknown'?'Status sesi perlu diperiksa':s.state==='canceled'?'Sesi dibatalkan':s.state==='failed'?'Sesi gagal dibuat':'Menyiapkan sesi'}</strong><br/>{s.message}</p>}
  {s?.expiresAt&&s.state==='active'&&<p>Berlaku hingga {new Date(s.expiresAt).toLocaleString('id-ID')}</p>}
  {state&&!state.readiness.paymentEnabled&&<p>Sandbox belum siap. Hubungi admin untuk memeriksa konfigurasi.</p>}
  {canCreate&&<button type="button" className="vco26-button" disabled={busy} onClick={()=>void start()}>{busy?'Membuka checkout...':'Bayar melalui Xendit sandbox ↗'}</button>}
  {resumable&&<a className="vco26-button" href={s.paymentUrl!}>Lanjutkan pembayaran sandbox ↗</a>}
  {s?.sessionId&&s.state!=='completed'&&<button type="button" className="vco26-secondary" disabled={busy} onClick={()=>void check()}>{busy?'Memeriksa...':'Periksa status pembayaran'}</button>}
  {error&&<p role="alert">{error}</p>}
  {!state&&error&&<button type="button" className="vco26-secondary" onClick={()=>void load().catch(e=>setError(e.message))}>Coba muat lagi</button>}
 </section>;
}
