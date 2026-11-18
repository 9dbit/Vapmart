'use client';
import {useEffect, useRef} from 'react';
import {usePathname} from 'next/navigation';

function useStorefront() {
  return !/^\/(admin|brand)(?:\/|$)/.test(usePathname());
}

export function StorefrontChrome({children}:{children:React.ReactNode}) {
  const storefront = useStorefront();
  const initialStorefront = useRef(storefront);
  useEffect(() => {
    // Start or dispose of the provider's document-level listeners when crossing into or out of staff pages.
    if (initialStorefront.current !== storefront) window.location.reload();
  }, [storefront]);

  return storefront ? <>{children}</> : null;
}
