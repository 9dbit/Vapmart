'use client';
import {useEffect,useState} from 'react';
import {useCustomerAuth} from '@/lib/customer-auth';
import '../app/xendit-readiness.css';

type Readiness={provider:'xendit';environment:string;sandboxEnabled:boolean;connected:boolean;channels:string[];
 webhookEnabled:boolean;liveEnabled:boolean;paymentEnabled:boolean;
 merchantConfigured:boolean;testKeyConfigured:boolean;callbackTokenConfigured:boolean;
 channelsConfigured:boolean;orderSandboxEnabled:boolean;settlementEnabled:boolean;missing:string[]};
const callback='https://vapmart.id/api/webhooks/xendit/payment-sessions';

export function XenditReadinessPanel(){
 const auth=useCustomerAuth();
 const [state,setState]=useState<Readiness|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [copied,setCopied]=useState(false);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  if(!auth.accessToken)return;
  const abort=new AbortController();
  setBusy(true);setError('');setState(null);
  fetch('/api/admin/payments/xendit/readiness',{
   headers:{authorization:'Bearer '+auth.accessToken},cache:'no-store',signal:abort.signal
  }).then(async r=>{const x=await r.json();if(!r.ok)throw Error(x?.message||'Tidak bisa membaca status Xendit');return x as Readiness;})
   .then(setState).catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Status tidak tersedia')})
   .finally(()=>{if(!abort.signal.aborted)setBusy(false)});
  return()=>abort.abort();
 },[auth.accessToken,revision]);
 const checks=[
  {title:'Merchant Business ID',ready:state?.merchantConfigured},
  {title:'API key Test Mode',ready:state?.testKeyConfigured},
  {title:'Webhook verification token',ready:state?.callbackTokenConfigured},
  {title:'Kanal pembayaran terpilih',ready:state?.channelsConfigured},
  {title:'Sandbox transport diaktifkan',ready:state?.sandboxEnabled},
  {title:'Webhook sandbox diaktifkan',ready:state?.webhookEnabled},
  {title:'Checkout sandbox diaktifkan',ready:state?.orderSandboxEnabled}
 ];
 return <section className="vm-xendit-panel" aria-labelledby="vm-xendit-title">
  <header className="vm-xendit-head"><div><p>PAYMENTS / INTEGRATION</p><h2 id="vm-xendit-title">Xendit Gateway</h2>
   <span>Status koneksi dan kanal pembayaran dari server Vapmart.</span></div>
   <strong className="vm-xendit-flag">{busy?'MEMERIKSA':error?'STATUS TIDAK TERSEDIA':state?.paymentEnabled?'SANDBOX AKTIF':state?.connected?'SANDBOX TERHUBUNG':'PERLU KONFIGURASI'}</strong></header>
  <p className="vm-xendit-notice">Sandbox digunakan untuk simulasi pembayaran melalui Xendit. Hasil simulasi diverifikasi server dan tidak mengubah pesanan menjadi pembayaran nyata atau memicu pengiriman.</p>
  <button className="vm-xendit-refresh" type="button" disabled={busy||!auth.accessToken} onClick={()=>setRevision(x=>x+1)}>{busy?'Memeriksa...':'Perbarui status'}</button>
  {busy&&<p role="status">Memeriksa konfigurasi server...</p>}
  {error&&<p role="alert" className="vm-xendit-error">{error}</p>}
  {state&&<><div className="vm-xendit-checks">
   {checks.map(check=><div key={check.title} className="vm-xendit-check">
    <span>{check.title}</span><strong className={check.ready?'is-ready':'is-missing'}>{check.ready?'Tersedia':'Perlu konfigurasi'}</strong>
   </div>)}
  </div>
  <p className="vm-xendit-note">Checkout: <strong>{state.paymentEnabled?'Sandbox aktif':'Belum aktif'}</strong>.
   Pembayaran nyata: <strong>Belum aktif</strong>.<br/>Kanal sandbox: {state.channels?.join(', ')||'Belum dipilih'}.</p></>}
  <div className="vm-xendit-callback"><div><small>WEBHOOK PAYMENT SESSION</small><code>{callback}</code></div>
   <button type="button" onClick={()=>{void navigator.clipboard.writeText(callback).then(()=>setCopied(true)).catch(()=>setCopied(false))}}>
    {copied?'Tersalin':'Salin URL'}</button></div>
  <p className="vm-xendit-foot">Konfigurasi callback pada Xendit Dashboard → Settings → Webhooks → Payment Session.
   <a href="https://docs.xendit.co/docs/payments-integration-setup" rel="noopener noreferrer" target="_blank"> Buka panduan Xendit</a>.
   Pengaturan dan aktivasi kredensial dilakukan di Railway, bukan di browser pelanggan.</p>
 </section>;
}
