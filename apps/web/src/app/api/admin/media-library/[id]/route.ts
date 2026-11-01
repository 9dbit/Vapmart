import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export async function PATCH(r:NextRequest,{params}:{params:Promise<{id:string}>}){const {id}=await params;return proxyJson(r,'/v1/admin/media-library/'+encodeURIComponent(id),'PATCH',{requireAuth:true,maxChars:2400});}
