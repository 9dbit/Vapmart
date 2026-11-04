import {NextRequest,NextResponse} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>120)
  return NextResponse.json({message:'Slug arsip tidak valid'},{status:400});
 return proxyJson(req,'/v1/admin/product-records/'+encodeURIComponent(slug)+'/convert','POST',{requireAuth:true,maxChars:600});
}
