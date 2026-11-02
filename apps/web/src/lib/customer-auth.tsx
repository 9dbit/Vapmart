'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {createClient,type Session,type SupabaseClient,type User} from '@supabase/supabase-js';

type CustomerContext={
  user:User|null;accessToken:string|null;loading:boolean;configured:boolean;
  signIn:(email:string,password:string)=>Promise<void>;
  signUp:(email:string,password:string,name:string)=>Promise<{needsConfirmation:boolean}>;
  sendReset:(email:string)=>Promise<void>;
  changePassword:(newPassword:string)=>Promise<void>;
  signOut:()=>Promise<void>;
};
const Context=createContext<CustomerContext|null>(null);
let singleton:SupabaseClient|null=null;
function getClient():SupabaseClient|null{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return null;
 if(!singleton)singleton=createClient(url,key,{auth:{
   persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,
   storageKey:'vapmart-customer-auth-v1'
 }});
 return singleton;
}
export function CustomerAuthProvider({children}:{children:ReactNode}){
 const [session,setSession]=useState<Session|null>(null);
 const [loading,setLoading]=useState(true);
 const client=useMemo(()=>getClient(),[]);
 useEffect(()=>{
   if(!client){setLoading(false);return;}
   let alive=true;
   const {data:{subscription}}=client.auth.onAuthStateChange((_event,next)=>{
     if(alive){setSession(next);setLoading(false);}
   });
   client.auth.getSession().then(({data})=>{if(alive){setSession(data.session);setLoading(false);}})
     .catch(()=>{if(alive)setLoading(false);});
   return()=>{alive=false;subscription.unsubscribe();};
 },[client]);
 const requireClient=useCallback(()=>{
   if(!client)throw new Error('Autentikasi Vapmart belum dikonfigurasi. Sistem belum menerima pendaftaran.');
   return client;
 },[client]);
 const signIn=useCallback(async(email:string,password:string)=>{
   const {error}=await requireClient().auth.signInWithPassword({email,password});
   if(error)throw new Error(error.message);
 },[requireClient]);
 const signUp=useCallback(async(email:string,password:string,name:string)=>{
   const {data,error}=await requireClient().auth.signUp({email,password,options:{
     data:{display_name:name.trim().slice(0,90)},
     emailRedirectTo:typeof window==='undefined'?undefined:window.location.origin+'/login'
   }});
   if(error)throw new Error(error.message);
   return {needsConfirmation:!data.session};
 },[requireClient]);
 const sendReset=useCallback(async(email:string)=>{
   const {error}=await requireClient().auth.resetPasswordForEmail(email,{
     redirectTo:typeof window==='undefined'?undefined:window.location.origin+'/login?mode=reset'
   });
   if(error)throw new Error(error.message);
 },[requireClient]);
 const changePassword=useCallback(async(password:string)=>{
   const {error}=await requireClient().auth.updateUser({password});if(error)throw new Error(error.message);
 },[requireClient]);
 const signOut=useCallback(async()=>{
   const {error}=await requireClient().auth.signOut();if(error)throw new Error(error.message);
 },[requireClient]);
 const value=useMemo(()=>({
   user:session?.user??null,accessToken:session?.access_token??null,loading,configured:!!client,
   signIn,signUp,sendReset,changePassword,signOut
 }),[session,loading,client,signIn,signUp,sendReset,changePassword,signOut]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCustomerAuth(){
 const ctx=useContext(Context);
 if(!ctx)throw new Error('CustomerAuthProvider missing from layout');
 return ctx;
}
