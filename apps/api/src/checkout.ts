import {createHash} from 'node:crypto';
import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {DatabaseService} from './database';
import type {Principal} from './auth';

type BasketItem={productId:string;quantity:number};
type PricedItem={productId:string;sku:string|null;name:string;unitPriceIdr:number;quantity:number;lineTotalIdr:number;stockQty:number};
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
export function priceBasket(items:BasketItem[],rows:Array<{id:string;sku:string|null;name:string;price_idr:string|number;stock_qty:number;is_active:boolean}>):Quote{
 const byId=new Map(rows.map(row=>[row.id,row]));
 const priced=items.map(item=>{
   const product=byId.get(item.productId);
   if(!product||!product.is_active)throw new ConflictException('Produk tidak tersedia lagi, silakan perbarui keranjang');
   if(product.stock_qty<item.quantity)throw new ConflictException('Stok tidak mencukupi untuk '+product.name);
   const unitPriceIdr=Number(product.price_idr);
   if(!Number.isSafeInteger(unitPriceIdr)||unitPriceIdr<0)throw new ServiceUnavailableException('Harga produk belum valid');
   return {productId:item.productId,sku:product.sku,name:product.name,unitPriceIdr,quantity:item.quantity,lineTotalIdr:unitPriceIdr*item.quantity,stockQty:product.stock_qty};
 });
 const subtotalIdr=priced.reduce((sum,item)=>sum+item.lineTotalIdr,0);
 const shippingFeeIdr=shippingAmount();
 return {items:priced,subtotalIdr,shippingFeeIdr,totalIdr:shippingFeeIdr===null?null:subtotalIdr+shippingFeeIdr,
  currency:'IDR',shippingEstimate:true,paymentEnabled:false,paymentMethods:[...PAYMENT_METHODS]};
}
type Address={name:string;phone:string;address:string;city:string;province:string;postalCode:string;paymentMethod:typeof PAYMENT_METHODS[number];idempotencyKey:string};
function addressString(raw:unknown,label:string,min:number,max:number):string{
 if(typeof raw!=='string'||raw.trim().length<min||raw.trim().length>max)throw new BadRequestException(label+' wajib diisi dengan benar');
 return raw.trim();
}
export function parseDraftOrder(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Data checkout tidak valid');
 const data=raw as Record<string,unknown>;
 if(Object.keys(data).some(k=>!['items','name','phone','address','city','province','postalCode','paymentMethod','idempotencyKey'].includes(k)))
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
 const details:Address={name,phone,address,city,province,postalCode,paymentMethod:data.paymentMethod as Address['paymentMethod'],idempotencyKey:data.idempotencyKey};
 return {items,details};
}
@Injectable()
export class CheckoutService{
 constructor(private readonly db:DatabaseService){}
 config(){return {paymentEnabled:false,providerConnected:false,methods:PAYMENT_METHODS,shippingFeeIdr:shippingAmount(),ordersMode:'draft_only'};}
 private async quoted(items:BasketItem[],query:(sql:string,params:unknown[])=>Promise<{rows:any[]}>):Promise<Quote>{
   const rows=await query('SELECT id,sku,name,price_idr,stock_qty,is_active FROM product.products WHERE id=ANY($1::uuid[])',[items.map(x=>x.productId)]);
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
     if(quote.totalIdr===null||quote.shippingFeeIdr===null)throw new ServiceUnavailableException({code:'SHIPPING_QUOTE_NOT_CONFIGURED'});
     const order=await client.query<{id:string;status:string;payment_status:string}>(
       "INSERT INTO product.orders(customer_user_id,status,currency,total_idr,subtotal_idr,shipping_fee_idr,idempotency_key,request_hash,contact_name,contact_email,contact_phone,address_line,city,province,postal_code,shipping_method,payment_method,payment_status,expires_at) VALUES ($1,'draft','IDR',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'standard',$14,'not_initiated',now()+interval '24 hours') RETURNING id,status,payment_status",
       [user.id,quote.totalIdr,quote.subtotalIdr,quote.shippingFeeIdr,details.idempotencyKey,hash,details.name,user.email,details.phone,details.address,details.city,details.province,details.postalCode,details.paymentMethod]);
     for(const item of quote.items){
       await client.query('INSERT INTO product.order_items(order_id,product_id,quantity,unit_price_idr,product_name,sku) VALUES($1,$2,$3,$4,$5,$6)',
         [order.rows[0].id,item.productId,item.quantity,item.unitPriceIdr,item.name,item.sku]);
     }
     return {id:order.rows[0].id,status:order.rows[0].status,paymentStatus:order.rows[0].payment_status,paymentEnabled:false,totalIdr:quote.totalIdr};
   });
 }
 async getOrder(user:Principal,id:string){
   if(!uuid.test(id))throw new BadRequestException('ID pesanan tidak valid');
   const order=await this.db.query(
     'SELECT id,status,payment_status,payment_method,subtotal_idr::text,shipping_fee_idr::text,total_idr::text,contact_name,city,province,created_at,expires_at FROM product.orders WHERE id=$1 AND customer_user_id=$2',
     [id,user.id]);
   if(!order.rows[0])throw new NotFoundException('Pesanan tidak ditemukan');
   const lines=await this.db.query(
     'SELECT product_id,product_name,sku,quantity,unit_price_idr::text FROM product.order_items WHERE order_id=$1 ORDER BY id',[id]);
   return {order:order.rows[0],items:lines.rows,paymentEnabled:false};
 }
 async adminOrders(){
   const rows=await this.db.query(
     'SELECT id,status,payment_status,contact_name,contact_email,city,province,subtotal_idr::text,shipping_fee_idr::text,total_idr::text,payment_method,created_at FROM product.orders WHERE idempotency_key IS NOT NULL ORDER BY created_at DESC LIMIT 100');
   return {items:rows.rows,paymentEnabled:false};
 }
 paymentSession(){
   throw new ServiceUnavailableException({code:'PAYMENT_PROVIDER_NOT_CONNECTED',message:'Pembayaran tidak dapat diproses sampai payment gateway terintegrasi dan diverifikasi'});
 }
}
