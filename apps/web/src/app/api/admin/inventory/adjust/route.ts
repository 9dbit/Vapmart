import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export function POST(request:NextRequest){return proxyJson(request,'/v1/admin/inventory/adjust','POST',{requireAuth:true,maxChars:2400});}
