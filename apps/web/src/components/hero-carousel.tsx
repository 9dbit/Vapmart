'use client';
import {useEffect,useRef,useState} from 'react';

const slides=[
 {desktop:'/legacy/banners/desktop-01.png',mobile:'/legacy/banners/mobile-01.png',label:'Banner arsip Vapmart pertama'},
 {desktop:'/legacy/banners/desktop-02.png',mobile:'/legacy/banners/mobile-02.png',label:'Banner arsip Vapmart kedua'},
 {desktop:'/legacy/banners/desktop-03.png',mobile:'/legacy/banners/mobile-03.png',label:'Banner arsip Vapmart ketiga'}
] as const;

export function HeroCarousel(){
  const [active,setActive]=useState(0);
  const [paused,setPaused]=useState(false);
  const [hovered,setHovered]=useState(false);
  const startX=useRef<number|null>(null);
  useEffect(()=>{
    if(paused||hovered||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const interval=window.setInterval(()=>setActive(current=>(current+1)%slides.length),5500);
    return()=>window.clearInterval(interval);
  },[paused,hovered]);
  function navigate(direction:number){
    setPaused(true);
    setActive(current=>(current+direction+slides.length)%slides.length);
  }
  function jump(index:number){setPaused(true);setActive(index);}
  return <section className="legacy-banner-reference vm-original-banner" aria-label="Banner referensi Vapmart">
    <div className="vm-carousel-shell"
      role="region" aria-roledescription="carousel" aria-label="Banner Vapmart"
      onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      onFocusCapture={()=>setHovered(true)} onBlurCapture={()=>setHovered(false)}
      onKeyDown={event=>{
        if(event.key==='ArrowLeft'){event.preventDefault();navigate(-1)}
        if(event.key==='ArrowRight'){event.preventDefault();navigate(1)}
      }}
      onTouchStart={event=>{startX.current=event.touches[0]?.clientX??null;}}
      onTouchEnd={event=>{
        if(startX.current===null)return;
        const x=event.changedTouches[0]?.clientX??startX.current;
        const distance=x-startX.current;startX.current=null;
        if(Math.abs(distance)>35)navigate(distance<0?1:-1);
      }}>
      <div className="vm-carousel-track" style={{transform:'translate3d(-'+(active*100)+'%,0,0)'}}>
        {slides.map((slide,index)=><div key={slide.desktop} role="group" aria-roledescription="slide"
          aria-label={(index+1)+' dari '+slides.length} aria-hidden={index!==active} className="vm-carousel-slide">
          <picture>
            <source media="(max-width:767px)" srcSet={slide.mobile}/>
            <img src={slide.desktop} alt={slide.label} width={1024} height={320}
              loading={index===0?'eager':'lazy'} fetchPriority={index===0?'high':'auto'}/>
          </picture>
        </div>)}
      </div>
      <button type="button" className="vm-carousel-arrow vm-carousel-previous" onClick={()=>navigate(-1)} aria-label="Banner sebelumnya">
        <span aria-hidden="true">‹</span>
      </button>
      <button type="button" className="vm-carousel-arrow vm-carousel-next" onClick={()=>navigate(1)} aria-label="Banner berikutnya">
        <span aria-hidden="true">›</span>
      </button>
      <div className="vm-carousel-dots" role="group" aria-label="Pilih banner">
        {slides.map((slide,index)=><button key={slide.desktop} type="button" className={index===active?'is-active':''}
          aria-label={'Tampilkan banner '+(index+1)} aria-pressed={index===active} onClick={()=>jump(index)}><span/></button>)}
      </div>
      <button type="button" className="vm-carousel-pause" aria-label={paused?'Lanjutkan putaran banner':'Jeda putaran banner'}
        onClick={()=>setPaused(value=>!value)}>{paused?'▶':'Ⅱ'}</button>
    </div>
  </section>;
}
