'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import type {CartItem,Product} from './types';

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (product:Product)=>void;
  setQuantity: (id:string,quantity:number)=>void;
  remove: (id:string)=>void;
  open: boolean;
  setOpen: (open:boolean)=>void;
}
const Context=createContext<CartContextValue|null>(null);
const STORAGE='vapmart-staging-cart-v1';

export function CartProvider({children}:{children:ReactNode}) {
  const [items,setItems]=useState<CartItem[]>([]);
  const [hydrated,setHydrated]=useState(false);
  const [open,setOpen]=useState(false);
  useEffect(()=>{
    try {
      const value=JSON.parse(localStorage.getItem(STORAGE)||'[]') as unknown;
      if(Array.isArray(value)) {
        setItems(value.filter((x):x is CartItem=>x && typeof x==='object' && x.product && typeof x.product.id==='string' && Number.isInteger(x.quantity) && x.quantity>0).slice(0,50));
      }
    } catch { /* Corrupt cart is reset. */ }
    setHydrated(true);
  },[]);
  useEffect(()=>{if(hydrated)localStorage.setItem(STORAGE,JSON.stringify(items));},[items,hydrated]);
  const add=useCallback((product:Product)=>{
    setItems(prev=>{
      if(!product.is_active || product.stock_qty<=0)return prev;
      const existing=prev.find(item=>item.product.id===product.id);
      if(existing)return prev.map(item=>item.product.id===product.id?{...item,quantity:Math.min(item.quantity+1,product.stock_qty)}:item);
      return [...prev,{product,quantity:1}].slice(0,50);
    });
    setOpen(true);
  },[]);
  const setQuantity=useCallback((id:string,quantity:number)=>setItems(prev=>prev.map(item=>item.product.id===id?{
    ...item,quantity:Math.min(item.product.stock_qty,Math.max(1,Math.trunc(quantity)||1))
  }:item)),[]);
  const remove=useCallback((id:string)=>setItems(prev=>prev.filter(item=>item.product.id!==id)),[]);
  const count=useMemo(()=>items.reduce((n,item)=>n+item.quantity,0),[items]);
  const subtotal=useMemo(()=>items.reduce((n,item)=>n+item.quantity*item.product.price_idr,0),[items]);
  return <Context.Provider value={{items,count,subtotal,add,setQuantity,remove,open,setOpen}}>{children}</Context.Provider>;
}
export function useCart(){const ctx=useContext(Context);if(!ctx)throw new Error('CartProvider missing');return ctx;}
