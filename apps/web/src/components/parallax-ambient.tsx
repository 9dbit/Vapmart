'use client';
import {useEffect,useRef} from 'react';

/** Decorative-only parallax: two glow layers move while the hero is visible.
 * No content, controls, banner imagery or scroll position is transformed.
 * Disabled on small screens, reduced-motion and background tabs.
 */
export function ParallaxAmbient(){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const element=ref.current;
    if(!element)return;
    const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
    const narrow=window.matchMedia('(max-width: 767px)');
    if(reduce.matches||narrow.matches)return;
    let frame=0;
    function update(){
      frame=0;
      if(!element||document.visibilityState==='hidden')return;
      const bounds=element.parentElement?.getBoundingClientRect();
      if(!bounds||bounds.bottom<0||bounds.top>window.innerHeight)return;
      const displacement=(window.innerHeight/2-bounds.top-bounds.height/2)*0.12;
      const clamped=Math.max(-42,Math.min(42,displacement));
      element.style.setProperty('--vm-parallax-y',clamped.toFixed(1)+'px');
    }
    function schedule(){
      if(frame===0)frame=window.requestAnimationFrame(update);
    }
    schedule();
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule,{passive:true});
    return()=>{
      window.removeEventListener('scroll',schedule);
      window.removeEventListener('resize',schedule);
      if(frame)window.cancelAnimationFrame(frame);
    };
  },[]);
  return <div className="vm-parallax-atmosphere" ref={ref} aria-hidden="true">
    <span className="vm-parallax-glow vm-glow-left"/>
    <span className="vm-parallax-glow vm-glow-right"/>
  </div>;
}
