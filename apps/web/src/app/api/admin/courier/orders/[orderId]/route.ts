import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:Promise<{orderId:string}>}){
 const {orderId}=await params;
 return proxyJson(request,'/v1/admin/courier/orders/'+encodeURIComponent(orderId),'GET',{requireAuth:true,maxChars:1000});
}
