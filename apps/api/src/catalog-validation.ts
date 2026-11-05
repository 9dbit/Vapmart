import {BadRequestException,ConflictException} from '@nestjs/common';
import {requireUuid} from './warehouses';
export type Attribute={name:string;values:string[]};
export type StockInput={warehouseId:string;onHand:number;expectedOnHand:number;expectedReserved:number;notes:string};
export const restrictedCatalog=/(nicotine|nikotin|vape|vaping|rokok|tobacco|e-cig|e-liquid|e-juice|saltnic|iqos)/i;
export function record(v:unknown,allowed?:string[]):Record<string,any>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw new BadRequestException('Objek diperlukan');
 const x=v as Record<string,any>;
 if(allowed&&Object.keys(x).some(k=>!allowed.includes(k)))throw new BadRequestException('Kolom tidak dikenal');return x;
}
export function text(v:unknown,label:string,min=0,max=140):string{
 if(typeof v!=='string'||v.trim().length<min||v.trim().length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v))throw new BadRequestException(label+' tidak valid');return v.trim();
}
export function integer(v:unknown,label:string,min=0,max=2000000000):number{
 if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)throw new BadRequestException(label+' tidak valid');return v;
}
export function measurement(v:unknown,label:string):number{
 if(label==='weight_grams')return integer(v,label,1,1000000);
 if(typeof v!=='number'||!Number.isFinite(v)||v<1||v>1000)throw new BadRequestException(label+' harus angka 1–1000 cm (desimal diperbolehkan)');return v;
}
export function slug(v:unknown):string{const s=text(v,'Slug',1,120);if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s))throw new BadRequestException('Slug hanya huruf kecil, angka dan tanda hubung');return s;}
export function sku(v:unknown):string|null{
 if(v===null||v===''||v===undefined)return null;
 const s=text(v,'SKU',3,64).toUpperCase();if(!/^[A-Z0-9][A-Z0-9._ /-]{2,63}$/.test(s))throw new BadRequestException('SKU harus 3–64 karakter: huruf, angka, spasi, titik, garis bawah, garis miring atau tanda hubung');return s;
}
export function imageUrl(v:unknown):string|null{
 if(v===null||v===''||v===undefined)return null;
 const s=text(v,'URL gambar',1,600);
 if(/^\/api\/media\/[0-9a-f-]{36}$/i.test(s))return s;
 try{const u=new URL(s);if(u.protocol!=='https:'||u.username||u.password||u.hash)throw Error();}catch{throw new BadRequestException('Gambar harus URL HTTPS atau media internal');}return s;
}
export function date(v:unknown):string|null{
 if(v===null||v===''||v===undefined)return null;
 if(v instanceof Date){if(!Number.isFinite(v.valueOf()))throw new BadRequestException('Tanggal tidak valid');return v.toISOString();}
 if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT.+(?:Z|[+-]\d\d:\d\d)$/.test(v)||!Number.isFinite(Date.parse(v)))throw new BadRequestException('Tanggal promo harus memiliki timezone');return new Date(v).toISOString();
}
export function priceFields(x:Record<string,any>){
 const price_idr=integer(x.price_idr,'Harga normal'),sale_price_idr=x.sale_price_idr===null||x.sale_price_idr===undefined||x.sale_price_idr===''?null:integer(x.sale_price_idr,'Harga promo');
 const sale_starts_at=date(x.sale_starts_at),sale_ends_at=date(x.sale_ends_at);
 if(sale_price_idr!==null&&sale_price_idr>=price_idr)throw new BadRequestException('Harga promo harus lebih rendah dari harga normal');
 if((sale_starts_at||sale_ends_at)&&sale_price_idr===null)throw new BadRequestException('Isi harga promo sebelum mengatur jadwal');
 if(sale_starts_at&&sale_ends_at&&sale_starts_at>=sale_ends_at)throw new BadRequestException('Akhir promo harus setelah mulai');
 return {price_idr,sale_price_idr,sale_starts_at,sale_ends_at};
}
export function attributes(v:unknown):Attribute[]{
 if(!Array.isArray(v)||v.length>3)throw new BadRequestException('Maksimal tiga dimensi variasi');
 const names=new Set<string>();return v.map(a=>{const x=record(a,['name','values']),name=text(x.name,'Nama atribut',1,40);
 if(names.has(name.toLowerCase()))throw new BadRequestException('Nama atribut ganda');names.add(name.toLowerCase());
 if(!Array.isArray(x.values)||x.values.length<1||x.values.length>50)throw new BadRequestException('Isi 1-50 pilihan atribut');
 const values=x.values.map((s:unknown)=>text(s,'Nilai atribut',1,60));if(new Set(values.map((s:string)=>s.toLowerCase())).size!==values.length)throw new BadRequestException('Pilihan atribut ganda');return {name,values};});
}
export function options(v:unknown,defs:Attribute[]):Record<string,string>{
 const x=record(v);if(Object.keys(x).length!==defs.length)throw new BadRequestException('Pilih seluruh atribut varian');
 const out:Record<string,string>={};for(const d of [...defs].sort((a,b)=>a.name.localeCompare(b.name))){if(typeof x[d.name]!=='string'||!d.values.includes(x[d.name]))throw new BadRequestException('Kombinasi varian tidak dikenal');out[d.name]=x[d.name];}return out;
}
export function stockInputs(v:unknown):StockInput[]{
 if(v===undefined)return [];if(!Array.isArray(v)||v.length>50)throw new BadRequestException('Stok gudang tidak valid');
 const seen=new Set<string>();return v.map(s=>{const x=record(s,['warehouseId','onHand','expectedOnHand','expectedReserved','notes']),warehouseId=requireUuid(x.warehouseId,'gudang');
 if(seen.has(warehouseId))throw new BadRequestException('Gudang ganda');seen.add(warehouseId);
 return {warehouseId,onHand:integer(x.onHand,'Stok fisik',0,100000000),expectedOnHand:integer(x.expectedOnHand,'Stok sebelumnya',0,100000000),expectedReserved:integer(x.expectedReserved,'Reservasi sebelumnya',0,100000000),notes:text(x.notes??'','Catatan stok',0,300)};});
}
export function safeCatalogTerms(...values:unknown[]){if(values.some(x=>restrictedCatalog.test(typeof x==='string'?x:JSON.stringify(x))))throw new BadRequestException('Konten ini tidak dapat dimasukkan ke katalog operasional');}
export function version(v:unknown){return integer(v,'Versi edit',1,2147483647);}
export function conflict(message:string):never{throw new ConflictException({code:'EDIT_CONFLICT',message});}
