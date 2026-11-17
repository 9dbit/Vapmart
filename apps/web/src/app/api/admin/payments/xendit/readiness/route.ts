import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export function GET(request:NextRequest){
 return proxyJson(request,'/v1/admin/payments/xendit/readiness','GET',{requireAuth:true,maxChars:300});
}
