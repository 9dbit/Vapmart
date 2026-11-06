import {BadRequestException,ForbiddenException,Injectable} from '@nestjs/common';
import {DatabaseService} from './database';
import {JubelioShipmentClient} from './jubelio-shipment';
import type {Principal} from './auth';
import {jubelioConfigured,shippingProvider} from './shipping-config';

export type CarrierOption={code:string;name:string};
export type ServiceOption={key:string;courierCode:string;courierName:string;serviceCode:string;serviceName:string;category:string;supportsPostalCheckout:boolean};
export type VisibilitySelection={courierCodes:string[];serviceKeys:string[]|null};
const idPattern=/^[A-Za-z0-9_-]{1,50}$/;
const keyPattern=/^[A-Za-z0-9_-]{1,50}:[A-Za-z0-9_-]{1,50}$/;
const obj=(x:unknown):Record<string,unknown>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{};
const id=(v:unknown)=>((typeof v==='number'&&Number.isSafeInteger(v)&&v>0)||(typeof v==='string'&&idPattern.test(v)))?String(v):null;
const label=(v:unknown,fallback:string)=>typeof v==='string'&&v.trim()&&v.length<=150?v.trim():fallback;
const supported=(category:string)=>!['INSTANT','SAMEDAY','SAME DAY'].includes(category.toUpperCase());
function providerRows(raw:unknown):unknown[]{
 const x=obj(raw);
 return Array.isArray(raw)?raw:Array.isArray(x.data)?x.data:Array.isArray(x.items)?x.items:[];
}
export function serviceVisibilityKey(courierCode:string,serviceIdOrCode:string|number){
 return courierCode+':'+String(serviceIdOrCode);
}
/** Provider courier IDs and service IDs are separate identities, never interchangeable. */
export function normalizeProviderServices(raw:unknown):ServiceOption[]{
 const services=new Map<string,ServiceOption>();
 for(const value of providerRows(raw)){
  const row=obj(value),nested=obj(row.courier);
  const courierCode=id(row.courier_id??nested.id);
  const serviceIdentifier=id(row.courier_service_id??row.courier_service_code);
  if(!courierCode||!serviceIdentifier)continue;
  const key=serviceVisibilityKey(courierCode,serviceIdentifier);
  const serviceCode=label(row.courier_service_code??row.code,serviceIdentifier);
  const courierName=label(row.courier_name??nested.name,'Courier '+courierCode);
  const serviceName=label(row.courier_service_name??row.name,serviceCode);
  const category=label(row.courier_service_category??row.category,'');
  services.set(key,{key,courierCode,courierName,serviceCode,serviceName,category,supportsPostalCheckout:supported(category)});
 }
 return [...services.values()].sort((a,b)=>a.courierName.localeCompare(b.courierName,'id')||a.serviceName.localeCompare(b.serviceName,'id'));
}
export function filterVisibleShippingRates<T extends {courierCode:string;serviceCode:string;providerServiceId?:number}>(rates:T[],selection:VisibilitySelection|null):T[]{
 if(selection===null)return rates;
 const allowedCouriers=new Set(selection.courierCodes);
 const allowedServices=selection.serviceKeys===null?null:new Set(selection.serviceKeys);
 return rates.filter(rate=>allowedCouriers.has(rate.courierCode)&&
  (allowedServices===null||allowedServices.has(serviceVisibilityKey(rate.courierCode,rate.providerServiceId??rate.serviceCode))));
}
@Injectable()
export class CourierVisibilityService{
 constructor(private readonly db:DatabaseService,private readonly jubelio:JubelioShipmentClient){}
 async selection(provider=shippingProvider()):Promise<VisibilitySelection|null>{
  const q=await this.db.query<{courier_codes:string[];service_keys:string[]|null}>('SELECT courier_codes,service_keys FROM product.shipping_courier_visibility WHERE provider=$1',[provider]);
  return q.rows[0]?{courierCodes:q.rows[0].courier_codes,serviceKeys:q.rows[0].service_keys}:null;
 }
 async selectedCodes(provider=shippingProvider()){return (await this.selection(provider))?.courierCodes??null;}
 async list(){
  const provider=shippingProvider(),snapshot=provider==='jubelio'?'jubelio':'biteship_test';
  const [selection,observed,modified]=await Promise.all([
   this.selection(provider),
   this.db.query<{courier_code:string;courier_name:string;service_code:string;service_name:string;provider_service_id:number|null}>(
    `SELECT DISTINCT ON (courier_code,service_code,provider_service_id) courier_code,courier_name,service_code,service_name,provider_service_id
     FROM product.shipping_rate_quotes WHERE provider=$1
     ORDER BY courier_code,service_code,provider_service_id,created_at DESC LIMIT 300`,[snapshot]),
   this.db.query<{updated_at:string}>('SELECT updated_at FROM product.shipping_courier_visibility WHERE provider=$1',[provider])
  ]);
  const carriers=new Map<string,CarrierOption>(),services=new Map<string,ServiceOption>();
  for(const row of observed.rows){
   if(!idPattern.test(row.courier_code)||!idPattern.test(row.service_code))continue;
   const code=row.courier_code,courierName=row.courier_name||code,serviceName=row.service_name||row.service_code;
   carriers.set(code,{code,name:courierName});
   const key=serviceVisibilityKey(code,provider==='jubelio'&&row.provider_service_id?row.provider_service_id:row.service_code);
   services.set(key,{key,courierCode:code,courierName,serviceCode:row.service_code,serviceName,category:'',supportsPostalCheckout:true});
  }
  let warning:string|null=null;
  if(provider==='jubelio'&&jubelioConfigured()){
   try{
    const live=normalizeProviderServices(await this.jubelio.request('/courier-services/list'));
    if(!live.length)warning='Jubelio belum mengirim daftar layanan beridentitas valid. Gunakan riwayat tarif untuk sementara.';
    for(const value of live){
     const known=carriers.get(value.courierCode);
     const carrierName=value.courierName.startsWith('Courier ')?known?.name||value.courierName:value.courierName;
     const option={...value,courierName:carrierName};
     carriers.set(value.courierCode,{code:value.courierCode,name:carrierName});
     services.set(value.key,option);
    }
   }catch{warning='Daftar layanan Jubelio tidak dapat dimuat. Menampilkan layanan dari riwayat tarif.';}
  }else if(provider==='biteship'){
   for(const name of (process.env.SHIPPING_COURIERS||'jne,sicepat,anteraja').split(',')){
    const code=name.trim().toLowerCase();if(idPattern.test(code))carriers.set(code,{code,name:code.toUpperCase()});
   }
  }
  for(const id of selection?.courierCodes||[]){if(!carriers.has(id))carriers.set(id,{code:id,name:id+' (tersimpan)'});}
  for(const key of selection?.serviceKeys||[]){
   if(!services.has(key)){
    const [courierCode,serviceCode]=key.split(':');
    services.set(key,{key,courierCode,courierName:carriers.get(courierCode)?.name||courierCode,serviceCode,serviceName:serviceCode+' (tersimpan)',category:'',supportsPostalCheckout:true});
   }
  }
  return {provider,configured:selection!==null,selectedCodes:selection?.courierCodes||[],
   selectedServices:selection?.serviceKeys??null,
   available:[...carriers.values()].sort((a,b)=>a.name.localeCompare(b.name,'id')),
   availableServices:[...services.values()].sort((a,b)=>a.courierName.localeCompare(b.courierName,'id')||a.serviceName.localeCompare(b.serviceName,'id')),
   warning,updatedAt:modified.rows[0]?.updated_at||null};
 }
 async save(actor:Principal,raw:unknown){
  if(!actor.emailVerified)throw new ForbiddenException('Admin terverifikasi diperlukan');
  const body=obj(raw),keys=Object.keys(body);
  const byService=keys.length===1&&keys[0]==='selectedServices';
  const byCourier=keys.length===1&&keys[0]==='selectedCodes';
  if(!byService&&!byCourier)throw new BadRequestException('Pilih layanan kurir yang akan tampil');
  const chosen=byService?body.selectedServices:body.selectedCodes;
  const pattern=byService?keyPattern:idPattern;
  if(!Array.isArray(chosen)||!chosen.length||chosen.length>(byService?160:80)||chosen.some(x=>typeof x!=='string'||!pattern.test(x))||new Set(chosen).size!==chosen.length)
   throw new BadRequestException('Minimal satu pilihan valid tanpa duplikasi diperlukan');
  const options=await this.list();
  const known=new Set((byService?options.availableServices.map(x=>x.key):options.available.map(x=>x.code)));
  if(chosen.some(x=>!known.has(x)))throw new BadRequestException('Daftar layanan berubah. Muat ulang pilihan kurir.');
  const services=byService?chosen as string[]:null;
  const codes=byService?[...new Set((chosen as string[]).map(x=>x.split(':')[0]))]:chosen as string[];
  await this.db.query(`INSERT INTO product.shipping_courier_visibility(provider,courier_codes,service_keys,updated_by,updated_at)
   VALUES($1,$2::text[],$3::text[],$4,now()) ON CONFLICT(provider) DO UPDATE SET
   courier_codes=EXCLUDED.courier_codes,service_keys=EXCLUDED.service_keys,updated_by=EXCLUDED.updated_by,updated_at=now()`,
   [options.provider,codes,services,actor.id]);
  return this.list();
 }
}
