'use client';
import {useRef,useState} from 'react';
import {Icon} from './store-icon';

export function ArchiveGallery({images,title}:{images:string[];title:string}){
  const photos=Array.from(new Set(images));
  const track=useRef<HTMLDivElement>(null);
  const [active,setActive]=useState(0);
  function show(index:number){
    const rail=track.current;
    if(!rail)return;
    const next=Math.max(0,Math.min(photos.length-1,index));
    rail.scrollTo({left:next*rail.clientWidth,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  return <section className="vm-photo-gallery" aria-label={'Foto '+title} aria-roledescription="carousel">
    <div className="vm-photo-stage">
      <div className="vm-photo-track" ref={track} tabIndex={photos.length>1?0:undefined} aria-label="Galeri foto produk"
        onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();show(active+(e.key==='ArrowRight'?1:-1));}}}
        onScroll={e=>{const rail=e.currentTarget;if(rail.clientWidth)setActive(Math.max(0,Math.min(photos.length-1,Math.round(rail.scrollLeft/rail.clientWidth))));}}>
        {photos.map((src,i)=><img key={src} src={src} alt={title+' — foto '+(i+1)} width={640} height={640} loading={i===0?'eager':'lazy'} draggable={false}/>)}
      </div>
      {photos.length>1&&<div className="vm-photo-nav">
        <button type="button" aria-label="Foto sebelumnya" onClick={()=>show(active-1)} disabled={active===0}><Icon name="back"/></button>
        <span aria-live="polite">{active+1} / {photos.length}</span>
        <button type="button" aria-label="Foto berikutnya" onClick={()=>show(active+1)} disabled={active===photos.length-1}><Icon name="next"/></button>
      </div>}
    </div>
    {photos.length>1&&<div className="vm-photo-thumbs">{photos.map((src,i)=><button type="button" key={src} onClick={()=>show(i)}
      aria-label={'Tampilkan foto '+(i+1)} aria-pressed={active===i}><img src={src} width={48} height={48} alt="" loading="lazy"/></button>)}</div>}
  </section>;
}
