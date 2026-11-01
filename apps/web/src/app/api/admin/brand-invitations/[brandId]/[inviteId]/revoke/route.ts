import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest,{params}:{params:Promise<{brandId:string;inviteId:string}>}){const {brandId,inviteId}=await params;return proxyJson(request,'/v1/admin/brand-invitations/'+encodeURIComponent(brandId)+'/'+encodeURIComponent(inviteId)+'/revoke','POST',{requireAuth:true,maxChars:150});}
