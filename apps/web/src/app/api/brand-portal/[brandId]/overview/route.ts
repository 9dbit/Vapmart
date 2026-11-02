import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:Promise<{brandId:string}>}){const {brandId}=await params;return proxyJson(request,'/v1/brand-portal/'+encodeURIComponent(brandId)+'/overview','GET',{requireAuth:true});}
