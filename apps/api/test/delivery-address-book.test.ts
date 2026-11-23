import test from 'node:test';
import assert from 'node:assert/strict';
import {
 readAddressBook,validatedBook,preferredAddress,legacyAccountAddress,
 normalizeSavedAddress,validAddressRegion,ADDRESS_BOOK_MAX,addressStreet,checkoutAddressLine
} from '../../web/src/lib/delivery-address-book';
import {pathFromLocation,regionFromPath,locationCompletion,normalizedRegionName,type AddressOption,type AddressList} from '../../web/src/lib/address-location';
const region={
 provinceId:'31',cityId:'3171',districtId:'317101',areaId:'3171011002',
 province:'DKI JAKARTA',city:'KOTA ADM. JAKARTA PUSAT',district:'GAMBIR',
 area:'PETOJO UTARA',postalCode:'10130',label:'PETOJO UTARA, GAMBIR, JAKARTA PUSAT, DKI JAKARTA, 10130'
};
const addr={
 id:'11111111-2222-4333-8444-000000000001',label:'Kantor',recipientName:'Budi Testing',
 contactName:'Budi Testing',phone:'081234567890',street:'Jalan Cideng Timur 11B',
 unit:'Lantai 2',region,pin:{latitude:-6.16,longitude:106.82,confirmed:true as const}
};
const lookup:AddressList=async (level,parent)=>{
 const data:Record<string,AddressOption[]>={
 provinces:[{id:'31',name:'DKI JAKARTA'}],
 cities:[{id:'3171',name:'KOTA ADMINISTRASI JAKARTA PUSAT',parentId:'31'}],
 districts:[{id:'317101',name:'GAMBIR',parentId:'3171'}],
 areas:[{id:'3171011002',name:'PETOJO UTARA',parentId:'317101',postalCode:'10130'},
        {id:'3171011003',name:'PETOJO SELATAN',parentId:'317101',postalCode:'10160'}]
 };
 assert.ok(!parent||data[level].every(x=>x.parentId===parent));
 return data[level];
};

test('a valid saved address has all location levels, recipient and confirmed pin',()=>{
 assert.equal(validAddressRegion(region),true);
 assert.equal(normalizeSavedAddress(addr)?.label,'Kantor');
 assert.equal(addressStreet(addr),'Jalan Cideng Timur 11B, Lantai 2');
 assert.equal(checkoutAddressLine({...addr,contactName:'Rani Operator'}),'Jalan Cideng Timur 11B, Lantai 2, Kontak lokasi: Rani Operator');
 assert.equal(normalizeSavedAddress({...addr,street:'A'.repeat(290),contactName:'Rani Operator'}),null);
 assert.equal(normalizeSavedAddress({...addr,recipientName:''}),null);
 assert.equal(normalizeSavedAddress({...addr,region:{...region,areaId:''}}),null);
 assert.equal(normalizeSavedAddress({...addr,pin:{latitude:0,longitude:0,confirmed:true}})?.pin,null);
});

test('book picks signed-in default unless session chose another address',()=>{
 const second={...addr,id:'11111111-2222-4333-8444-000000000002',label:'Rumah'};
 const book=validatedBook({version:1,addresses:[addr,second],defaultId:addr.id});
 assert.equal(preferredAddress(book)?.id,addr.id);
 assert.equal(preferredAddress(book,second.id)?.id,second.id);
 assert.equal(readAddressBook({vapmart_address_book_v1:book}).addresses.length,2);
 assert.equal(readAddressBook({vapmart_address_book_v1:{...book,defaultId:'missing'}}).defaultId,addr.id);
 assert.equal(readAddressBook({vapmart_address_book_v1:{...book,addresses:[addr,addr]}}).addresses.length,1);
 assert.throws(()=>validatedBook({...book,addresses:Array(ADDRESS_BOOK_MAX+1).fill(addr)}));
 assert.throws(()=>validatedBook({...book,addresses:[addr,addr]}));
});
test('legacy text profile is shown without inventing missing geographic codes',()=>{
 assert.equal(legacyAccountAddress({address_line:'Jalan Cideng Timur 11B',display_name:'Budi Testing',whatsapp_number:'081234567890'})?.street,'Jalan Cideng Timur 11B');
 assert.equal(legacyAccountAddress({address_line:'Jl A'}),null);
 assert.equal(readAddressBook({address_line:'Jalan Cideng Timur 11B'}).addresses.length,0);
});
test('GPS reverse result matches all five courier levels and fills unique postal',async()=>{
 const raw={
  countryCode:'ID',principalSubdivision:'Jakarta',principalSubdivisionCode:'ID-JK',
  city:'Jakarta Pusat',locality:'Petojo Utara',postcode:'10130',
  localityInfo:{administrative:[
   {adminLevel:4,name:'DKI JAKARTA'},{adminLevel:5,name:'Kota Administrasi Jakarta Pusat'},
   {adminLevel:6,name:'Kecamatan Gambir'},{adminLevel:7,name:'Kelurahan Petojo Utara'}
  ]}
 };
 const path=await pathFromLocation(raw,lookup);
 assert.equal(regionFromPath(path)?.areaId,'3171011002');
 const fallback=await pathFromLocation({...raw,locality:'',localityInfo:{
  administrative:[{adminLevel:4,name:'DKI JAKARTA'},{adminLevel:5,name:'Kota Administrasi Jakarta Pusat'},{adminLevel:6,name:'Gambir'}]
 }},lookup);
 assert.equal(regionFromPath(fallback)?.postalCode,'10130');
 const ambiguous=await pathFromLocation({...raw,postcode:'10131',locality:'',localityInfo:{
  administrative:[{adminLevel:4,name:'DKI JAKARTA'},{adminLevel:5,name:'Kota Administrasi Jakarta Pusat'},{adminLevel:6,name:'Gambir'}]
 }},lookup);
 assert.equal(regionFromPath(ambiguous),null);
 await assert.rejects(()=>pathFromLocation({...raw,countryCode:'SG'},lookup),/luar Indonesia/);
});

