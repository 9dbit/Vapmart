import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:Promise<{productId:string}>}){const {productId}=await params;return proxyJson(request,'/v1/admin/inventory/'+encodeURIComponent(productId)+'/movements','GET',{requireAuth:true});}
