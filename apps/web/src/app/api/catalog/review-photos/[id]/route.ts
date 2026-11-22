import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return new Response(null,{status:404});
 const base=process.env.API_INTERNAL_URL;
 if(!base)return new Response(null,{status:503});
 try{
  const r=await fetch(new URL('/v1/catalog/review-photos/'+id,base),{cache:'no-store',signal:AbortSignal.timeout(8500)});
  if(!r.ok)return new Response(null,{status:r.status===403?404:r.status});
  if(r.headers.get('content-type')!=='image/webp')return new Response(null,{status:502});
  const bytes=await r.arrayBuffer();
  if(bytes.byteLength>1572864)return new Response(null,{status:502});
  return new NextResponse(bytes,{headers:{'Content-Type':'image/webp','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=3600'}});
 }catch{return new Response(null,{status:503});}
}
