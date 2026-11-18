'use client';
import {usePathname} from 'next/navigation';

export function useStorefront() {
  return !/^\/(admin|brand)(?:\/|$)/.test(usePathname());
}

export function StorefrontChrome({children}:{children:React.ReactNode}) {
  return useStorefront() ? <>{children}</> : null;
}
