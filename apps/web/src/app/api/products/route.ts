import {NextResponse} from 'next/server';
import {getProducts} from '@/lib/api';
export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json({items:await getProducts()},{headers:{'Cache-Control':'no-store'}});}
