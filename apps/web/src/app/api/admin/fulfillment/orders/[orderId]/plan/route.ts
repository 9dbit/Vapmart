import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export async function GET(r:NextRequest,{params}:{params:Promise<{orderId:string}>}){const {orderId}=await params;return proxyJson(r,'/v1/admin/fulfillment/orders/'+encodeURIComponent(orderId)+'/plan','GET',{requireAuth:true});}
