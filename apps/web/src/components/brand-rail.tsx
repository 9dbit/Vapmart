'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {brandPartners} from '@/lib/merchandising';
import type {ActiveBrand} from '@/lib/api';

export function BrandRail({brands=[]}:{brands?:ActiveBrand[]}){
  const partners=brands.length>0?brands.map(b=>({slug:b.slug,name:b.name,image:b.logo_url||''})):brandPartners;
  const railRef=useRef<HTMLDivElement>(null);
  const [canPrev,setCanPrev]=useState(false);
  const [canNext,setCanNext]=useState(false);
  useEffect(()=>{
    const rail=railRef.current;
    if(!rail)return;
    const sync=()=>{
      const max=Math.max(0,rail.scrollWidth-rail.clientWidth);
      setCanPrev(rail.scrollLeft>3);
      setCanNext(rail.scrollLeft<max-3);
    };
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(sync):null;
    observer?.observe(rail);
    window.addEventListener('resize',sync,{passive:true});
    rail.addEventListener('scroll',sync,{passive:true});
    sync();
    return()=>{observer?.disconnect();window.removeEventListener('resize',sync);rail.removeEventListener('scroll',sync);};
  },[]);
  const move=(direction:-1|1)=>{
    const rail=railRef.current;
    if(!rail)return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    rail.scrollBy({left:direction*Math.max(180,rail.clientWidth*.68),behavior:reduced?'instant':'smooth'});
  };
  return <div className="vm-brand-rail">
    <div ref={railRef} className="vm-brand-logos" role="group" aria-label="Logo Brand Partner Vapmart">
      {partners.map(brand=><Link href={'/brand-partner#brand-'+brand.slug}
        className="vm-brand-logo vm-brand-card" key={brand.slug}
        aria-label={'Lihat logo '+brand.name+' di Brand Partner'}>
        <span className="vm-brand-stage">
          {brand.image?<img src={brand.image} alt={'Logo '+brand.name} width={400} height={400} loading="lazy" decoding="async"/>:<span style={{fontWeight:800,fontSize:28,color:'#7f2dc4'}}>{brand.name.slice(0,2).toUpperCase()}</span>}
        </span>
        <span className="vm-brand-name">{brand.name}</span>
      </Link>)}
    </div>
    <div className="vm-brand-controls" role="group" aria-label="Geser daftar brand">
      <button type="button" onClick={()=>move(-1)} disabled={!canPrev} aria-label="Brand sebelumnya">‹</button>
      <button type="button" onClick={()=>move(1)} disabled={!canNext} aria-label="Brand berikutnya">›</button>
    </div>
  </div>;
}
