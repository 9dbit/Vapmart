import type {AddressSelection} from '@/lib/address-location';
import type {DeliveryPin} from '@/lib/delivery-pin';

export const ADDRESS_BOOK_MAX=10;
export const ADDRESS_BOOK_META_KEY='vapmart_address_book_v1';
export const CHOSEN_ADDRESS_KEY='vapmart.checkout.address.';

export type SavedDeliveryAddress={
 id:string;
 label:string;
 recipientName:string;
 contactName:string;
 phone:string;
 street:string;
 unit:string;
 region:AddressSelection;
 pin:DeliveryPin|null;
};
export type AddressBook={version:1;defaultId:string|null;addresses:SavedDeliveryAddress[]};
export const EMPTY_ADDRESS_BOOK:AddressBook={version:1,defaultId:null,addresses:[]};

const string=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};

export function validAddressRegion(raw:unknown):raw is AddressSelection{
 const r=object(raw);
 return ['provinceId','cityId','districtId','areaId','province','city','district','area','postalCode','label'].every(k=>typeof r[k]==='string'&&r[k].length>0)
  &&/^\d{2}$/.test(String(r.provinceId))&&/^\d{4}$/.test(String(r.cityId))
  &&/^\d{6}$/.test(String(r.districtId))&&/^\d{10}$/.test(String(r.areaId))
  &&/^\d{5}$/.test(String(r.postalCode));
}
export function validDeliveryPin(raw:unknown):raw is DeliveryPin{
 const x=object(raw);
 return x.confirmed===true&&typeof x.latitude==='number'&&typeof x.longitude==='number'
  &&Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)
  &&x.latitude>=-11.5&&x.latitude<=6.5&&x.longitude>=94.5&&x.longitude<=141.5;
}
export function normalizeSavedAddress(raw:unknown):SavedDeliveryAddress|null{
 const v=object(raw),region=v.region,pin=v.pin;
 if(!/^[0-9a-f-]{36}$/i.test(String(v.id??''))||!validAddressRegion(region))return null;
 const result:SavedDeliveryAddress={
  id:String(v.id),label:string(v.label,40),recipientName:string(v.recipientName,90),
  contactName:string(v.contactName,90),phone:string(v.phone,22),street:string(v.street,300),
  unit:string(v.unit,100),region,pin:validDeliveryPin(pin)?pin:null
 };
 if(!result.label||result.recipientName.length<2||result.contactName.length<2
    ||result.street.length<8||!/^(?:\+?62|0)[0-9\s-]{8,18}$/.test(result.phone))return null;
 return result;
}
export function readAddressBook(metadata:unknown):AddressBook{
 const raw=object(object(metadata)[ADDRESS_BOOK_META_KEY]);
 const items=Array.isArray(raw.addresses)?raw.addresses:[];
 const seen=new Set<string>(),addresses:SavedDeliveryAddress[]=[];
 for(const item of items){
  const addr=normalizeSavedAddress(item);
  if(!addr||seen.has(addr.id))continue;
  seen.add(addr.id);addresses.push(addr);
  if(addresses.length===ADDRESS_BOOK_MAX)break;
 }
 const preferred=typeof raw.defaultId==='string'?raw.defaultId:'';
 return {version:1,addresses,defaultId:addresses.find(a=>a.id===preferred)?.id||addresses[0]?.id||null};
}
export function validatedBook(book:AddressBook):AddressBook{
 if(!book||!Array.isArray(book.addresses)||book.addresses.length>ADDRESS_BOOK_MAX)
  throw Error('Maksimal 10 alamat tersimpan per akun.');
 const addresses=book.addresses.map(a=>normalizeSavedAddress(a));
 if(addresses.some(a=>!a)||new Set(addresses.map(a=>a!.id)).size!==addresses.length)
  throw Error('Lengkapi nama, kontak, alamat, dan wilayah sebelum menyimpan.');
 const accepted=addresses as SavedDeliveryAddress[];
 return {version:1,addresses:accepted,defaultId:accepted.find(a=>a.id===book.defaultId)?.id||accepted[0]?.id||null};
}
export function preferredAddress(book:AddressBook,sessionChoice?:string|null):SavedDeliveryAddress|null{
 return book.addresses.find(a=>a.id===sessionChoice)||book.addresses.find(a=>a.id===book.defaultId)||book.addresses[0]||null;
}
export function addressStreet(addr:SavedDeliveryAddress):string{
 return [addr.street,addr.unit].filter(Boolean).join(', ');
}
export function legacyAccountAddress(metadata:unknown):{
 label:string;recipientName:string;contactName:string;phone:string;street:string
}|null{
 const m=object(metadata),street=string(m.address_line,300);
 if(street.length<8)return null;
 const name=string(m.display_name,90),phone=string(m.whatsapp_number,22);
 return {label:'Alamat akun',recipientName:name,contactName:name,phone,street};
}
