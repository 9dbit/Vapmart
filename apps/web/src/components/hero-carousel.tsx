'use client';
import {useEffect,useRef,useState} from 'react';
import type {HeroSlide} from '@/lib/hero-banners';

export function HeroCarousel({slides}:{slides:HeroSlide[]}){
  const [active,setActive]=useState(0);
  const [hovered,setHovered]=useState(false);
  const startX=useRef<number|null>(null);
  const count=slides.length;
  const signature=slides.map(s=>s.key).join(',');
  useEffect(()=>{setActive(0);},[signature]);
  useEffect(()=>{
    if(count<2||hovered||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const interval=window.setInterval(()=>setActive(current=>(current+1)%slides.length),5500);
    return()=>window.clearInterval(interval);
  },[hovered,count]);
  function navigate(direction:number){
    setActive(current=>(current+direction+slides.length)%slides.length);
  }
  function jump(index:number){setActive(index);}
  if(!count)return null;
  const shown=Math.min(active,count-1);
  return <section className="legacy-banner-reference vm-original-banner" aria-label="Banner Vapmart">
    <div className="vm-carousel-shell"
      tabIndex={0} role="region" aria-roledescription="carousel" aria-label="Banner Vapmart"
      onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      onFocusCapture={()=>setHovered(true)} onBlurCapture={()=>setHovered(false)}
      onKeyDown={event=>{
        if(count<2)return;
        if(event.key==='ArrowLeft'){event.preventDefault();navigate(-1)}
        if(event.key==='ArrowRight'){event.preventDefault();navigate(1)}
      }}
      onTouchStart={event=>{startX.current=event.touches[0]?.clientX??null;}}
      onTouchEnd={event=>{
        if(count<2||startX.current===null)return;
        const x=event.changedTouches[0]?.clientX??startX.current;
        const distance=x-startX.current;startX.current=null;
        if(Math.abs(distance)>35)navigate(distance<0?1:-1);
      }}>
      <div className="vm-carousel-track" style={{transform:'translate3d(-'+(shown*100)+'%,0,0)'}}>
        {slides.map((slide,index)=><div key={slide.key} role="group" aria-roledescription="slide"
          aria-label={(index+1)+' dari '+slides.length} aria-hidden={index!==shown} className="vm-carousel-slide">
          <picture>
            <source media="(max-width:767px)" srcSet={slide.mobile}/>
            <img src={slide.desktop} alt={slide.label} width={1024} height={320}
              loading={index===0?'eager':'lazy'} fetchPriority={index===0?'high':'auto'}/>
          </picture>
        </div>)}
      </div>
      {count>1&&<>
      <div className="vm-carousel-dots" role="group" aria-label="Pilih banner">
        {slides.map((slide,index)=><button key={slide.key} type="button" className={index===shown?'is-active':''}
          aria-label={'Tampilkan banner '+(index+1)} aria-pressed={index===shown} onClick={()=>jump(index)}><span/></button>)}
      </div>
      </>}
    </div>
  </section>;
}
