import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export function POST(r:NextRequest){return proxyJson(r,'/v1/shipping/estimate','POST',{maxChars:5000,timeoutMs:45000});}
