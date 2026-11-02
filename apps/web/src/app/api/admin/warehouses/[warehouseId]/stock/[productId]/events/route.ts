import {NextRequest} from 'next/server';
import {proxyJson} from '@/lib/server-proxy';
export const dynamic='force-dynamic';
export async function GET(r:NextRequest,{params}:{params:Promise<{warehouseId:string;productId:string}>}){const {warehouseId,productId}=await params;return proxyJson(r,'/v1/admin/warehouses/'+encodeURIComponent(warehouseId)+'/stock/'+encodeURIComponent(productId)+'/events','GET',{requireAuth:true});}
