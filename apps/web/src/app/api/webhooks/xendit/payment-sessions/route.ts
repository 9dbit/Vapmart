import {NextRequest,NextResponse} from 'next/server';
export const dynamic='force-dynamic';
const HEADER='x-callback-token';
/** Forward the exact webhook bytes and callback token to the Nest API.
 * Never route Xendit notifications through customer Supabase authentication.
 */
export async function POST(req:NextRequest){
 const base=process.env.API_INTERNAL_URL;
 if(!base)return NextResponse.json({code:'API_NOT_CONFIGURED'},{status:503});
 const token=req.headers.get(HEADER);
 if(!token||token.length>500)return NextResponse.json({code:'CALLBACK_TOKEN_REQUIRED'},{status:401});
 const max=32768;
 if(Number(req.headers.get('content-length')||0)>max)return NextResponse.json({code:'PAYLOAD_TOO_LARGE'},{status:413});
 const raw=await req.arrayBuffer();
 if(raw.byteLength<1||raw.byteLength>max)return NextResponse.json({code:'PAYLOAD_TOO_LARGE'},{status:413});
 try{
  const response=await fetch(new URL('/v1/webhooks/xendit/payment-sessions',base),{
   method:'POST',headers:{'content-type':'application/json',[HEADER]:token},
   body:new Uint8Array(raw),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(9000)
  });
  return new Response(await response.text(),{status:response.status,headers:{
   'content-type':'application/json','cache-control':'no-store'}});
 }catch{return NextResponse.json({code:'WEBHOOK_API_UNAVAILABLE'},{status:503});}
}
