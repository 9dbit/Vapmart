export type PriceInput={price_idr:string|number;sale_price_idr?:string|number|null;sale_starts_at?:Date|string|null;sale_ends_at?:Date|string|null};
export function effectivePrice(p:PriceInput,now=Date.now()):number{
 const regular=Number(p.price_idr),sale=p.sale_price_idr===null||p.sale_price_idr===undefined?null:Number(p.sale_price_idr);
 const start=p.sale_starts_at?new Date(p.sale_starts_at).valueOf():null,end=p.sale_ends_at?new Date(p.sale_ends_at).valueOf():null;
 return sale!==null&&Number.isSafeInteger(sale)&&sale>=0&&sale<regular&&(start===null||start<=now)&&(end===null||now<end)?sale:regular;
}
export function publicPrice<T extends PriceInput>(p:T,now=Date.now()){
 const regular_price_idr=Number(p.price_idr),price_idr=effectivePrice(p,now);
 return {...p,regular_price_idr,price_idr,promo_active:price_idr<regular_price_idr};
}
// Every checkout and shipping lookup uses this same sellable-SKU predicate.
export const sellableSQL=`p.archived_at IS NULL AND p.is_active AND p.product_type<>'variable' AND p.slug NOT LIKE 'demo-%'
 AND (p.parent_product_id IS NULL OR EXISTS(SELECT 1 FROM product.products parent WHERE parent.id=p.parent_product_id AND parent.is_active AND parent.archived_at IS NULL))`;
