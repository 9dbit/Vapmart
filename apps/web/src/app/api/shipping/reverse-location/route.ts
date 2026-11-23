import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const fail=(message:string,status:number)=>NextResponse.json({message},{status,headers:{'Cache-Control':'no-store'}});
const valid=(lat:number,lng:number)=>Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-11.5&&lat<=6.5&&lng>=94.5&&lng<=141.5;

/** Same-origin reverse lookup avoids mobile Safari's third-party CORS blockers.
 * Called only after the customer explicitly grants browser GPS permission.
 * Never retains the coordinates; all responses are non-cacheable.
 */
export async function POST(request:Request){
 let body:unknown;
 try{body=await request.json();}catch{return fail('Lokasi GPS tidak valid.',400);}
 if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).some(k=>!['latitude','longitude'].includes(k)))return fail('Parameter GPS tidak valid.',400);
 const data=body as Record<string,unknown>;
 if(typeof data.latitude!=='number'||typeof data.longitude!=='number'||!valid(data.latitude,data.longitude))
  return fail('Koordinat harus berada di Indonesia.',400);
 const q=new URLSearchParams({
  latitude:data.latitude.toFixed(6),longitude:data.longitude.toFixed(6),localityLanguage:'id'
 });
 try{
  const response=await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?'+q,{
   cache:'no-store',redirect:'error',signal:AbortSignal.timeout(9500),
   headers:{accept:'application/json'}
  });
  if(!response.ok)return fail('Layanan deteksi wilayah sedang tidak tersedia. Pilih secara manual.',502);
  const raw:unknown=await response.json();
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail('Data lokasi tidak valid.',502);
  const x=raw as Record<string,unknown>;
  const info=x.localityInfo&&typeof x.localityInfo==='object'&&!Array.isArray(x.localityInfo)?x.localityInfo as Record<string,unknown>:{};
  const admins=Array.isArray(info.administrative)?info.administrative:[];
  const list=admins.filter(row=>{
   if(!row||typeof row!=='object'||Array.isArray(row))return false;
   const obj=row as Record<string,unknown>;
   return Number.isSafeInteger(obj.adminLevel)&&typeof obj.name==='string'&&obj.name.length<160;
  }).slice(0,24).map(row=>({adminLevel:(row as {adminLevel:number}).adminLevel,name:(row as {name:string}).name}));
  return NextResponse.json({
   countryCode:typeof x.countryCode==='string'?x.countryCode:'',
   principalSubdivision:typeof x.principalSubdivision==='string'?x.principalSubdivision.slice(0,160):'',
   principalSubdivisionCode:typeof x.principalSubdivisionCode==='string'?x.principalSubdivisionCode.slice(0,20):'',
   city:typeof x.city==='string'?x.city.slice(0,160):'',
   locality:typeof x.locality==='string'?x.locality.slice(0,160):'',
   postcode:typeof x.postcode==='string'?x.postcode.slice(0,8):'',
   localityInfo:{administrative:list}
  },{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return fail('Deteksi wilayah gagal. Periksa koneksi atau pilih wilayah secara manual.',502);}
}
