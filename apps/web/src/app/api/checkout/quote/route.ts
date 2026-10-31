import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export function POST(request:NextRequest){return proxyJson(request,'/v1/checkout/quote','POST',{maxChars:6000});}
