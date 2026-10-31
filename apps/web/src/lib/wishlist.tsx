'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';

const STORAGE_KEY='vapmart-preview-wishlist-v1';
const MAX_SAVED=100;
type WishlistContextValue={
  savedIds:string[];
  count:number;
  has:(id:string)=>boolean;
  toggle:(id:string)=>void;
};
const Context=createContext<WishlistContextValue|null>(null);
function safeIds(value:unknown):string[]{
  if(!Array.isArray(value))return [];
  return [...new Set(value.filter((id):id is string=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(id)))].slice(0,MAX_SAVED);
}
export function WishlistProvider({children}:{children:ReactNode}){
  const [savedIds,setSavedIds]=useState<string[]>([]);
  const [hydrated,setHydrated]=useState(false);
  useEffect(()=>{
    try{setSavedIds(safeIds(JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')));}
    catch{setSavedIds([]);}
    setHydrated(true);
  },[]);
  useEffect(()=>{
    if(!hydrated)return;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(savedIds));}catch{/* Browser storage may be unavailable. */}
  },[savedIds,hydrated]);
  useEffect(()=>{
    const update=(event:StorageEvent)=>{
      if(event.key!==STORAGE_KEY)return;
      try{setSavedIds(safeIds(JSON.parse(event.newValue||'[]')));}catch{setSavedIds([]);}
    };
    window.addEventListener('storage',update);
    return()=>window.removeEventListener('storage',update);
  },[]);
  const has=useCallback((id:string)=>savedIds.includes(id),[savedIds]);
  const toggle=useCallback((id:string)=>{
    if(!/^[a-zA-Z0-9-]{1,80}$/.test(id))return;
    setSavedIds(previous=>previous.includes(id)?previous.filter(saved=>saved!==id):[...previous,id].slice(-MAX_SAVED));
  },[]);
  const value=useMemo(()=>({savedIds,count:savedIds.length,has,toggle}),[savedIds,has,toggle]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWishlist(){
  const value=useContext(Context);
  if(!value)throw new Error('WishlistProvider missing');
  return value;
}
