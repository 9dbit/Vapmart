import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export async function PATCH(r:NextRequest,{params}:{params:Promise<{warehouseId:string}>}){const {warehouseId}=await params;return proxyJson(r,'/v1/admin/warehouses/'+encodeURIComponent(warehouseId),'PATCH',{requireAuth:true,maxChars:3000});}
