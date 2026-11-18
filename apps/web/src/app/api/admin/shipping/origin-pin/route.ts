import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export function GET(r:NextRequest){return proxyJson(r,'/v1/admin/shipping/origin-pin','GET',{requireAuth:true});}
export function POST(r:NextRequest){return proxyJson(r,'/v1/admin/shipping/origin-pin','POST',{requireAuth:true,maxChars:1000});}
