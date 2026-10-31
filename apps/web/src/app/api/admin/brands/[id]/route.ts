import {NextRequest,NextResponse} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({code:'INVALID_BRAND_ID'},{status:400});
 return proxyJson(request,'/v1/admin/brands/'+encodeURIComponent(id),'PATCH',{requireAuth:true,maxChars:4000});
}
