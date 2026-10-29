import {NextResponse,type NextRequest} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
  const auth=request.headers.get('authorization');
  if(!auth?.startsWith('Bearer '))return NextResponse.json({error:'Unauthorized'},{status:401});
  if(!process.env.API_INTERNAL_URL)return NextResponse.json({error:'API not configured'},{status:503});
  try{
    const response=await fetch(new URL('/v1/admin/status',process.env.API_INTERNAL_URL),{
      method:'GET',headers:{authorization:auth},cache:'no-store',signal:AbortSignal.timeout(8000)
    });
    return new NextResponse(await response.text(),{
      status:response.status,headers:{'content-type':'application/json','cache-control':'no-store'}
    });
  }catch{
    return NextResponse.json({error:'API unavailable'},{status:503});
  }
}
