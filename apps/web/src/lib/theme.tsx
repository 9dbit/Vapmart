'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';

export type ThemePreference='light'|'dark'|'system';
type ResolvedTheme='light'|'dark';
type ThemeContextValue={
  preference:ThemePreference;
  resolvedTheme:ResolvedTheme;
  setPreference:(next:ThemePreference)=>void;
};
const storageKey='vapmart.color-mode.v1';
const ThemeContext=createContext<ThemeContextValue|null>(null);

function validPreference(value:string|null):value is ThemePreference{
  return value==='light'||value==='dark'||value==='system';
}
export function ThemeProvider({children}:{children:ReactNode}){
  const [preference,setSavedPreference]=useState<ThemePreference>('light');
  const [systemDark,setSystemDark]=useState(false);
  const [initialized,setInitialized]=useState(false);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-color-scheme: dark)');
    const read=()=>{
      try{
        const saved=window.localStorage.getItem(storageKey);
        return validPreference(saved)?saved:'light';
      }catch{return 'light' as const;}
    };
    setSavedPreference(read());
    setSystemDark(media.matches);
    setInitialized(true);
    const updateSystem=(event:MediaQueryListEvent)=>setSystemDark(event.matches);
    const updateStorage=(event:StorageEvent)=>{
      if(event.key===storageKey||event.key===null)setSavedPreference(read());
    };
    media.addEventListener('change',updateSystem);
    window.addEventListener('storage',updateStorage);
    return()=>{
      media.removeEventListener('change',updateSystem);
      window.removeEventListener('storage',updateStorage);
    };
  },[]);
  const resolvedTheme:ResolvedTheme=preference==='system'?(systemDark?'dark':'light'):preference;
  useEffect(()=>{
    if(!initialized)return;
    document.documentElement.setAttribute('data-vapmart-color-mode',resolvedTheme);
    document.documentElement.style.colorScheme=resolvedTheme;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content',resolvedTheme==='dark'?'#131317':'#ffffff');
  },[initialized,resolvedTheme]);
  const setPreference=useCallback((next:ThemePreference)=>{
    if(!validPreference(next))return;
    setSavedPreference(next);
    try{window.localStorage.setItem(storageKey,next);}catch{/* no persistence in private mode */}
    const prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved=next==='system'?(prefersDark?'dark':'light'):next;
    document.documentElement.setAttribute('data-vapmart-color-mode',resolved);
    document.documentElement.style.colorScheme=resolved;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content',resolved==='dark'?'#131317':'#ffffff');
  },[]);
  const value=useMemo(()=>({preference,resolvedTheme,setPreference}),[preference,resolvedTheme,setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useVapmartTheme(){
  const context=useContext(ThemeContext);
  if(!context)throw new Error('useVapmartTheme requires ThemeProvider');
  return context;
}
