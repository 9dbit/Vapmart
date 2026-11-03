import {NextRequest,NextResponse} from 'next/server';
const MAX_BODY=5*1024*1024+65536;
const headers={'cache-control':'no-store','x-content-type-options':'nosniff'};
export async function heroImageProxy(req:NextRequest,id:string,admin:boolean){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return NextResponse.json({message:'ID gambar tidak valid'},{status:400,headers});
 const token=req.headers.get('authorization')||'';
 if(admin&&!/^Bearer [A-Za-z0-9._~+/=-]+$/.test(token))return NextResponse.json({message:'Login diperlukan'},{status:401,headers});
 const base=process.env.API_INTERNAL_URL;if(!base)return NextResponse.json({message:'API belum tersedia'},{status:503,headers});
 try{
  const path=admin?'/v1/admin/hero-banners/assets/'+id+'/content':'/v1/hero-banners/assets/'+id;
  const r=await fetch(new URL(path,base),{headers:admin?{authorization:token}:{},cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!r.ok)return NextResponse.json({message:'Gambar tidak tersedia'},{status:r.status,headers});
  if(r.headers.get('content-type')?.split(';')[0]!=='image/webp')throw Error('Unexpected image');
  const bytes=await r.arrayBuffer();if(bytes.byteLength>5242880)throw Error('Image limit');
  return new Response(bytes,{headers:{...headers,'content-type':'image/webp','content-security-policy':"default-src 'none'; sandbox",...(admin?{'cache-control':'private, no-store'}:{})}});
 }catch{return NextResponse.json({message:'Gambar belum dapat dimuat'},{status:503,headers});}
}
export async function heroUploadProxy(req:NextRequest){
 const auth=req.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9._~+/=-]+$/.test(auth))return NextResponse.json({message:'Login diperlukan'},{status:401,headers});
 const type=req.headers.get('content-type')||'';
 if(!/^multipart\/form-data;\s*boundary=/i.test(type))return NextResponse.json({message:'Upload harus multipart'},{status:400,headers});
 if(Number(req.headers.get('content-length')||0)>MAX_BODY)return NextResponse.json({message:'File maksimal 5 MiB'},{status:413,headers});
 const base=process.env.API_INTERNAL_URL;if(!base)return NextResponse.json({message:'API belum tersedia'},{status:503,headers});
 try{
  const reader=req.body?.getReader();if(!reader)return NextResponse.json({message:'File diperlukan'},{status:400,headers});
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
   if(size>MAX_BODY){await reader.cancel();return NextResponse.json({message:'File maksimal 5 MiB'},{status:413,headers});}chunks.push(part.value);}
  const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}
  const r=await fetch(new URL('/v1/admin/hero-banners/assets',base),{method:'POST',headers:{authorization:auth,'content-type':type},body,cache:'no-store',signal:AbortSignal.timeout(30000)});
  return new Response(await r.text(),{status:r.status,headers:{...headers,'content-type':'application/json'}});
 }catch{return NextResponse.json({message:'Upload gagal. Periksa koneksi dan coba lagi.'},{status:503,headers});}
}
