import {NextRequest,NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const bearer=request.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9._~+/=-]+$/.test(bearer))
   return NextResponse.json({code:'AUTH_REQUIRED'},{status:401});
 if(!process.env.API_INTERNAL_URL)
   return NextResponse.json({code:'MEMBER_API_NOT_CONFIGURED'},{status:503});
 try{
   const response=await fetch(new URL('/v1/member/overview',process.env.API_INTERNAL_URL),{
     method:'GET',cache:'no-store',headers:{Authorization:bearer},signal:AbortSignal.timeout(8500)
   });
   const body=await response.text();
   return new Response(body,{status:response.status,headers:{
     'content-type':'application/json; charset=utf-8','cache-control':'no-store'
   }});
 }catch{return NextResponse.json({code:'MEMBER_API_UNAVAILABLE'},{status:503});}
}
