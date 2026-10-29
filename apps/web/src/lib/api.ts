import type { Product } from './types';

export async function getProducts():Promise<Product[]> {
  if (!process.env.API_INTERNAL_URL) return [];
  try {
    const response = await fetch(new URL('/v1/products',process.env.API_INTERNAL_URL), {cache:'no-store',signal:AbortSignal.timeout(7000)});
    if (!response.ok) return [];
    const data:unknown = await response.json();
    if (typeof data !== 'object' || data === null || !('items' in data)) return [];
    const items=(data as {items?:unknown}).items;
    return Array.isArray(items) ? items as Product[] : [];
  } catch { return []; }
}

export async function getProduct(slug:string):Promise<Product|null> {
  if (!process.env.API_INTERNAL_URL) return null;
  try {
    const response=await fetch(new URL('/v1/products/'+encodeURIComponent(slug),process.env.API_INTERNAL_URL),{cache:'no-store',signal:AbortSignal.timeout(7000)});
    if(!response.ok) return null;
    return (await response.json()) as Product;
  } catch { return null; }
}
