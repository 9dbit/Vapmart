import {NextRequest} from 'next/server';
import {heroImageProxy} from '@/lib/hero-proxy';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest,c:{params:Promise<{id:string}>}){return heroImageProxy(req,(await c.params).id,false);}
