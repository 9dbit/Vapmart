import {BadRequestException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {DatabaseService} from './database';
import type {Principal} from './auth';
export const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const membershipRoles=['owner','manager','viewer'] as const;
export function parseBrandMembership(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new BadRequestException('Data anggota brand tidak valid');
 const body=value as Record<string,unknown>;
 if(Object.keys(body).some(k=>!['userId','role','isActive'].includes(k))||
 typeof body.userId!=='string'||!uuidPattern.test(body.userId)||
 typeof body.role!=='string'||!membershipRoles.includes(body.role as typeof membershipRoles[number])||
 ('isActive' in body&&typeof body.isActive!=='boolean'))throw new BadRequestException('Role atau ID anggota brand tidak valid');
 return {userId:body.userId,role:body.role,isActive:body.isActive!==false};
}
@Injectable()
export class BrandPortalService{
 constructor(private readonly db:DatabaseService){}
 async myBrands(user:Principal){
  if(!user.emailVerified)throw new ForbiddenException('Verifikasi email diperlukan');
  const result=await this.db.query(
   'SELECT b.id,b.name,b.slug,m.role FROM product.brand_memberships m JOIN product.brands b ON b.id=m.brand_id WHERE m.user_id=$1 AND m.is_active=true AND b.is_active=true ORDER BY b.name',[user.id]);
  return {brands:result.rows,scope:'assigned_brands_only'};
 }
 private async grant(user:Principal,brandId:string){
  if(!uuidPattern.test(brandId))throw new BadRequestException('ID brand tidak valid');
  if(!user.emailVerified)throw new ForbiddenException('Verifikasi email diperlukan');
  const r=await this.db.query('SELECT m.role FROM product.brand_memberships m JOIN product.brands b ON b.id=m.brand_id WHERE m.user_id=$1 AND m.brand_id=$2 AND m.is_active=true AND b.is_active=true LIMIT 1',[user.id,brandId]);
  if(!r.rows[0])throw new ForbiddenException('Akses brand tidak tersedia');
  return r.rows[0].role as string;
 }
 async assertCanManageFulfillment(user:Principal,brandId:string){
  const role=await this.grant(user,brandId);
  if(role!=='owner'&&role!=='manager')throw new ForbiddenException('Hanya Owner atau Manager yang dapat memperbarui proses fulfillment');
  return {brandId,role};
 }
 private async paidSales(brandId:string){
  const r=await this.db.query(`SELECT count(DISTINCT o.id)::text AS paid_orders,coalesce(sum(oi.quantity),0)::text AS units_sold,
   coalesce(sum(oi.quantity*oi.unit_price_idr),0)::text AS gross_item_sales_idr
   FROM product.order_items oi JOIN product.orders o ON o.id=oi.order_id
   WHERE oi.brand_id=$1 AND o.payment_status='paid' AND o.payment_provider IS NOT NULL
    AND o.payment_reference IS NOT NULL AND o.status IN ('paid','fulfilled')`,[brandId]);
  return r.rows[0]||{paid_orders:'0',units_sold:'0',gross_item_sales_idr:'0'};
 }
 async overview(user:Principal,brandId:string){
  const role=await this.grant(user,brandId);
  const r=await this.db.query<{products:number;published:number;total_stock:string;low_stock:number}>(
   "SELECT count(*)::integer products,count(*) FILTER (WHERE is_active)::integer published,coalesce(sum(stock_qty),0)::text total_stock,count(*) FILTER (WHERE stock_qty<=5)::integer low_stock FROM product.products WHERE brand_id=$1 AND slug NOT LIKE 'demo-%'",[brandId]);
  return {brandId,role,inventory:r.rows[0],sales:await this.paidSales(brandId),salesBasis:'verified_paid_item_gross',paymentEnabled:false};
 }
 async products(user:Principal,brandId:string){
  await this.grant(user,brandId);
  const r=await this.db.query(
   "SELECT id,sku,name,price_idr::text,stock_qty,is_active,weight_grams,updated_at FROM product.products WHERE brand_id=$1 AND slug NOT LIKE 'demo-%' ORDER BY updated_at DESC LIMIT 500",[brandId]);
  return {brandId,items:r.rows,scope:'brand_only'};
 }
 async sales(user:Principal,brandId:string){
  await this.grant(user,brandId);
  const r=await this.db.query(`SELECT oi.product_id,oi.sku,oi.product_name AS name,sum(oi.quantity)::text AS units_sold,
    sum(oi.quantity*oi.unit_price_idr)::text AS gross_item_sales_idr
   FROM product.order_items oi JOIN product.orders o ON o.id=oi.order_id
   WHERE oi.brand_id=$1 AND o.payment_status='paid' AND o.payment_provider IS NOT NULL
    AND o.payment_reference IS NOT NULL AND o.status IN ('paid','fulfilled')
   GROUP BY oi.product_id,oi.sku,oi.product_name ORDER BY oi.product_name,oi.product_id`,[brandId]);
  return {brandId,items:r.rows,scope:'brand_only',salesBasis:'verified_paid_brand_snapshot',settlementAvailable:false};
 }
 async warehouseStock(user:Principal,brandId:string){
  await this.grant(user,brandId);
  const r=await this.db.query(
   "SELECT w.code,w.name AS warehouse_name,w.city,p.id AS product_id,p.sku,p.name AS product_name,s.on_hand,s.reserved,(s.on_hand-s.reserved) AS available,w.is_dispatch_enabled FROM product.warehouse_stock s JOIN product.products p ON p.id=s.product_id JOIN product.warehouses w ON w.id=s.warehouse_id WHERE p.brand_id=$1 AND NOT w.is_system_hold AND p.slug NOT LIKE 'demo-%' ORDER BY p.name,w.code LIMIT 500",
   [brandId]);
  return {brandId,items:r.rows,readOnly:true,customerDataExcluded:true};
 }
 async fulfillment(user:Principal,brandId:string){
  await this.grant(user,brandId);
  const r=await this.db.query(
   "SELECT f.id,f.order_id,f.state,w.code AS warehouse_code,f.created_at,s.state AS carrier_state,s.provider_status,s.tracking_number,(SELECT coalesce(sum(l.quantity),0)::integer FROM product.fulfillment_lines l WHERE l.batch_id=f.id) AS units FROM product.fulfillment_batches f JOIN product.warehouses w ON w.id=f.warehouse_id LEFT JOIN product.shipments s ON s.fulfillment_batch_id=f.id WHERE f.brand_id=$1 ORDER BY f.created_at DESC LIMIT 100",
   [brandId]);
  return {brandId,items:r.rows,readOnly:true,customerDataExcluded:true,courierBookingEnabled:false,providerTrackingIsReadOnly:true};
 }
 async members(brandId:string){
  if(!uuidPattern.test(brandId))throw new BadRequestException('ID brand tidak valid');
  const r=await this.db.query('SELECT m.user_id,m.role,m.is_active,m.created_at FROM product.brand_memberships m WHERE m.brand_id=$1 ORDER BY m.created_at DESC LIMIT 100',[brandId]);
  return {brandId,items:r.rows};
 }
 async setMember(actor:Principal,brandId:string,payload:unknown){
  if(!uuidPattern.test(brandId))throw new BadRequestException('ID brand tidak valid');
  const body=parseBrandMembership(payload);
  return this.db.transaction(async client=>{
   const brand=await client.query('SELECT 1 FROM product.brands WHERE id=$1',[brandId]);
   if(!brand.rows[0])throw new NotFoundException('Brand tidak ditemukan');
   const existing=await client.query('SELECT 1 FROM product.brand_memberships WHERE brand_id=$1 AND user_id=$2 FOR UPDATE',[brandId,body.userId]);
   if(!existing.rows[0])throw new ForbiddenException('Gunakan undangan email terverifikasi untuk anggota baru');
   const r=await client.query(
    'INSERT INTO product.brand_memberships(brand_id,user_id,role,is_active,added_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(brand_id,user_id) DO UPDATE SET role=excluded.role,is_active=excluded.is_active,updated_at=now() RETURNING brand_id,user_id,role,is_active',
    [brandId,body.userId,body.role,body.isActive,actor.id]);
   await client.query('INSERT INTO product.brand_access_audit(brand_id,user_id,actor_id,role,is_active) VALUES($1,$2,$3,$4,$5)',[brandId,body.userId,actor.id,body.role,body.isActive]);
   return r.rows[0];
  });
 }
}
