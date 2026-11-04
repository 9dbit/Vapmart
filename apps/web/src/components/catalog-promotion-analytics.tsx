'use client';
import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {useCustomerAuth} from '@/lib/customer-auth';
import {CatalogNotice,useCatalogAdmin} from './catalog-admin-shell';
import '../app/catalog-analytics.css';

type Money=string;
type Period={from:string;to:string;timezone:string;campaignId:string|null};
type Summary={
 appliedOrders:number;paidOrders:number;pendingOrders:number;refundedOrders:number;
 paidCampaignOrders:number;paidVoucherOrders:number;stackedPaidOrders:number;anomalyOrders:number;
 paidGmvIdr:Money;voucherDiscountIdr:Money;promotionDiscountIdr:Money;paidShippingIdr:Money;paidTotalIdr:Money;
 paidDiscountIdr:Money;netMerchandiseIdr:Money;paidRatePct:number|null;discountRatePct:number|null;
};
type Daily={day:string;appliedOrders:number;paidOrders:number;paidGmvIdr:Money;voucherDiscountIdr:Money;promotionDiscountIdr:Money};
type Campaign={id:string;title:string;slug:string;status:string;startsAt:string;endsAt:string;memberOnly:boolean;appliedOrders:number;paidOrders:number;pendingOrders:number;refundedOrders:number;stackedPaidOrders:number;paidGmvIdr:Money;promotionDiscountIdr:Money;stackedVoucherDiscountIdr:Money;paidRatePct:number|null};
type Segment={segment:string;paidOrders:number;paidGmvIdr:Money;paidDiscountIdr:Money};
type Breakdown={id:string;name:string;units:string;paidGmvIdr:Money;voucherDiscountIdr:Money;promotionDiscountIdr:Money};
type Anomaly={orderId:string;createdAt:string;paymentStatus:string;discountDeltaIdr:Money;totalDeltaIdr:Money};
type Overview={period:Period;summary:Summary;daily:Daily[];campaigns:Campaign[];campaignListTruncated:boolean;segments:Segment[];products:Breakdown[];categories:Breakdown[];anomalies:Anomaly[];definitions:Record<string,string>};
type LedgerItem={id:string;createdAt:string;paymentStatus:string;orderStatus:string;campaignId:string|null;campaignTitle:string|null;voucherCode:string|null;subtotalIdr:Money;voucherDiscountIdr:Money;promotionDiscountIdr:Money;discountIdr:Money;shippingFeeIdr:Money;totalIdr:Money;discountDeltaIdr:Money;totalDeltaIdr:Money};
type Ledger={items:LedgerItem[];hasMore:boolean;nextCursor:string|null};
type Filters={from:string;to:string;campaignId:string};
const WINDOW=86400000;
const rupiah=new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0});
const integer=new Intl.NumberFormat('id-ID',{maximumFractionDigits:0});
const money=(x:Money|number|bigint|undefined)=>rupiah.format(BigInt(x??0));
const count=(n:number|string|undefined)=>integer.format(Number(n||0));
const pct=(n:number|null|undefined)=>n===null||n===undefined?'—':n.toLocaleString('id-ID',{maximumFractionDigits:2})+'%';
const pctHeight=(value:string,max:bigint)=>{
 const n=BigInt(value||'0');return max===BigInt(0)||n===BigInt(0)?0:Math.max(0,Math.min(100,Number(n*BigInt(10000)/max)/100));
};
const numericMax=(list:string[])=>list.reduce((m,x)=>BigInt(x||'0')>m?BigInt(x||'0'):m,BigInt(0));
const today=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
const dayOffset=(day:string,diff:number)=>new Date(Date.parse(day+'T00:00:00+07:00')+diff*WINDOW+7*3600000).toISOString().slice(0,10);
const initial=():Filters=>{const end=today();return {from:dayOffset(end,-29),to:end,campaignId:''}};
const param=(filters:Filters)=>new URLSearchParams({from:filters.from,to:filters.to,...(filters.campaignId?{campaignId:filters.campaignId}:{})}).toString();
function Card({label,value,note}:{label:string;value:string;note:string}){return <div className="vc-analytics-kpi"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>}
function BarChart({rows,kind}:{rows:Daily[];kind:'gmv'|'discount'}){
 const max=numericMax(rows.map(x=>kind==='gmv'?x.paidGmvIdr:String(BigInt(x.voucherDiscountIdr)+BigInt(x.promotionDiscountIdr))));
 const labels=kind==='gmv'?['GMV paid']:['Promo','Voucher'];
 return <div className="vc-analytics-chart"><div className="vc-analytics-legend">{labels.map((x,i)=><span key={x}><i className={kind==='gmv'?'vc-bar-gmv':i===0?'vc-bar-promo':'vc-bar-voucher'}/>{x}</span>)}</div>
  <div className="vc-analytics-bars-scroll"><div className="vc-analytics-bars" role="img" aria-label={kind==='gmv'?'GMV paid per hari':'Diskon paid voucher dan promo per hari'}>
   {rows.map((r,i)=>{
    const total=kind==='gmv'?r.paidGmvIdr:String(BigInt(r.voucherDiscountIdr)+BigInt(r.promotionDiscountIdr));
    const height=pctHeight(total,max);
    const voucherTotal=BigInt(r.voucherDiscountIdr||0),promoTotal=BigInt(r.promotionDiscountIdr||0),discountTotal=BigInt(total||0);
    return <div className="vc-analytics-bar-day" key={r.day} title={r.day+' | '+(kind==='gmv'?money(r.paidGmvIdr):'Promo '+money(r.promotionDiscountIdr)+' + Voucher '+money(r.voucherDiscountIdr))}>
     <div className="vc-analytics-bar-track">
      {kind==='gmv'?<div className="vc-bar-gmv" style={{height:height+'%'}}/>:
       <div className="vc-analytics-bar-stack" style={{height:height+'%'}}>
        <div className="vc-bar-voucher" style={{height:(discountTotal>BigInt(0)?Number(voucherTotal*BigInt(10000)/discountTotal)/100:0)+'%'}}/>
        <div className="vc-bar-promo" style={{height:(discountTotal>BigInt(0)?Number(promoTotal*BigInt(10000)/discountTotal)/100:0)+'%'}}/>
       </div>}
     </div>
     <span className="vc-analytics-day-label">{i===0||i===rows.length-1||i%Math.max(1,Math.ceil(rows.length/7))===0?r.day.slice(5):''}</span>
    </div>;
   })}
  </div></div>
  {max===BigInt(0)&&<p className="vc-analytics-chart-empty">Belum ada nilai paid pada periode ini.</p>}
 </div>;
}
function BreakdownTable({title,items}:{title:string;items:Breakdown[]}){
 return <section className="vc-panel vc-analytics-panel"><h2>{title}</h2><p className="vc-muted">Nilai dari order paid. Diskon dialokasikan proporsional; kategori mengikuti katalog saat ini.</p>
  <div className="vc-table-wrap"><table className="vc-table"><thead><tr><th>Nama</th><th>Unit</th><th>GMV</th><th>Promo</th><th>Voucher</th></tr></thead><tbody>
   {items.map((x,i)=><tr key={x.id+'-'+i}><td><strong>{x.name}</strong></td><td>{count(x.units)}</td><td>{money(x.paidGmvIdr)}</td><td>{money(x.promotionDiscountIdr)}</td><td>{money(x.voucherDiscountIdr)}</td></tr>)}
  </tbody></table></div>{!items.length&&<p className="vc-empty">Belum ada data untuk periode ini.</p>}
 </section>;
}

