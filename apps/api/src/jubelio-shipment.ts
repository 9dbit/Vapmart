import {BadRequestException,Injectable,ServiceUnavailableException} from '@nestjs/common';
import {createHash} from 'node:crypto';
import {jubelioConfigured} from './shipping-config';

// Contract: Jubelio's own published plugin v2.1.0 (WordPress.org), verified against
// production with the account's new credentials. No browser token is reused.
const API='https://api-shipment.jubelio.com';
export type ShippingRegion={areaId:string;postalCode:string;label:string;province:string;city:string;district:string;area:string};
export type JubelioGoods={weight:number;quantity:number;value:number;length?:number;width?:number;height?:number};
export type JubelioRate={courierCode:string;courierName:string;serviceCode:string;serviceName:string;priceIdr:number;duration:string;
 providerServiceId:number;basePriceIdr:number;insuranceIdr:number};
function object(x:unknown):Record<string,unknown>{return x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{};}
function money(x:unknown):number|null{
 if(typeof x!=='number'&&!(typeof x==='string'&&/^\d+(\.0+)?$/.test(x)))return null;
 const n=Number(x);return Number.isSafeInteger(n)&&n>=0&&n<=10000000?n:null;
}
export function normalizeJubelioRegions(raw:unknown):ShippingRegion[]{
 if(!Array.isArray(raw))return [];
 const seen=new Set<string>();
 return raw.flatMap(row=>{const r=object(row);
  if(typeof r.area_id!=='string'||!/^\d{10}$/.test(r.area_id)||typeof r.zipcode!=='string'||!/^\d{5}$/.test(r.zipcode)||
   ['name','province','city','district','area'].some(k=>typeof r[k]!=='string'||String(r[k]).length>250)||seen.has(r.area_id))return [];
  seen.add(r.area_id);return [{areaId:r.area_id,postalCode:r.zipcode,label:String(r.name),province:String(r.province),city:String(r.city),district:String(r.district),area:String(r.area)}];
 }).slice(0,50);
}
export function normalizeJubelioRates(raw:unknown,now=Date.now()):JubelioRate[]{
 if(!Array.isArray(raw))throw new ServiceUnavailableException('Respons tarif Jubelio tidak valid');
 const seen=new Set<number>();
 return raw.flatMap(row=>{const r=object(row),base=money(r.rates),insurance=money(r.shipping_insurance??0);
  if(base===null||insurance===null||base+insurance>10000000||!Number.isSafeInteger(r.courier_id)||Number(r.courier_id)<=0||
   !Number.isSafeInteger(r.courier_service_id)||Number(r.courier_service_id)<=0||seen.has(Number(r.courier_service_id))||
   typeof r.courier_service_code!=='string'||!/^[-A-Za-z0-9_ ]{1,50}$/.test(r.courier_service_code)||
   typeof r.courier_name!=='string'||typeof r.courier_service_name!=='string')return [];
  // Instant/sameday requires verified map coordinates, which this postal flow does not collect.
  if(['INSTANT','SAMEDAY','SAME DAY'].includes(String(r.courier_service_category).toUpperCase()))return [];
  seen.add(Number(r.courier_service_id));
  const from=Date.parse(String(r.eta_from)),to=Date.parse(String(r.eta_to));
  const days=(t:number)=>Math.max(0,Math.ceil((t-now)/86400000));
  const duration=Number.isFinite(from)&&Number.isFinite(to)?`${days(from)}–${days(to)} hari`:'';
  // Quote the base tariff plus insurance. Conditional promotion discounts must
  // not be promised without reserving their usage/quota at booking time.
  return [{courierCode:String(r.courier_id),courierName:r.courier_name.slice(0,100),serviceCode:r.courier_service_code,
   serviceName:r.courier_service_name.slice(0,150),priceIdr:base+insurance,basePriceIdr:base,insuranceIdr:insurance,
   providerServiceId:Number(r.courier_service_id),duration}];
 }).sort((a,b)=>a.priceIdr-b.priceIdr).slice(0,40);
}
export function buildJubelioRatePayload(origin:{areaId:string;postalCode:string},destination:ShippingRegion,goods:JubelioGoods[]){
 if(!/^\d{10}$/.test(origin.areaId)||!/^\d{5}$/.test(origin.postalCode)||!/^\d{10}$/.test(destination.areaId)||!/^\d{5}$/.test(destination.postalCode)||!goods.length)
  throw new BadRequestException('Wilayah pengiriman belum lengkap');
 let weight=0,total=0;
 const items=goods.map(g=>{
  if(!Number.isSafeInteger(g.weight)||g.weight<1||!Number.isSafeInteger(g.quantity)||g.quantity<1||money(g.value)===null||
   [g.length,g.width,g.height].some(n=>typeof n!=='number'||!Number.isFinite(n)||n<=0||n>1000))
   throw new BadRequestException('Berat dan dimensi produk wajib dilengkapi untuk Jubelio');
  weight+=g.weight*g.quantity;total+=g.value*g.quantity;
  return {quantity:g.quantity,weight:g.weight,length:g.length,width:g.width,height:g.height};
 });
 if(!Number.isSafeInteger(weight)||weight>100000000||!Number.isSafeInteger(total)||total>1000000000)
  throw new BadRequestException('Nilai atau berat paket melebihi batas');
 return {origin:{area_id:origin.areaId,zipcode:origin.postalCode},destination:{area_id:destination.areaId,zipcode:destination.postalCode},
  weight,items,total_value:total,service_category_id:0};
}
@Injectable()
export class JubelioShipmentClient{
 private token:{value:string;expires:number;key:string}|null=null;
 private authenticating:Promise<string>|null=null;
 private regionsCache=new Map<string,{expires:number;items:ShippingRegion[]}>();
 private async json(path:string,init:RequestInit={},timeout=8000):Promise<{status:number;data:unknown}>{
  try{const r=await fetch(API+path,{...init,redirect:'error',signal:AbortSignal.timeout(timeout),headers:{'content-type':'application/json',...init.headers}});
   return {status:r.status,data:await r.json()};
  }catch{throw new ServiceUnavailableException({code:'JUBELIO_UNAVAILABLE',message:'Jubelio belum merespons, silakan coba lagi.'});}
 }
 private async accessToken():Promise<string>{
  if(!jubelioConfigured())throw new ServiceUnavailableException({code:'JUBELIO_NOT_CONFIGURED',message:'Koneksi Jubelio belum dikonfigurasi'});
  const key=createHash('sha256').update((process.env.JUBELIO_SHIPMENT_CLIENT_ID||'')+'\0'+process.env.JUBELIO_SHIPMENT_CLIENT_SECRET).digest('hex');
  if(this.token?.key===key&&this.token.expires>Date.now())return this.token.value;
  if(this.authenticating)return this.authenticating;
  this.authenticating=(async()=>{
   const r=await this.json('/auth/webstore',{method:'POST',body:JSON.stringify({client_id:process.env.JUBELIO_SHIPMENT_CLIENT_ID,
    client_secret:process.env.JUBELIO_SHIPMENT_CLIENT_SECRET,store_name:'Vapmart',store_domain:'vapmart.id'})});
   const d=object(r.data);
   if(r.status!==200||typeof d.token!=='string'||!d.token)throw new ServiceUnavailableException({code:'JUBELIO_AUTH_FAILED',message:'Autentikasi Jubelio gagal. Admin perlu memeriksa credential.'});
   const seconds=typeof d.expires_in==='number'&&Number.isFinite(d.expires_in)&&d.expires_in>0?d.expires_in:300;
   this.token={value:d.token,key,expires:Date.now()+Math.max(0,Math.min(seconds,86400)-60)*1000};return d.token;
  })();
  try{return await this.authenticating;}finally{this.authenticating=null;}
 }
 async request(path:string,body?:unknown):Promise<unknown>{
  // Internal allowlist: never turn a user-supplied path into an authenticated fetch.
  if(!['/courier-services/list','/webstore/rates/all'].includes(path))throw new Error('Unsupported Jubelio operation');
  for(let attempt=0;attempt<2;attempt++){
   const token=await this.accessToken(),r=await this.json(path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token},...(body===undefined?{}:{body:JSON.stringify(body)})},12000);
   if(r.status===401&&attempt===0){if(this.token?.value===token)this.token=null;continue;}
   if(r.status<200||r.status>=300)throw new ServiceUnavailableException({code:'JUBELIO_REQUEST_FAILED',message:'Tarif Jubelio belum tersedia untuk permintaan ini.'});
   return r.data;
  }
  throw new ServiceUnavailableException('Koneksi Jubelio perlu diperiksa');
 }
 async regions(search:string):Promise<ShippingRegion[]>{
  if(typeof search!=='string'||search.trim().length<3||search.length>80||!/^[\p{L}0-9 .,\-]+$/u.test(search))throw new BadRequestException('Masukkan kode pos atau nama wilayah minimal 3 karakter');
  const key=search.trim().toLowerCase(),cached=this.regionsCache.get(key);
  if(cached&&cached.expires>Date.now())return cached.items;
  const r=await this.json('/regions?name='+encodeURIComponent(key));
  if(r.status!==200||!Array.isArray(r.data))throw new ServiceUnavailableException('Pencarian wilayah Jubelio belum tersedia');
  const items=normalizeJubelioRegions(r.data);
  if(this.regionsCache.size>=200)this.regionsCache.delete(this.regionsCache.keys().next().value!);
  this.regionsCache.set(key,{items,expires:Date.now()+300000});return items;
 }
 async destination(postalCode:string,areaId?:string){
  const regions=(await this.regions(postalCode)).filter(r=>r.postalCode===postalCode);
  const chosen=areaId?regions.find(r=>r.areaId===areaId):regions.length===1?regions[0]:undefined;
  if(!chosen)throw new BadRequestException({code:'SHIPPING_AREA_REQUIRED',message:'Pilih kelurahan tujuan sesuai kode pos.'});
  return chosen;
 }
 async rates(destination:ShippingRegion,goods:JubelioGoods[]){
  const payload=buildJubelioRatePayload({areaId:process.env.JUBELIO_SHIPMENT_ORIGIN_AREA_ID||'',postalCode:process.env.SHIPPING_ORIGIN_POSTAL_CODE||''},destination,goods);
  return normalizeJubelioRates(await this.request('/webstore/rates/all',payload));
 }
 async status(){const data=await this.request('/courier-services/list');
  if(!Array.isArray(data))throw new ServiceUnavailableException('Data kurir Jubelio tidak valid');
  return {provider:'jubelio',connected:true,courierServiceCount:data.length,checkedAt:new Date().toISOString()};
 }
}
