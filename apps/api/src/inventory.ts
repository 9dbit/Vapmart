import {BadRequestException,ConflictException,Injectable,NotFoundException} from '@nestjs/common';
import {DatabaseService} from './database';
import type {Principal} from './auth';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reasons=['stock_receipt','adjustment','return'] as const;
export type StockAdjustment={productId:string;delta:number;reason:typeof reasons[number];notes:string;idempotencyKey:string};
export function parseStockAdjustment(raw:unknown):StockAdjustment{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Perubahan stok tidak valid');
 const b=raw as Record<string,unknown>;
 if(Object.keys(b).some(k=>!['productId','delta','reason','notes','idempotencyKey'].includes(k)) ||
 typeof b.productId!=='string'||!uuid.test(b.productId) ||
 typeof b.idempotencyKey!=='string'||!uuid.test(b.idempotencyKey) ||
 !Number.isSafeInteger(b.delta)||Number(b.delta)===0||Math.abs(Number(b.delta))>100000 ||
 typeof b.reason!=='string'||!reasons.includes(b.reason as StockAdjustment['reason']) ||
 typeof b.notes!=='string'||b.notes.trim().length<6||b.notes.length>300)
  throw new BadRequestException('Perubahan stok wajib memiliki ID, delta, alasan, catatan dan kunci unik yang valid');
 if((b.reason==='stock_receipt'||b.reason==='return')&&Number(b.delta)<0)throw new BadRequestException('Penerimaan dan retur harus menambah stok');
 return {productId:b.productId,delta:Number(b.delta),reason:b.reason as StockAdjustment['reason'],notes:b.notes.trim(),idempotencyKey:b.idempotencyKey};
}
@Injectable()
export class InventoryService{
 constructor(private readonly db:DatabaseService){}
 async events(productId:string){
  if(!uuid.test(productId))throw new BadRequestException('Product UUID tidak valid');
  const r=await this.db.query(
   "SELECT e.id,e.product_id,e.delta_qty,e.stock_before,e.stock_after,e.reason,e.notes,e.created_at,e.actor_id FROM product.inventory_events e JOIN product.products p ON p.id=e.product_id WHERE e.product_id=$1 AND p.slug NOT LIKE 'demo-%' ORDER BY e.created_at DESC,e.id DESC LIMIT 100",[productId]);
  return {productId,items:r.rows};
 }
 async adjust(actor:Principal,raw:unknown){
  if(!actor.emailVerified)throw new ConflictException('Verifikasi email admin diperlukan');
  const b=parseStockAdjustment(raw);
  return this.db.transaction(async client=>{
   const row=await client.query<{id:string;slug:string;stock_qty:number}>(
    'SELECT id,slug,stock_qty FROM product.products WHERE id=$1 FOR UPDATE',[b.productId]);
   const p=row.rows[0];if(!p||p.slug.startsWith('demo-'))throw new NotFoundException('Produk tidak tersedia');
   const prior=await client.query<{id:string;delta_qty:number;stock_before:number;stock_after:number;reason:string;notes:string;created_at:string}>(
    'SELECT id,delta_qty,stock_before,stock_after,reason,notes,created_at FROM product.inventory_events WHERE product_id=$1 AND movement_key=$2 LIMIT 1',
    [b.productId,b.idempotencyKey]);
   if(prior.rows[0]){
    const x=prior.rows[0];
    if(x.delta_qty!==b.delta||x.reason!==b.reason||x.notes!==b.notes)throw new ConflictException('Kunci idempotensi sudah digunakan dengan perubahan lain');
    return {movement:x,replayed:true};
   }
   const after=p.stock_qty+b.delta;
   if(!Number.isSafeInteger(after)||after<0||after>2147483647)throw new ConflictException('Stok tidak mencukupi atau melebihi kapasitas');
   await client.query('UPDATE product.products SET stock_qty=$2,updated_at=now() WHERE id=$1',[b.productId,after]);
   const result=await client.query(
    'INSERT INTO product.inventory_events(product_id,delta_qty,reason,actor_id,movement_key,stock_before,stock_after,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,delta_qty,reason,stock_before,stock_after,notes,created_at',
    [b.productId,b.delta,b.reason,actor.id,b.idempotencyKey,p.stock_qty,after,b.notes]);
   return {movement:result.rows[0],replayed:false};
  });
 }
}
