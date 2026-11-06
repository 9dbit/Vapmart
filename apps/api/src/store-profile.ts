import {BadRequestException,Injectable} from '@nestjs/common';
import {DatabaseService} from './database';
import type {Principal} from './auth';
import {assertVersion,requireActor} from './data-integrity';
import * as V from './catalog-validation';
export function parseStoreProfile(raw:unknown){
 const x=V.record(raw,['expectedVersion','name','address','city','province','postalCode','phone','email']);
 const profile={name:V.text(x.name,'Nama toko',2,100),address:V.text(x.address,'Alamat toko',8,300),city:V.text(x.city,'Kota',2,90),province:V.text(x.province,'Provinsi',2,90),postalCode:V.text(x.postalCode,'Kode pos',5,5),phone:V.text(x.phone,'Telepon',9,22),email:V.text(x.email??'','Email',0,254)};
 if(!/^\d{5}$/.test(profile.postalCode)||!/^\+?[0-9 ()-]{9,22}$/.test(profile.phone)||profile.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email))throw new BadRequestException('Kode pos, telepon, atau email toko tidak valid');
 return {profile,expectedVersion:V.integer(x.expectedVersion,'Versi',1)};
}
@Injectable()
export class StoreProfileService{
 constructor(private readonly db:DatabaseService){}
 private fallback(){return {name:process.env.INVOICE_STORE_NAME||'Vapmart',address:process.env.INVOICE_STORE_ADDRESS||'',city:'',province:'',postalCode:'',phone:process.env.INVOICE_STORE_PHONE||'',email:process.env.INVOICE_STORE_EMAIL||process.env.SHIPPING_SENDER_EMAIL||''};}
 async get(client:Pick<DatabaseService,'query'>=this.db){const r=(await client.query('SELECT * FROM product.store_profile WHERE id=true')).rows[0];return {profile:{...this.fallback(),...r.profile},version:r.version,updatedAt:r.updated_at};}
 async save(actor:Principal,raw:unknown){const who=requireActor(actor),x=parseStoreProfile(raw);return this.db.transaction(async c=>{
 const before=(await c.query('SELECT * FROM product.store_profile WHERE id=true FOR UPDATE')).rows[0];assertVersion(before.version,x.expectedVersion);
 const after=(await c.query('UPDATE product.store_profile SET profile=$1::jsonb,version=version+1,updated_by=$2,updated_at=now() WHERE id=true RETURNING *',[JSON.stringify(x.profile),who])).rows[0];
 await c.query('INSERT INTO product.store_profile_events(actor_id,before_data,after_data) VALUES($1,$2::jsonb,$3::jsonb)',[who,JSON.stringify(before.profile),JSON.stringify(after.profile)]);
 return {profile:after.profile,version:after.version,updatedAt:after.updated_at};
 });}
}
