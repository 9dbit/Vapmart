import {BadRequestException} from '@nestjs/common';
export type DeliveryPin={latitude:number;longitude:number;confirmed:true};
export function parseDeliveryPin(raw:unknown):DeliveryPin|null{
 if(raw===undefined||raw===null)return null;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Pin lokasi tidak valid');
 const p=raw as Record<string,unknown>;
 if(Object.keys(p).some(k=>!['latitude','longitude','confirmed'].includes(k))||p.confirmed!==true||typeof p.latitude!=='number'||typeof p.longitude!=='number'||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)||p.latitude< -11.5||p.latitude>6.5||p.longitude<94.5||p.longitude>141.5)throw new BadRequestException('Periksa dan konfirmasi pin lokasi di Indonesia.');
 return{latitude:Number(p.latitude.toFixed(6)),longitude:Number(p.longitude.toFixed(6)),confirmed:true};
}
export const pinCoordinate=(pin:DeliveryPin|null)=>pin?`(${pin.latitude},${pin.longitude})`:'';
export const pinMapsUrl=(pin:DeliveryPin)=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(pin.latitude+','+pin.longitude);
export const samePin=(a:unknown,b:unknown)=>JSON.stringify(parseDeliveryPin(a))===JSON.stringify(parseDeliveryPin(b));
export async function readOriginPin(db:{query:(sql:string,args?:unknown[])=>Promise<{rows:any[]}>},area:string,postal:string){
 const r=await db.query('SELECT pin FROM product.shipping_origin_pins WHERE provider=\'jubelio\' AND area_id=$1 AND postal_code=$2',[area,postal]);
 return parseDeliveryPin(r.rows[0]?.pin);
}
const allowedHost=(h:string)=>['google.com','www.google.com','maps.google.com','google.co.id','www.google.co.id','maps.app.goo.gl','goo.gl'].includes(h);
export function pointFromMapInput(input:string):DeliveryPin|null{
 const coordinate=/^\s*\(?\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*\)?\s*$/;
 let match=input.match(coordinate);
 if(!match){let u:URL;try{u=new URL(input);}catch{return null;}
  if(u.protocol!=='https:'||!allowedHost(u.hostname)||u.username||u.password||u.port)throw new BadRequestException('Gunakan tautan Google Maps yang valid.');
  // An @camera-centre is not necessarily the delivery pin. Only an explicit
  // coordinate query or the selected place's 3d/4d pair is accepted.
  match=(u.searchParams.get('query')||u.searchParams.get('q')||u.searchParams.get('destination')||'').match(coordinate);
  if(!match){try{match=decodeURIComponent(u.href).match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);}catch{throw new BadRequestException('Tautan Google Maps tidak valid.');}}
 }
 return match?parseDeliveryPin({latitude:Number(match[1]),longitude:Number(match[2]),confirmed:true}):null;
}
export async function resolveMapPin(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>k!=='input')||typeof (raw as any).input!=='string'||(raw as any).input.length>2048)throw new BadRequestException('Tempel tautan Google Maps atau koordinat.');
 let input=(raw as any).input.trim();let pin=pointFromMapInput(input);
 for(let i=0;!pin&&i<4;i++){
  let u:URL;try{u=new URL(input);}catch{break;}
  if(u.protocol!=='https:'||!allowedHost(u.hostname)||u.username||u.password||u.port)break;
  if(!['maps.app.goo.gl','goo.gl'].includes(u.hostname))break;
  let r:Response;try{r=await fetch(u,{redirect:'manual',method:'HEAD',signal:AbortSignal.timeout(5000)});}catch{break;}
  const next=r.headers.get('location');if(!next)break;input=new URL(next,u).href;pin=pointFromMapInput(input);
 }
 if(!pin)throw new BadRequestException('Tautan belum memuat koordinat pin. Di Google Maps, pilih titik lalu salin koordinat latitude, longitude.');
 return {pin,googleMapsUrl:pinMapsUrl(pin)};
}
