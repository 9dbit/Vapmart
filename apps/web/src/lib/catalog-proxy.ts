import {NextRequest,NextResponse} from 'next/server';
const privatePattern=/^(lookups|products(?:\/[0-9a-f-]{36}(?:\/(?:quick|state))?)?|categories(?:\/[0-9a-f-]{36}(?:\/archive)?)?|reviews(?:\/[0-9a-f-]{36}\/moderate)?|imports\/(?:columns|preview|[0-9a-f-]{36}(?:\/apply)?)|orders(?:\/(?:products|[0-9a-f-]{36}(?:\/(?:rates|preview|status|invoice))?))?|vouchers(?:\/[0-9a-f-]{36})?|promotions(?:\/[0-9a-f-]{36})?|analytics\/(?:summary|ledger(?:\.csv)?))$/i;
export async function catalogProxy(req:NextRequest,segments:string[],scope:'admin'|'public'|'customer'){
 const path=segments.join('/');
 const allowed=scope==='admin'?privatePattern.test(path):scope==='public'?/^(categories|selection|reviews\/[a-z0-9-]{1,120})$/.test(path):/^(review-eligible|reviews|orders)$/.test(path);
 if(!allowed)return NextResponse.json({message:'Route tidak ditemukan'},{status:404});
 if(scope==='public'&&req.method!=='GET')return new Response(null,{status:405});
 const base=process.env.API_INTERNAL_URL;if(!base)return NextResponse.json({message:'Layanan belum dikonfigurasi'},{status:503});
 const authorization=req.headers.get('authorization')||'';
 if(scope!=='public'&&!/^Bearer [A-Za-z0-9._~+/=-]+$/.test(authorization))return NextResponse.json({message:'Silakan masuk kembali'},{status:401});
 const limit=path.startsWith('imports/')?13*1024*1024:2900000;let body:Uint8Array|undefined;
 if(req.method!=='GET'){
  if(!req.headers.get('content-type')?.startsWith('application/json'))return NextResponse.json({message:'JSON diperlukan'},{status:415});
  const reader=req.body?.getReader(),chunks:Uint8Array[]=[];let size=0;
  if(reader)try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();return NextResponse.json({message:'Payload terlalu besar'},{status:413});}chunks.push(value);}}finally{reader.releaseLock();}
  body=new Uint8Array(size);let at=0;for(const c of chunks){body.set(c,at);at+=c.length;}
 }
 try{
  const url=new URL('/v1/'+(scope==='admin'?'admin/catalog/':scope==='customer'?'customer/catalog/':'catalog/')+path+req.nextUrl.search,base);
  const r=await fetch(url,{method:req.method,headers:{...(scope!=='public'?{authorization}:{}),'content-type':'application/json'},...(body?{body:body as BodyInit}:{}),cache:'no-store',signal:AbortSignal.timeout(path.endsWith('/apply')?120000:30000)});
  const csv=path==='analytics/ledger.csv'&&r.ok;
  return new Response(csv?await r.arrayBuffer():await r.text(),{status:r.status,headers:{'content-type':csv?'text/csv; charset=utf-8':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff',...(csv?{'content-disposition':'attachment; filename="vapmart-promotion-ledger.csv"'}:{})}});
 }catch{return NextResponse.json({message:'Layanan belum merespons. Coba lagi; permintaan tersimpan tidak digandakan.'},{status:503});}
}
