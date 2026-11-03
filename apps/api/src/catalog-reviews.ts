import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import {DatabaseService} from './database';
import type {Principal} from './auth';
import {requireActor,assertVersion,parsePage,pageResult} from './data-integrity';
import {requireUuid,inventoryLock} from './warehouses';
import {catalogAudit} from './catalog-workspace';
import * as V from './catalog-validation';
// Only genuinely delivered, paid, owned order lines can receive a verified review.
const eligibleSQL=`o.customer_user_id=$1 AND o.status IN('paid','fulfilled') AND o.payment_status='paid'
 AND o.payment_provider IS NOT NULL AND o.payment_reference IS NOT NULL
 AND EXISTS(SELECT 1 FROM product.fulfillment_lines fl JOIN product.fulfillment_batches f ON f.id=fl.batch_id JOIN product.shipments s ON s.fulfillment_batch_id=fl.batch_id
 WHERE fl.order_item_id=oi.id AND s.state='delivered' AND f.carrier_handover_at IS NOT NULL AND s.provider_shipment_id IS NOT NULL)`;
@Injectable()
export class CatalogReviewsService{
 constructor(private readonly db:DatabaseService){}
 async eligible(user:Principal){
  requireActor(user);
  const r=await this.db.query(`SELECT oi.id AS order_item_id,oi.order_id,oi.product_id,oi.product_name,oi.sku,coalesce(p.parent_product_id,p.id) root_product_id
 FROM product.order_items oi JOIN product.orders o ON o.id=oi.order_id JOIN product.products p ON p.id=oi.product_id
 WHERE ${eligibleSQL} AND NOT EXISTS(SELECT 1 FROM product.product_reviews r WHERE r.order_item_id=oi.id)
 ORDER BY o.created_at DESC,oi.id DESC LIMIT 100`,[user.id]);return {items:r.rows};
 }
 async create(user:Principal,raw:unknown){
  const who=requireActor(user),x=V.record(raw,['orderItemId','rating','body','displayName']);const line=requireUuid(x.orderItemId,'item pesanan');
  const rating=V.integer(x.rating,'Rating',1,5),body=V.text(x.body,'Ulasan',10,2000),name=V.text(x.displayName,'Nama tampilan',2,60);
  if(/@|https?:\/\//i.test(name))throw new BadRequestException('Gunakan nama tampilan tanpa email atau tautan');
  return this.db.transaction(async client=>{
   const eligible=(await client.query(`SELECT oi.product_id,coalesce(p.parent_product_id,p.id) root_product_id FROM product.order_items oi JOIN product.orders o ON o.id=oi.order_id JOIN product.products p ON p.id=oi.product_id
 WHERE ${eligibleSQL} AND oi.id=$2 FOR UPDATE OF oi`,[who,line])).rows[0];
   if(!eligible)throw new ForbiddenException('Ulasan hanya untuk barang pesanan sendiri yang sudah dibayar dan diterima');
   const old=(await client.query('SELECT id,rating,body,display_name FROM product.product_reviews WHERE order_item_id=$1',[line])).rows[0];
   if(old){if(old.rating===rating&&old.body===body&&old.display_name===name)return {id:old.id,replayed:true};throw new ConflictException('Item ini sudah memiliki ulasan');}
   const review=(await client.query("INSERT INTO product.product_reviews(product_id,purchased_product_id,order_item_id,customer_user_id,display_name,rating,body) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,status",[eligible.root_product_id,eligible.product_id,line,who,name,rating,body])).rows[0];
   await catalogAudit(client,who,'review',review.id,'submit',null,{rating,status:'pending'});return review;
  });
 }
 async list(raw:Record<string,unknown>={}){
  const f=parsePage(raw);if(f.status&&!['pending','approved','rejected','spam','trash'].includes(f.status))throw new BadRequestException('Status review tidak valid');
  const r=await this.db.query(`WITH f AS(SELECT r.*,p.name product_name,p.slug product_slug,oi.order_id,true verified_purchase FROM product.product_reviews r JOIN product.products p ON p.id=r.product_id JOIN product.order_items oi ON oi.id=r.order_item_id
 WHERE ($1='' OR r.status=$1) AND ($2='' OR strpos(lower(concat_ws(' ',r.body,r.display_name,p.name)),lower($2))>0)),s AS(SELECT * FROM f ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC,s.id DESC) FROM s),'[]'::jsonb),'total',(SELECT count(*)::int FROM f)) data`,[f.status,f.q,f.pageSize,(f.page-1)*f.pageSize]);const d=r.rows[0].data;return pageResult(d.items,d.total,f.page,f.pageSize);
 }
 async moderate(actor:Principal,id:string,raw:unknown){
  const who=requireActor(actor),x=V.record(raw,['expectedVersion','status','reply']);requireUuid(id,'review');
  if(!['pending','approved','rejected','spam','trash'].includes(x.status))throw new BadRequestException('Status moderasi tidak valid');const reply=V.text(x.reply??'','Balasan',0,2000);
  return this.db.transaction(async client=>{await inventoryLock(client);const before=(await client.query('SELECT * FROM product.product_reviews WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!before)throw new NotFoundException();assertVersion(before.edit_version,V.version(x.expectedVersion));
   const after=(await client.query('UPDATE product.product_reviews SET status=$2,reply=$3,reply_by=CASE WHEN $3<>reply THEN $4 ELSE reply_by END,reply_at=CASE WHEN $3<>reply THEN now() ELSE reply_at END,edit_version=edit_version+1,updated_at=now() WHERE id=$1 RETURNING *',[id,x.status,reply,who])).rows[0];await catalogAudit(client,who,'review',id,'moderate',before,after);return after;});
 }
 async publicList(slug:string,raw:Record<string,unknown>={}){
  const f=parsePage(raw);const p=(await this.db.query('SELECT id FROM product.products WHERE slug=$1 AND parent_product_id IS NULL AND is_active AND archived_at IS NULL',[slug])).rows[0];if(!p)throw new NotFoundException('Produk tidak ditemukan');
  const r=await this.db.query(`SELECT id,display_name,rating,body,reply,reply_at,created_at,true verified_purchase FROM product.product_reviews WHERE product_id=$1 AND status='approved' ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`,[p.id,f.pageSize,(f.page-1)*f.pageSize]);
  const stats=(await this.db.query("SELECT count(*)::int total,coalesce(round(avg(rating),2),0) average FROM product.product_reviews WHERE product_id=$1 AND status='approved'",[p.id])).rows[0];return {...pageResult(r.rows,stats.total,f.page,f.pageSize),average:Number(stats.average)};
 }
}
