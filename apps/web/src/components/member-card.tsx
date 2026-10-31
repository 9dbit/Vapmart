'use client';
import {useMemo} from 'react';

type MemberStatus='GUEST'|'REGISTERED'|'ACTIVE'|'SUSPENDED'|'UNAVAILABLE';
type MemberCardProps={
 name:string;
 balance:number|null;
 status:MemberStatus;
 cardLast4?:string|null;
 onOpenWallet?:()=>void;
};
const formatCoin=(value:number)=>Math.max(0,value).toLocaleString('id-ID');
function CrownIcon(){
 return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
   <path d="m3 7 4.3 3 4.7-6 4.7 6L21 7l-2 11H5L3 7Z" fill="currentColor"/>
   <path d="M6 21h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
 </svg>;
}
/** A real ISO/IEC 7810 ID-1 proportion (85.60 x 53.98 mm).
 *  All names, status, last digits and balances are live props. No sample funds.
 */
export function MemberCard({name,balance,status,cardLast4,onOpenWallet}:MemberCardProps){
 const active=status==='ACTIVE';
 const safeLast4=useMemo(()=>/^\d{4}$/.test(cardLast4??'')?cardLast4:null,[cardLast4]);
 const displayName=name.trim()||'VAPMART GUEST';
 const statusText=active?'Vapmart Member':
   status==='REGISTERED'?'Belum Aktif':
   status==='SUSPENDED'?'Ditangguhkan':
   status==='GUEST'?'Preview Card':'Belum Tersambung';
 return <section className="vm-new-member-card vm22-member-card"
   data-member-status={status.toLowerCase()} aria-label="Vapmart Member Card"
   aria-description="Kartu digital member Vapmart dengan rasio kartu internasional">
   <span className="vm22-card-purple-panel" aria-hidden="true"/>
   <span className="vm22-card-charcoal-panel" aria-hidden="true"/>
   <svg className="vm22-card-engraving" aria-hidden="true" viewBox="0 0 150 165" focusable="false">
     <path fill="#36333E" d="M39 0h94L80 69H9L39 0Z"/>
     <path fill="#55505E" d="M5 82h51l49 73H54L5 82Z"/>
   </svg>
   <div className="vm22-card-content">
     <div className="vm22-card-brand-row">
       <div className="vm-new-card-brand vm22-card-brand">
         <img src="/branding/vapmart-logo.png" alt="Vapmart" width="165" height="46"/>
       </div>
       <span className="vm22-card-type">MEMBER CARD</span>
     </div>
     <div className="vm22-card-holder-block">
       <span className="vm22-card-holder-label">CARDHOLDER</span>
       <strong className="vm-new-card-holder vm22-card-holder">{displayName}</strong>
       <span className="vm22-card-number">
         {safeLast4?'••••  ••••  ••••  '+safeLast4:'••••  ••••  ••••  ••••'}
       </span>
     </div>
     <div className="vm22-card-bottom">
       <div className="vm22-card-membership">
         <span className="vm22-card-bottom-label">STATUS MEMBER</span>
         <span className={active?'vm22-card-status is-active':'vm22-card-status'}>
           <CrownIcon/><span>{statusText}</span>
         </span>
       </div>
       <div className="vm22-card-coin-panel">
         <span className="vm22-card-bottom-label">SALDO COIN</span>
         <div className="vm22-card-coin-value">
           <span className="vm22-card-goldcoin" aria-hidden="true">V</span>
           <strong aria-live="polite">{balance===null?'—':formatCoin(balance)}</strong>
           {onOpenWallet&&<button type="button" className="vm22-card-open-wallet"
             onClick={onOpenWallet} aria-label="Buka riwayat Coin">
             <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none"><path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
           </button>}
         </div>
       </div>
     </div>
   </div>
 </section>;
}
