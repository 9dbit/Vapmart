import {BadRequestException,ServiceUnavailableException} from '@nestjs/common';
export type AddressOption={id:string;name:string;parentId?:string;postalCode?:string};
export type AddressRegion={areaId:string;provinceId:string;cityId:string;districtId:string;province:string;city:string;district:string;area:string;postalCode:string;label:string};
// Courier IDs remain Jubelio IDs. Province membership follows the 2022 Papua
// province split (UU 14/15/16/29 2022), not the courier's legacy province grouping.
const papua:Record<string,string>={
 '9101':'93','9116':'93','9117':'93','9118':'93',
 '9104':'94','9108':'94','9107':'94','9109':'94','9125':'94','9126':'94','9127':'94','9128':'94',
 '9102':'95','9112':'95','9113':'95','9114':'95','9121':'95','9122':'95','9123':'95','9124':'95',
 '9201':'96','9204':'96','9205':'96','9209':'96','9210':'96','9271':'96'
};
export const provinceForCourierCity=(id:string)=>papua[id]||id.slice(0,2);
export const courierProvince=(id:string)=>['93','94','95'].includes(id)?'91':id==='96'?'92':id;
export function normalizeAddressOptions(raw:unknown,level:string,parent=''):AddressOption[]{
 if(!Array.isArray(raw))throw new ServiceUnavailableException('Daftar wilayah belum tersedia');
 const config:Record<string,[string,number,string?]>={provinces:['province_id',2],cities:['city_id',4,'province_id'],districts:['district_id',6,'city_id'],areas:['area_id',10,'district_id']};
 const c=config[level];if(!c)throw new BadRequestException('Tingkat wilayah tidak valid');
 const seen=new Set<string>(),items:AddressOption[]=[];
 for(const r of raw){if(!r||typeof r!=='object')continue;const id=String(r[c[0]]??'');
  if(!new RegExp('^\\d{'+c[1]+'}$').test(id)||typeof r.name!=='string'||!r.name.trim()||r.name.length>150||seen.has(id))continue;
  if(c[2]&&String(r[c[2]])!==(level==='cities'?courierProvince(parent):parent))continue;
  if(level==='cities'&&provinceForCourierCity(id)!==parent)continue;
  if(level==='areas'&&!/^\d{5}$/.test(String(r.zipcode??'')))continue;
  seen.add(id);items.push({id,name:r.name.trim(),...(parent?{parentId:parent}:{}),...(level==='areas'?{postalCode:String(r.zipcode)}:{})});
 }
 if(level==='provinces')for(const [id,name] of [['93','PAPUA SELATAN'],['94','PAPUA TENGAH'],['95','PAPUA PEGUNUNGAN'],['96','PAPUA BARAT DAYA']])if(!seen.has(id))items.push({id,name});
 return items.sort((a,b)=>a.name.localeCompare(b.name,'id'));
}
export function addressLocality(o:{address_region?:any;district?:string;area?:string}){
 const r=o.address_region;return [r?.area||o.area,r?.district||o.district].filter(Boolean).join(', ');
}
export function courierRecipientAddress(o:{address_line?:string|null;city?:string|null;province?:string|null;postal_code?:string|null;address_region?:any}){
 return [o.address_line,addressLocality(o),[o.city,o.province,o.postal_code].filter(Boolean).join(', ')].filter(Boolean).join(', ');
}
