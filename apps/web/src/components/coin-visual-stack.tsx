import type {CSSProperties} from 'react';

export function CoinVisualStack({amount,large=false}:{amount:number;large?:boolean}){
 const count=amount>=2000000?26:amount>=1000000?19:amount>=500000?13:
   amount>=300000?9:amount>=100000?5:3;
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
         '--coin-rotation':((i*17)%29-14)+'deg'} as CSSProperties} aria-hidden="true">
       <span>V</span>
     </span>;
   })}
   <i aria-hidden="true" className="vm-gold-coins-glow"/>
 </div>;
}
