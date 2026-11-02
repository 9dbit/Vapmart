import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:Promise<{brandId:string}>}){const {brandId}=await params;return proxyJson(request,'/v1/admin/brand-access/'+encodeURIComponent(brandId),'GET',{requireAuth:true});}
export async function POST(request:NextRequest,{params}:{params:Promise<{brandId:string}>}){const {brandId}=await params;return proxyJson(request,'/v1/admin/brand-access/'+encodeURIComponent(brandId),'POST',{requireAuth:true,maxChars:2000});}
