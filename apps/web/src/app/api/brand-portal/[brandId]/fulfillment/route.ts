import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export async function GET(r:NextRequest,{params}:{params:Promise<{brandId:string}>}){const {brandId}=await params;return proxyJson(r,'/v1/brand-portal/'+encodeURIComponent(brandId)+'/fulfillment','GET',{requireAuth:true});}
