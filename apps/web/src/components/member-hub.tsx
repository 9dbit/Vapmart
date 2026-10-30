'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useCustomerAuth} from '@/lib/customer-auth';
import {useCart} from '@/lib/cart';
import {membershipActivation,digitalPacks,digitalProduct,type DigitalPack} from '@/lib/digital-products';
import {MemberCard} from './member-card';
import {CoinVisualStack} from './coin-visual-stack';
import {formatIDR} from '@/lib/types';

type Overview={
  status:'REGISTERED'|'ACTIVE'|'SUSPENDED';balanceCoin:number;cardLast4:string|null;
  name:string|null;benefits:Array<{title:string;description:string;endsAt:string}>;
  transactions:Array<{id:string;coins:number;description:string;createdAt:string}>;
};
type Tab='overview'|'topup'|'benefits'|'history';

function CoinPackShop(){
 const [chosen,setChosen]=useState<DigitalPack>(digitalPacks[1]);
 const {add}=useCart();
 return <section className="vm21-packs-section" aria-label="Pilih paket Coin">
   <div className="vm21-section-head"><div><span className="vm21-eyebrow">COIN COLLECTION</span><h2>Top Up Coin</h2></div><span className="vm21-tag">6 paket</span></div>
   <p>Pilih nominal yang diinginkan. Jumlah gold coin pada setiap kartu bertambah mengikuti ukuran paket.</p>
   <div className="vm21-coin-grid">
     {digitalPacks.map(pack=><button type="button" key={pack.sku}
       className={chosen.sku===pack.sku?'vm21-coin-pack is-selected':'vm21-coin-pack'}
       onClick={()=>setChosen(pack)} aria-pressed={chosen.sku===pack.sku}>
       <div className="vm21-coin-pack-top"><span>{pack.label}</span><span className="vm21-pack-check">{chosen.sku===pack.sku?'✓':'+'}</span></div>
       <CoinVisualStack amount={pack.amount}/>
       <strong>{pack.coins.toLocaleString('id-ID')} <small>Coin</small></strong>
       <span className="vm21-pack-price">{formatIDR(pack.amount)}</span>
     </button>)}
   </div>
   <div className="vm21-pack-summary">
     <div><span>PAKET DIPILIH</span><strong>{chosen.coins.toLocaleString('id-ID')} Coin</strong><small>{formatIDR(chosen.amount)} · tanpa bonus tersembunyi</small></div>
     <button type="button" className="vm21-primary" onClick={()=>add(digitalProduct(chosen))}>Masukkan Keranjang <span aria-hidden="true">↗</span></button>
   </div>
   <p className="vm21-fine-print">Coin dikreditkan hanya setelah server memverifikasi pembayaran. Pembayaran asli belum tersedia pada staging.</p>
 </section>;
}

