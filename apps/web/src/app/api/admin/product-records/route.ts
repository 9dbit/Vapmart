import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export function GET(req:NextRequest){
 const query=new URLSearchParams();
 for(const key of ['q','source','status','brand','category','page','pageSize']){
  const value=req.nextUrl.searchParams.get(key);if(value!==null)query.set(key,value);
 }
 return proxyJson(req,'/v1/admin/product-records'+(query.size?'?'+query.toString():''),'GET',{requireAuth:true});
}
