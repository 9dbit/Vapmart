import {effectivePrice,sellableSQL,type PriceInput} from './catalog-pricing';
import {inventoryLock} from './warehouses';
import {createHash} from 'node:crypto';
import {BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {DatabaseService} from './database';
import type {Principal} from './auth';
import {parsePage,pageResult} from './data-integrity';
import {shippingFingerprint,shippingParcelFingerprint} from './shipping-fingerprint';
import {shippingSnapshotProvider,shippingConfig} from './shipping-config';
import {bestAutomaticPromotion} from './promotions';

type BasketItem={productId:string;quantity:number};
type PricedItem={productId:string;brandId:string|null;sku:string|null;name:string;unitPriceIdr:number;quantity:number;lineTotalIdr:number;stockQty:number};
type Quote={items:PricedItem[];subtotalIdr:number;discountIdr:number;voucherDiscountIdr:number;voucherCode:string|null;voucherId:string|null;promotionDiscountIdr:number;promotionEventId:string|null;promotionTitle:string|null;shippingFeeIdr:number|null;totalIdr:number|null;currency:'IDR';shippingEstimate:boolean;paymentEnabled:false;paymentMethods:string[]};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PAYMENT_METHODS=['bank_transfer','qris','virtual_account','ewallet'] as const;
function voucherCode(raw:unknown):string|null{
 if(raw===undefined||raw===null||raw==='')return null;
 if(typeof raw!=='string')throw new BadRequestException('Kode voucher tidak valid');
 const code=raw.trim().toUpperCase();
 if(!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code))throw new BadRequestException('Kode voucher tidak valid');
 return code;
}

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
export function priceBasket(items:BasketItem[],rows:Array<{id:string;sku:string|null;brand_id?:string|null;fulfillment_owner_brand_id?:string|null;name:string;price_idr:string|number;sale_price_idr?:string|number|null;sale_starts_at?:string|null;sale_ends_at?:string|null;stock_qty:number;is_active:boolean}>):Quote{
 const byId=new Map(rows.map(row=>[row.id,row]));
 const priced=items.map(item=>{
   const product=byId.get(item.productId);
   if(!product||!product.is_active)throw new ConflictException('Produk tidak tersedia lagi, silakan perbarui keranjang');
   if(product.stock_qty<item.quantity)throw new ConflictException('Stok tidak mencukupi untuk '+product.name);
   const unitPriceIdr=effectivePrice(product);
   if(!Number.isSafeInteger(unitPriceIdr)||unitPriceIdr<0)throw new ServiceUnavailableException('Harga produk belum valid');
   return {productId:item.productId,brandId:product.fulfillment_owner_brand_id===undefined?(product.brand_id||null):product.fulfillment_owner_brand_id,sku:product.sku,name:product.name,unitPriceIdr,quantity:item.quantity,lineTotalIdr:unitPriceIdr*item.quantity,stockQty:product.stock_qty};
 });
 const subtotalIdr=priced.reduce((sum,item)=>sum+item.lineTotalIdr,0);
 const shippingFeeIdr=shippingAmount();
 return {items:priced,subtotalIdr,discountIdr:0,voucherDiscountIdr:0,voucherCode:null,voucherId:null,promotionDiscountIdr:0,promotionEventId:null,promotionTitle:null,shippingFeeIdr,totalIdr:shippingFeeIdr===null?null:subtotalIdr+shippingFeeIdr,
  currency:'IDR',shippingEstimate:true,paymentEnabled:false,paymentMethods:[...PAYMENT_METHODS]};
}
type Address={name:string;phone:string;address:string;city:string;province:string;postalCode:string;paymentMethod:typeof PAYMENT_METHODS[number];idempotencyKey:string;shippingQuoteId:string|null;voucherCode:string|null;destinationAreaId?:string};
function addressString(raw:unknown,label:string,min:number,max:number):string{
 if(typeof raw!=='string'||raw.trim().length<min||raw.trim().length>max)throw new BadRequestException(label+' wajib diisi dengan benar');
 return raw.trim();
}
export function parseDraftOrder(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Data checkout tidak valid');
 const data=raw as Record<string,unknown>;
 if(Object.keys(data).some(k=>!['items','name','phone','address','city','province','postalCode','paymentMethod','idempotencyKey','shippingQuoteId','voucherCode','destinationAreaId'].includes(k)))
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
 const details:Address={name,phone,address,city,province,postalCode,paymentMethod:data.paymentMethod as Address['paymentMethod'],idempotencyKey:data.idempotencyKey,shippingQuoteId:typeof data.shippingQuoteId==='string'?data.shippingQuoteId:null,voucherCode:voucherCode(data.voucherCode)};
 if(data.destinationAreaId!==undefined){
  if(typeof data.destinationAreaId!=='string'||!/^\d{10}$/.test(data.destinationAreaId))throw new BadRequestException('Wilayah tujuan tidak valid');
  details.destinationAreaId=data.destinationAreaId;
 }
 return {items,details};
}
@Injectable()
export class CheckoutService{
 constructor(private readonly db:DatabaseService){}
 config(){return {paymentEnabled:false,providerConnected:false,methods:PAYMENT_METHODS,shippingFeeIdr:shippingAmount(),shippingMode:shippingConfig().rateLookupEnabled?'courier_select':'fixed_estimate',ordersMode:'draft_only'};}
 async quoted(items:BasketItem[],query:(sql:string,params:unknown[])=>Promise<{rows:any[]}>,code:string|null=null,userId:string|null=null,overrides?:Map<string,number>):Promise<Quote>{
   const rows=await query(`SELECT p.* FROM product.products p WHERE p.id=ANY($1::uuid[]) AND ${sellableSQL}`,[items.map(x=>x.productId)]);
   let quote=priceBasket(items,rows.rows.map(p=>overrides?.has(p.id)?{...p,price_idr:overrides.get(p.id),sale_price_idr:null}:p));
   if(code){
    const vr=await query(`SELECT v.id,v.code,v.discount_type,v.discount_value,v.max_discount_idr::text AS max_discount_idr,v.min_subtotal_idr::text AS min_subtotal_idr,v.usage_limit
     FROM product.vouchers v WHERE v.code=$1 AND v.is_active AND (v.starts_at IS NULL OR v.starts_at<=now()) AND (v.ends_at IS NULL OR v.ends_at>now()) LIMIT 1`,[code]);
    const v=vr.rows[0];if(!v)throw new ConflictException('Voucher tidak tersedia atau sudah berakhir');
    if(quote.subtotalIdr<Number(v.min_subtotal_idr||0))throw new ConflictException('Minimum belanja voucher belum terpenuhi');
    if(v.usage_limit){const used=await query(`SELECT count(*)::int n FROM product.orders WHERE voucher_id=$1 AND payment_status='paid'`,[v.id]);if(Number(used.rows[0]?.n||0)>=Number(v.usage_limit))throw new ConflictException('Kuota voucher sudah habis');}
    let discount=v.discount_type==='percent'?Math.floor(quote.subtotalIdr*Number(v.discount_value)/100):Number(v.discount_value);
    if(v.max_discount_idr!==null&&v.max_discount_idr!==undefined)discount=Math.min(discount,Number(v.max_discount_idr));discount=Math.max(0,Math.min(discount,quote.subtotalIdr));
    quote={...quote,discountIdr:discount,voucherDiscountIdr:discount,voucherCode:v.code,voucherId:v.id,totalIdr:quote.shippingFeeIdr===null?null:quote.subtotalIdr-discount+quote.shippingFeeIdr};
   }
   const promo=await bestAutomaticPromotion({items:quote.items.map(x=>({productId:x.productId,lineTotalIdr:x.lineTotalIdr})),subtotalIdr:quote.subtotalIdr,voucherDiscountIdr:quote.voucherDiscountIdr,voucherApplied:Boolean(quote.voucherId),userId,query});
   if(promo){const totalDiscount=Math.min(quote.subtotalIdr,quote.voucherDiscountIdr+promo.discountIdr);quote={...quote,promotionDiscountIdr:promo.discountIdr,promotionEventId:promo.id,promotionTitle:promo.title,discountIdr:totalDiscount,totalIdr:quote.shippingFeeIdr===null?null:quote.subtotalIdr-totalDiscount+quote.shippingFeeIdr};}
   return quote;
 }
 quote(raw:unknown,user?:Principal|null){
   const items=parseBasket(raw),code=voucherCode((raw as Record<string,unknown>)?.voucherCode);
   return this.quoted(items,(sql,params)=>this.db.query(sql,params),code,user?.id||null);
 }
 async createDraft(user:Principal,raw:unknown){
   if(!user.email||!user.emailVerified)throw new ForbiddenException('Masuk dengan email yang sudah diverifikasi');
   const {items,details}=parseDraftOrder(raw);
   return this.db.transaction(async client=>{
     await inventoryLock(client);
     const hash=createHash('sha256').update(JSON.stringify({items,details:{...details,idempotencyKey:undefined}})).digest('hex');
     const existing=await client.query<{id:string;request_hash:string;status:string;payment_status:string}>(
       'SELECT id,request_hash,status,payment_status FROM product.orders WHERE customer_user_id=$1 AND idempotency_key=$2',
       [user.id,details.idempotencyKey]);
     if(existing.rows[0]){
       if(existing.rows[0].request_hash!==hash)throw new ConflictException('Kunci pesanan pernah digunakan untuk data berbeda');
       return {id:existing.rows[0].id,status:existing.rows[0].status,paymentStatus:existing.rows[0].payment_status,paymentEnabled:false};
     }
     const recent=await client.query<{total:string}>(
       "SELECT COUNT(*)::text total FROM product.orders WHERE customer_user_id=$1 AND created_at > now() - interval '24 hours' AND status='draft'",
       [user.id]);
     if(Number(recent.rows[0]?.total||0)>=5)throw new ConflictException('Batas lima draft per hari tercapai');
     const quote=await this.quoted(items,(sql,params)=>client.query(sql,params),details.voucherCode,user.id);
     let shippingFee=quote.shippingFeeIdr;
     let service:{provider:string;courier_code:string;service_code:string}|null=null;
     if(details.shippingQuoteId){
      const r=await client.query<{cart_fingerprint:string;destination_postal_code:string;origin_postal_code:string;provider:string;courier_code:string;service_code:string;amount_idr:string;expires_at:string;applied_order_id:string|null;origin_area_id:string|null;destination_area_id:string|null;destination_region:{city:string;province:string}|null}>(
       'SELECT cart_fingerprint,destination_postal_code,origin_postal_code,provider,courier_code,service_code,amount_idr::text,expires_at,applied_order_id,origin_area_id,destination_area_id,destination_region FROM product.shipping_rate_quotes WHERE id=$1 AND customer_user_id=$2 FOR UPDATE',
       [details.shippingQuoteId,user.id]);
      const stored=r.rows[0];
      if(!stored||stored.applied_order_id||Date.parse(stored.expires_at)<=Date.now()||
        stored.destination_postal_code!==details.postalCode||stored.origin_postal_code!==process.env.SHIPPING_ORIGIN_POSTAL_CODE||
        stored.provider!==shippingSnapshotProvider())throw new ConflictException('Pilihan ongkir habis masa berlaku, silakan cek ulang');
      if(stored.provider==='jubelio'&&(stored.origin_area_id!==process.env.JUBELIO_SHIPMENT_ORIGIN_AREA_ID||stored.destination_area_id!==details.destinationAreaId||
       stored.destination_region?.city!==details.city||stored.destination_region?.province!==details.province))
       throw new ConflictException('Wilayah pengiriman berubah, silakan pilih wilayah dan cek ongkir ulang');
      const live=await client.query<{id:string;weight_grams:number|null;length_cm:number|null;width_cm:number|null;height_cm:number|null}&PriceInput>(
       `SELECT p.* FROM product.products p WHERE p.id=ANY($1::uuid[]) AND ${sellableSQL}`,
       [items.map(i=>i.productId)]);
      const byId=new Map(live.rows.map(p=>[p.id,p]));
      const fingerprintItems=items.map(i=>{
       const p=byId.get(i.productId);
       if(!p||!p.weight_grams||!Number.isSafeInteger(Number(p.price_idr)))throw new ConflictException('Harga atau berat produk tidak tersedia, mohon cek ongkir ulang');
       return {productId:i.productId,quantity:i.quantity,unitPriceIdr:effectivePrice(p),weightGrams:p.weight_grams,lengthCm:p.length_cm,widthCm:p.width_cm,heightCm:p.height_cm};
      });
      const signature=stored.provider==='jubelio'?shippingParcelFingerprint(fingerprintItems):shippingFingerprint(fingerprintItems);
      if(signature!==stored.cart_fingerprint)throw new ConflictException('Harga, berat, atau isi keranjang berubah; mohon cek ongkir ulang');
      shippingFee=Number(stored.amount_idr);
      service={provider:stored.provider,courier_code:stored.courier_code,service_code:stored.service_code};
     }else if(process.env.SHIPPING_RATE_LOOKUP_ENABLED==='true'){
      throw new ConflictException('Pilih jasa kurir sebelum menyimpan draft');
     }
     if(shippingFee===null||!Number.isSafeInteger(shippingFee)||shippingFee<0)
      throw new ServiceUnavailableException({code:'SHIPPING_QUOTE_NOT_CONFIGURED'});
     const draftTotal=quote.subtotalIdr-quote.discountIdr+shippingFee,paymentStatus=details.paymentMethod==='bank_transfer'?'pending':'not_initiated';
     const order=await client.query<{id:string;status:string;payment_status:string}>(
       "INSERT INTO product.orders(customer_user_id,status,currency,total_idr,subtotal_idr,discount_idr,voucher_discount_idr,promotion_discount_idr,shipping_fee_idr,idempotency_key,request_hash,contact_name,contact_email,contact_phone,address_line,city,province,postal_code,shipping_method,payment_method,payment_status,expires_at,shipping_quote_id,shipping_provider,shipping_courier_code,shipping_service_code,voucher_id,voucher_code,promotion_event_id,promotion_title) VALUES ($1,'draft','IDR',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'standard',$17,$18,now()+interval '24 hours',$19,$20,$21,$22,$23,$24,$25,$26) RETURNING id,status,payment_status",
       [user.id,draftTotal,quote.subtotalIdr,quote.discountIdr,quote.voucherDiscountIdr,quote.promotionDiscountIdr,shippingFee,details.idempotencyKey,hash,details.name,user.email,details.phone,details.address,details.city,details.province,details.postalCode,details.paymentMethod,paymentStatus,details.shippingQuoteId,service?.provider||null,service?.courier_code||null,service?.service_code||null,quote.voucherId,quote.voucherCode,quote.promotionEventId,quote.promotionTitle]);
     if(details.shippingQuoteId){
      await client.query('UPDATE product.shipping_rate_quotes SET applied_order_id=$2 WHERE id=$1 AND applied_order_id IS NULL',[details.shippingQuoteId,order.rows[0].id]);
     }
     for(const item of quote.items){
       await client.query('INSERT INTO product.order_items(order_id,product_id,quantity,unit_price_idr,product_name,sku,brand_id,ownership_scope) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
         [order.rows[0].id,item.productId,item.quantity,item.unitPriceIdr,item.name,item.sku,item.brandId,item.brandId?'brand':'platform']);
     }
     return {id:order.rows[0].id,status:order.rows[0].status,paymentStatus:order.rows[0].payment_status,paymentMethod:details.paymentMethod,paymentEnabled:false,totalIdr:draftTotal,discountIdr:quote.discountIdr,voucherDiscountIdr:quote.voucherDiscountIdr,voucherCode:quote.voucherCode,promotionDiscountIdr:quote.promotionDiscountIdr,promotionEventId:quote.promotionEventId,promotionTitle:quote.promotionTitle};
   });
 }
 async getOrder(user:Principal,id:string){
   if(!uuid.test(id))throw new BadRequestException('ID pesanan tidak valid');
   const order=await this.db.query(
     'SELECT id,status,operational_status,invoice_number,additional_fee_idr::text,payment_status,payment_method,shipping_provider,shipping_courier_code,shipping_service_code,subtotal_idr::text,discount_idr::text,voucher_discount_idr::text,voucher_code,promotion_discount_idr::text,promotion_event_id,promotion_title,shipping_fee_idr::text,total_idr::text,contact_name,city,province,created_at,expires_at FROM product.orders WHERE id=$1 AND customer_user_id=$2',
     [id,user.id]);
   if(!order.rows[0])throw new NotFoundException('Pesanan tidak ditemukan');
   const lines=await this.db.query(
     'SELECT id,product_id,product_name,sku,quantity,unit_price_idr::text FROM product.order_items WHERE order_id=$1 ORDER BY id',[id]);
   return {order:order.rows[0],items:lines.rows,paymentEnabled:false};
 }
 async adminOrders(raw:Record<string,unknown>={}){
  const f=parsePage(raw);
  const r=await this.db.query(`WITH filtered AS (
   SELECT id,status,operational_status,invoice_number,payment_status,(payment_provider IS NOT NULL AND payment_reference IS NOT NULL) AS payment_verified,
    contact_name,contact_email,city,province,shipping_provider,shipping_courier_code,shipping_service_code,
    subtotal_idr::text,discount_idr::text,voucher_discount_idr::text,voucher_code,promotion_discount_idr::text,promotion_event_id,promotion_title,shipping_fee_idr::text,total_idr::text,payment_method,created_at
   FROM product.orders WHERE idempotency_key IS NOT NULL
    AND ($1::text='' OR strpos(lower(concat_ws(' ',id::text,contact_name,contact_email,city)),lower($1))>0)
    AND ($2::text='' OR operational_status=$2 OR status=$2 OR payment_status=$2)
   ), selected AS (SELECT * FROM filtered ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4)
   SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC,s.id DESC) FROM selected s),'[]'::jsonb),
    'total',(SELECT count(*)::integer FROM filtered)) AS data`,[f.q,f.status,f.pageSize,(f.page-1)*f.pageSize]);
  const d=r.rows[0].data;return {...pageResult(d.items,d.total,f.page,f.pageSize),paymentEnabled:false};
 }
 paymentSession(){
   throw new ServiceUnavailableException({code:'PAYMENT_PROVIDER_NOT_CONNECTED',message:'Pembayaran tidak dapat diproses sampai payment gateway terintegrasi dan diverifikasi'});
 }
}
