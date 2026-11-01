import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export async function POST(r:NextRequest,{params}:{params:Promise<{id:string}>}){const {id}=await params;return proxyJson(r,'/v1/admin/courier-returns/'+encodeURIComponent(id)+'/restock','POST',{requireAuth:true,maxChars:1300});}