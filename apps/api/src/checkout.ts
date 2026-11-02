import {createHash} from 'node:crypto';
import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {DatabaseService} from './database';
import type {Principal} from './auth';
import {parsePage,pageResult} from './data-integrity';
import {shippingFingerprint} from './shipping-fingerprint';

type BasketItem={productId:string;quantity:number};
type PricedItem={productId:string;brandId:string|null;sku:string|null;name:string;unitPriceIdr:number;quantity:number;lineTotalIdr:number;stockQty:number};
type Quote={items:PricedItem[];subtotalIdr:number;shippingFeeIdr:number|null;totalIdr:number|null;currency:'IDR';shippingEstimate:boolean;paymentEnabled:false;paymentMethods:string[]};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PAYMENT_METHODS=['qris','virtual_account','ewallet'] as const;

export function parseBasket(raw:unknown):BasketItem[]{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Keranjang tidak valid');
 const body=raw as Record<string,unknown>;
 if(!Array.isArray(body.items)||body.items.length<1||body.items.length>25)throw new BadRequestException('Keranjang harus berisi 1 sampai 25 produk');
 const seen=new Set<string>();
 return body.items.map((row:unknown)=>{
   if(!row||typeof row!=='object'||Array.isArray(row))throw new BadRequestException('Item tidak valid');
   const item=row as Record<string,unknown>;
   if(Object.keys(item).some(k=>!['productId','quantity'].includes(k))||typeof item.productId!=='string'||!uuid.test(item.productId))
     throw new BadRequestException('ID produk tidak valid');
   if(seen.has(item.productId))throw new BadRequestException('Produk ganda di keranjang');
   seen.add(item.productId);
   if(typeof item.quantity!=='number'||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>99)
     throw new BadRequestException('Kuantitas harus 1 sampai 99');
   return {productId:item.productId,quantity:item.quantity};
 });
}
function shippingAmount():number|null {
 const raw=process.env.SHIPPING_FEE_IDR;
 if(raw===undefined||raw==='')return null;
 const amount=Number(raw);
 return Number.isSafeInteger(amount)&&amount>=0&&amount<=10000000?amount:null;
}
export function priceBasket(items:BasketItem[],rows:Array<{id:string;sku:string|null;brand_id?:string|null;name:string;price_idr:string|number;stock_qty:number;is_active:boolean}>):Quote{
 const byId=new Map(rows.map(row=>[row.id,row]));
 const priced=items.map(item=>{
   const product=byId.get(item.productId);
   if(!product||!product.is_active)throw new ConflictException('Produk tidak tersedia lagi, silakan perbarui keranjang');
   if(product.stock_qty<item.quantity)throw new ConflictException('Stok tidak mencukupi untuk '+product.name);
   const unitPriceIdr=Number(product.price_idr);
   if(!Number.isSafeInteger(unitPriceIdr)||unitPriceIdr<0)throw new ServiceUnavailableException('Harga produk belum valid');
   return {productId:item.productId,brandId:product.brand_id||null,sku:product.sku,name:product.name,unitPriceIdr,quantity:item.quantity,lineTotalIdr:unitPriceIdr*item.quantity,stockQty:product.stock_qty};
 });
 const subtotalIdr=priced.reduce((sum,item)=>sum+item.lineTotalIdr,0);
 const shippingFeeIdr=shippingAmount();
 return {items:priced,subtotalIdr,shippingFeeIdr,totalIdr:shippingFeeIdr===null?null:subtotalIdr+shippingFeeIdr,
  currency:'IDR',shippingEstimate:true,paymentEnabled:false,paymentMethods:[...PAYMENT_METHODS]};
}
type Address={name:string;phone:string;address:string;city:string;province:string;postalCode:string;paymentMethod:typeof PAYMENT_METHODS[number];idempotencyKey:string;shippingQuoteId:string|null};
function addressString(raw:unknown,label:string,min:number,max:number):string{
 if(typeof raw!=='string'||raw.trim().length<min||raw.trim().length>max)throw new BadRequestException(label+' wajib diisi dengan benar');
 return raw.trim();
}
export function parseDraftOrder(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Data checkout tidak valid');
 const data=raw as Record<string,unknown>;
 if(Object.keys(data).some(k=>!['items','name','phone','address','city','province','postalCode','paymentMethod','idempotencyKey','shippingQuoteId'].includes(k)))
   throw new BadRequestException('Kolom checkout tidak dikenali');
 const items=parseBasket({items:data.items});
 const name=addressString(data.name,'Nama penerima',2,100);
 const phone=addressString(data.phone,'Nomor telepon',9,22);
 if(!/^\+?[0-9\s()-]{9,22}$/.test(phone))throw new BadRequestException('Nomor telepon tidak valid');
 const address=addressString(data.address,'Alamat',8,300);
 const city=addressString(data.city,'Kota',2,90);
 const province=addressString(data.province,'Provinsi',2,90);
 const postalCode=addressString(data.postalCode,'Kode pos',5,5);
 if(!/^[0-9]{5}$/.test(postalCode))throw new BadRequestException('Kode pos harus 5 angka');
 if(typeof data.paymentMethod!=='string'||!PAYMENT_METHODS.includes(data.paymentMethod as typeof PAYMENT_METHODS[number]))
   throw new BadRequestException('Metode pembayaran tidak tersedia');
 if(typeof data.idempotencyKey!=='string'||!uuid.test(data.idempotencyKey))
   throw new BadRequestException('Kunci checkout tidak valid');
 if(data.shippingQuoteId!==undefined&&data.shippingQuoteId!==null&&(typeof data.shippingQuoteId!=='string'||!uuid.test(data.shippingQuoteId)))
   throw new BadRequestException('Shipping quote ID tidak valid');
 const details:Address={name,phone,address,city,province,postalCode,paymentMethod:data.paymentMethod as Address['paymentMethod'],idempotencyKey:data.idempotencyKey,shippingQuoteId:typeof data.shippingQuoteId==='string'?data.shippingQuoteId:null};
 return {items,details};
}
@Injectable()
export class CheckoutService{
 constructor(private readonly db:DatabaseService){}
 config(){return {paymentEnabled:false,providerConnected:false,methods:PAYMENT_METHODS,shippingFeeIdr:shippingAmount(),shippingMode:process.env.SHIPPING_RATE_LOOKUP_ENABLED==='true'?'sandbox_select':'fixed_estimate',ordersMode:'draft_only'};}
 private async quoted(items:BasketItem[],query:(sql:string,params:unknown[])=>Promise<{rows:any[]}>):Promise<Quote>{
   const rows=await query('SELECT id,sku,brand_id,name,price_idr,stock_qty,is_active FROM product.products WHERE id=ANY($1::uuid[])',[items.map(x=>x.productId)]);
   return priceBasket(items,rows.rows);
 }
 quote(raw:unknown){
   const items=parseBasket(raw);
   return this.quoted(items,(sql,params)=>this.db.query(sql,params));
 }
 async createDraft(user:Principal,raw:unknown){
   if(!user.email||!user.emailVerified)throw new ForbiddenException('Masuk dengan email yang sudah diverifikasi');
   const {items,details}=parseDraftOrder(raw);
   return this.db.transaction(async client=>{
     const hash=createHash('sha256').update(JSON.stringify({items,details:{...details,idempotencyKey:undefined}})).digest('hex');
     const existing=await client.query<{id:string;request_hash:string;status:string;payment_status:string}>(
       'SELECT id,request_hash,status,payment_status FROM product.orders WHERE customer_user_id=$1 AND idempotency_key=$2',
       [user.id,details.idempotencyKey]);
     if(existing.rows[0]){
       if(existing.rows[0].request_hash!==hash)throw new ConflictException('Kunci pesanan pernah digunakan untuk data berbeda');
       return {id:existing.rows[0].id,status:existing.rows[0].status,paymentStatus:existing.rows[0].payment_status,paymentEnabled:false};
     }
     const recent=await client.query<{total:string}>(
       "SELECT COUNT(*)::text total FROM product.orders WHERE customer_user_id=$1 AND created_at > now() - interval '24 hours' AND payment_status='not_initiated'",
       [user.id]);
     if(Number(recent.rows[0]?.total||0)>=5)throw new ConflictException('Batas lima draft per hari tercapai');
     const quote=await this.quoted(items,(sql,params)=>client.query(sql,params));
     let shippingFee=quote.shippingFeeIdr;
     let service:{provider:string;courier_code:string;service_code:string}|null=null;
     if(details.shippingQuoteId){
      const r=await client.query<{cart_fingerprint:string;destination_postal_code:string;origin_postal_code:string;provider:string;courier_code:string;service_code:string;amount_idr:string;expires_at:string;applied_order_id:string|null}>(
       'SELECT cart_fingerprint,destination_postal_code,origin_postal_code,provider,courier_code,service_code,amount_idr::text,expires_at,applied_order_id FROM product.shipping_rate_quotes WHERE id=$1 AND customer_user_id=$2 FOR UPDATE',
       [details.shippingQuoteId,user.id]);
      const stored=r.rows[0];
      if(!stored||stored.applied_order_id||Date.parse(stored.expires_at)<=Date.now()||
        stored.destination_postal_code!==details.postalCode||stored.origin_postal_code!==process.env.SHIPPING_ORIGIN_POSTAL_CODE||
        stored.provider!=='biteship_test')throw new ConflictException('Pilihan ongkir habis masa berlaku, silakan cek ulang');
      const live=await client.query<{id:string;price_idr:string;weight_grams:number|null}>(
       'SELECT id,price_idr::text,weight_grams FROM product.products WHERE id=ANY($1::uuid[])',
       [items.map(i=>i.productId)]);
      const byId=new Map(live.rows.map(p=>[p.id,p]));
      const signature=shippingFingerprint(items.map(i=>{
       const p=byId.get(i.productId);
       if(!p||!p.weight_grams||!Number.isSafeInteger(Number(p.price_idr)))throw new ConflictException('Harga atau berat produk tidak tersedia, mohon cek ongkir ulang');
       return {productId:i.productId,quantity:i.quantity,unitPriceIdr:Number(p.price_idr),weightGrams:p.weight_grams};
      }));
      if(signature!==stored.cart_fingerprint)throw new ConflictException('Harga, berat, atau isi keranjang berubah; mohon cek ongkir ulang');
      shippingFee=Number(stored.amount_idr);
      service={provider:stored.provider,courier_code:stored.courier_code,service_code:stored.service_code};
     }else if(process.env.SHIPPING_RATE_LOOKUP_ENABLED==='true'){
      throw new ConflictException('Pilih jasa kurir sebelum menyimpan draft');
     }
     if(shippingFee===null||!Number.isSafeInteger(shippingFee)||shippingFee<0)
      throw new ServiceUnavailableException({code:'SHIPPING_QUOTE_NOT_CONFIGURED'});
     const draftTotal=quote.subtotalIdr+shippingFee;
     const order=await client.query<{id:string;status:string;payment_status:string}>(
       "INSERT INTO product.orders(customer_user_id,status,currency,total_idr,subtotal_idr,shipping_fee_idr,idempotency_key,request_hash,contact_name,contact_email,contact_phone,address_line,city,province,postal_code,shipping_method,payment_method,payment_status,expires_at,shipping_quote_id,shipping_provider,shipping_courier_code,shipping_service_code) VALUES ($1,'draft','IDR',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'standard',$14,'not_initiated',now()+interval '24 hours',$15,$16,$17,$18) RETURNING id,status,payment_status",
       [user.id,draftTotal,quote.subtotalIdr,shippingFee,details.idempotencyKey,hash,details.name,user.email,details.phone,details.address,details.city,details.province,details.postalCode,details.paymentMethod,details.shippingQuoteId,service?.provider||null,service?.courier_code||null,service?.service_code||null]);
     if(details.shippingQuoteId){
      await client.query('UPDATE product.shipping_rate_quotes SET applied_order_id=$2 WHERE id=$1 AND applied_order_id IS NULL',[details.shippingQuoteId,order.rows[0].id]);
     }
     for(const item of quote.items){
       await client.query('INSERT INTO product.order_items(order_id,product_id,quantity,unit_price_idr,product_name,sku,brand_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
         [order.rows[0].id,item.productId,item.quantity,item.unitPriceIdr,item.name,item.sku,item.brandId]);
     }
     return {id:order.rows[0].id,status:order.rows[0].status,paymentStatus:order.rows[0].payment_status,paymentEnabled:false,totalIdr:draftTotal};
   });
 }
 async getOrder(user:Principal,id:string){
   if(!uuid.test(id))throw new BadRequestException('ID pesanan tidak valid');
   const order=await this.db.query(
     'SELECT id,status,payment_status,payment_method,shipping_provider,shipping_courier_code,shipping_service_code,subtotal_idr::text,shipping_fee_idr::text,total_idr::text,contact_name,city,province,created_at,expires_at FROM product.orders WHERE id=$1 AND customer_user_id=$2',
     [id,user.id]);
   if(!order.rows[0])throw new NotFoundException('Pesanan tidak ditemukan');
   const lines=await this.db.query(
     'SELECT product_id,product_name,sku,quantity,unit_price_idr::text FROM product.order_items WHERE order_id=$1 ORDER BY id',[id]);
   return {order:order.rows[0],items:lines.rows,paymentEnabled:false};
 }
 async adminOrders(raw:Record<string,unknown>={}){
  const f=parsePage(raw);
  const r=await this.db.query(`WITH filtered AS (
   SELECT id,status,payment_status,(payment_provider IS NOT NULL AND payment_reference IS NOT NULL) AS payment_verified,
    contact_name,contact_email,city,province,shipping_provider,shipping_courier_code,shipping_service_code,
    subtotal_idr::text,shipping_fee_idr::text,total_idr::text,payment_method,created_at
   FROM product.orders WHERE idempotency_key IS NOT NULL
    AND ($1::text='' OR strpos(lower(concat_ws(' ',id::text,contact_name,contact_email,city)),lower($1))>0)
    AND ($2::text='' OR status=$2 OR payment_status=$2)
   ), selected AS (SELECT * FROM filtered ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4)
   SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC,s.id DESC) FROM selected s),'[]'::jsonb),
    'total',(SELECT count(*)::integer FROM filtered)) AS data`,[f.q,f.status,f.pageSize,(f.page-1)*f.pageSize]);
  const d=r.rows[0].data;return {...pageResult(d.items,d.total,f.page,f.pageSize),paymentEnabled:false};
 }
 paymentSession(){
   throw new ServiceUnavailableException({code:'PAYMENT_PROVIDER_NOT_CONNECTED',message:'Pembayaran tidak dapat diproses sampai payment gateway terintegrasi dan diverifikasi'});
 }
}
