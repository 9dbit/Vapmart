import {NextRequest,NextResponse} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
import {heroImageProxy,heroUploadProxy} from '@/lib/hero-proxy';
export const dynamic='force-dynamic';
export const runtime='nodejs';
type Context={params:Promise<{segments?:string[]}>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function route(req:NextRequest,context:Context,method:'GET'|'POST'|'PATCH'){
 const parts=(await context.params).segments||[];
 if(method==='POST'&&parts.length===1&&parts[0]==='assets')return heroUploadProxy(req);
 if(method==='GET'&&parts.length===3&&parts[0]==='assets'&&parts[2]==='content')return heroImageProxy(req,parts[1],true);
 const allowed=parts.length===0&&method!=='PATCH'||method==='POST'&&parts.length===1&&parts[0]==='reorder'||
  method==='PATCH'&&parts.length===1&&uuid.test(parts[0])||method==='POST'&&parts.length===2&&uuid.test(parts[0])&&['state','trash','restore'].includes(parts[1]);
 if(!allowed)return NextResponse.json({message:'Endpoint tidak tersedia'},{status:404,headers:{'cache-control':'no-store'}});
 return proxyJson(req,'/v1/admin/hero-banners'+(parts.length?'/'+parts.map(encodeURIComponent).join('/'):''),method,{requireAuth:true});
}
export const GET=(req:NextRequest,c:Context)=>route(req,c,'GET');
export const POST=(req:NextRequest,c:Context)=>route(req,c,'POST');
export const PATCH=(req:NextRequest,c:Context)=>route(req,c,'PATCH');
