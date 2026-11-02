import {NextResponse,type NextRequest} from 'next/server';
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!process.env.API_INTERNAL_URL)return NextResponse.json({error:'API not configured'},{status:503});
  const auth=request.headers.get('authorization');if(!auth?.startsWith('Bearer '))return NextResponse.json({error:'Unauthorized'},{status:401});
  const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Invalid ID'},{status:400});
  const raw=await request.text();if(raw.length>25000)return NextResponse.json({error:'Payload too large'},{status:413});
  try{const r=await fetch(new URL('/v1/admin/products/'+encodeURIComponent(id),process.env.API_INTERNAL_URL),{method:'PATCH',headers:{authorization:auth,'content-type':'application/json'},body:raw,cache:'no-store',signal:AbortSignal.timeout(8000)});return new NextResponse(await r.text(),{status:r.status,headers:{'content-type':'application/json','Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'API unavailable'},{status:503});}
}
