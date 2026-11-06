import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export function GET(r:NextRequest){return proxyJson(r,'/v1/admin/shipping/couriers','GET',{requireAuth:true,timeoutMs:20000});}
export function PATCH(r:NextRequest){return proxyJson(r,'/v1/admin/shipping/couriers','PATCH',{requireAuth:true,maxChars:6000,timeoutMs:20000});}
