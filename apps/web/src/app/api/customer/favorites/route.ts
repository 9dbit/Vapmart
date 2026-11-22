import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){return proxyJson(request,'/v1/customer/favorites','GET',{requireAuth:true});}
export async function POST(request:NextRequest){return proxyJson(request,'/v1/customer/favorites','POST',{requireAuth:true,maxChars:400});}
