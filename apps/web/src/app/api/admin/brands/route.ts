import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export function GET(request:NextRequest){return proxyJson(request,'/v1/admin/brands','GET',{requireAuth:true});}
export function POST(request:NextRequest){return proxyJson(request,'/v1/admin/brands','POST',{requireAuth:true,maxChars:4000});}
