import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export function GET(request:NextRequest){const q=request.nextUrl.searchParams;return proxyJson(request,'/v1/shipping/areas?level='+encodeURIComponent(q.get('level')||'')+'&parentId='+encodeURIComponent(q.get('parentId')||''),'GET');}
