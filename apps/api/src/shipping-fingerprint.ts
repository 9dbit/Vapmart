import {createHash} from 'node:crypto';
export type FingerprintItem={productId:string;quantity:number;unitPriceIdr:number;weightGrams:number};
export function shippingFingerprint(items:FingerprintItem[]){
 const normalized=items.map(item=>{
  if(!Number.isSafeInteger(item.quantity)||item.quantity<1||
   !Number.isSafeInteger(item.unitPriceIdr)||item.unitPriceIdr<0||
   !Number.isSafeInteger(item.weightGrams)||item.weightGrams<1)
    throw new Error('Invalid shipping fingerprint item');
  return [item.productId,item.quantity,item.unitPriceIdr,item.weightGrams];
 }).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}
export function shippingParcelFingerprint(items:Array<FingerprintItem&{lengthCm:number|null;widthCm:number|null;heightCm:number|null}>){
 const dimensions=items.map(i=>[i.productId,i.lengthCm,i.widthCm,i.heightCm]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 return createHash('sha256').update(JSON.stringify([shippingFingerprint(items),dimensions])).digest('hex');
}
