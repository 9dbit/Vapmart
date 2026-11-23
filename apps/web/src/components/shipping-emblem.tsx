type ShippingEmblemProps={kind?:'truck'|'store';className?:string};

/** Compact delivery symbols, with solid silhouettes that remain clear at 20px. */
export function ShippingEmblem({kind='truck',className=''}:ShippingEmblemProps){
 return <span className={'vm-shipping-emblem'+(className?' '+className:'')} aria-hidden="true">
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" focusable="false">
   {kind==='store'?<>
    <path d="M5.3 3.5h13.4a1 1 0 0 1 .95.68L21 8.5H3l1.35-4.32a1 1 0 0 1 .95-.68ZM3 10h18v1a2.5 2.5 0 0 1-4.5 1.5 2.5 2.5 0 0 1-4.5 0 2.5 2.5 0 0 1-4.5 0A2.5 2.5 0 0 1 3 11v-1Z"/>
    <path d="M5 14.5a4 4 0 0 0 2.5-.47 4 4 0 0 0 4.5 0 4 4 0 0 0 4.5 0 4 4 0 0 0 2.5.47v5a1 1 0 0 1-1 1h-3.5V16h-5v4.5H6a1 1 0 0 1-1-1v-5Z"/>
   </>:<>
    <rect x="2" y="5" width="12" height="11" rx="1.5"/>
    <path fillRule="evenodd" d="M15 8h3.7a1.5 1.5 0 0 1 1.2.6l2.8 3.7a1.5 1.5 0 0 1 .3.9V16a1 1 0 0 1-1 1h-7V8Zm2 2v3h3.6l-2.25-3H17Z" clipRule="evenodd"/>
    <path d="M2 16h20v1.5H2z"/>
    <circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/>
    <circle className="vm-shipping-emblem-cutout" cx="6" cy="18" r="1"/>
    <circle className="vm-shipping-emblem-cutout" cx="18" cy="18" r="1"/>
   </>}
  </svg>
 </span>;
}
