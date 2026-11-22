import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
/* Register a verified customer as a member. No payment or Coin credit. */
export async function POST(request:NextRequest){
 return proxyJson(request,'/v1/member/registration','POST',{requireAuth:true,maxChars:1250});
}
