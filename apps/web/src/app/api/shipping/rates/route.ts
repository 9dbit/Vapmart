import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export function POST(request:NextRequest){return proxyJson(request,'/v1/shipping/rates','POST',{requireAuth:true,maxChars:5000,timeoutMs:45000});}