test('actual BigDataCloud Jakarta result uses Jawa / ID-JW but province is DKI JAKARTA',async()=>{
 const raw={
  countryCode:'ID',principalSubdivision:'Jawa',principalSubdivisionCode:'ID-JW',
  city:'Jakarta',locality:'Gambir',postcode:'10130',
  localityInfo:{administrative:[
   {adminLevel:2,name:'Indonesia'}, {adminLevel:3,name:'Jawa'},
   {adminLevel:4,name:'Jakarta'},{adminLevel:4,name:'Jakarta'},
   {adminLevel:5,name:'Jakarta Pusat'},{adminLevel:6,name:'Gambir'}
  ]}
 };
 assert.equal(normalizedRegionName('DKI JAKARTA'),normalizedRegionName('Jakarta'));
 const path=await pathFromLocation(raw,lookup);
 assert.equal(path.provinceId,'31');
 assert.equal(path.cityId,'3171');
 assert.equal(path.districtId,'317101');
 assert.equal(regionFromPath(path)?.areaId,'3171011002');
 const partial=await pathFromLocation({...raw,postcode:'10110'},lookup);
 assert.equal(partial.provinceId,'31');
 assert.equal(partial.cityId,'3171');
 assert.equal(partial.districtId,'317101');
 assert.equal(partial.areaId,'');
 assert.equal(locationCompletion(partial),'kelurahan dan kode pos');
});
test('identical Tangerang city labels are disambiguated by the GPS district',async()=>{
 const calls:string[]=[];
 const resolve:AddressList=async(level,parent='')=>{
  calls.push(level+':'+parent);
  if(level==='provinces')return [{id:'36',name:'BANTEN'}];
  if(level==='cities')return [
   {id:'3603',name:'KABUPATEN TANGERANG',parentId:'36'},
   {id:'3671',name:'KOTA TANGERANG',parentId:'36'}
  ];
  if(level==='districts'){
   if(parent==='3603')return [{id:'360301',name:'KELAPA DUA',parentId:'3603'}];
   if(parent==='3671')return [{id:'367101',name:'KARAWACI',parentId:'3671'}];
  }
  if(level==='areas')return [{id:'3671011001',name:'CIMONE',parentId:'367101',postalCode:'15114'}];
  return [];
 };
 const raw={countryCode:'ID',principalSubdivision:'Jawa',principalSubdivisionCode:'ID-JW',
  city:'Tangerang',locality:'Karawaci',postcode:'15114',
  localityInfo:{administrative:[
   {adminLevel:4,name:'Banten'}, {adminLevel:5,name:'Tangerang'},{adminLevel:6,name:'Karawaci'}
  ]}
 };
 const path=await pathFromLocation(raw,resolve);
 assert.equal(path.provinceId,'36');
 assert.equal(path.cityId,'3671');
 assert.equal(path.districtId,'367101');
 assert.equal(path.areaId,'3671011001');
 assert.ok(calls.includes('districts:3603'));
 assert.ok(calls.includes('districts:3671'));
 const ambiguous=await pathFromLocation({...raw,locality:'',
  localityInfo:{administrative:[{adminLevel:4,name:'Banten'},{adminLevel:5,name:'Tangerang'}]}},resolve);
 assert.equal(ambiguous.cityId,'','never silently choose between Kota and Kabupaten');
 assert.equal(locationCompletion(ambiguous),'kota/kabupaten');
});
