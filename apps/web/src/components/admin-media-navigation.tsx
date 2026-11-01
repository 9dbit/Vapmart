'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
export function AdminMediaNavigation(){const path=usePathname();if(path==='/admin/login')return null;return <nav aria-label="Area Control Panel" className="main-container" style={{display:'flex',gap:10,flexWrap:'wrap',paddingTop:20,paddingBottom:0}}><Link href="/admin" style={{padding:'10px 18px',borderRadius:99,background:path==='/admin'?'#8424cf':'#efe8f5',color:path==='/admin'?'white':'#714085',fontSize:12,fontWeight:700}}>Control Panel</Link><Link href="/admin/media" style={{padding:'10px 18px',borderRadius:99,background:path.startsWith('/admin/media')?'#8424cf':'#efe8f5',color:path.startsWith('/admin/media')?'white':'#714085',fontSize:12,fontWeight:700}}>Media &amp; Aset</Link></nav>;}
