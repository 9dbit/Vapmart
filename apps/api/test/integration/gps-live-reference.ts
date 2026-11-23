import assert from 'node:assert/strict';
import {pathFromLocation,regionFromPath,type AddressOption,type AddressList} from '../../../web/src/lib/address-location';

const origin='https://vapmart.id';
const fixtures=[
 {name:'Jakarta Pusat',latitude:-6.175392,longitude:106.827153,province:'31',city:'3171'},
 {name:'Kota Tangerang',latitude:-6.17831,longitude:106.6282,province:'36',city:'3671'},
 {name:'Kota Bandung',latitude:-6.914744,longitude:107.60981,province:'32',city:'3273'},
 {name:'Kota Surabaya',latitude:-7.257472,longitude:112.75209,province:'35',city:'3578'}
];
const list:AddressList=async(level,parent='')=>{
 const query=new URLSearchParams({level,parentId:parent});
 const response=await fetch(origin+'/api/shipping/areas?'+query,{signal:AbortSignal.timeout(16000),cache:'no-store'});
 if(!response.ok)throw Error('Wilayah kurir '+level+' gagal HTTP '+response.status);
 const data=await response.json() as {items?:AddressOption[]};
 if(!Array.isArray(data.items))throw Error('Daftar wilayah kurir tidak valid');
 return data.items;
};
async function main(){
for(const fixture of fixtures){
 const response=await fetch(origin+'/api/shipping/reverse-location',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({latitude:fixture.latitude,longitude:fixture.longitude}),
  cache:'no-store',signal:AbortSignal.timeout(16000)
 });
 assert.equal(response.status,200,fixture.name+' reverse geocoder response');
 const raw=await response.json();
 const result=await pathFromLocation(raw,list);
 console.log(fixture.name,'expected='+fixture.province+'/'+fixture.city,
  'resolved='+result.provinceId+'/'+result.cityId+'/'+result.districtId+'/'+result.areaId,
  'complete='+(regionFromPath(result)!==null));
 assert.equal(result.provinceId,fixture.province,'province '+fixture.name);
 assert.equal(result.cityId,fixture.city,'city '+fixture.name);
 assert.ok(result.districtId,'district '+fixture.name);
}
console.log('PASS: 4 real reference GPS points resolved through live reverse geocoder + courier hierarchy');

}
void main().catch(error=>{console.error(error);process.exitCode=1;});
