import {NextRequest,NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const auth=req.headers.get('authorization')||'';
 const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
 if(!/^Bearer [A-Za-z0-9._~+/=-]+$/.test(auth))return NextResponse.json({code:'AUTH_REQUIRED'},{status:401,headers});
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({code:'INVALID_MEDIA_ID'},{status:400,headers});
 const base=process.env.API_INTERNAL_URL;
 if(!base)return NextResponse.json({code:'API_UNAVAILABLE'},{status:503,headers});
 try{
  const r=await fetch(new URL('/v1/admin/media-library/'+encodeURIComponent(id)+'/content',base),{headers:{authorization:auth},cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!r.ok)return NextResponse.json({code:r.status===401?'AUTH_REQUIRED':r.status===403?'ADMIN_REQUIRED':'MEDIA_NOT_AVAILABLE'},{status:r.status,headers});
  const mime=r.headers.get('content-type')?.split(';')[0]||'';
  if(!['image/png','image/jpeg','image/webp'].includes(mime))throw Error('Unsupported image response');
  const data=await r.arrayBuffer();
  if(data.byteLength>5242880)throw Error('Media exceeds limit');
  return new Response(data,{headers:{...headers,'content-type':mime,'content-length':String(data.byteLength),'content-security-policy':"default-src 'none'; sandbox"}});
 }catch{return NextResponse.json({code:'MEDIA_UNAVAILABLE'},{status:503,headers});}
}
