'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useCustomerAuth} from '@/lib/customer-auth';
import {useWishlist} from '@/lib/wishlist';
import {formatIDR,type Product} from '@/lib/types';
import {MemberCard} from '@/components/member-card';
import {Icon} from '@/components/store-icon';
import {orderStatus} from '@/lib/order-status';
type MemberData={
 status:'ACTIVE'|'REGISTERED'|'SUSPENDED';
 balanceCoin:number;cardLast4:string|null;name:string|null;
 benefits:Array<{title:string;description:string;endsAt:string}>;
 transactions:Array<{id:string;coins:number;description:string;createdAt:string}>;
};
type RecentOrder={id:string;created_at:string;operational_status?:string;status:string;payment_status:string;
 product_name?:string|null;image_url?:string|null;total_idr:string;item_count?:number};
const stages=[
 {key:'pending_payment',label:'Belum bayar',icon:'wallet' as const},
 {key:'processing',label:'Diproses',icon:'package' as const},
 {key:'completed',label:'Selesai',icon:'package-check' as const},
 {key:'refunded',label:'Refund',icon:'undo-2' as const}
] as const;
function initials(name:string){
 return name.trim().split(/\s+/).slice(0,2).map(x=>x.slice(0,1).toUpperCase()).join('')||'VM';
}
export function AccountDashboard({products=[]}:{products?:Product[]}){
 const auth=useCustomerAuth();
 const wishlist=useWishlist();
 const [member,setMember]=useState<MemberData|null>(null);
 const [recent,setRecent]=useState<RecentOrder[]>([]);
 const [memberError,setMemberError]=useState('');
 const [ordersError,setOrdersError]=useState('');
 const [busy,setBusy]=useState(false);
 const [counts,setCounts]=useState<Record<string,number>>({});
 useEffect(()=>{
  if(!auth.accessToken){setMember(null);setRecent([]);setCounts({});setMemberError('');setOrdersError('');return;}
  const token=auth.accessToken,controller=new AbortController();
  setBusy(true);setMemberError('');setOrdersError('');
  const headers={authorization:'Bearer '+token};
  fetch('/api/member',{headers,cache:'no-store',signal:controller.signal})
   .then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.message||'Member belum tersedia');return x as MemberData;})
   .then(x=>{if(!controller.signal.aborted)setMember(x)})
   .catch(e=>{if(!controller.signal.aborted)setMemberError(e instanceof Error?e.message:'Gagal memuat Member')});
  fetch('/api/customer/catalog/orders?page=1&pageSize=4',{headers,cache:'no-store',signal:controller.signal})
   .then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.message||'Transaksi tidak tersedia');return x})
   .then(x=>{if(!controller.signal.aborted)setRecent(Array.isArray(x.items)?x.items:[])})
   .catch(e=>{if(!controller.signal.aborted)setOrdersError(e instanceof Error?e.message:'Gagal memuat transaksi')})
   .finally(()=>{if(!controller.signal.aborted)setBusy(false)});
  Promise.all(stages.map(async stage=>{
   try{
    const r=await fetch('/api/customer/catalog/orders?page=1&pageSize=1&status='+stage.key,{headers,cache:'no-store',signal:controller.signal});
    if(!r.ok)return [stage.key,null] as const;
    const x=await r.json();
    return [stage.key,typeof x.total==='number'?x.total:null] as const;
   }catch{return [stage.key,null] as const;}
  })).then(values=>{if(!controller.signal.aborted)setCounts(Object.fromEntries(values.filter(([,n])=>n!==null)) as Record<string,number>);});
  return()=>controller.abort();
 },[auth.accessToken]);
 const fullName=typeof auth.user?.user_metadata?.display_name==='string'&&auth.user.user_metadata.display_name.trim()?
  auth.user.user_metadata.display_name.trim():member?.name||auth.user?.email?.split('@')[0]||'Pelanggan Vapmart';
 const memberStatus=auth.user?(member?.status||'UNAVAILABLE'):'GUEST';
 const activeBenefits=member?.status==='ACTIVE'?member.benefits?.length||0:0;
 const suggestions=products.filter(p=>p.is_active&&p.available!==false&&p.price_idr>0&&p.stock_qty>0&&!wishlist.savedIds.includes(p.id)).slice(0,4);
 if(auth.loading)return <main className="vm26-customer-page vm26-account" data-page="account"><p className="vm26-loading" role="status">Memeriksa sesi akun…</p></main>;
 if(!auth.user)return <main className="vm26-customer-page vm26-account" data-page="account">
  <div className="vm26-page-head"><div><span className="vm26-eyebrow">VAPMART ACCOUNT</span><h1>Akun Saya</h1></div></div>
  <section className="vm26-empty"><Icon name="user"/><h2>Selamat datang di Vapmart</h2>
   <p>Daftar atau masuk untuk membuka dashboard Member, riwayat pembelian dan favorit yang tersinkron.</p>
   <div className="vm26-inline-actions"><Link className="vm26-primary" href="/login?next=/akun">Masuk</Link>
    <Link className="vm26-secondary" href="/login?mode=signup&next=/akun">Daftar Gratis</Link></div>
  </section>
 </main>;
 return <main className="vm26-customer-page vm26-account" data-page="account">
  <header className="vm26-account-identity">
   <div className="vm26-avatar" aria-hidden="true">{initials(String(fullName))}</div>
   <div className="vm26-identity-copy"><span className="vm26-eyebrow">VAPMART ACCOUNT</span>
    <h1>{fullName}</h1><p>{auth.user.email||'Email belum tersedia'}</p>
    {!auth.user.email_confirmed_at&&<small role="status">Verifikasi email untuk mengaktifkan fitur akun.</small>}
   </div>
   <Link href="/akun/profil" className="vm26-settings" aria-label="Pengaturan profil"><Icon name="settings"/></Link>
  </header>
  <section className="vm26-member-board" aria-label="Vapmart Membership">
   <div className="vm26-member-card"><MemberCard name={String(fullName)} balance={member?Number(member.balanceCoin):null}
    status={memberStatus} cardLast4={member?.cardLast4}/></div>
   <div className="vm26-member-stats">
    <Link href="/member-2" className="vm26-member-stat">
     <small>Saldo Coin</small><strong>{member?Number(member.balanceCoin).toLocaleString('id-ID'):'—'}</strong>
     <span>{member?'Coin tercatat di akun':'Memuat saldo asli'}</span><Icon name="next"/></Link>
    <Link href="/member-2" className="vm26-member-stat">
     <small>Benefit Member</small><strong>{member?activeBenefits:'—'}</strong>
     <span>{activeBenefits?'Benefit event yang tersedia':'Belum ada benefit yang berlaku'}</span><Icon name="next"/></Link>
    <div className="vm26-member-actions">
     <Link href="/member-2">Lihat Member Card <Icon name="next"/></Link>
     <Link href="/member-2">Top Up Coin <Icon name="plus"/></Link>
    </div>
   </div>
  </section>
  {memberError&&<p className="vm26-inline-error" role="status">Status Member tidak dapat dimuat. {memberError}</p>}
  <section className="vm26-account-section vm26-account-transactions">
   <div className="vm26-section-heading"><h2>Transaksi Saya</h2><Link href="/pesanan">Lihat semua <Icon name="next"/></Link></div>
   <div className="vm26-stage-shortcuts">
    {stages.map(s=><Link href={'/pesanan?status='+s.key} key={s.key} className="vm26-stage-shortcut">
     <span className="vm26-stage-icon"><Icon name={s.icon}/></span>
     <span>{s.label}</span>
     {counts[s.key]!==undefined&&counts[s.key]>0&&<b>{counts[s.key]}</b>}
    </Link>)}
   </div>
   <div className="vm26-recent-orders">
    {recent.length?recent.map(o=><Link href={'/pesanan/'+o.id} className="vm26-recent-order" key={o.id}>
      <span className="vm26-recent-image">{o.image_url?<img src={o.image_url} width={64} height={64} alt={o.product_name||'Produk'}/>:<Icon name="bag"/>}</span>
      <span><strong>{o.product_name||'Produk pesanan'}</strong>
       <small>{new Date(o.created_at).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',year:'numeric'})} · {o.payment_status==='paid'?'Dibayar':orderStatus(o).replaceAll('_',' ')}</small>
      </span>
      <b>{formatIDR(Number(o.total_idr))}</b>
     </Link>):<p className="vm26-soft">{busy?'Memuat pesanan terbaru…':ordersError?'Riwayat pesanan belum tersedia.':'Belum ada transaksi. Pesanan asli akan tampil di sini.'}</p>}
   </div>
  </section>
  <section className="vm26-account-section">
   <div className="vm26-section-heading"><h2>Menu lainnya</h2></div>
   <nav className="vm26-account-menu" aria-label="Menu akun">
    <Link href="/favorit?tab=produk"><Icon name="heart"/><span><strong>Produk Favorit</strong><small>{wishlist.savedIds.length} produk tersimpan</small></span><Icon name="next"/></Link>
    <Link href="/favorit?tab=brand"><Icon name="store"/><span><strong>Brand Favorit</strong><small>{wishlist.brandIds.length} brand tersimpan</small></span><Icon name="next"/></Link>
    <Link href="/member-2"><Icon name="award"/><span><strong>Benefit & Member</strong><small>Violet Edge Member Card dan riwayat Coin</small></span><Icon name="next"/></Link>
    <Link href="/akun/profil"><Icon name="user"/><span><strong>Pengaturan Profil</strong><small>Nama, WhatsApp, email dan alamat</small></span><Icon name="next"/></Link>
    <a href="https://wa.me/6285232324824" rel="noopener noreferrer" target="_blank"><Icon name="message-circle"/><span><strong>Pusat Bantuan</strong><small>Hubungi Vapmart Care melalui WhatsApp</small></span><Icon name="next"/></a>
   </nav>
  </section>
  {suggestions.length>0&&<section className="vm26-account-section">
   <div className="vm26-section-heading"><h2>Koleksi Pilihan</h2><Link href="/catalog">Lihat katalog <Icon name="next"/></Link></div>
   <div className="vm26-account-product-grid">{suggestions.map(p=><Link href={'/product/'+encodeURIComponent(p.slug)} key={p.id} className="vm26-account-product">
    <span>{p.image_url?<img src={p.image_url} width={170} height={170} alt={p.name} loading="lazy"/>:<Icon name="bag"/>}</span>
    <strong>{p.name}</strong><b>{formatIDR(p.price_idr)}</b>
   </Link>)}</div>
  </section>}
 </main>;
}
