import type {Product} from './types';
import {CollectionReadError,readCollection,settleCollection} from './collection-read';
export interface ActiveBrand {id:string;name:string;slug:string;logo_url:string|null;description:string;is_active:boolean;}
function url(path:string){if(!process.env.API_INTERNAL_URL)throw new CollectionReadError('SOURCE_NOT_CONFIGURED');return new URL(path,process.env.API_INTERNAL_URL).toString();}
const productValid=(x:unknown)=>!!x&&typeof x==='object'&&typeof (x as Product).id==='string'&&typeof (x as Product).slug==='string'&&typeof (x as Product).name==='string'&&typeof (x as Product).is_active==='boolean';
const brandValid=(x:unknown)=>!!x&&typeof x==='object'&&typeof (x as ActiveBrand).id==='string'&&typeof (x as ActiveBrand).name==='string'&&typeof (x as ActiveBrand).slug==='string';
export async function getProducts():Promise<Product[]>{return readCollection<Product>(url('/v1/products'),fetch,productValid);}
export async function getBrands():Promise<ActiveBrand[]>{return readCollection<ActiveBrand>(url('/v1/brands'),fetch,brandValid);}
export function getProductsResult(){return settleCollection(getProducts);}
export function getBrandsResult(){return settleCollection(getBrands);}
export async function getProduct(slug:string):Promise<Product|null>{
 let r:Response;try{r=await fetch(url('/v1/products/'+encodeURIComponent(slug)),{cache:'no-store',signal:AbortSignal.timeout(8000)});}catch{throw new CollectionReadError('SOURCE_UNAVAILABLE');}
 if(r.status===404)return null;if(!r.ok)throw new CollectionReadError('SOURCE_UNAVAILABLE');
 let d:unknown;try{d=await r.json();}catch{throw new CollectionReadError('INVALID_RESPONSE');}
 if(!productValid(d))throw new CollectionReadError('INVALID_RESPONSE');return d as Product;
}
