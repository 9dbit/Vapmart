import {effectivePrice,sellableSQL,type PriceInput} from './catalog-pricing';
import {BadRequestException,ConflictException,ForbiddenException,Injectable,ServiceUnavailableException} from '@nestjs/common';
import {DatabaseService} from './database';
import type {Principal} from './auth';
import {parseBasket} from './checkout';
import {shippingFingerprint,shippingParcelFingerprint} from './shipping-fingerprint';
import {shippingConfig,shippingSnapshotProvider} from './shipping-config';
import {JubelioShipmentClient,type ShippingRegion,type JubelioRate} from './jubelio-shipment';

type ShippingRequest={items:{productId:string;quantity:number}[];destinationPostalCode:string;destinationAreaId?:string};
export function parseShippingRequest(raw:unknown):ShippingRequest{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Permintaan ongkir tidak valid');
 const body=raw as Record<string,unknown>;
 if(Object.keys(body).some(x=>!['items','destinationPostalCode','destinationAreaId'].includes(x))||
 typeof body.destinationPostalCode!=='string'||!/^[0-9]{5}$/.test(body.destinationPostalCode))
  throw new BadRequestException('Kode pos tujuan harus 5 angka');
 if(body.destinationAreaId!==undefined&&(typeof body.destinationAreaId!=='string'||!/^\d{10}$/.test(body.destinationAreaId)))throw new BadRequestException('Pilih wilayah tujuan yang valid');
 return {items:parseBasket({items:body.items}),destinationPostalCode:body.destinationPostalCode,...(typeof body.destinationAreaId==='string'?{destinationAreaId:body.destinationAreaId}:{})};
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
 constructor(private readonly db:DatabaseService,private readonly jubelio:JubelioShipmentClient){}
 config(){return shippingConfig();}
 async rates(user:Principal,body:unknown){
  if(!user.emailVerified)throw new ForbiddenException('Verifikasi email diperlukan untuk cek ongkir');
  const {items,destinationPostalCode,destinationAreaId}=parseShippingRequest(body),config=this.config();
  const key=process.env.BITESHIP_API_KEY,origin=process.env.SHIPPING_ORIGIN_POSTAL_CODE;
  if(!config.rateLookupEnabled||!origin)throw new ServiceUnavailableException({code:'SHIPPING_NOT_CONFIGURED',message:'Tarif kurir belum diaktifkan'});
  const list=await this.db.query<{id:string;slug:string;name:string;stock_qty:number;is_active:boolean;weight_grams:number|null;length_cm:number|null;width_cm:number|null;height_cm:number|null}&PriceInput>(
    `SELECT p.* FROM product.products p WHERE p.id=ANY($1::uuid[]) AND ${sellableSQL}`,[items.map(i=>i.productId)]);
  const byId=new Map(list.rows.map(p=>[p.id,p]));
  const fingerprintItems:Array<{productId:string;quantity:number;unitPriceIdr:number;weightGrams:number;lengthCm:number|null;widthCm:number|null;heightCm:number|null}>=[];
  const goods=items.map(i=>{
   const p=byId.get(i.productId);
   if(!p||!p.is_active||p.slug.startsWith('demo-')||p.stock_qty<i.quantity)throw new ConflictException('Stok atau produk tidak tersedia');
   if(!Number.isSafeInteger(p.weight_grams)||!p.weight_grams||p.weight_grams<=0)
    throw new ConflictException('Berat produk belum dilengkapi');
   const value=effectivePrice(p);
   if(!Number.isSafeInteger(value)||value<0)throw new ConflictException('Harga produk belum valid');
   fingerprintItems.push({productId:i.productId,quantity:i.quantity,unitPriceIdr:value,weightGrams:p.weight_grams,lengthCm:p.length_cm,widthCm:p.width_cm,heightCm:p.height_cm});
   return {name:p.name,value,weight:p.weight_grams,quantity:i.quantity,
     ...(p.length_cm?{length:p.length_cm}:{}),...(p.width_cm?{width:p.width_cm}:{}),...(p.height_cm?{height:p.height_cm}:{})};
  });
  let rates:Array<CourierRate|JubelioRate>,destination:ShippingRegion|null=null;
  if(config.provider==='jubelio'){
   destination=await this.jubelio.destination(destinationPostalCode,destinationAreaId);
   rates=await this.jubelio.rates(destination,goods);
  }else{let data:unknown;try{
   const couriers=process.env.SHIPPING_COURIERS||'jne,sicepat,anteraja';
   if(!/^[a-z,]{3,120}$/.test(couriers))throw Error('Bad couriers');
   const response=await fetch('https://api.biteship.com/v1/rates/couriers',{
    method:'POST',headers:{authorization:key!,'content-type':'application/json'},
    body:JSON.stringify({origin_postal_code:Number(origin),destination_postal_code:Number(destinationPostalCode),couriers,items:goods}),
    signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error('Shipping provider rejected request');
   data=await response.json();
  }catch{throw new ServiceUnavailableException({code:'SHIPPING_PROVIDER_UNAVAILABLE'});}
   rates=normalizeCourierRates(data).slice(0,12).filter(r=>r.priceIdr<=10000000);
  }
  const fingerprint=config.provider==='jubelio'?shippingParcelFingerprint(fingerprintItems):shippingFingerprint(fingerprintItems);
  const saved=await this.db.transaction(async client=>{
   const options=[];
   for(const r of rates){
    const inserted=await client.query<{id:string;expires_at:string}>(
     "INSERT INTO product.shipping_rate_quotes(customer_user_id,cart_fingerprint,origin_postal_code,destination_postal_code,provider,courier_code,service_code,courier_name,service_name,amount_idr,expires_at,origin_area_id,destination_area_id,destination_region,provider_service_id,base_amount_idr,insurance_amount_idr) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now()+interval '15 minutes',$11,$12,$13::jsonb,$14,$15,$16) RETURNING id,expires_at",
     [user.id,fingerprint,origin,destinationPostalCode,shippingSnapshotProvider(),r.courierCode,r.serviceCode,r.courierName,r.serviceName,r.priceIdr,
      config.provider==='jubelio'?process.env.JUBELIO_SHIPMENT_ORIGIN_AREA_ID:null,destination?.areaId||null,destination?JSON.stringify(destination):null,
      'providerServiceId' in r?r.providerServiceId:null,'basePriceIdr' in r?r.basePriceIdr:r.priceIdr,'insuranceIdr' in r?r.insuranceIdr:0]);
    options.push({...r,quoteId:inserted.rows[0].id,expiresAt:inserted.rows[0].expires_at});
   }
   return options;
  });
  return {rates:saved,provider:config.provider,quoteOnly:true,canBook:false,paymentEnabled:false,rateType:config.rateType,destinationPostalCode,destination};
 }
}
