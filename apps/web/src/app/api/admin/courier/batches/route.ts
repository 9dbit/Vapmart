import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export function GET(r:NextRequest){return proxyJson(r,'/v1/admin/courier/batches','GET',{requireAuth:true});}