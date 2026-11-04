import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export function POST(request:NextRequest){
 const hasBearer=/^Bearer [A-Za-z0-9._~+/=-]+$/.test(request.headers.get('authorization')||'');
 return proxyJson(request,'/v1/checkout/quote','POST',{requireAuth:hasBearer,maxChars:6000});
}
