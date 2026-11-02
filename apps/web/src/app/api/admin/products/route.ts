import {NextResponse,type NextRequest} from 'next/server';
export const dynamic='force-dynamic';

async function proxyAdmin(request:NextRequest,method:'GET'|'POST'):Promise<NextResponse>{
  if(!process.env.API_INTERNAL_URL)return NextResponse.json({error:'API not configured'},{status:503});
  const auth=request.headers.get('authorization');
  if(!auth?.startsWith('Bearer '))return NextResponse.json({error:'Unauthorized'},{status:401});
  let body:string|undefined;
  if(method==='POST'){
    body=await request.text();
    if(body.length>25000)return NextResponse.json({error:'Payload too large'},{status:413});
  }
  try {
    const response=await fetch(new URL('/v1/admin/products',process.env.API_INTERNAL_URL),{
      method,
      headers:{authorization:auth,...(method==='POST'?{'content-type':'application/json'}:{})},
      ...(body===undefined?{}:{body}),
      cache:'no-store',
      signal:AbortSignal.timeout(8000)
    });
    return new NextResponse(await response.text(),{
      status:response.status,headers:{'content-type':'application/json','cache-control':'no-store'}
    });
  }catch {
    return NextResponse.json({error:'API unavailable'},{status:503});
  }
}
export async function GET(request:NextRequest){return proxyAdmin(request,'GET');}
export async function POST(request:NextRequest){return proxyAdmin(request,'POST');}
