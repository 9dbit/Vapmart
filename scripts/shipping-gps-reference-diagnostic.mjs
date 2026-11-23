const testLocations=[
 {name:'Jakarta-Pusat',latitude:-6.175392,longitude:106.827153},
 {name:'Tangerang',latitude:-6.17831,longitude:106.6282},
 {name:'Bandung',latitude:-6.914744,longitude:107.60981},
 {name:'Surabaya',latitude:-7.257472,longitude:112.75209}
];
const root='https://vapmart.id';
const provincesResponse=await fetch(root+'/api/shipping/areas?level=provinces',{signal:AbortSignal.timeout(12000)});
const provinces=await provincesResponse.json().catch(()=>({}));
console.log('provinces',provincesResponse.status,JSON.stringify((provinces.items||[]).map(x=>({id:x.id,name:x.name}))).slice(0,6000));
for(const loc of testLocations){
 try{
  const r=await fetch(root+'/api/shipping/reverse-location',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({latitude:loc.latitude,longitude:loc.longitude}),
   signal:AbortSignal.timeout(16000)});
  const d=await r.json().catch(()=>({}));
  const admin=(d.localityInfo?.administrative||[]).map(x=>({level:x.adminLevel,name:x.name}));
  console.log(loc.name,JSON.stringify({status:r.status,countryCode:d.countryCode,principalSubdivision:d.principalSubdivision,
   principalSubdivisionCode:d.principalSubdivisionCode,city:d.city,locality:d.locality,
   postcode:d.postcode,admin,message:d.message}));
 }catch(e){console.log(loc.name,'REQUEST_FAILURE',String(e));}
}
