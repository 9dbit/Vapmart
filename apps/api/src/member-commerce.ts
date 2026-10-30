import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {DatabaseService} from './database';
import type {Principal} from './auth';

export const PACKS=[
 {sku:'MEMBER-ACTIVATION',type:'membership_activation',priceIdr:100000,coinCredit:100000},
 {sku:'COIN-050',type:'coin_pack',priceIdr:50000,coinCredit:50000},
 {sku:'COIN-100',type:'coin_pack',priceIdr:100000,coinCredit:100000},
 {sku:'COIN-300',type:'coin_pack',priceIdr:300000,coinCredit:300000},
 {sku:'COIN-500',type:'coin_pack',priceIdr:500000,coinCredit:500000},
 {sku:'COIN-1000',type:'coin_pack',priceIdr:1000000,coinCredit:1000000},
 {sku:'COIN-2000',type:'coin_pack',priceIdr:2000000,coinCredit:2000000}
] as const;
export function digitalEnabled(){
 return process.env.DIGITAL_COMMERCE_ENABLED==='true' &&
        process.env.PAYMENT_MODE==='sandbox' &&
        process.env.RAILWAY_ENVIRONMENT_NAME==='staging';
}
export function validateOrder(body:unknown){
 if(!body||typeof body!=='object'||Array.isArray(body))throw new BadRequestException('Invalid payload');
 const b=body as Record<string,unknown>;
 if(Object.keys(b).some(k=>!['sku','idempotencyKey'].includes(k)))
   throw new BadRequestException('Unknown order field');
 if(typeof b.sku!=='string'||!PACKS.some(p=>p.sku===b.sku))
   throw new BadRequestException('Unknown SKU');
 if(typeof b.idempotencyKey!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.idempotencyKey))
   throw new BadRequestException('Idempotency key must be UUID');
 return {sku:b.sku,idempotencyKey:b.idempotencyKey};
}
@Injectable()
export class MemberCommerceService{
 constructor(private readonly db:DatabaseService){}
 packs(){return {items:PACKS,checkoutEnabled:digitalEnabled()};}
 async overview(user:Principal){
  if(!this.db.configured)throw new ServiceUnavailableException('Member database unavailable');
  try {
   const [r,tx,promos]=await Promise.all([
    this.db.query<{status:string;available_coins:string;display_name:string|null;card_last4:string|null}>(
     `SELECT COALESCE(m.status,'REGISTERED') status, COALESCE(w.available_coins,0)::text available_coins,
       p.display_name, right(replace(c.id::text,'-',''),4) card_last4
       FROM (SELECT $1::uuid AS user_id) q
       LEFT JOIN public.customer_profiles p ON p.user_id=q.user_id
       LEFT JOIN membership.accounts m ON m.user_id=q.user_id
       LEFT JOIN wallet.accounts w ON w.user_id=q.user_id
       LEFT JOIN membership.cards c ON c.user_id=q.user_id`,[user.id]),
    this.db.query<{id:string;delta_coins:string;memo:string;created_at:string}>(
      "SELECT id,delta_coins::text,memo,created_at::text FROM wallet.ledger_entries WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30",[user.id]),
    this.db.query<{title:string;description:string;ends_at:string}>(
      "SELECT title,description,ends_at::text FROM promotion.events WHERE status='published' AND member_only=true AND starts_at<=now() AND ends_at>now() ORDER BY ends_at LIMIT 10")
   ]);
   const row=r.rows[0];
   return {
     status:row?.status??'REGISTERED',
     balanceCoin:Number(row?.available_coins??0),
     name:row?.display_name??user.email?.split('@')[0]??null,
     cardLast4:row?.card_last4??null,
     benefits:row?.status==='ACTIVE'?promos.rows.map(x=>({title:x.title,description:x.description,endsAt:x.ends_at})):[],
     transactions:tx.rows.map(x=>({id:x.id,coins:Number(x.delta_coins),description:x.memo,createdAt:x.created_at}))
   };
  }catch{
   throw new ServiceUnavailableException({code:'MEMBERSHIP_SCHEMA_REQUIRED'});
  }
 }
 async createOrder(user:Principal,input:unknown){
   if(!digitalEnabled())throw new ServiceUnavailableException({code:'DIGITAL_PAYMENT_DISABLED'});
   const {sku,idempotencyKey}=validateOrder(input);
   if(!user.email)throw new ForbiddenException('Verified email required');
   return this.db.transaction(async client=>{
     await client.query(
      "INSERT INTO public.customer_profiles(user_id,email) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,updated_at=now()",
      [user.id,user.email]);
     await client.query("INSERT INTO membership.accounts(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING",[user.id]);
     await client.query("INSERT INTO wallet.accounts(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING",[user.id]);
     const existing=await client.query<{id:string;sku:string;status:string;amount_idr:string;credit_coins:string}>(
      "SELECT id,sku,status,amount_idr::text,credit_coins::text FROM commerce.digital_orders WHERE user_id=$1 AND idempotency_key=$2",
      [user.id,idempotencyKey]);
     if(existing.rows[0]){
       if(existing.rows[0].sku!==sku)throw new ConflictException('Idempotency key already used');
       return {id:existing.rows[0].id,status:existing.rows[0].status};
     }
     const r=await client.query<{price_idr:string;credit_coins:string}>(
       "SELECT price_idr::text,credit_coins::text FROM commerce.digital_catalog WHERE sku=$1 AND is_active=true",[sku]);
     if(!r.rows[0])throw new NotFoundException('Pack unavailable');
     if(sku==='MEMBER-ACTIVATION'){
       const m=await client.query<{status:string}>("SELECT status FROM membership.accounts WHERE user_id=$1 FOR UPDATE",[user.id]);
       if(m.rows[0]?.status==='ACTIVE')throw new ConflictException('Membership already active');
       if(m.rows[0]?.status==='SUSPENDED')throw new ForbiddenException('Account suspended');
     }
     const outstanding=await client.query<{total:string}>(
       "SELECT count(*)::text AS total FROM commerce.digital_orders WHERE user_id=$1 AND status='pending' AND created_at>now()-interval '24 hours'",[user.id]);
     if(Number(outstanding.rows[0]?.total??0)>=5)throw new ConflictException('Too many pending orders');
     const order=await client.query<{id:string;status:string}>(
       "INSERT INTO commerce.digital_orders(user_id,sku,amount_idr,credit_coins,idempotency_key) VALUES($1,$2,$3,$4,$5) RETURNING id,status",
       [user.id,sku,r.rows[0].price_idr,r.rows[0].credit_coins,idempotencyKey]);
     return order.rows[0];
   });
 }
 async getOrder(user:Principal,id:string){
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw new BadRequestException('Invalid ID');
   const r=await this.db.query(
     "SELECT id,sku,status,amount_idr::text,credit_coins::text FROM commerce.digital_orders WHERE id=$1 AND user_id=$2",[id,user.id]);
   if(!r.rows.length)throw new NotFoundException('Order not found');
   return r.rows[0];
 }
 paymentSession(){
   throw new ServiceUnavailableException({code:'PAYMENT_PROVIDER_NOT_CONNECTED'});
 }
}
