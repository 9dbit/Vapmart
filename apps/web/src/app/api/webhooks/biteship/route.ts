import {NextRequest,NextResponse} from 'next/server';
export const dynamic='force-dynamic';
const SHARED_HEADER='x-vapmart-biteship-secret';
// Preserve the exact JSON bytes. Only the Nest API knows the shared secret.
// Do not use proxyJson here because webhook authentication is not Supabase bearer.
export async function POST(req:NextRequest){
 const base=process.env.API_INTERNAL_URL;
 if(!base)return NextResponse.json({code:'API_UNAVAILABLE'},{status:503});
 const proof=req.headers.get(SHARED_HEADER);
 if(!proof||proof.length>500)return NextResponse.json({code:'SIGNATURE_HEADER_REQUIRED'},{status:401});
 const max=32768;
 if(Number(req.headers.get('content-length')||0)>max)return NextResponse.json({code:'PAYLOAD_TOO_LARGE'},{status:413});
 const raw=await req.arrayBuffer();
 if(raw.byteLength<1||raw.byteLength>max)return NextResponse.json({code:'PAYLOAD_TOO_LARGE'},{status:413});
 try{
  const out=await fetch(new URL('/v1/webhooks/biteship',base),{
   method:'POST',headers:{'content-type':'application/json',[SHARED_HEADER]:proof},
   body:new Uint8Array(raw),cache:'no-store',signal:AbortSignal.timeout(8000)});
  return new Response(await out.text(),{status:out.status,headers:{'content-type':'application/json','cache-control':'no-store'}});
 }catch{return NextResponse.json({code:'WEBHOOK_API_UNAVAILABLE'},{status:503});}
}
