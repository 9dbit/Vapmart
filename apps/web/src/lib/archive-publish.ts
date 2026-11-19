/** A protected, idempotent archive-to-draft conversion.
 *  This never changes the original archive and NEVER publishes to customers.
 *  The catalog editor's server-side publication checks remain authoritative.
 */
export function archiveEditorUrl(productId:string){
 return '/admin/products/'+encodeURIComponent(productId)+'?from=archive';
}
export async function createArchiveCatalogDraft(token:string,slug:string):Promise<string>{
 if(!token)throw Error('Sesi administrator berakhir. Silakan login kembali.');
 const response=await fetch('/api/admin/product-records/'+encodeURIComponent(slug)+'/convert',{
  method:'POST',
  headers:{authorization:'Bearer '+token,'content-type':'application/json'},
  body:JSON.stringify({confirm:true}),
  cache:'no-store'
 });
 const result=await response.json().catch(()=>({message:'Respons konversi tidak valid'}));
 if(!response.ok||typeof result.productId!=='string'){
  const details=Array.isArray(result.message)?result.message.join(', '):result.message;
  throw Error(details||'Gagal membuat draft katalog dari arsip');
 }
 return result.productId;
}
