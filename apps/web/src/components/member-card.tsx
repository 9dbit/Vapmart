import {CoinVisualStack} from './coin-visual-stack';

type MemberStatus='GUEST'|'REGISTERED'|'ACTIVE'|'UNAVAILABLE';
export function MemberCard({name,balance,status,cardLast4}:{name:string;balance:number|null;status:MemberStatus;cardLast4?:string|null}){
 const active=status==='ACTIVE';
 return <section className="vm-new-member-card" aria-label="Vapmart Member Card">
   <div className="vm-new-member-card-top">
     <div className="vm-new-card-brand"><span className="vm-new-card-symbol">V</span><strong>vapmart</strong></div>
     <span className="vm-new-card-chip">MEMBER CARD</span>
   </div>
   <div className="vm-new-card-center">
     <div><span className="vm-new-card-label">AVAILABLE COIN</span>
       <strong className="vm-new-card-balance" aria-live="polite">
         {balance===null?'—':balance.toLocaleString('id-ID')}
       </strong>
       <span className="vm-new-card-caption">Saldo Coin mengikuti transaksi yang telah terverifikasi</span>
     </div>
     <CoinVisualStack amount={balance===null||balance<=0?50000:balance} large/>
   </div>
   <div className="vm-new-member-card-bottom">
     <div><span className="vm-new-card-label">CARDHOLDER</span>
       <strong className="vm-new-card-holder">{name}</strong>
       <small>{cardLast4?'•••• •••• '+cardLast4:'Nomor kartu muncul setelah aktivasi'}</small>
     </div>
     <span className={active?'vm-new-member-status active':'vm-new-member-status'}>
       {active?'MEMBER ACTIVE':status==='REGISTERED'?'BELUM AKTIF':status==='GUEST'?'PREVIEW':'BELUM TERHUBUNG'}
     </span>
   </div>
 </section>;
}
