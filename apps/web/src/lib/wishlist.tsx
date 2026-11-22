'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {useCustomerAuth} from './customer-auth';

const STORAGE_KEY='vapmart-preview-wishlist-v1';
const BRAND_STORAGE_KEY='vapmart-guest-brand-favorites-v1';
const MAX_SAVED=100;
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
type SyncState='guest'|'loading'|'ready'|'error';
type FavoriteData={productIds:string[];brandIds:string[]};
type WishlistContextValue={
 savedIds:string[];brandIds:string[];count:number;has:(id:string)=>boolean;toggle:(id:string)=>void;
 hasBrand:(id:string)=>boolean;toggleBrand:(id:string)=>void;
 syncState:SyncState;syncError:string|null;reload:()=>void;
};
const Context=createContext<WishlistContextValue|null>(null);
function safeIds(value:unknown):string[]{
 if(!Array.isArray(value))return [];
 return [...new Set(value.filter((id):id is string=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(id)))].slice(0,MAX_SAVED);
}
function guestIds(key:string){
 try{return safeIds(JSON.parse(localStorage.getItem(key)||'[]'));}catch{return [];}
}
async function fetchFavorites(token:string,signal?:AbortSignal):Promise<FavoriteData>{
 const response=await fetch('/api/customer/favorites',{headers:{authorization:'Bearer '+token},cache:'no-store',signal});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(typeof data.message==='string'?data.message:'Favorit akun belum dapat disinkronkan.');
 return {productIds:safeIds(data.productIds),brandIds:safeIds(data.brandIds)};
}
export function WishlistProvider({children}:{children:ReactNode}){
 const auth=useCustomerAuth();
 const [savedIds,setSavedIds]=useState<string[]>([]);
 const [brandIds,setBrandIds]=useState<string[]>([]);
 const [hydrated,setHydrated]=useState(false);
 const [syncState,setSyncState]=useState<SyncState>('loading');
 const [syncError,setSyncError]=useState<string|null>(null);
 const [version,setVersion]=useState(0);
 useEffect(()=>{
  setSavedIds(guestIds(STORAGE_KEY));
  setBrandIds(guestIds(BRAND_STORAGE_KEY));
  setHydrated(true);
 },[]);
 useEffect(()=>{
  if(!hydrated||auth.loading)return;
  if(!auth.user||!auth.accessToken){
   setSavedIds(guestIds(STORAGE_KEY));
   setBrandIds(guestIds(BRAND_STORAGE_KEY));
   setSyncState('guest');setSyncError(null);return;
  }
  if(!auth.user.email_confirmed_at){
   setSyncState('error');setSyncError('Verifikasi email diperlukan agar favorit tersimpan lintas perangkat.');return;
  }
  const controller=new AbortController();
  const token=auth.accessToken;
  setSyncState('loading');setSyncError(null);
  (async()=>{
   let remote=await fetchFavorites(token,controller.signal);
   if(controller.signal.aborted)return;
   const pendingProducts=guestIds(STORAGE_KEY).filter(id=>uuid.test(id)&&!remote.productIds.includes(id));
   const pendingBrands=guestIds(BRAND_STORAGE_KEY).filter(id=>uuid.test(id)&&!remote.brandIds.includes(id));
   for(const [type,ids] of [['product',pendingProducts],['brand',pendingBrands]] as const){
    if(!ids.length)continue;
    const r=await fetch('/api/customer/favorites',{
     method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
     body:JSON.stringify({type,ids}),cache:'no-store',signal:controller.signal
    });
    if(!r.ok)throw Error('Favorit dari browser belum berhasil dipindahkan ke akun.');
   }
   if(pendingProducts.length||pendingBrands.length)remote=await fetchFavorites(token,controller.signal);
   if(controller.signal.aborted)return;
   setSavedIds(remote.productIds);setBrandIds(remote.brandIds);
   if(pendingProducts.length)localStorage.removeItem(STORAGE_KEY);
   if(pendingBrands.length)localStorage.removeItem(BRAND_STORAGE_KEY);
   setSyncState('ready');
  })().catch(e=>{
   if(controller.signal.aborted)return;
   setSyncState('error');
   setSyncError(e instanceof Error?e.message:'Sinkronisasi favorit gagal');
  });
  return()=>controller.abort();
 },[hydrated,auth.loading,auth.user?.id,auth.user?.email_confirmed_at,auth.accessToken,version]);
 useEffect(()=>{
  if(!hydrated||auth.loading||auth.user)return;
  try{
   localStorage.setItem(STORAGE_KEY,JSON.stringify(savedIds));
   localStorage.setItem(BRAND_STORAGE_KEY,JSON.stringify(brandIds));
  }catch{}
 },[savedIds,brandIds,hydrated,auth.loading,auth.user?.id]);
 useEffect(()=>{
  const update=(event:StorageEvent)=>{
   if(auth.user)return;
   if(event.key===STORAGE_KEY)setSavedIds(guestIds(STORAGE_KEY));
   if(event.key===BRAND_STORAGE_KEY)setBrandIds(guestIds(BRAND_STORAGE_KEY));
  };
  window.addEventListener('storage',update);
  return()=>window.removeEventListener('storage',update);
 },[auth.user?.id]);
 const change=useCallback((type:'product'|'brand',id:string)=>{
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(id))return;
  if(auth.user&&(!uuid.test(id)||syncState==='loading'))return;
  const isBrand=type==='brand';
  const current=isBrand?brandIds:savedIds;
  const nextSaved=!current.includes(id);
  const setter=isBrand?setBrandIds:setSavedIds;
  setter(prev=>nextSaved?[...prev.filter(x=>x!==id),id].slice(-MAX_SAVED):prev.filter(x=>x!==id));
  if(!auth.user||!auth.accessToken)return;
  fetch('/api/customer/favorites',{
   method:'POST',headers:{authorization:'Bearer '+auth.accessToken,'content-type':'application/json'},
   body:JSON.stringify({type,entityId:id,saved:nextSaved}),cache:'no-store'
  }).then(async r=>{
   if(!r.ok){const data=await r.json().catch(()=>({}));throw Error(data.message||'Gagal menyimpan favorit akun');}
  }).catch(e=>{
   setter(prev=>nextSaved?prev.filter(x=>x!==id):[...prev,id].slice(-MAX_SAVED));
   setSyncError(e instanceof Error?e.message:'Sinkronisasi favorit gagal');
   setSyncState('error');
  });
 },[auth.user?.id,auth.accessToken,syncState,brandIds,savedIds]);
 const has=useCallback((id:string)=>savedIds.includes(id),[savedIds]);
 const hasBrand=useCallback((id:string)=>brandIds.includes(id),[brandIds]);
 const toggle=useCallback((id:string)=>change('product',id),[change]);
 const toggleBrand=useCallback((id:string)=>change('brand',id),[change]);
 const reload=useCallback(()=>setVersion(x=>x+1),[]);
 const value=useMemo(()=>({savedIds,brandIds,count:savedIds.length,has,toggle,hasBrand,toggleBrand,syncState,syncError,reload}),
  [savedIds,brandIds,has,toggle,hasBrand,toggleBrand,syncState,syncError,reload]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWishlist(){
 const value=useContext(Context);
 if(!value)throw new Error('WishlistProvider missing');
 return value;
}
