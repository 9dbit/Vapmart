'use client';
import {usePathname} from 'next/navigation';
export function StorefrontChrome({children}:{children:React.ReactNode}){
 const pathname=usePathname();
 if(pathname==='/admin'||pathname.startsWith('/admin/')||pathname==='/brand'||pathname.startsWith('/brand/'))return null;
 return <>{children}</>;
}
