import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export async function POST(r:NextRequest,{params}:{params:Promise<{batchId:string}>}){const {batchId}=await params;return proxyJson(r,'/v1/admin/courier/batches/'+encodeURIComponent(batchId)+'/sync','POST',{requireAuth:true,maxChars:1000,timeoutMs:55000});}
