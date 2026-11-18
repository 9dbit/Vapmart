'use client';
import {useEffect, useRef, useState, type MouseEvent} from 'react';

import {useStorefront} from './storefront-chrome';

const scriptId = 'vapmart-chatvice-care';
const scriptUrl = 'https://chatvice.app/api/widget/chatvice.js?merchant=m_d74410c444e2726c';
const chatUrl = 'https://chatvice.app/widget/m_d74410c444e2726c';
type CareWindow = Window & {chatvice?: {open: () => void}};

function visible(element: HTMLElement | null): boolean {
  if (!element) return false;
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
}

export function VapmartCare() {
  const storefront = useStorefront();
  const loadedOnStorefront = useRef(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (!storefront) {
      // Dispose of the provider's document-level listeners before entering staff pages.
      if (loadedOnStorefront.current) window.location.reload();
      return;
    }
    loadedOnStorefront.current = true;
    let attempts = 0;
    let suspended = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let script: HTMLScriptElement | null = null;

    function checkVisibility() {
      const launcher = document.getElementById('chatvice-widget-button');
      const photo = launcher?.querySelector('img');
      const launcherReady = visible(launcher) && (!photo || (photo.complete && photo.naturalWidth > 0));
      const chatOpen = visible(document.getElementById('chatvice-widget-frame'));
      const restoreVisible = visible(document.getElementById('chatvice-hidden-label'));
      setFallback(!launcherReady && !chatOpen && !restoreVisible);
    }

    function failed() {
      script?.remove();
      script = null;
      checkVisibility();
      if (!suspended && attempts < 3) retry = setTimeout(loadScript, attempts * 1500);
    }

    function loadScript() {
      if (suspended) return;
      const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
      if (existing) {
        script = existing;
        attempts = Math.max(attempts, 1);
        script.addEventListener('error', failed);
        script.addEventListener('load', checkVisibility);
        return;
      }
      attempts += 1;
      script = document.createElement('script');
      script.id = scriptId;
      script.src = scriptUrl;
      script.async = true;
      script.addEventListener('error', failed);
      script.addEventListener('load', checkVisibility);
      // Load after hydration so React cannot discard the provider's body elements.
      document.head.appendChild(script);
    }

    function suspend() {
      suspended = true;
      clearTimeout(retry);
    }

    function online() {
      suspended = false;
      clearTimeout(retry);
      attempts = 0;
      loadScript();
      checkVisibility();
    }

    const observer = new MutationObserver(records => {
      if (records.some(record => {
        const target = record.target as Element;
        if (target.closest?.('[id^="chatvice-"]')) return true;
        return [...record.addedNodes, ...record.removedNodes].some(node =>
          node instanceof Element && node.id.startsWith('chatvice-'));
      })) checkVisibility();
    });
    observer.observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['style','class','hidden']});
    document.body.addEventListener('load', checkVisibility, true);
    document.body.addEventListener('error', checkVisibility, true);
    window.addEventListener('online', online);
    window.addEventListener('pageshow', online);
    window.addEventListener('pagehide', suspend);
    window.addEventListener('resize', checkVisibility);
    loadScript();
    checkVisibility();
    return () => {
      clearTimeout(retry);
      observer.disconnect();
      script?.removeEventListener('error', failed);
      script?.removeEventListener('load', checkVisibility);
      document.body.removeEventListener('load', checkVisibility, true);
      document.body.removeEventListener('error', checkVisibility, true);
      window.removeEventListener('online', online);
      window.removeEventListener('pageshow', online);
      window.removeEventListener('pagehide', suspend);
      window.removeEventListener('resize', checkVisibility);
    };
  }, [storefront]);

  function openChat(event: MouseEvent<HTMLAnchorElement>) {
    const care = (window as CareWindow).chatvice;
    if (care && document.getElementById('chatvice-widget-frame')) {
      care.open();
      event.preventDefault();
    }
  }

  return storefront && fallback ? (
    <a className="vm-care-fallback" href={chatUrl} target="_blank" rel="noopener noreferrer"
      aria-label="Buka chat Vapmart Care" title="Chat Vapmart Care" onClick={openChat}>
      <span aria-hidden="true">•••</span>
    </a>
  ) : null;
}
