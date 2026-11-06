import {BadRequestException,ForbiddenException,Injectable} from '@nestjs/common';
import {DatabaseService} from './database';
import {JubelioShipmentClient} from './jubelio-shipment';
import type {Principal} from './auth';
import {jubelioConfigured,shippingProvider} from './shipping-config';

export type CarrierOption={code:string;name:string};
const providerCode=/^[A-Za-z0-9_-]{1,50}$/;
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const code=(v:unknown)=>((typeof v==='number'&&Number.isSafeInteger(v)&&v>0)||(typeof v==='string'&&providerCode.test(v)))?String(v):null;

/** Normalize provider carrier IDs; NEVER use the service ID as a carrier ID. */
export function normalizeProviderCarriers(raw:unknown):CarrierOption[]{
 const d=obj(raw),list=Array.isArray(raw)?raw:Array.isArray(d.data)?d.data:Array.isArray(d.items)?d.items:[];
 const names=new Map<string,string>();
 for(const value of list){
  const item=obj(value),nested=obj(item.courier);
  const id=code(item.courier_id??nested.id);
  if(!id)continue;
  const title=item.courier_name??nested.name??item.name;
  const name=typeof title==='string'&&title.trim()&&title.length<=100?title.trim():id;
  const prior=names.get(id);
  if(!prior||prior===id)names.set(id,name);
 }
 return [...names].map(([code,name])=>({code,name})).sort((a,b)=>a.name.localeCompare(b.name,'id'));
}
export function filterVisibleCouriers<T extends {courierCode:string}>(rates:T[],selectedCodes:string[]|null):T[]{
 if(selectedCodes===null)return rates;
 const enabled=new Set(selectedCodes);
 return rates.filter(rate=>enabled.has(rate.courierCode));
}
@Injectable()
export class CourierVisibilityService{
 constructor(private readonly db:DatabaseService,private readonly jubelio:JubelioShipmentClient){}
 async selectedCodes(provider=shippingProvider()):Promise<string[]|null>{
  const r=await this.db.query<{courier_codes:string[]}>('SELECT courier_codes FROM product.shipping_courier_visibility WHERE provider=$1',[provider]);
  return r.rows[0]?.courier_codes??null;
 }
 async list(){
  const provider=shippingProvider(),snapshot=provider==='jubelio'?'jubelio':'biteship_test';
  const [selected,observed]=await Promise.all([
   this.selectedCodes(provider),
   this.db.query<{code:string;name:string}>("SELECT courier_code AS code,MAX(courier_name) AS name FROM product.shipping_rate_quotes WHERE provider=$1 AND courier_code ~ '^[a-zA-Z0-9_-]{1,50}$' GROUP BY courier_code ORDER BY MAX(courier_name) LIMIT 150",[snapshot])
  ]);
  const carriers=new Map<string,CarrierOption>();
  for(const row of observed.rows){if(providerCode.test(row.code))carriers.set(row.code,{code:row.code,name:row.name||row.code});}
  let warning:string|null=null;
  if(provider==='jubelio'&&jubelioConfigured()){
   try{
    const list=normalizeProviderCarriers(await this.jubelio.request('/courier-services/list'));
    if(!list.length)warning='Daftar kurir dari Jubelio tidak berisi kode kurir yang dapat digunakan. Riwayat tarif tetap tersedia.';
    for(const option of list)carriers.set(option.code,option);
   }catch{warning='Daftar kurir Jubelio tidak dapat dimuat. Menampilkan kurir dari riwayat tarif saja.';}
  }else if(provider==='biteship'){
   for(const name of (process.env.SHIPPING_COURIERS||'jne,sicepat,anteraja').split(',')){
    const id=name.trim().toLowerCase();
    if(providerCode.test(id))carriers.set(id,{code:id,name:id.toUpperCase()});
   }
  }
  for(const id of selected||[]){if(!carriers.has(id))carriers.set(id,{code:id,name:id+' (tersimpan)'});}
  const available=[...carriers.values()].sort((a,b)=>a.name.localeCompare(b.name,'id'));
  return {provider,configured:selected!==null,selectedCodes:selected||[],available,
   warning,updatedAt:(await this.db.query<{updated_at:string}>('SELECT updated_at FROM product.shipping_courier_visibility WHERE provider=$1',[provider])).rows[0]?.updated_at||null};
 }
 async save(actor:Principal,raw:unknown){
  if(!actor.emailVerified)throw new ForbiddenException('Admin terverifikasi diperlukan');
  const item=obj(raw);
  if(Object.keys(item).length!==1||!Array.isArray(item.selectedCodes)||item.selectedCodes.length<1||item.selectedCodes.length>80||
   item.selectedCodes.some(x=>typeof x!=='string'||!providerCode.test(x))||
   new Set(item.selectedCodes).size!==item.selectedCodes.length)
   throw new BadRequestException('Pilih minimal satu kurir valid tanpa duplikasi');
  const options=await this.list();
  const known=new Set(options.available.map(x=>x.code));
  if(item.selectedCodes.some(x=>!known.has(x as string)))throw new BadRequestException('Pilihan tidak ditemukan. Muat ulang daftar kurir.');
  await this.db.query(`INSERT INTO product.shipping_courier_visibility(provider,courier_codes,updated_by,updated_at)
   VALUES($1,$2::text[],$3,now()) ON CONFLICT(provider) DO UPDATE SET courier_codes=EXCLUDED.courier_codes,updated_by=EXCLUDED.updated_by,updated_at=now()`,
   [options.provider,item.selectedCodes,actor.id]);
  return this.list();
 }
}
