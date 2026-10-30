import {digitalPacks,membershipActivation} from '@/lib/digital-products';

export function CoinVisualStack({amount,large=false}:{amount:number;large?:boolean}){
 const pack=digitalPacks.find(p=>p.amount===amount)??membershipActivation;
 const count=pack.coinCount;
 return <div className={large?'vm-gold-coins is-large':'vm-gold-coins'}
   role="img" aria-label={count+' koin emas dekoratif untuk '+amount.toLocaleString('id-ID')+' Coin'}>
   {Array.from({length:count},(_,i)=>{
     const columns=large?7:6;
     const row=Math.floor(i/columns);
     const col=i%columns;
     const left=(col-(columns-1)/2)*14 + row*4;
     const top=-row*9 + (i%3)*2;
     return <span key={i} className="vm-gold-coin"
       style={{'--coin-x':left+'px','--coin-y':top+'px','--coin-z':i,
         '--coin-rotation':((i*17)%29-14)+'deg'} as React.CSSProperties} aria-hidden="true">
       <span>V</span>
     </span>;
   })}
   <i aria-hidden="true" className="vm-gold-coins-glow"/>
 </div>;
}
