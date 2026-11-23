import test from 'node:test';
import assert from 'node:assert/strict';
import {
 readAddressBook,validatedBook,preferredAddress,legacyAccountAddress,
 normalizeSavedAddress,validAddressRegion,ADDRESS_BOOK_MAX,addressStreet
} from '../../web/src/lib/delivery-address-book';
import {pathFromLocation,regionFromPath,type AddressOption,type AddressList} from '../../web/src/lib/address-location';
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
