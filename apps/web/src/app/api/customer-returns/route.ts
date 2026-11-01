import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export function GET(r:NextRequest){return proxyJson(r,'/v1/customer-returns','GET',{requireAuth:true});}
export function POST(r:NextRequest){return proxyJson(r,'/v1/customer-returns','POST',{requireAuth:true,maxChars:1600});}