export function CatalogPromotionAnalytics(){
 const api=useCatalogAdmin(),auth=useCustomerAuth();
 const [fields,setFields]=useState<Filters>(initial),[filters,setFilters]=useState<Filters>(initial);
 const [overview,setOverview]=useState<Overview|null>(null),[ledger,setLedger]=useState<Ledger|null>(null);
 const [campaignOptions,setCampaignOptions]=useState<{id:string;title:string}[]>([]);
 const [cursor,setCursor]=useState<string|null>(null),[history,setHistory]=useState<(string|null)[]>([]);
 const [revision,setRevision]=useState(0),[loading,setLoading]=useState(false),[ledgerLoading,setLedgerLoading]=useState(false),[exportBusy,setExportBusy]=useState(false);
 const [error,setError]=useState(''),[exportError,setExportError]=useState('');
 const query=useMemo(()=>param(filters),[filters]);
 useEffect(()=>{let alive=true;setLoading(true);setError('');
  api.request<Overview>('analytics/summary?'+query).then(d=>{if(!alive)return;setOverview(d);if(!filters.campaignId)setCampaignOptions(d.campaigns.map(x=>({id:x.id,title:x.title})))})
   .catch(e=>{if(alive){setOverview(null);setError(e instanceof Error?e.message:'Analytics gagal dimuat')}})
   .finally(()=>{if(alive)setLoading(false)});return()=>{alive=false};
 },[query,revision]);
 useEffect(()=>{let alive=true;setLedgerLoading(true);
  const params=query+'&limit=50'+(cursor?'&cursor='+encodeURIComponent(cursor):'');
  api.request<Ledger>('analytics/ledger?'+params).then(d=>{if(alive)setLedger(d)})
   .catch(e=>{if(alive){setLedger(null);setError(e instanceof Error?e.message:'Ledger gagal dimuat')}})
   .finally(()=>{if(alive)setLedgerLoading(false)});
  return()=>{alive=false};
 },[query,cursor,revision]);
 const apply=(e:FormEvent)=>{e.preventDefault();if(fields.from>fields.to){setError('Tanggal mulai tidak boleh melampaui tanggal akhir.');return}
  setCursor(null);setHistory([]);setFilters({...fields});setRevision(x=>x+1);};
 const preset=(days:number)=>{const end=today();const next={...fields,from:dayOffset(end,1-days),to:end};setFields(next);setCursor(null);setHistory([]);setFilters(next);setRevision(x=>x+1)};
 async function exportCsv(){
  if(!auth.accessToken)return setExportError('Sesi administrator tidak tersedia.');
  setExportBusy(true);setExportError('');
  try{
   const r=await fetch('/api/admin/catalog/analytics/ledger.csv?'+query,{headers:{authorization:'Bearer '+auth.accessToken},cache:'no-store'});
   if(!r.ok){const body=await r.json().catch(()=>null);throw Error(body?.message||'Ekspor gagal: HTTP '+r.status)}
   const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='vapmart-promotion-ledger-'+filters.from+'-'+filters.to+'.csv';document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),3000);
  }catch(e){setExportError(e instanceof Error?e.message:'Ekspor gagal');}finally{setExportBusy(false)}
 }
 const summary=overview?.summary;
 return <div className="vc-analytics">
  <form className="vc-panel vc-analytics-filter" onSubmit={apply}>
   <div className="vc-analytics-filter-title"><h2>Promotion Analytics</h2><p>Berbasis snapshot order, zona Asia/Jakarta. Periode memakai tanggal order dibuat.</p></div>
   <div className="vc-analytics-preset"><button type="button" onClick={()=>preset(7)}>7 hari</button><button type="button" onClick={()=>preset(30)}>30 hari</button><button type="button" onClick={()=>preset(90)}>90 hari</button></div>
   <div className="vc-analytics-controls"><label>Mulai<input aria-label="Tanggal mulai" required type="date" value={fields.from} onChange={e=>setFields(f=>({...f,from:e.target.value}))}/></label>
    <label>Sampai<input aria-label="Tanggal akhir" required type="date" value={fields.to} onChange={e=>setFields(f=>({...f,to:e.target.value}))}/></label>
    <label>Campaign<select aria-label="Filter campaign" value={fields.campaignId} onChange={e=>setFields(f=>({...f,campaignId:e.target.value}))}><option value="">Semua campaign + voucher</option>{campaignOptions.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
    <button className="vc-primary" disabled={loading} type="submit">{loading?'Memuat...':'Terapkan'}</button>
    <button type="button" onClick={()=>setRevision(x=>x+1)}>Refresh</button>
   </div>
  </form>
  <CatalogNotice error={error}/>{loading&&!overview&&<p role="status">Menghitung laporan dari order...</p>}
  {overview&&summary&&<>
   <div className="vc-analytics-kpis">
    <Card label="GMV paid" value={money(summary.paidGmvIdr)} note="Subtotal barang, tanpa ongkir"/>
    <Card label="Biaya diskon paid" value={money(summary.paidDiscountIdr)} note={'Promo '+money(summary.promotionDiscountIdr)+' · Voucher '+money(summary.voucherDiscountIdr)}/>
    <Card label="Net barang" value={money(summary.netMerchandiseIdr)} note="GMV dikurangi diskon, belum memperhitungkan biaya lain"/>
    <Card label="Rasio order lunas" value={pct(summary.paidRatePct)} note={count(summary.paidOrders)+' paid / '+count(summary.appliedOrders)+' order berpromo'}/>
    <Card label="Order pending" value={count(summary.pendingOrders)} note="Belum dihitung sebagai penjualan"/>
    <Card label="Reconciliation exception" value={count(summary.anomalyOrders)} note="Perbedaan formula diskon/total"/>
   </div>
   <div className="vc-analytics-chartgrid">
    <section className="vc-panel vc-analytics-panel"><h2>GMV paid harian</h2><p className="vc-muted">Tidak termasuk pembayaran yang masih pending.</p><BarChart rows={overview.daily} kind="gmv"/></section>
    <section className="vc-panel vc-analytics-panel"><h2>Biaya diskon paid harian</h2><p className="vc-muted">Promo dan voucher terlihat terpisah, termasuk order stacking.</p><BarChart rows={overview.daily} kind="discount"/></section>
   </div>
   <section className="vc-panel vc-analytics-panel">
    <div className="vc-analytics-section-title"><div><h2>Kinerja campaign</h2><p className="vc-muted">GMV paid dan redemption berdasarkan campaign yang tercatat di order.</p></div><span className="vc-analytics-meta">Paid stacking: {count(summary.stackedPaidOrders)} order</span></div>
    <div className="vc-table-wrap"><table className="vc-table"><thead><tr><th>Campaign</th><th>Applied</th><th>Paid</th><th>Paid rate</th><th>GMV paid</th><th>Cost promo</th><th>Cost voucher stacking</th><th>Diagnostik</th></tr></thead><tbody>
     {overview.campaigns.map(c=><tr key={c.id}><td><strong>{c.title}</strong><small className="vc-analytics-subline">{c.slug} · {c.status}</small></td><td>{count(c.appliedOrders)}</td><td>{count(c.paidOrders)}</td><td>{pct(c.paidRatePct)}</td><td>{money(c.paidGmvIdr)}</td><td>{money(c.promotionDiscountIdr)}</td><td>{money(c.stackedVoucherDiscountIdr)}</td><td>{c.status==='published'&&Date.parse(c.endsAt)<Date.now()&&c.paidOrders===0?'Expired · belum paid di periode ini':c.pendingOrders?'Pending '+c.pendingOrders:'—'}</td></tr>)}
    </tbody></table></div>{!overview.campaigns.length&&<p className="vc-empty">Belum ada campaign yang tercatat.</p>}
    {overview.campaignListTruncated&&<p className="vc-muted">Hanya 200 campaign teratas ditampilkan. Pilih campaign untuk mempersempit laporan.</p>}
   </section>
   <div className="vc-analytics-chartgrid">
    <BreakdownTable title="Performa produk" items={overview.products}/>
    <BreakdownTable title="Performa kategori" items={overview.categories}/>
   </div>
   <section className="vc-panel vc-analytics-panel">
    <h2>Segmentasi membership saat ini</h2><p className="vc-muted">Segmentasi menggunakan status membership saat laporan dibuat, bukan status historis saat order.</p>
    <div className="vc-analytics-segments">{overview.segments.map(s=><div key={s.segment} className="vc-analytics-segment"><strong>{s.segment==='active_now'?'Member ACTIVE':'Lainnya / belum terklasifikasi'}</strong><span>{count(s.paidOrders)} paid order</span><b>{money(s.paidGmvIdr)}</b><small>Diskon paid {money(s.paidDiscountIdr)}</small></div>)}</div>
    {!overview.segments.length&&<p className="vc-empty">Belum ada aktivitas berpromo di periode ini.</p>}
   </section>
   <section className="vc-panel vc-analytics-panel">
    <h2>Reconciliation exceptions</h2><p className="vc-muted">Memeriksa total diskon vs voucher + campaign, dan total order vs subtotal − diskon + ongkir. Termasuk pending order yang sudah tersimpan.</p>
    {!summary.anomalyOrders?<div className="vc-analytics-ok">Tidak ada selisih perhitungan pada order yang diperiksa.</div>:
     <div className="vc-table-wrap"><table className="vc-table"><thead><tr><th>Order</th><th>Waktu WIB</th><th>Pembayaran</th><th>Delta diskon</th><th>Delta total</th></tr></thead><tbody>{overview.anomalies.map(a=><tr key={a.orderId}><td><code>{a.orderId.slice(0,8)}</code></td><td>{new Date(a.createdAt).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})}</td><td>{a.paymentStatus}</td><td>{money(a.discountDeltaIdr)}</td><td>{money(a.totalDeltaIdr)}</td></tr>)}</tbody></table></div>}
    {summary.anomalyOrders>overview.anomalies.length&&<p className="vc-muted">Menampilkan 25 exception terbaru dari {count(summary.anomalyOrders)}.</p>}
   </section>
   <section className="vc-panel vc-analytics-panel">
    <div className="vc-analytics-section-title"><div><h2>Finance ledger</h2><p className="vc-muted">Satu baris per order ber-voucher atau ber-campaign. CSV mencakup filter yang sama dengan laporan.</p></div>
     <button type="button" className="vc-primary" disabled={exportBusy||ledgerLoading} onClick={()=>void exportCsv()}>{exportBusy?'Membuat CSV...':'Export CSV'}</button></div>
    <CatalogNotice error={exportError}/>
    <div className="vc-table-wrap"><table className="vc-table"><thead><tr><th>Order</th><th>Created WIB</th><th>Status</th><th>Campaign / Voucher</th><th>Subtotal</th><th>Diskon promo</th><th>Diskon voucher</th><th>Total</th><th>Reconciliation</th></tr></thead><tbody>
     {(ledger?.items||[]).map(x=><tr key={x.id}><td><code>{x.id.slice(0,8)}</code></td><td>{new Date(x.createdAt).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})}</td><td>{x.paymentStatus}</td><td>{x.campaignTitle||'—'}<small className="vc-analytics-subline">{x.voucherCode||''}</small></td><td>{money(x.subtotalIdr)}</td><td>{money(x.promotionDiscountIdr)}</td><td>{money(x.voucherDiscountIdr)}</td><td>{money(x.totalIdr)}</td><td>{BigInt(x.discountDeltaIdr)===BigInt(0)&&BigInt(x.totalDeltaIdr)===BigInt(0)?'OK':'Periksa'}</td></tr>)}
    </tbody></table></div>
    {!ledgerLoading&&!ledger?.items.length&&<p className="vc-empty">Belum ada order berpromo dalam filter ini.</p>}
    {ledgerLoading&&<p role="status">Memuat ledger...</p>}
    <div className="vc-analytics-ledger-paging"><button type="button" disabled={!history.length||ledgerLoading} onClick={()=>{setCursor(history[history.length-1]);setHistory(h=>h.slice(0,-1))}}>Sebelumnya</button><span>Halaman {history.length+1}</span><button type="button" disabled={!ledger?.hasMore||ledgerLoading} onClick={()=>{setHistory(h=>[...h,cursor]);setCursor(ledger?.nextCursor||null)}}>Berikutnya</button></div>
   </section>
   <p className="vc-analytics-disclosure"><strong>Batas interpretasi:</strong> {overview.definitions.paidRate} {overview.definitions.growth} {overview.definitions.refunds}</p>
  </>}
 </div>;
}
