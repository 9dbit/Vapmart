import {NextRequest,NextResponse} from 'next/server';
type Method='GET'|'POST'|'PATCH';
export async function proxyJson(request:NextRequest,path:string,method:Method,options:{requireAuth?:boolean;maxChars?:number}={}):Promise<Response>{
 const base=process.env.API_INTERNAL_URL;
 if(!base)return NextResponse.json({code:'API_NOT_CONFIGURED',message:'API belum dikonfigurasi'},{status:503});
 const bearer=request.headers.get('authorization')||'';
 if(options.requireAuth&&!/^Bearer [A-Za-z0-9._~+/=-]+$/.test(bearer))
  return NextResponse.json({code:'AUTH_REQUIRED',message:'Silakan masuk kembali'},{status:401});
 let body:string|undefined;
 if(method!=='GET'){
  const limit=options.maxChars??12000;
  const length=Number(request.headers.get('content-length')||0);
  if(length>limit)return NextResponse.json({code:'PAYLOAD_TOO_LARGE'},{status:413});
  body=await request.text();
  if(body.length>limit)return NextResponse.json({code:'PAYLOAD_TOO_LARGE'},{status:413});
 }
 try{
  const response=await fetch(new URL(path,base),{
   method,headers:{...(options.requireAuth?{authorization:bearer}:{}),...(body===undefined?{}:{'content-type':'application/json'})},
   ...(body===undefined?{}:{body}),cache:'no-store',signal:AbortSignal.timeout(10000)
  });
  return new Response(await response.text(),{status:response.status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
 }catch{
  return NextResponse.json({code:'API_UNAVAILABLE',message:'Layanan belum tersedia'},{status:503});
 }
}
