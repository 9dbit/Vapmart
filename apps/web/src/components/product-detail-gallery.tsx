'use client';
import {useEffect,useRef,useState} from 'react';

type GalleryProps={images:string[];title:string};

/** Product-specific square gallery. Never inserts sample images or exceeds 10 photos. */
export function ProductDetailGallery({images,title}:GalleryProps){
  const photos=[...new Set(images.filter((url):url is string=>typeof url==='string'&&url.trim().length>0))].slice(0,10);
  const [active,setActive]=useState(0);
  const track=useRef<HTMLDivElement>(null);
  const thumbs=useRef<HTMLDivElement>(null);
  const signature=photos.join('\u0000');

  useEffect(()=>{
    setActive(0);
    track.current?.scrollTo({left:0,behavior:'instant'});
    thumbs.current?.scrollTo({left:0,behavior:'instant'});
  },[signature]);

  /* Keep the active thumb visible after both thumbnail taps and image swipes. */
  useEffect(()=>{
    const strip=thumbs.current;
    const thumb=strip?.querySelectorAll<HTMLButtonElement>('.vpd-media-thumb')[active];
    if(!strip||!thumb)return;
    const left=thumb.offsetLeft;
    const right=left+thumb.clientWidth;
    if(left>=strip.scrollLeft&&right<=strip.scrollLeft+strip.clientWidth)return;
    strip.scrollTo({
      left:left-(strip.clientWidth-thumb.clientWidth)/2,
      behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'
    });
  },[active,signature]);

  const show=(index:number)=>{
    const rail=track.current;
    if(!rail||photos.length<1)return;
    const next=Math.max(0,Math.min(photos.length-1,index));
    setActive(next);
    rail.scrollTo({left:next*rail.clientWidth,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  };
  if(!photos.length)return <div className="vpd-photo-placeholder" role="img" aria-label={'Foto '+title+' belum tersedia'}>VAPMART</div>;
  return <section className="vpd-media" aria-label={'Galeri foto '+title} aria-roledescription="carousel">
    <div className="vpd-media-stage">
      <div className="vpd-media-track" ref={track} aria-label="Foto produk" tabIndex={photos.length>1?0:undefined}
        onScroll={e=>{const rail=e.currentTarget;if(rail.clientWidth)setActive(Math.max(0,Math.min(photos.length-1,Math.round(rail.scrollLeft/rail.clientWidth))));}}
        onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();show(active+(e.key==='ArrowRight'?1:-1));}}}>
        {photos.map((src,i)=><img key={src} src={src} alt={title+' - foto '+(i+1)}
          width={800} height={800} decoding="async" loading={i===0?'eager':'lazy'} draggable={false}/>)}
      </div>
      {photos.length>1&&<>
        <span className="vpd-media-count" aria-live="polite">{active+1}/{photos.length}</span>
        <button type="button" className="vpd-media-arrow is-prev" onClick={()=>show(active-1)}
          disabled={active===0} aria-label="Foto sebelumnya">‹</button>
        <button type="button" className="vpd-media-arrow is-next" onClick={()=>show(active+1)}
          disabled={active===photos.length-1} aria-label="Foto berikutnya">›</button>
      </>}
    </div>
    {photos.length>1&&<div className="vpd-media-thumbs" ref={thumbs} role="group" aria-label="Pilih foto produk, geser untuk melihat foto lainnya">
      {photos.map((src,i)=><button key={src} type="button" className="vpd-media-thumb"
        aria-label={'Lihat foto '+(i+1)+' dari '+photos.length} aria-pressed={active===i} onClick={()=>show(i)}>
        <img src={src} alt="" width={68} height={68} loading="lazy" decoding="async"/>
      </button>)}
    </div>}
  </section>;
}
