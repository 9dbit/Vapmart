'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import type {CartItem,Product} from './types';
import {isDigitalProduct} from './digital-products';
interface CartContextValue {items:CartItem[];count:number;subtotal:number;add:(product:Product)=>void;setQuantity:(id:string,quantity:number)=>void;remove:(id:string)=>void;open:boolean;setOpen:(v:boolean)=>void;refresh:()=>Promise<void>;refreshing:boolean;catalogError:string;}
const Context=createContext<CartContextValue|null>(null),STORAGE='vapmart-staging-cart-v1';
export function CartProvider({children}:{children:ReactNode}){
 const [items,setItems]=useState<CartItem[]>([]),[hydrated,setHydrated]=useState(false),[open,setOpen]=useState(false),[refreshing,setRefreshing]=useState(false),[catalogError,setCatalogError]=useState('');
 const itemsRef=useRef(items),refreshId=useRef(0);itemsRef.current=items;
 useEffect(()=>{try{const v=JSON.parse(localStorage.getItem(STORAGE)||'[]');if(Array.isArray(v))setItems(v.filter((x:any):x is CartItem=>x&&typeof x==='object'&&x.product&&typeof x.product.id==='string'&&Number.isInteger(x.quantity)&&x.quantity>0&&x.quantity<=999).slice(0,25).map((x:CartItem)=>({...x,quantity:Math.min(99,x.quantity)})));}catch{}setHydrated(true)},[]);
 useEffect(()=>{if(hydrated)try{localStorage.setItem(STORAGE,JSON.stringify(items))}catch{}},[items,hydrated]);
 const ids=items.filter(x=>!isDigitalProduct(x.product)).map(x=>x.product.id).sort().join(',');
 const refresh=useCallback(async()=>{const list=itemsRef.current.filter(x=>!isDigitalProduct(x.product));if(!list.length){setCatalogError('');return;}const ticket=++refreshId.current;setRefreshing(true);try{const r=await fetch('/api/catalog/selection?ids='+encodeURIComponent(list.map(x=>x.product.id).join(',')),{cache:'no-store',signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok||!Array.isArray(d.items))throw Error('Harga dan stok belum dapat diperbarui. Checkout akan memeriksa ulang.');if(ticket!==refreshId.current)return;const map=new Map<string,Product>(d.items.map((p:Product)=>[p.id,p]));const requested=new Set(list.map(x=>x.product.id));setItems(prev=>prev.map(item=>{if(isDigitalProduct(item.product)||!requested.has(item.product.id))return item;const p=map.get(item.product.id);return p?{product:{...p,available:true},quantity:Math.max(1,Math.min(item.quantity,p.stock_qty||1))}:{...item,product:{...item.product,is_active:false,stock_qty:0,available:false}}}));setCatalogError('');}catch(e){if(ticket===refreshId.current)setCatalogError((e as Error).message)}finally{if(ticket===refreshId.current)setRefreshing(false)}},[]);
 useEffect(()=>{if(!hydrated)return;void refresh();const focus=()=>{if(document.visibilityState==='visible')void refresh()};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);return()=>{window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus)}},[hydrated,ids,open,refresh]);
 const add=useCallback((product:Product)=>{if(!product.is_active||product.stock_qty<=0||product.product_type==='variable')return;setItems(prev=>{const found=prev.find(x=>x.product.id===product.id);if(found)return prev.map(x=>x.product.id===product.id?{product,quantity:Math.min(x.quantity+1,product.stock_qty,99)}:x);return [...prev,{product,quantity:1}].slice(0,25)});setOpen(true)},[]);
 const setQuantity=useCallback((id:string,q:number)=>setItems(prev=>prev.map(x=>x.product.id===id?{...x,quantity:Math.max(1,Math.min(x.product.stock_qty||1,99,Math.trunc(q)||1))}:x)),[]);
 const remove=useCallback((id:string)=>setItems(prev=>prev.filter(x=>x.product.id!==id)),[]);
 const count=useMemo(()=>items.reduce((n,x)=>n+x.quantity,0),[items]),subtotal=useMemo(()=>items.reduce((n,x)=>n+x.quantity*x.product.price_idr,0),[items]);
 return <Context.Provider value={{items,count,subtotal,add,setQuantity,remove,open,setOpen,refresh,refreshing,catalogError}}>{children}</Context.Provider>;
}
export function useCart(){const c=useContext(Context);if(!c)throw Error('CartProvider missing');return c;}
