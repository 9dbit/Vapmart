import {NextResponse,type NextRequest} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
  if(!process.env.API_INTERNAL_URL)return NextResponse.json({error:'API not configured'},{status:503});
  const auth=request.headers.get('authorization');
  if(!auth?.startsWith('Bearer '))return NextResponse.json({error:'Unauthorized'},{status:401});
  try {
    const response=await fetch(new URL('/v1/admin/products',process.env.API_INTERNAL_URL),{
      method:'GET',headers:{authorization:auth},cache:'no-store',signal:AbortSignal.timeout(8000)
    });
    return new NextResponse(await response.text(),{
      status:response.status,headers:{'content-type':'application/json','Cache-Control':'no-store'}
    });
  }catch {return NextResponse.json({error:'API unavailable'},{status:503});}
}

import {NextResponse,type NextRequest} from 'next/server';
export async function POST(request:NextRequest){
  if(!process.env.API_INTERNAL_URL)return NextResponse.json({error:'API not configured'},{status:503});
  const auth=request.headers.get('authorization');if(!auth?.startsWith('Bearer '))return NextResponse.json({error:'Unauthorized'},{status:401});
  const raw=await request.text();if(raw.length>25000)return NextResponse.json({error:'Payload too large'},{status:413});
  try{const r=await fetch(new URL('/v1/admin/products',process.env.API_INTERNAL_URL),{method:'POST',headers:{authorization:auth,'content-type':'application/json'},body:raw,cache:'no-store',signal:AbortSignal.timeout(8000)});return new NextResponse(await r.text(),{status:r.status,headers:{'content-type':'application/json','Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'API unavailable'},{status:503});}
}
