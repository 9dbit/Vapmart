import {NextRequest,NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
 const bearer=request.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9._~+/=-]+$/.test(bearer))
   return NextResponse.json({code:'AUTH_REQUIRED'},{status:401});
 if(!process.env.API_INTERNAL_URL)
   return NextResponse.json({code:'ORDER_API_NOT_CONFIGURED'},{status:503});
 const length=Number(request.headers.get('content-length')||0);
 if(length>1024)return NextResponse.json({code:'PAYLOAD_TOO_LARGE'},{status:413});
 let body:unknown;
 try{body=await request.json();}catch{return NextResponse.json({code:'INVALID_JSON'},{status:400});}
 try{
   const response=await fetch(new URL('/v1/digital-orders',process.env.API_INTERNAL_URL),{
     method:'POST',headers:{Authorization:bearer,'content-type':'application/json'},
     body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(8500)
   });
   return new Response(await response.text(),{status:response.status,headers:{
     'content-type':'application/json; charset=utf-8','cache-control':'no-store'
   }});
 }catch{return NextResponse.json({code:'ORDER_API_UNAVAILABLE'},{status:503});}
}
