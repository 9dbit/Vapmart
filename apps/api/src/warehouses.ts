import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import type {PoolClient} from 'pg';
import {DatabaseService} from './database';
import type {Principal} from './auth';

export const validUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function requireUuid(value:unknown,label:string):string{
 if(typeof value!=='string'||!validUuid.test(value))throw new BadRequestException('Invalid '+label);
 return value;
}
function object(input:unknown,allowed:string[]):Record<string,unknown>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Request object required');
 const data=input as Record<string,unknown>;
 if(Object.keys(data).some(k=>!allowed.includes(k)))throw new BadRequestException('Unexpected warehouse field');
 return data;
}
export function parseWarehouse(raw:unknown){
 const x=object(raw,['code','name','address','city','province','postalCode']);
 const code=String(x.code||'').trim().toUpperCase(),name=String(x.name||'').trim();
 const address=String(x.address||'').trim(),city=String(x.city||'').trim(),province=String(x.province||'').trim();
 const postalCode=x.postalCode===undefined||x.postalCode===''?null:x.postalCode;
 if(!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(code)||name.length<2||name.length>100||address.length>300||city.length>100||province.length>100||
  (postalCode!==null&&(typeof postalCode!=='string'||!/^[0-9]{5}$/.test(postalCode))))
  throw new BadRequestException('Invalid warehouse code, name or postal address');
 return {code,name,address,city,province,postalCode};
}
export function parseWarehousePatch(raw:unknown){
 const x=object(raw,['name','address','city','province','postalCode','isActive','dispatchEnabled']);
 if(!Object.keys(x).length)throw new BadRequestException('No warehouse changes');
 const out:Record<string,unknown>={};
 for(const field of ['name','address','city','province'] as const)if(field in x){
  if(typeof x[field]!=='string'||String(x[field]).trim().length>(field==='address'?300:100)||
   (field==='name'&&String(x[field]).trim().length<2))throw new BadRequestException('Invalid '+field);
  out[field]=String(x[field]).trim();
 }
 if('postalCode' in x){
  if(x.postalCode!==null&&(typeof x.postalCode!=='string'||!/^[0-9]{5}$/.test(x.postalCode)))throw new BadRequestException('Invalid postal code');
  out.postalCode=x.postalCode;
 }
 for(const field of ['isActive','dispatchEnabled'] as const)if(field in x){
  if(typeof x[field]!=='boolean')throw new BadRequestException('Invalid '+field);
  out[field]=x[field];
 }
 return out;
}
export function parseWarehouseMovement(raw:unknown){
 const x=object(raw,['warehouseId','productId','delta','reason','notes','idempotencyKey']);
 const warehouseId=requireUuid(x.warehouseId,'warehouse'),productId=requireUuid(x.productId,'product'),idempotencyKey=requireUuid(x.idempotencyKey,'movement');
 if(!Number.isSafeInteger(x.delta)||Number(x.delta)===0||Math.abs(Number(x.delta))>100000 ||
  !['receipt','adjustment','return'].includes(String(x.reason)) ||
  typeof x.notes!=='string'||x.notes.trim().length<6||x.notes.length>300)
  throw new BadRequestException('Provide a signed quantity, reason and documented stock note');
 const delta=Number(x.delta),reason=x.reason as 'receipt'|'adjustment'|'return';
 if(reason!=='adjustment'&&delta<0)throw new BadRequestException('Receipt and return must add physical inventory');
 return {warehouseId,productId,idempotencyKey,delta,reason,notes:x.notes.trim()};
}
export function parseWarehouseTransfer(raw:unknown){
 const x=object(raw,['fromWarehouseId','toWarehouseId','productId','quantity','notes','idempotencyKey']);
 const fromWarehouseId=requireUuid(x.fromWarehouseId,'source warehouse');
 const toWarehouseId=requireUuid(x.toWarehouseId,'destination warehouse');
 const productId=requireUuid(x.productId,'product'),idempotencyKey=requireUuid(x.idempotencyKey,'transfer');
 if(fromWarehouseId===toWarehouseId||!Number.isSafeInteger(x.quantity)||Number(x.quantity)<1||Number(x.quantity)>100000||
   typeof x.notes!=='string'||x.notes.trim().length<6||x.notes.length>300)
  throw new BadRequestException('Invalid physical warehouse transfer');
 return {fromWarehouseId,toWarehouseId,productId,idempotencyKey,quantity:Number(x.quantity),notes:x.notes.trim()};
}
type Balance={warehouse_id:string;product_id:string;on_hand:number;reserved:number};
export async function inventoryLock(client:PoolClient){await client.query('SELECT pg_advisory_xact_lock(2026110202)');}
export async function refreshProductAvailability(client:PoolClient,ids:string[]){
 for(const id of [...new Set(ids)].sort()){
  await client.query(
   `UPDATE product.products SET stock_qty=COALESCE((
     SELECT sum(s.on_hand-s.reserved)::integer FROM product.warehouse_stock s
     JOIN product.warehouses w ON w.id=s.warehouse_id
     WHERE s.product_id=$1 AND w.is_active=true AND w.is_dispatch_enabled=true),0),updated_at=now()
    WHERE id=$1`,[id]);
 }
}
export async function ensureBalance(client:PoolClient,warehouseId:string,productId:string):Promise<Balance>{
 await client.query('INSERT INTO product.warehouse_stock(warehouse_id,product_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[warehouseId,productId]);
 const row=await client.query<Balance>('SELECT warehouse_id,product_id,on_hand,reserved FROM product.warehouse_stock WHERE warehouse_id=$1 AND product_id=$2 FOR UPDATE',[warehouseId,productId]);
 return row.rows[0];
}
export async function writeEvent(client:PoolClient,x:{row:Balance;deltaHand:number;deltaReserved:number;reason:string;notes:string;actor:string;key?:string|null;batchId?:string|null}){
 const afterHand=x.row.on_hand+x.deltaHand,afterReserved=x.row.reserved+x.deltaReserved;
 if(!Number.isSafeInteger(afterHand)||!Number.isSafeInteger(afterReserved)||afterHand<0||afterReserved<0||afterReserved>afterHand||afterHand>2147483647)
  throw new ConflictException('Warehouse balance insufficient or exceeded');
 await client.query('UPDATE product.warehouse_stock SET on_hand=$3,reserved=$4,updated_at=now() WHERE warehouse_id=$1 AND product_id=$2',
   [x.row.warehouse_id,x.row.product_id,afterHand,afterReserved]);
 const event=await client.query(
  'INSERT INTO product.warehouse_stock_events(warehouse_id,product_id,delta_on_hand,delta_reserved,on_hand_before,on_hand_after,reserved_before,reserved_after,reason,notes,actor_id,movement_key,batch_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id,warehouse_id,product_id,delta_on_hand,delta_reserved,on_hand_before,on_hand_after,reserved_before,reserved_after,reason,notes,created_at',
  [x.row.warehouse_id,x.row.product_id,x.deltaHand,x.deltaReserved,x.row.on_hand,afterHand,x.row.reserved,afterReserved,x.reason,x.notes,x.actor,x.key||null,x.batchId||null]);
 return event.rows[0];
}
@Injectable()
export class WarehouseService{
 constructor(private readonly db:DatabaseService){}
 async list(){
  const [warehouses,stock]=await Promise.all([
   this.db.query('SELECT id,code,name,city,province,address_line,postal_code,is_active,is_dispatch_enabled,is_system_hold,created_at FROM product.warehouses ORDER BY is_system_hold,code'),
   this.db.query(`SELECT s.warehouse_id,s.product_id,p.sku,p.name AS product_name,p.brand_id,b.name AS brand_name,
    s.on_hand,s.reserved,(s.on_hand-s.reserved) AS available,w.is_dispatch_enabled,w.is_system_hold
    FROM product.warehouse_stock s JOIN product.products p ON p.id=s.product_id
    JOIN product.warehouses w ON w.id=s.warehouse_id LEFT JOIN product.brands b ON b.id=p.brand_id
    WHERE p.slug NOT LIKE 'demo-%' ORDER BY w.code,p.name LIMIT 1000`)
  ]);
  return {warehouses:warehouses.rows,stock:stock.rows,dispatchBookingEnabled:false,paymentEnabled:false};
 }
 async create(actor:Principal,body:unknown){
  if(!actor.emailVerified)throw new ForbiddenException('Verified admin required');
  const d=parseWarehouse(body);
  const r=await this.db.query(
   "INSERT INTO product.warehouses(code,name,address_line,city,province,postal_code,is_active,is_dispatch_enabled) VALUES($1,$2,$3,$4,$5,$6,true,false) RETURNING id,code,name,city,province,postal_code,is_dispatch_enabled",
   [d.code,d.name,d.address,d.city,d.province,d.postalCode]);
  return {warehouse:r.rows[0],dispatchReady:false};
 }
 async update(actor:Principal,id:string,body:unknown){
  requireUuid(id,'warehouse');
  if(!actor.emailVerified)throw new ForbiddenException('Verified admin required');
  const input=parseWarehousePatch(body);
  return this.db.transaction(async client=>{
   await inventoryLock(client);
   const r=await client.query<{id:string;is_system_hold:boolean;name:string;address_line:string;city:string;province:string;postal_code:string|null;is_active:boolean;is_dispatch_enabled:boolean}>(
    'SELECT id,name,address_line,city,province,postal_code,is_active,is_dispatch_enabled,is_system_hold FROM product.warehouses WHERE id=$1 FOR UPDATE',[id]);
   const w=r.rows[0];if(!w)throw new NotFoundException('Warehouse not found');
   if(w.is_system_hold)throw new ForbiddenException('System hold is permanently non-dispatchable');
   const name=input.name===undefined?w.name:String(input.name);
   const address=input.address===undefined?w.address_line:String(input.address);
   const city=input.city===undefined?w.city:String(input.city);
   const province=input.province===undefined?w.province:String(input.province);
   const postcode=input.postalCode===undefined?w.postal_code:input.postalCode;
   const active=input.isActive===undefined?w.is_active:Boolean(input.isActive);
   const dispatch=input.dispatchEnabled===undefined?w.is_dispatch_enabled:Boolean(input.dispatchEnabled);
   if(dispatch&&(!active||typeof postcode!=='string'||!/^[0-9]{5}$/.test(postcode)||city.length<2||province.length<2||address.length<8))
    throw new BadRequestException('Complete verified warehouse address and postal code before dispatch');
   if((!active||!dispatch)&&w.is_dispatch_enabled){
    const reservations=await client.query<{count:string}>('SELECT coalesce(sum(reserved),0)::text AS count FROM product.warehouse_stock WHERE warehouse_id=$1',[id]);
    if(Number(reservations.rows[0]?.count||0)>0)throw new ConflictException('Release all fulfillment reservations before disabling this warehouse');
   }
   const updated=await client.query(
    'UPDATE product.warehouses SET name=$2,address_line=$3,city=$4,province=$5,postal_code=$6,is_active=$7,is_dispatch_enabled=$8,updated_at=now() WHERE id=$1 RETURNING id,code,name,city,province,postal_code,is_active,is_dispatch_enabled',
    [id,name,address,city,province,postcode,active,dispatch]);
   const products=await client.query<{product_id:string}>('SELECT product_id FROM product.warehouse_stock WHERE warehouse_id=$1',[id]);
   await refreshProductAvailability(client,products.rows.map(x=>x.product_id));
   return {warehouse:updated.rows[0],availabilityRecalculated:products.rows.length};
  });
 }
 async adjust(actor:Principal,raw:unknown){
  if(!actor.emailVerified)throw new ForbiddenException('Verified admin required');
  const b=parseWarehouseMovement(raw);
  return this.db.transaction(async client=>{
   await inventoryLock(client);
   const product=await client.query<{id:string;slug:string}>('SELECT id,slug FROM product.products WHERE id=$1 FOR UPDATE',[b.productId]);
   if(!product.rows[0]||product.rows[0].slug.startsWith('demo-'))throw new NotFoundException('Product not found');
   const warehouse=await client.query<{is_active:boolean;is_system_hold:boolean}>('SELECT is_active,is_system_hold FROM product.warehouses WHERE id=$1 FOR UPDATE',[b.warehouseId]);
   if(!warehouse.rows[0]||!warehouse.rows[0].is_active||warehouse.rows[0].is_system_hold)throw new ConflictException('Use warehouse transfer to reconcile legacy hold');
   const previous=await client.query<{id:string;delta_on_hand:number;reason:string;notes:string;on_hand_after:number}>(
    'SELECT id,delta_on_hand,reason,notes,on_hand_after FROM product.warehouse_stock_events WHERE warehouse_id=$1 AND product_id=$2 AND movement_key=$3',
    [b.warehouseId,b.productId,b.idempotencyKey]);
   if(previous.rows[0]){
    const x=previous.rows[0];if(x.delta_on_hand!==b.delta||x.reason!==b.reason||x.notes!==b.notes)throw new ConflictException('Movement key already used for a different adjustment');
    return {movement:x,replayed:true};
   }
   const balance=await ensureBalance(client,b.warehouseId,b.productId);
   const movement=await writeEvent(client,{row:balance,deltaHand:b.delta,deltaReserved:0,reason:b.reason,notes:b.notes,actor:actor.id,key:b.idempotencyKey});
   await refreshProductAvailability(client,[b.productId]);
   return {movement,replayed:false};
  });
 }
 async transfer(actor:Principal,raw:unknown){
  if(!actor.emailVerified)throw new ForbiddenException('Verified admin required');
  const b=parseWarehouseTransfer(raw);
  return this.db.transaction(async client=>{
   await inventoryLock(client);
   const prior=await client.query<{id:string;product_id:string;from_warehouse_id:string;to_warehouse_id:string;quantity:number;notes:string}>(
    'SELECT id,product_id,from_warehouse_id,to_warehouse_id,quantity,notes FROM product.warehouse_transfers WHERE movement_key=$1',[b.idempotencyKey]);
   if(prior.rows[0]){
    const x=prior.rows[0];
    if(x.product_id!==b.productId||x.from_warehouse_id!==b.fromWarehouseId||x.to_warehouse_id!==b.toWarehouseId||x.quantity!==b.quantity||x.notes!==b.notes)
     throw new ConflictException('Transfer key used with different details');
    return {transfer:x,replayed:true};
   }
   const p=await client.query<{slug:string}>('SELECT slug FROM product.products WHERE id=$1 FOR UPDATE',[b.productId]);
   if(!p.rows[0]||p.rows[0].slug.startsWith('demo-'))throw new NotFoundException('Product not found');
   const ws=await client.query<{id:string;is_active:boolean;is_system_hold:boolean}>(
    'SELECT id,is_active,is_system_hold FROM product.warehouses WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
    [[b.fromWarehouseId,b.toWarehouseId]]);
   if(ws.rows.length!==2||!ws.rows.find(x=>x.id===b.toWarehouseId)?.is_active||
    ws.rows.find(x=>x.id===b.toWarehouseId)?.is_system_hold)throw new ConflictException('Destination must be an active physical warehouse');
   const balances=new Map<string,Balance>();
   for(const id of [b.fromWarehouseId,b.toWarehouseId].sort())balances.set(id,await ensureBalance(client,id,b.productId));
   const from=balances.get(b.fromWarehouseId)!,to=balances.get(b.toWarehouseId)!;
   if(from.on_hand-from.reserved<b.quantity)throw new ConflictException('Insufficient unreserved stock in source warehouse');
   await writeEvent(client,{row:from,deltaHand:-b.quantity,deltaReserved:0,reason:'transfer_out',notes:b.notes,actor:actor.id});
   await writeEvent(client,{row:to,deltaHand:b.quantity,deltaReserved:0,reason:'transfer_in',notes:b.notes,actor:actor.id});
   const transfer=await client.query(
    'INSERT INTO product.warehouse_transfers(movement_key,product_id,from_warehouse_id,to_warehouse_id,quantity,notes,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,product_id,from_warehouse_id,to_warehouse_id,quantity,notes,created_at',
    [b.idempotencyKey,b.productId,b.fromWarehouseId,b.toWarehouseId,b.quantity,b.notes,actor.id]);
   await refreshProductAvailability(client,[b.productId]);
   return {transfer:transfer.rows[0],replayed:false};
  });
 }
 async events(warehouseId:string,productId:string){
  requireUuid(warehouseId,'warehouse');requireUuid(productId,'product');
  const result=await this.db.query(
   'SELECT id,warehouse_id,product_id,delta_on_hand,delta_reserved,on_hand_before,on_hand_after,reserved_before,reserved_after,reason,notes,created_at FROM product.warehouse_stock_events WHERE warehouse_id=$1 AND product_id=$2 ORDER BY created_at DESC,id DESC LIMIT 100',
   [warehouseId,productId]);
  return {items:result.rows};
 }
 async brandStocks(brandId:string){
  requireUuid(brandId,'brand');
  const result=await this.db.query(
   "SELECT w.code,w.name AS warehouse_name,w.city,s.product_id,p.sku,p.name AS product_name,s.on_hand,s.reserved,(s.on_hand-s.reserved) AS available,w.is_dispatch_enabled FROM product.warehouse_stock s JOIN product.products p ON p.id=s.product_id JOIN product.warehouses w ON w.id=s.warehouse_id WHERE p.brand_id=$1 AND p.slug NOT LIKE 'demo-%' AND NOT w.is_system_hold ORDER BY p.name,w.code LIMIT 500",
   [brandId]);
  return {items:result.rows,readOnly:true};
 }
}
