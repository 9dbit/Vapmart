export type AddressOption={id:string;name:string;parentId?:string;postalCode?:string};
export type AddressSelection={provinceId:string;cityId:string;districtId:string;areaId:string;province:string;city:string;district:string;area:string;postalCode:string;label:string};
export type AddressPath={provinces:AddressOption[];cities:AddressOption[];districts:AddressOption[];areas:AddressOption[];provinceId:string;cityId:string;districtId:string;areaId:string};

export function regionFromPath(p:AddressPath):AddressSelection|null{
 const province=p.provinces.find(x=>x.id===p.provinceId),city=p.cities.find(x=>x.id===p.cityId&&x.parentId===p.provinceId),
  district=p.districts.find(x=>x.id===p.districtId&&x.parentId===p.cityId),area=p.areas.find(x=>x.id===p.areaId&&x.parentId===p.districtId);
 if(!province||!city||!district||!area?.postalCode)return null;
 return {provinceId:province.id,cityId:city.id,districtId:district.id,areaId:area.id,
  province:province.name,city:city.name,district:district.name,area:area.name,postalCode:area.postalCode,
  label:[area.name,district.name,city.name,province.name,area.postalCode].join(', ')};
}
export function resetAddressPath(p:AddressPath,level:'provinceId'|'cityId'|'districtId'|'areaId',id:string):AddressPath{
 const n={...p,[level]:id};
 if(level==='provinceId'){n.cityId='';n.cities=[];}
 if(['provinceId','cityId'].includes(level)){n.districtId='';n.districts=[];}
 if(level!=='areaId'){n.areaId='';n.areas=[];}
 return n;
}

/** BigDataCloud follows OSM naming. The courier uses the Ministry of Home
 * Affairs naming, e.g. GPS 'Jakarta' vs courier 'DKI JAKARTA'.
 * Never treat geocoder 'Jawa' (ID-JW) as a province.
 */
export function normalizedRegionName(s:string){
 const canonical=s.toUpperCase().normalize('NFKD')
  .replace(/DAERAH KHUSUS IBUKOTA|DAERAH KHUSUS JAKARTA|SPECIAL CAPITAL REGION OF JAKARTA/,'DKI JAKARTA')
  .replace(/DAERAH ISTIMEWA YOGYAKARTA|SPECIAL REGION OF YOGYAKARTA/,'YOGYAKARTA')
  .replace(/\b(PROVINSI|PROVINCE|KABUPATEN|KAB|KOTA|ADMINISTRASI|ADM|KECAMATAN|DISTRIK|KELURAHAN|DESA|REGENCY|CITY|DISTRICT)\b/g,'')
  .replace(/[^A-Z0-9]/g,'');
 if(['DKIJAKARTA','JAKARTA','JAKARTARAYA'].includes(canonical))return 'JAKARTA';
 return canonical;
}

export function regionCandidates(items:AddressOption[],names:string[]):AddressOption[]{
 const qualified=(s:string)=>s.toUpperCase().replace(/KABUPATEN|REGENCY/g,'KAB')
  .replace(/ADMINISTRASI/g,'ADM').replace(/[^A-Z0-9]/g,'');
 const terms=names.filter(Boolean);
 const exact=new Set(terms.map(qualified));
 const direct=items.filter(x=>exact.has(qualified(x.name)));
 if(direct.length)return direct;
 const wanted=new Set(terms.map(normalizedRegionName));
 return items.filter(x=>wanted.has(normalizedRegionName(x.name)));
}

export function uniqueRegionMatch(items:AddressOption[],names:string[]){
 const found=regionCandidates(items,names);
 return found.length===1?found[0]:null;
}
export type AddressList=(level:'provinces'|'cities'|'districts'|'areas',parent?:string)=>Promise<AddressOption[]>;

export function locationCompletion(path:AddressPath):string{
 if(!path.provinceId)return 'provinsi';
 if(!path.cityId)return 'kota/kabupaten';
 if(!path.districtId)return 'kecamatan';
 if(!path.areaId)return 'kelurahan dan kode pos';
 return 'lengkap';
}

/** Safely resolve GPS to the courier's hierarchy. Some names are ambiguous:
 * "Tangerang" can mean Kabupaten or Kota. In that case inspect which city
 * actually contains the GPS district. If still ambiguous, leave the field
 * blank rather than choosing the wrong destination / quote.
 */
export async function pathFromLocation(raw:any,list:AddressList):Promise<AddressPath>{
 if(raw?.countryCode!=='ID')
  throw Error('Lokasi GPS tampak berada di luar Indonesia atau belum dapat dipastikan. Periksa izin GPS dan coba lagi.');
 const admins=Array.isArray(raw.localityInfo?.administrative)?raw.localityInfo.administrative:[];
 const names=(level:number):string[]=>admins.filter((x:any)=>x.adminLevel===level&&typeof x.name==='string').map((x:any)=>x.name);
 const p:AddressPath={provinces:await list('provinces'),cities:[],districts:[],areas:[],
  provinceId:'',cityId:'',districtId:'',areaId:''};

 // The principal subdivision might say "Jawa" with code ID-JW, which is an
 // island, not a province. Prefer OSM adminLevel=4 province names first.
 const province=uniqueRegionMatch(p.provinces,[...names(4),raw.principalSubdivision||'']);
 if(!province)return p;
 p.provinceId=province.id;
 p.cities=await list('cities',p.provinceId);
 const cityHints=[...names(5),raw.city||''];
 let city=uniqueRegionMatch(p.cities,cityHints);
 const districtHints=[...names(6),raw.locality||''];

 if(!city){
  const candidates=regionCandidates(p.cities,cityHints);
  // Bound the disambiguation work and do not guess between multiple cities.
  if(candidates.length>1&&candidates.length<=8&&districtHints.some(Boolean)){
   const resolved=await Promise.all(candidates.map(async candidate=>{
    try{
     const districts=await list('districts',candidate.id);
     return {candidate,districts,matched:uniqueRegionMatch(districts,districtHints)};
    }catch{return null;}
   }));
   const options=resolved.filter((entry):entry is {candidate:AddressOption;districts:AddressOption[];matched:AddressOption}=>
     Boolean(entry?.matched));
   if(options.length===1){
    city=options[0].candidate;
    p.districts=options[0].districts;
    p.districtId=options[0].matched.id;
   }
  }
 }
 if(!city)return p;
 p.cityId=city.id;
 if(!p.districts.length)p.districts=await list('districts',p.cityId);
 if(!p.districtId){
  const district=uniqueRegionMatch(p.districts,districtHints);
  if(!district)return p;
  p.districtId=district.id;
 }
 p.areas=await list('areas',p.districtId);
 const postal=typeof raw.postcode==='string'&&/^\d{5}$/.test(raw.postcode)?raw.postcode:'';
 const namedArea=uniqueRegionMatch(p.areas,[...names(7),...names(8),raw.locality||'']);
 const matchesPostal=postal?p.areas.filter(x=>x.postalCode===postal):[];
 // If the postcode maps to multiple kelurahan, the user must choose.
 const area=namedArea||(matchesPostal.length===1?matchesPostal[0]:null);
 if(area)p.areaId=area.id;
 return p;
}
