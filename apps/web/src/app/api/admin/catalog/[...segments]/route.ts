import {NextRequest} from 'next/server';
import {catalogProxy} from '@/lib/catalog-proxy';
export const dynamic='force-dynamic';
async function handle(req:NextRequest,{params}:{params:Promise<{segments:string[]}>}){return catalogProxy(req,(await params).segments,'admin');}
export const GET=handle;
export const POST=handle;
export const PATCH=handle;
