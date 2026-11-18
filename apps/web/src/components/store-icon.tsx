export type IconName='search'|'cart'|'user'|'home'|'categories'|'star'|'tag'|'back'|'next'|'plus'|'sort'|'bag'|'decor'|'electronics'|'whatsapp';
export function Icon({name}:{name:IconName}){
  const common={viewBox:'0 0 24 24',width:21,height:21,fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true as const};
  if(name==='search')return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>;
  if(name==='cart')return <svg {...common}><path d="M3 4h2l2.2 11.4a2 2 0 0 0 2 1.6h9.5a2 2 0 0 0 2-1.5L22 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="19" cy="20" r="1"/></svg>;
  if(name==='user')return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>;
  if(name==='home')return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/></svg>;
  if(name==='categories')return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>;
  if(name==='star')return <svg {...common}><path d="m12 2 2.9 6 6.6.9-4.8 4.7 1.1 6.6-5.8-3.1-5.8 3.1 1.1-6.6-4.8-4.7L9.1 8Z"/></svg>;
  if(name==='tag')return <svg {...common}><path d="M3 4h9l9 9-8 8-10-10V4Z"/><circle cx="8" cy="9" r="1"/></svg>;
  if(name==='plus')return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
  if(name==='sort')return <svg {...common}><path d="M4 6h15M4 12h10M4 18h5m8-5 3 3 3-3m-3-8v11"/></svg>;
  if(name==='bag')return <svg {...common}><path d="M4 8h16l-1 12H5L4 8Zm5 0V6a3 3 0 0 1 6 0v2"/></svg>;
  if(name==='decor')return <svg {...common}><path d="M9 3h6l-1 5c0 3 4 4 4 8a6 6 0 0 1-12 0c0-4 4-5 4-8L9 3Z"/></svg>;
  if(name==='electronics')return <svg {...common}><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>;
  if(name==='next')return <svg {...common}><path d="m9 18 6-6-6-6"/></svg>;
  if(name==='whatsapp')return <svg {...common}><path d="M20.5 11.7a8.5 8.5 0 0 1-12.7 7.4L3 20.5l1.4-4.6a8.5 8.5 0 1 1 16.1-4.2Z"/><path d="M8 7.5c.6-.5 1.4-.3 1.7.4l.7 1.6-.9 1.1c.8 1.6 1.7 2.5 3.3 3.2l1.1-1 1.7.8c.7.4.8 1 .4 1.6-.6 1-1.4 1.3-2.6 1-3.4-.9-6-3.6-6.5-6.4-.1-.9.2-1.8 1.1-2.3Z" fill="currentColor" stroke="none"/></svg>;
  return <svg {...common}><path d="m15 18-6-6 6-6"/></svg>;
}
