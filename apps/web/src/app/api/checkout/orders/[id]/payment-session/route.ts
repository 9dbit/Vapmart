import {NextRequest,NextResponse} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({code:'INVALID_ORDER_ID'},{status:400});
 return proxyJson(request,'/v1/checkout/orders/'+encodeURIComponent(id)+'/payment-session','POST',{requireAuth:true,maxChars:200});
}
