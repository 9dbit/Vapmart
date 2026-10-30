'use client';
import {useEffect,useRef} from 'react';
import {usePathname} from 'next/navigation';
import {useVapmartTheme,type ThemePreference} from '@/lib/theme';
function ThemeIcon({kind}:{kind:'sun'|'moon'|'system'}){
 const props={width:20,height:20,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true as const};
 if(kind==='sun')return <svg {...props}><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>;
 if(kind==='system')return <svg {...props}><rect x="3" y="4" width="18" height="14" rx="2.5"/><path d="M8 21h8m-4-3v3"/></svg>;
 return <svg {...props}><path d="M20.1 15.6A8.2 8.2 0 0 1 8.4 3.9 8.5 8.5 0 1 0 20.1 15.6Z"/></svg>;
}
const choices=[
 {value:'light',label:'Light',description:'Tema terang',icon:'sun'},
 {value:'dark',label:'Dark',description:'Hitam & ungu',icon:'moon'},
 {value:'system',label:'Ikuti Sistem',description:'Otomatis sesuai perangkat',icon:'system'}
] as const;
export function ThemeSwitcher(){
 const {preference,resolvedTheme,setPreference}=useVapmartTheme();
 const detailsRef=useRef<HTMLDetailsElement>(null);
 const pathname=usePathname();
 useEffect(()=>{if(detailsRef.current)detailsRef.current.open=false;},[pathname]);
 useEffect(()=>{
   const onOutside=(event:PointerEvent)=>{
     if(detailsRef.current?.open&&!detailsRef.current.contains(event.target as Node))detailsRef.current.open=false;
   };
   const onEscape=(event:KeyboardEvent)=>{
     if(event.key==='Escape'&&detailsRef.current?.open){
       detailsRef.current.open=false;
       detailsRef.current.querySelector<HTMLElement>('summary')?.focus();
     }
   };
   document.addEventListener('pointerdown',onOutside);
   document.addEventListener('keydown',onEscape);
   return()=>{document.removeEventListener('pointerdown',onOutside);document.removeEventListener('keydown',onEscape);};
 },[]);
 const set=(next:ThemePreference)=>{
   setPreference(next);
   if(detailsRef.current)detailsRef.current.open=false;
   detailsRef.current?.querySelector<HTMLElement>('summary')?.focus();
 };
 return <details ref={detailsRef} className="vm23-theme-switcher" data-preference={preference}>
   <summary className="vm23-theme-trigger" aria-label={'Ubah tampilan, mode sekarang '+(preference==='system'?'mengikuti sistem':resolvedTheme==='dark'?'gelap':'terang')} title="Tema Vapmart">
     <ThemeIcon kind={resolvedTheme==='dark'?'moon':'sun'}/>
   </summary>
   <div className="vm23-theme-menu" role="group" aria-label="Pilih tema Vapmart">
     <div className="vm23-theme-menu-heading"><strong>Tampilan</strong><small>Pilih tema favoritmu</small></div>
     {choices.map(choice=><button type="button" key={choice.value}
       className={preference===choice.value?'is-current':''}
       aria-pressed={preference===choice.value}
       onClick={()=>set(choice.value)}>
       <span className="vm23-theme-choice-icon"><ThemeIcon kind={choice.icon}/></span>
       <span className="vm23-theme-choice-text"><strong>{choice.label}</strong><small>{choice.description}</small></span>
       <span className="vm23-theme-choice-check" aria-hidden="true">{preference===choice.value?'✓':''}</span>
     </button>)}
   </div>
 </details>;
}
