import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export function POST(request:NextRequest){return proxyJson(request,'/v1/admin/media','POST',{requireAuth:true,maxChars:2250000});}
