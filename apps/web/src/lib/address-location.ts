export type AddressOption={id:string;name:string;parentId?:string;postalCode?:string};
export type AddressSelection={provinceId:string;cityId:string;districtId:string;areaId:string;province:string;city:string;district:string;area:string;postalCode:string;label:string};
export type AddressPath={provinces:AddressOption[];cities:AddressOption[];districts:AddressOption[];areas:AddressOption[];provinceId:string;cityId:string;districtId:string;areaId:string};
export function regionFromPath(p:AddressPath):AddressSelection|null{
 const province=p.provinces.find(x=>x.id===p.provinceId),city=p.cities.find(x=>x.id===p.cityId&&x.parentId===p.provinceId),district=p.districts.find(x=>x.id===p.districtId&&x.parentId===p.cityId),area=p.areas.find(x=>x.id===p.areaId&&x.parentId===p.districtId);
 if(!province||!city||!district||!area?.postalCode)return null;
 return {provinceId:province.id,cityId:city.id,districtId:district.id,areaId:area.id,province:province.name,city:city.name,district:district.name,area:area.name,postalCode:area.postalCode,label:[area.name,district.name,city.name,province.name,area.postalCode].join(', ')};
}
export function resetAddressPath(p:AddressPath,level:'provinceId'|'cityId'|'districtId'|'areaId',id:string):AddressPath{
 const n={...p,[level]:id};
 if(level==='provinceId'){n.cityId='';n.cities=[];}if(['provinceId','cityId'].includes(level)){n.districtId='';n.districts=[];}if(level!=='areaId'){n.areaId='';n.areas=[];}return n;
}
export function normalizedRegionName(s:string){
 return s.toUpperCase().normalize('NFKD').replace(/DAERAH KHUSUS IBUKOTA|DAERAH KHUSUS JAKARTA|SPECIAL CAPITAL REGION OF JAKARTA/,'DKI JAKARTA').replace(/DAERAH ISTIMEWA YOGYAKARTA|SPECIAL REGION OF YOGYAKARTA/,'YOGYAKARTA').replace(/\b(PROVINSI|PROVINCE|KABUPATEN|KAB|KOTA|ADMINISTRASI|ADM|KECAMATAN|DISTRIK|KELURAHAN|DESA|REGENCY|CITY|DISTRICT)\b/g,'').replace(/[^A-Z0-9]/g,'');
}
export function uniqueRegionMatch(items:AddressOption[],names:string[]){
 const qualified=(s:string)=>s.toUpperCase().replace(/KABUPATEN|REGENCY/g,'KAB').replace(/ADMINISTRASI/g,'ADM').replace(/[^A-Z0-9]/g,'');
 const exact=new Set(names.filter(Boolean).map(qualified)),direct=items.filter(x=>exact.has(qualified(x.name)));if(direct.length===1)return direct[0];
 const wanted=new Set(names.filter(Boolean).map(normalizedRegionName));const found=items.filter(x=>wanted.has(normalizedRegionName(x.name)));return found.length===1?found[0]:null;
}
export type AddressList=(level:'provinces'|'cities'|'districts'|'areas',parent?:string)=>Promise<AddressOption[]>;
export async function pathFromLocation(raw:any,list:AddressList):Promise<AddressPath>{
 if(raw?.countryCode!=='ID')throw Error('Lokasi berada di luar Indonesia. Pilih alamat Indonesia secara manual.');
 const admins=Array.isArray(raw.localityInfo?.administrative)?raw.localityInfo.administrative:[];
 const names=(level:number)=>admins.filter((x:any)=>x.adminLevel===level&&typeof x.name==='string').map((x:any)=>x.name);
 const p:AddressPath={provinces:await list('provinces'),cities:[],districts:[],areas:[],provinceId:'',cityId:'',districtId:'',areaId:''};
 const province=uniqueRegionMatch(p.provinces,[raw.principalSubdivision||'',...names(4)]);if(!province)throw Error('Provinsi lokasi belum dapat dipastikan. Pilih wilayah secara manual.');p.provinceId=province.id;
 p.cities=await list('cities',p.provinceId);const city=uniqueRegionMatch(p.cities,[...names(5),raw.city||'']);if(!city)return p;p.cityId=city.id;
 p.districts=await list('districts',p.cityId);const district=uniqueRegionMatch(p.districts,[...names(6),raw.locality||'']);if(!district)return p;p.districtId=district.id;
 p.areas=await list('areas',p.districtId);const area=uniqueRegionMatch(p.areas,[...names(7),raw.locality||'']);if(area)p.areaId=area.id;
 return p;
}
