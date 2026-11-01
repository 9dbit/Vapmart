import {BadRequestException,ConflictException,ForbiddenException,Injectable,ServiceUnavailableException} from '@nestjs/common';
import {DatabaseService} from './database';
import type {Principal} from './auth';
import {parseBasket} from './checkout';

type ShippingRequest={items:{productId:string;quantity:number}[];destinationPostalCode:string};
export function parseShippingRequest(raw:unknown):ShippingRequest{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Permintaan ongkir tidak valid');
 const body=raw as Record<string,unknown>;
 if(Object.keys(body).some(x=>!['items','destinationPostalCode'].includes(x))||
 typeof body.destinationPostalCode!=='string'||!/^[0-9]{5}$/.test(body.destinationPostalCode))
  throw new BadRequestException('Kode pos tujuan harus 5 angka');
 return {items:parseBasket({items:body.items}),destinationPostalCode:body.destinationPostalCode};
}
export type CourierRate={courierCode:string;courierName:string;serviceCode:string;serviceName:string;priceIdr:number;duration:string};
export function normalizeCourierRates(raw:unknown):CourierRate[]{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return [];
 const list=(raw as {pricing?:unknown}).pricing;
 if(!Array.isArray(list))return [];
 return list.flatMap((r:unknown)=>{
  if(!r||typeof r!=='object')return [];
  const x=r as Record<string,unknown>;
  const price=Number(x.price);
  if(!Number.isSafeInteger(price)||price<0||typeof x.courier_code!=='string'||typeof x.courier_service_code!=='string')return [];
  return [{courierCode:x.courier_code,courierName:typeof x.courier_name==='string'?x.courier_name:x.courier_code,
    serviceCode:x.courier_service_code,serviceName:typeof x.courier_service_name==='string'?x.courier_service_name:x.courier_service_code,
    priceIdr:price,duration:typeof x.duration==='string'?x.duration:''}];
 });
}
@Injectable()
export class ShippingService{
 constructor(private readonly db:DatabaseService){}
 config(){return {provider:'biteship',rateLookupEnabled:process.env.SHIPPING_RATE_LOOKUP_ENABLED==='true'&&Boolean(process.env.BITESHIP_API_KEY),bookingEnabled:false,paymentEnabled:false,rateType:'provisional_only'};}
 async rates(user:Principal,body:unknown){
  if(!user.emailVerified)throw new ForbiddenException('Verifikasi email diperlukan untuk cek ongkir');
  const {items,destinationPostalCode}=parseShippingRequest(body);
  const key=process.env.BITESHIP_API_KEY,origin=process.env.SHIPPING_ORIGIN_POSTAL_CODE;
  if(process.env.SHIPPING_RATE_LOOKUP_ENABLED!=='true'||!key||!key.startsWith('biteship_test.')||!origin||!/^[0-9]{5}$/.test(origin))
   throw new ServiceUnavailableException({code:'SHIPPING_SANDBOX_NOT_CONFIGURED',message:'Tarif kurir belum diaktifkan'});
  const list=await this.db.query<{id:string;slug:string;name:string;price_idr:string|number;stock_qty:number;is_active:boolean;weight_grams:number|null;length_cm:number|null;width_cm:number|null;height_cm:number|null}>(
    'SELECT id,slug,name,price_idr,stock_qty,is_active,weight_grams,length_cm,width_cm,height_cm FROM product.products WHERE id=ANY($1::uuid[])',[items.map(i=>i.productId)]);
  const byId=new Map(list.rows.map(p=>[p.id,p]));
  const goods=items.map(i=>{
   const p=byId.get(i.productId);
   if(!p||!p.is_active||p.slug.startsWith('demo-')||p.stock_qty<i.quantity)throw new ConflictException('Stok atau produk tidak tersedia');
   if(!Number.isSafeInteger(p.weight_grams)||!p.weight_grams||p.weight_grams<=0)
    throw new ConflictException('Berat produk belum dilengkapi');
   const value=Number(p.price_idr);
   if(!Number.isSafeInteger(value)||value<0)throw new ConflictException('Harga produk belum valid');
   return {name:p.name,value,weight:p.weight_grams,quantity:i.quantity,
     ...(p.length_cm?{length:p.length_cm}:{}),...(p.width_cm?{width:p.width_cm}:{}),...(p.height_cm?{height:p.height_cm}:{})};
  });
  let data:unknown;
  try{
   const couriers=process.env.SHIPPING_COURIERS||'jne,sicepat,anteraja';
   if(!/^[a-z,]{3,120}$/.test(couriers))throw Error('Bad couriers');
   const response=await fetch('https://api.biteship.com/v1/rates/couriers',{
    method:'POST',headers:{authorization:key,'content-type':'application/json'},
    body:JSON.stringify({origin_postal_code:Number(origin),destination_postal_code:Number(destinationPostalCode),couriers,items:goods}),
    signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error('Shipping provider rejected request');
   data=await response.json();
  }catch{throw new ServiceUnavailableException({code:'SHIPPING_PROVIDER_UNAVAILABLE'});}
  const rates=normalizeCourierRates(data);
  return {rates,provider:'biteship',quoteOnly:true,canBook:false,paymentEnabled:false,rateType:'provisional',destinationPostalCode};
 }
}
