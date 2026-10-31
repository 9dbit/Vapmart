import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return new Response(null,{status:404});
 if(!process.env.API_INTERNAL_URL)return new Response(null,{status:503});
 try{
  const response=await fetch(new URL('/v1/media/'+encodeURIComponent(id),process.env.API_INTERNAL_URL),{
   cache:'no-store',signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)return new Response(null,{status:response.status});
  const type=response.headers.get('content-type')||'';
  if(!['image/webp','image/png','image/jpeg'].includes(type))return new Response(null,{status:502});
  const content=await response.arrayBuffer();
  if(content.byteLength>1572864)return new Response(null,{status:502});
  return new NextResponse(content,{status:200,headers:{'content-type':type,'x-content-type-options':'nosniff','cache-control':'public, max-age=86400, immutable'}});
 }catch{return new Response(null,{status:503});}
}
