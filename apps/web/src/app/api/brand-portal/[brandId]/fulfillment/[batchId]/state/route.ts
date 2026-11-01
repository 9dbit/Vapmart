import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export async function POST(r:NextRequest,{params}:{params:Promise<{brandId:string;batchId:string}>}){const {brandId,batchId}=await params;return proxyJson(r,'/v1/brand-portal/'+encodeURIComponent(brandId)+'/fulfillment/'+encodeURIComponent(batchId)+'/state','POST',{requireAuth:true,maxChars:1000});}
