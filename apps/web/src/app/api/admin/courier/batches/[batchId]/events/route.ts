import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export async function GET(r:NextRequest,{params}:{params:Promise<{batchId:string}>}){const {batchId}=await params;return proxyJson(r,'/v1/admin/courier/batches/'+encodeURIComponent(batchId)+'/events','GET',{requireAuth:true});}