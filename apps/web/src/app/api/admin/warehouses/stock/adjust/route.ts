import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export function POST(r:NextRequest){return proxyJson(r,'/v1/admin/warehouses/stock/adjust','POST',{requireAuth:true,maxChars:3000});}
