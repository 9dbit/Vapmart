export class CollectionReadError extends Error {
 constructor(public code:string){super('Data tidak dapat dimuat ('+code+'). Silakan coba lagi.');this.name='CollectionReadError';}
}
export async function readCollection<T>(url:string,fetcher:typeof fetch,valid:(row:unknown)=>boolean=()=>true):Promise<T[]> {
 const items:T[]=[];let expected:number|undefined;
 for(let page=1;page<=100;page++){
  const target=new URL(url,'https://local.invalid');target.searchParams.set('page',String(page));target.searchParams.set('pageSize','100');
  const relative=url.startsWith('/');
  let r:Response;try{r=await fetcher(relative?target.pathname+target.search:target.toString(),{cache:'no-store',signal:AbortSignal.timeout(8000)});}
  catch{throw new CollectionReadError('CONNECTION_UNAVAILABLE');}
  if(!r.ok)throw new CollectionReadError(r.status===401?'SESSION_EXPIRED':r.status===403?'ACCESS_DENIED':'SOURCE_UNAVAILABLE');
  let d:unknown;try{d=await r.json();}catch{throw new CollectionReadError('INVALID_RESPONSE');}
  if(!d||typeof d!=='object'||!('items' in d)||!Array.isArray(d.items)||!d.items.every(valid))throw new CollectionReadError('INVALID_RESPONSE');
  const data=d as {items:T[];total?:unknown;page?:unknown;pageSize?:unknown;hasMore?:unknown};
  if(data.total===undefined){if(page!==1)throw new CollectionReadError('INVALID_PAGINATION');return data.items;}
  if(!Number.isSafeInteger(data.total)||Number(data.total)<0||data.page!==page||data.pageSize!==100||typeof data.hasMore!=='boolean')throw new CollectionReadError('INVALID_PAGINATION');
  if(expected!==undefined&&expected!==data.total)throw new CollectionReadError('DATA_CHANGED_RETRY');expected=Number(data.total);
  items.push(...data.items);
  if(!data.hasMore){if(items.length!==expected)throw new CollectionReadError('INCOMPLETE_RESPONSE');return items;}
  if(!data.items.length)throw new CollectionReadError('INCOMPLETE_RESPONSE');
 }
 throw new CollectionReadError('RESULT_TOO_LARGE_USE_FILTER');
}
export async function settleCollection<T>(fn:()=>Promise<T[]>){
 try{return {ok:true as const,items:await fn(),error:null};}
 catch(e){return {ok:false as const,items:[] as T[],error:e instanceof CollectionReadError?e.code:'SOURCE_UNAVAILABLE'};}
}
