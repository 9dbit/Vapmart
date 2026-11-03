import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export function GET(req:NextRequest){return proxyJson(req,'/v1/hero-banners','GET');}
