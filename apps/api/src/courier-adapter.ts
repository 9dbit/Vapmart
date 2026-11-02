import {BadRequestException,ConflictException} from '@nestjs/common';
// Pure, non-network adapter for the documented POST /v1/orders request body.
// It does not initiate a provider booking, payment, AWB or pickup.
export type BiteshipBookingInput={
 referenceId:string;origin:{contactName:string;contactPhone:string;address:string;postalCode:string};
 destination:{contactName:string;contactPhone:string;address:string;postalCode:string};
 courierCompany:string;courierType:string;
 items:Array<{name:string;valueIdr:number;quantity:number;weightGrams:number;lengthCm:number;widthCm:number;heightCm:number}>;
};
const postal=(v:string)=>/^\d{5}$/.test(v);
const phone=(v:string)=>/^\+?[0-9 ()-]{9,22}$/.test(v);
export function buildBiteshipOrderPayload(x:BiteshipBookingInput){
 if(!/^[a-zA-Z0-9:_-]{10,120}$/.test(x.referenceId)||
  !postal(x.origin.postalCode)||!postal(x.destination.postalCode)||
  !phone(x.origin.contactPhone)||!phone(x.destination.contactPhone)||
  !x.origin.contactName.trim()||!x.destination.contactName.trim()||
  x.origin.address.trim().length<8||x.destination.address.trim().length<8)
  throw new BadRequestException('Verified origin and recipient are required before booking');
 if(!/^[a-z0-9_]{2,35}$/.test(x.courierCompany)||!/^[a-z0-9_]{2,40}$/.test(x.courierType))
  throw new BadRequestException('Courier must match a server-selected quoted service');
 if(!x.items.length||x.items.length>100||x.items.some(g=>
  g.name.trim().length<2||!Number.isSafeInteger(g.valueIdr)||g.valueIdr<0||
  !Number.isSafeInteger(g.quantity)||g.quantity<1||g.quantity>10000||
  !Number.isSafeInteger(g.weightGrams)||g.weightGrams<1||g.weightGrams>1000000||
  [g.lengthCm,g.widthCm,g.heightCm].some(n=>!Number.isSafeInteger(n)||n<1||n>1000)))
  throw new ConflictException('Items need verified quantities, declared values, weights and dimensions');
 return {reference_id:x.referenceId,
  origin_contact_name:x.origin.contactName,origin_contact_phone:x.origin.contactPhone,
  origin_address:x.origin.address,origin_postal_code:Number(x.origin.postalCode),
  destination_contact_name:x.destination.contactName,destination_contact_phone:x.destination.contactPhone,
  destination_address:x.destination.address,destination_postal_code:Number(x.destination.postalCode),
  courier_company:x.courierCompany,courier_type:x.courierType,
  origin_collection_method:'pickup',delivery_type:'now',
  items:x.items.map(g=>({name:g.name,value:g.valueIdr,quantity:g.quantity,weight:g.weightGrams,
    length:g.lengthCm,width:g.widthCm,height:g.heightCm}))};
}