export function MemberHub(){
 const auth=useCustomerAuth();
 const {add}=useCart();
 const [tab,setTab]=useState<Tab>('overview');
 const [overview,setOverview]=useState<Overview|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 useEffect(()=>{
   if(!auth.accessToken){setOverview(null);setError('');return;}
   let cancelled=false;
   setLoading(true);
   fetch('/api/member',{headers:{Authorization:'Bearer '+auth.accessToken},cache:'no-store'})
   .then(async response=>{
     if(!response.ok)throw new Error('Database member belum siap atau sedang tidak tersedia.');
     return response.json() as Promise<Overview>;
   }).then(data=>{if(!cancelled){setOverview(data);setError('');}})
     .catch(e=>{if(!cancelled){setOverview(null);setError(e.message);}})
     .finally(()=>{if(!cancelled)setLoading(false);});
   return()=>{cancelled=true;};
 },[auth.accessToken]);
 const status=auth.user?(overview?(overview.status==='ACTIVE'?'ACTIVE':'REGISTERED'):'UNAVAILABLE'):'GUEST';
 const balance=auth.user?(overview?overview.balanceCoin:null):null;
 const cardName=overview?.name||auth.user?.user_metadata?.display_name||auth.user?.email?.split('@')[0]||'VAPMART GUEST';
 return <main className="vm21-member-page">
   <div className="vm21-member-header">
     <span className="vm21-eyebrow">VAPMART CLUB / DIGITAL MEMBERSHIP</span>
     <h1>More benefits. More Vapmart.</h1>
     <p>Kelola Member Card, saldo Coin, paket top-up, dan benefit promo dalam satu tempat.</p>
   </div>
   <div className="vm21-member-columns">
     <div className="vm21-member-primary">
       <MemberCard name={String(cardName)} balance={balance} status={status} cardLast4={overview?.cardLast4}/>
       {loading&&<p className="vm21-info" role="status">Memuat saldo dari server…</p>}
       {error&&<p className="vm21-info" role="status">{error} Tidak ada saldo perkiraan yang ditampilkan.</p>}
       {!auth.user&&<div className="vm21-guest-actions"><Link href="/login?mode=signup" className="vm21-primary">Daftar Gratis <span aria-hidden="true">↗</span></Link><Link href="/login" className="vm21-secondary">Masuk Akun</Link></div>}
       {auth.user&&overview?.status!=='ACTIVE'&&<section className="vm21-activation">
         <div><span className="vm21-eyebrow">ONE-TIME ACTIVATION</span><h2>Aktifkan Vapmart Member</h2>
           <p>Bayar Rp100.000 satu kali. Setelah pembayaran terverifikasi, status member aktif dan 100.000 Coin dikreditkan tepat satu kali.</p>
         </div><button type="button" className="vm21-primary" onClick={()=>add(digitalProduct(membershipActivation))}>Aktivasi Member · Rp100.000</button>
       </section>}
       {auth.user&&overview?.status==='ACTIVE'&&<p className="vm21-member-active-note">Membership aktif. Benefit mengikuti event yang berlaku.</p>}
     </div>
     <div className="vm21-member-secondary">
       <div className="vm21-member-tabs" role="tablist" aria-label="Dashboard Member">
         {(['overview','topup','benefits','history'] as const).map(key=><button type="button" role="tab" key={key}
           aria-selected={tab===key} className={tab===key?'active':''} onClick={()=>setTab(key)}>
           {{overview:'Ringkasan',topup:'Top Up',benefits:'Benefit',history:'Riwayat'}[key]}
         </button>)}
       </div>
       {tab==='overview'&&<div role="tabpanel" className="vm21-overview">
         <div className="vm21-overview-stats">
           <div><span>SALDO COIN</span><strong>{balance===null?'—':balance.toLocaleString('id-ID')}</strong><small>Coin tersedia</small></div>
           <div><span>STATUS MEMBER</span><strong>{status==='ACTIVE'?'Active':status==='REGISTERED'?'Belum Aktif':status==='GUEST'?'Guest':'Belum Sinkron'}</strong><small>Benefit sesuai status</small></div>
         </div>
         <div className="vm21-benefit-intro"><span className="vm21-eyebrow">MEMBERSHIP BENEFIT</span><h2>One card. More access.</h2>
           <p>Keanggotaan membuka akses promo event, penawaran khusus, dan benefit yang ditentukan admin. Tidak ada diskon yang diklaim aktif sebelum event dipublikasikan.</p>
           <button type="button" className="vm21-text-link" onClick={()=>setTab('benefits')}>Lihat benefit <span aria-hidden="true">↗</span></button>
         </div>
       </div>}
       {tab==='topup'&&<CoinPackShop/>}
       {tab==='benefits'&&<div role="tabpanel" className="vm21-benefits">
         <h2>Benefit Vapmart Member</h2>
         <div className="vm21-benefit-list">
           <article><span>01</span><div><h3>Event Member-Only</h3><p>Penawaran khusus member jika event resmi sedang aktif.</p></div></article>
           <article><span>02</span><div><h3>Early Access</h3><p>Akses lebih awal ke koleksi dan campaign pilihan saat tersedia.</p></div></article>
           <article><span>03</span><div><h3>Coin & Progress</h3><p>Saldo Coin tercatat terpisah dari XP dan achievement.</p></div></article>
         </div>
         {overview?.benefits.length?overview.benefits.map((benefit,i)=><article className="vm21-real-promo" key={i}><strong>{benefit.title}</strong><p>{benefit.description}</p><small>Berakhir: {new Date(benefit.endsAt).toLocaleDateString('id-ID')}</small></article>):<div className="vm21-promo-empty"><strong>Belum ada promo member aktif</strong><p>Benefit akan muncul saat event dipublikasikan dan akun memenuhi syarat.</p></div>}
       </div>}
       {tab==='history'&&<div role="tabpanel" className="vm21-history">
         <h2>Riwayat Coin</h2>
         {overview?.transactions.length?overview.transactions.map(row=><article key={row.id}><div><strong>{row.description}</strong><small>{new Date(row.createdAt).toLocaleString('id-ID')}</small></div><strong>{row.coins>0?'+':''}{row.coins.toLocaleString('id-ID')} Coin</strong></article>):
         <div className="vm21-promo-empty"><strong>Belum ada transaksi</strong><p>Top-up dan aktivasi yang sudah terverifikasi akan tercatat di sini.</p></div>}
       </div>}
     </div>
   </div>
   {tab!=='topup'&&<div className="vm21-topup-shortcut">
     <div><span className="vm21-eyebrow">TOP UP COLLECTION</span><h2>Tambah Coin kapan saja.</h2><p>Pilih dari 6 paket mulai Rp50.000 sampai Rp2.000.000.</p></div>
     <button className="vm21-primary" type="button" onClick={()=>setTab('topup')}>Lihat Coin Pack <span aria-hidden="true">↗</span></button>
   </div>}
 </main>;
}
