import {BadRequestException,ConflictException,Injectable} from '@nestjs/common';
import {DatabaseService} from './database';

const DAY=86400000;
const MAX_DAYS=366;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Filter={from:string;to:string;start:string;exclusiveEnd:string;campaignId:string|null};
type LedgerRow={
 id:string;createdAt:string;paymentStatus:string;orderStatus:string;campaignId:string|null;
 campaignTitle:string|null;voucherCode:string|null;subtotalIdr:string;voucherDiscountIdr:string;
 promotionDiscountIdr:string;discountIdr:string;shippingFeeIdr:string;totalIdr:string;
 discountDeltaIdr:string;totalDeltaIdr:string;
};
const money=(v:unknown)=>BigInt(String(v??'0'));
const num=(v:unknown)=>Number(v||0);
const cents=(v:bigint)=>v.toString();
const percentage=(part:number,all:number)=>all?Math.round(part*10000/all)/100:null;

function parseDay(value:unknown,label:string):{day:string;ms:number}{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))
  throw new BadRequestException(label+' harus YYYY-MM-DD');
 const ms=Date.parse(value+'T00:00:00+07:00');
 if(!Number.isFinite(ms)||new Date(ms+7*3600000).toISOString().slice(0,10)!==value)
  throw new BadRequestException(label+' bukan tanggal valid');
 return {day:value,ms};
}
function jakartaToday(){return new Date(Date.now()+7*3600000).toISOString().slice(0,10);}
function formatDay(ms:number){return new Date(ms+7*3600000).toISOString().slice(0,10);}
function queryFilter(raw:Record<string,unknown>,allowPaging=false):Filter{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Filter laporan tidak valid');
 const allowed=allowPaging?['from','to','campaignId','limit','cursor']:['from','to','campaignId'];
 if(Object.keys(raw).some(k=>!allowed.includes(k)))throw new BadRequestException('Filter laporan tidak dikenal');
 const to=parseDay(raw.to??jakartaToday(),'Tanggal akhir');
 const from=parseDay(raw.from??formatDay(to.ms-29*DAY),'Tanggal mulai');
 if(to.ms<from.ms||to.ms-from.ms>=MAX_DAYS*DAY)
  throw new BadRequestException('Rentang tanggal maksimal 366 hari dan tanggal akhir harus sesudah mulai');
 const id=raw.campaignId===undefined||raw.campaignId===''?null:raw.campaignId;
 if(id!==null&&(typeof id!=='string'||!uuid.test(id)))throw new BadRequestException('Campaign ID tidak valid');
 return {from:from.day,to:to.day,start:new Date(from.ms).toISOString(),exclusiveEnd:new Date(to.ms+DAY).toISOString(),campaignId:id};
}
const SCOPE="o.idempotency_key IS NOT NULL AND (o.promotion_event_id IS NOT NULL OR o.voucher_id IS NOT NULL)"+
 " AND o.created_at >= $1::timestamptz AND o.created_at < $2::timestamptz"+
 " AND ($3::uuid IS NULL OR o.promotion_event_id=$3)";
const ISSUE="(o.discount_idr<>o.voucher_discount_idr+o.promotion_discount_idr"+
 " OR o.discount_idr>o.subtotal_idr"+
 " OR o.total_idr<>o.subtotal_idr-o.discount_idr+o.shipping_fee_idr"+
 " OR (o.promotion_discount_idr>0 AND o.promotion_event_id IS NULL)"+
 " OR (o.voucher_discount_idr>0 AND o.voucher_id IS NULL))";
const DAILY=[
 "SELECT to_char(o.created_at AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD') AS day,",
 "count(*)::int applied_orders,",
 "count(*) FILTER(WHERE o.payment_status='paid')::int paid_orders,",
 "count(*) FILTER(WHERE o.payment_status='pending')::int pending_orders,",
 "count(*) FILTER(WHERE o.payment_status='refunded')::int refunded_orders,",
 "count(*) FILTER(WHERE o.payment_status='paid' AND o.promotion_event_id IS NOT NULL)::int paid_campaign_orders,",
 "count(*) FILTER(WHERE o.payment_status='paid' AND o.voucher_id IS NOT NULL)::int paid_voucher_orders,",
 "count(*) FILTER(WHERE o.payment_status='paid' AND o.promotion_event_id IS NOT NULL AND o.voucher_id IS NOT NULL)::int stacked_paid_orders,",
 "coalesce(sum(o.subtotal_idr) FILTER(WHERE o.payment_status='paid'),0)::text paid_gmv_idr,",
 "coalesce(sum(o.voucher_discount_idr) FILTER(WHERE o.payment_status='paid'),0)::text voucher_discount_idr,",
 "coalesce(sum(o.promotion_discount_idr) FILTER(WHERE o.payment_status='paid'),0)::text promotion_discount_idr,",
 "coalesce(sum(o.shipping_fee_idr) FILTER(WHERE o.payment_status='paid'),0)::text paid_shipping_idr,",
 "coalesce(sum(o.total_idr) FILTER(WHERE o.payment_status='paid'),0)::text paid_total_idr,",
 "count(*) FILTER(WHERE "+ISSUE+")::int anomalies",
 "FROM product.orders o WHERE "+SCOPE,
 "GROUP BY 1 ORDER BY 1"
].join(' ');
const CAMPAIGNS=[
 "WITH order_usage AS (SELECT o.promotion_event_id id,",
 "count(*)::int applied_orders,",
 "count(*) FILTER(WHERE o.payment_status='paid')::int paid_orders,",
 "count(*) FILTER(WHERE o.payment_status='pending')::int pending_orders,",
 "count(*) FILTER(WHERE o.payment_status='refunded')::int refunded_orders,",
 "count(*) FILTER(WHERE o.payment_status='paid' AND o.voucher_id IS NOT NULL)::int stacked_paid_orders,",
 "coalesce(sum(o.subtotal_idr) FILTER(WHERE o.payment_status='paid'),0)::text paid_gmv_idr,",
 "coalesce(sum(o.promotion_discount_idr) FILTER(WHERE o.payment_status='paid'),0)::text promotion_discount_idr,",
 "coalesce(sum(o.voucher_discount_idr) FILTER(WHERE o.payment_status='paid'),0)::text stacked_voucher_discount_idr",
 "FROM product.orders o WHERE "+SCOPE+" AND o.promotion_event_id IS NOT NULL GROUP BY o.promotion_event_id)",
 "SELECT e.id,e.title,e.slug,e.status,e.starts_at,e.ends_at,e.member_only,",
 "coalesce(u.applied_orders,0) applied_orders,coalesce(u.paid_orders,0) paid_orders,",
 "coalesce(u.pending_orders,0) pending_orders,coalesce(u.refunded_orders,0) refunded_orders,",
 "coalesce(u.stacked_paid_orders,0) stacked_paid_orders,",
 "coalesce(u.paid_gmv_idr,'0') paid_gmv_idr,",
 "coalesce(u.promotion_discount_idr,'0') promotion_discount_idr,",
 "coalesce(u.stacked_voucher_discount_idr,'0') stacked_voucher_discount_idr",
 "FROM promotion.events e LEFT JOIN order_usage u ON u.id=e.id",
 "WHERE ($3::uuid IS NULL OR e.id=$3)",
 "ORDER BY coalesce(u.paid_gmv_idr,'0')::numeric DESC,e.title,e.id LIMIT 201"
].join(' ');
const SEGMENTS=[
 "SELECT CASE WHEN m.status='ACTIVE' THEN 'active_now' ELSE 'other_or_unknown' END segment,",
 "count(*) FILTER(WHERE o.payment_status='paid')::int paid_orders,",
 "coalesce(sum(o.subtotal_idr) FILTER(WHERE o.payment_status='paid'),0)::text paid_gmv_idr,",
 "coalesce(sum(o.promotion_discount_idr+o.voucher_discount_idr) FILTER(WHERE o.payment_status='paid'),0)::text paid_discount_idr",
 "FROM product.orders o LEFT JOIN membership.accounts m ON m.user_id=o.customer_user_id",
 "WHERE "+SCOPE+" GROUP BY 1 ORDER BY segment"
].join(' ');
const BREAKDOWN=[
 "WITH raw_lines AS (",
 "SELECT o.id order_id,oi.product_id::text product_key,",
 "coalesce(nullif(oi.product_name,''),p.name,'Produk tidak dikenal') product_label,",
 "coalesce(cat.id,'uncategorized') category_key,coalesce(cat.name,'Tanpa kategori') category_label,",
 "oi.quantity::bigint units, (oi.unit_price_idr::numeric*oi.quantity) gross,",
 "o.voucher_discount_idr::numeric voucher_discount,o.promotion_discount_idr::numeric promotion_discount,",
 "sum(oi.unit_price_idr::numeric*oi.quantity) OVER(PARTITION BY o.id ORDER BY oi.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) running,",
 "sum(oi.unit_price_idr::numeric*oi.quantity) OVER(PARTITION BY o.id) lines_total",
 "FROM product.orders o",
 "JOIN product.order_items oi ON oi.order_id=o.id",
 "LEFT JOIN product.products p ON p.id=oi.product_id",
 "LEFT JOIN LATERAL(SELECT c.id::text id,c.name FROM product.product_categories pc",
 "JOIN product.categories c ON c.id=pc.category_id",
 "WHERE pc.product_id=coalesce(p.parent_product_id,oi.product_id)",
 "ORDER BY c.slug,c.id LIMIT 1) cat ON true",
 "WHERE "+SCOPE+" AND o.payment_status='paid')",
 ",allocated AS (SELECT *,",
 "coalesce(floor(voucher_discount*running/nullif(lines_total,0))-floor(voucher_discount*(running-gross)/nullif(lines_total,0)),0)::bigint voucher_alloc,",
 "coalesce(floor(promotion_discount*running/nullif(lines_total,0))-floor(promotion_discount*(running-gross)/nullif(lines_total,0)),0)::bigint promotion_alloc",
 "FROM raw_lines)",
 ",dimension_totals AS(",
 "SELECT CASE WHEN GROUPING(product_key)=0 THEN 'product' ELSE 'category' END kind,",
 "CASE WHEN GROUPING(product_key)=0 THEN product_key ELSE category_key END item_key,",
 "CASE WHEN GROUPING(product_key)=0 THEN product_label ELSE category_label END item_label,",
 "sum(units)::bigint units,sum(gross)::numeric paid_gmv,",
 "sum(voucher_alloc)::numeric voucher_cost,sum(promotion_alloc)::numeric promotion_cost",
 "FROM allocated GROUP BY GROUPING SETS((product_key,product_label),(category_key,category_label)))",
 ",ranked AS(SELECT *,row_number() OVER(PARTITION BY kind ORDER BY paid_gmv DESC,item_label,item_key) rnk FROM dimension_totals)",
 "SELECT kind,CASE WHEN rnk<=12 THEN item_key ELSE '__other__' END item_key,",
 "CASE WHEN rnk<=12 THEN item_label ELSE 'Lainnya' END item_label,",
 "sum(units)::text units,sum(paid_gmv)::text paid_gmv_idr,",
 "sum(voucher_cost)::text voucher_discount_idr,sum(promotion_cost)::text promotion_discount_idr",
 "FROM ranked GROUP BY kind,CASE WHEN rnk<=12 THEN item_key ELSE '__other__' END,",
 "CASE WHEN rnk<=12 THEN item_label ELSE 'Lainnya' END",
 "ORDER BY kind,sum(paid_gmv) DESC,item_label"
].join(' ');
const ANOMALIES=[
 "SELECT o.id,o.created_at,o.payment_status,",
 "(o.discount_idr-o.voucher_discount_idr-o.promotion_discount_idr)::text discount_delta_idr,",
 "(o.total_idr-(o.subtotal_idr-o.discount_idr+o.shipping_fee_idr))::text total_delta_idr",
 "FROM product.orders o WHERE "+SCOPE+" AND "+ISSUE,
 "ORDER BY o.created_at DESC,o.id DESC LIMIT 25"
].join(' ');
const LEDGER_BASE=[
 "SELECT o.id,o.created_at,o.payment_status,o.status order_status,",
 "o.promotion_event_id campaign_id,o.promotion_title campaign_title,o.voucher_code,",
 "o.subtotal_idr::text subtotal_idr,o.voucher_discount_idr::text voucher_discount_idr,",
 "o.promotion_discount_idr::text promotion_discount_idr,o.discount_idr::text discount_idr,",
 "o.shipping_fee_idr::text shipping_fee_idr,o.total_idr::text total_idr,",
 "(o.discount_idr-o.voucher_discount_idr-o.promotion_discount_idr)::text discount_delta_idr,",
 "(o.total_idr-(o.subtotal_idr-o.discount_idr+o.shipping_fee_idr))::text total_delta_idr",
 "FROM product.orders o WHERE "+SCOPE
].join(' ');
const LEDGER_SORT=" ORDER BY o.created_at DESC,o.id DESC";
function mapLedger(r:any):LedgerRow{return {
 id:r.id,createdAt:new Date(r.created_at).toISOString(),paymentStatus:r.payment_status,orderStatus:r.order_status,
 campaignId:r.campaign_id,campaignTitle:r.campaign_title,voucherCode:r.voucher_code,
 subtotalIdr:String(r.subtotal_idr),voucherDiscountIdr:String(r.voucher_discount_idr),
 promotionDiscountIdr:String(r.promotion_discount_idr),discountIdr:String(r.discount_idr),
 shippingFeeIdr:String(r.shipping_fee_idr),totalIdr:String(r.total_idr),
 discountDeltaIdr:String(r.discount_delta_idr),totalDeltaIdr:String(r.total_delta_idr)
};}
function csvField(value:unknown){
 let s=value===null||value===undefined?'':String(value);
 if(/^[=+\-@\t\r\n]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
}
function parseLimit(raw:unknown){
 const n=raw===undefined?50:Number(raw);
 if(!Number.isInteger(n)||n<1||n>200)throw new BadRequestException('Batas ledger 1-200 baris');
 return n;
}
function parseCursor(raw:unknown):{at:string;id:string}|null{
 if(raw===undefined||raw==='')return null;
 if(typeof raw!=='string'||raw.length>220)throw new BadRequestException('Cursor ledger tidak valid');
 try{
  const value=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));
  if(typeof value.at!=='string'||!Number.isFinite(Date.parse(value.at))||typeof value.id!=='string'||!uuid.test(value.id))
   throw Error('Invalid cursor');
  return {at:new Date(value.at).toISOString(),id:value.id};
 }catch{throw new BadRequestException('Cursor ledger tidak valid');}
}

@Injectable()
export class PromotionAnalyticsService {
 constructor(private readonly db:DatabaseService){}
 async overview(raw:Record<string,unknown>={}){
  const f=queryFilter(raw),params=[f.start,f.exclusiveEnd,f.campaignId];
  const [days,campaigns,segments,breakdown,anomalies]=await Promise.all([
   this.db.query(DAILY,params),this.db.query(CAMPAIGNS,params),this.db.query(SEGMENTS,params),
   this.db.query(BREAKDOWN,params),this.db.query(ANOMALIES,params)
  ]);
  const totals={appliedOrders:0,paidOrders:0,pendingOrders:0,refundedOrders:0,
   paidCampaignOrders:0,paidVoucherOrders:0,stackedPaidOrders:0,anomalyOrders:0,
   paidGmvIdr:0n,voucherDiscountIdr:0n,promotionDiscountIdr:0n,paidShippingIdr:0n,paidTotalIdr:0n};
  const byDay=new Map<string,any>();
  for(const r of days.rows){
   byDay.set(r.day,r);
   totals.appliedOrders+=num(r.applied_orders);totals.paidOrders+=num(r.paid_orders);
   totals.pendingOrders+=num(r.pending_orders);totals.refundedOrders+=num(r.refunded_orders);
   totals.paidCampaignOrders+=num(r.paid_campaign_orders);totals.paidVoucherOrders+=num(r.paid_voucher_orders);
   totals.stackedPaidOrders+=num(r.stacked_paid_orders);totals.anomalyOrders+=num(r.anomalies);
   totals.paidGmvIdr+=money(r.paid_gmv_idr);totals.voucherDiscountIdr+=money(r.voucher_discount_idr);
   totals.promotionDiscountIdr+=money(r.promotion_discount_idr);
   totals.paidShippingIdr+=money(r.paid_shipping_idr);totals.paidTotalIdr+=money(r.paid_total_idr);
  }
  const daily=[];for(let ms=Date.parse(f.from+'T00:00:00+07:00');ms<Date.parse(f.exclusiveEnd);ms+=DAY){
   const day=formatDay(ms),r=byDay.get(day);
   daily.push({day,appliedOrders:num(r?.applied_orders),paidOrders:num(r?.paid_orders),
    paidGmvIdr:String(r?.paid_gmv_idr??'0'),voucherDiscountIdr:String(r?.voucher_discount_idr??'0'),
    promotionDiscountIdr:String(r?.promotion_discount_idr??'0')});
  }
  const list=campaigns.rows.slice(0,200).map(r=>({
   id:r.id,title:r.title,slug:r.slug,status:r.status,startsAt:new Date(r.starts_at).toISOString(),
   endsAt:new Date(r.ends_at).toISOString(),memberOnly:Boolean(r.member_only),
   appliedOrders:num(r.applied_orders),paidOrders:num(r.paid_orders),
   pendingOrders:num(r.pending_orders),refundedOrders:num(r.refunded_orders),
   stackedPaidOrders:num(r.stacked_paid_orders),paidGmvIdr:String(r.paid_gmv_idr),
   promotionDiscountIdr:String(r.promotion_discount_idr),
   stackedVoucherDiscountIdr:String(r.stacked_voucher_discount_idr),
   paidRatePct:percentage(num(r.paid_orders),num(r.applied_orders))
  }));
  const segmentsOut=segments.rows.map(r=>({segment:r.segment,paidOrders:num(r.paid_orders),
   paidGmvIdr:String(r.paid_gmv_idr),paidDiscountIdr:String(r.paid_discount_idr)}));
  const mapped=breakdown.rows.map(r=>({id:r.item_key,name:r.item_label,
   units:String(r.units),paidGmvIdr:String(r.paid_gmv_idr),
   voucherDiscountIdr:String(r.voucher_discount_idr),promotionDiscountIdr:String(r.promotion_discount_idr)}));
  const paidDiscount=totals.voucherDiscountIdr+totals.promotionDiscountIdr;
  return {
   period:{from:f.from,to:f.to,timezone:'Asia/Jakarta',campaignId:f.campaignId},
   summary:{
    ...Object.fromEntries(Object.entries(totals).map(([key,val])=>[key,typeof val==='bigint'?cents(val):val])),
    paidDiscountIdr:cents(paidDiscount),
    netMerchandiseIdr:cents(totals.paidGmvIdr-paidDiscount),
    paidRatePct:percentage(totals.paidOrders,totals.appliedOrders),
    discountRatePct:totals.paidGmvIdr>0n?Number((paidDiscount*10000n)/totals.paidGmvIdr)/100:null
   },
   daily,campaigns:list,campaignListTruncated:campaigns.rows.length>200,
   segments:segmentsOut,products:breakdown.rows.filter(r=>r.kind==='product').map(r=>({id:r.item_key,name:r.item_label,units:String(r.units),paidGmvIdr:String(r.paid_gmv_idr),voucherDiscountIdr:String(r.voucher_discount_idr),promotionDiscountIdr:String(r.promotion_discount_idr)})),
   categories:breakdown.rows.filter(r=>r.kind==='category').map(r=>({id:r.item_key,name:r.item_label,units:String(r.units),paidGmvIdr:String(r.paid_gmv_idr),voucherDiscountIdr:String(r.voucher_discount_idr),promotionDiscountIdr:String(r.promotion_discount_idr)})),
   anomalies:anomalies.rows.map(r=>({orderId:r.id,createdAt:new Date(r.created_at).toISOString(),paymentStatus:r.payment_status,
    discountDeltaIdr:r.discount_delta_idr,totalDeltaIdr:r.total_delta_idr})),
   definitions:{
    dateGrain:'Tanggal order dibuat, zona Asia/Jakarta; akhir periode inklusif.',
    revenue:'GMV = subtotal barang dari order dengan payment_status paid. Tidak termasuk ongkir.',
    discount:'Biaya diskon hanya pada order paid; voucher dan campaign dihitung terpisah dari snapshot order.',
    paidRate:'Paid orders / attributed orders, bukan conversion dari traffic atau dampak incremental.',
    membership:'Segmen ACTIVE memakai status membership saat laporan dibuka, bukan snapshot saat checkout.',
    categories:'Kategori utama dari katalog saat laporan dibuka; histori kategori tidak disimpan saat order.',
    refunds:'Refunded ditampilkan sebagai status; tidak ada ledger dana refund untuk mengklaim net cashflow.',
    growth:'Incremental conversion, exposure, dan lift tidak dapat dihitung tanpa event impression dan control group.'
   }
  };
 }
 async ledger(raw:Record<string,unknown>={}){
  const f=queryFilter(raw,true),limit=parseLimit(raw.limit),cursor=parseCursor(raw.cursor);
  const sql=LEDGER_BASE+
   " AND ($4::timestamptz IS NULL OR (o.created_at,o.id)<($4::timestamptz,$5::uuid))"+
   LEDGER_SORT+" LIMIT $6";
  const r=await this.db.query(sql,[f.start,f.exclusiveEnd,f.campaignId,cursor?.at??null,cursor?.id??null,limit+1]);
  const hasMore=r.rows.length>limit,selected=r.rows.slice(0,limit),last=selected.at(-1);
  const nextCursor=hasMore&&last?Buffer.from(JSON.stringify({at:new Date(last.created_at).toISOString(),id:last.id})).toString('base64url'):null;
  return {period:{from:f.from,to:f.to,campaignId:f.campaignId},items:selected.map(mapLedger),nextCursor,
   hasMore,limit,paymentCaptured:false};
 }
 async csv(raw:Record<string,unknown>={}){
  const f=queryFilter(raw),params=[f.start,f.exclusiveEnd,f.campaignId];
  return this.db.transaction(async client=>{
   await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const r=await client.query(LEDGER_BASE+LEDGER_SORT+' LIMIT 10001',params);
   if(r.rows.length>10000)throw new ConflictException('Lebih dari 10.000 order. Persempit rentang tanggal atau pilih satu campaign untuk ekspor.');
   const cols=['Tanggal dibuat (WIB)','Order ID','Payment status','Order status','Campaign ID','Campaign title','Voucher code',
    'Subtotal IDR','Voucher discount IDR','Promotion discount IDR','Total discount IDR','Shipping IDR','Order total IDR',
    'Discount delta IDR','Total delta IDR','Paid recognized'];
   const lines=[cols.map(csvField).join(',')];
   for(const rawRow of r.rows){
    const x=mapLedger(rawRow),wib=new Date(Date.parse(x.createdAt)+7*3600000).toISOString().replace('T',' ').slice(0,19);
    const values=[wib,x.id,x.paymentStatus,x.orderStatus,x.campaignId,x.campaignTitle,x.voucherCode,
     x.subtotalIdr,x.voucherDiscountIdr,x.promotionDiscountIdr,x.discountIdr,x.shippingFeeIdr,x.totalIdr,
     x.discountDeltaIdr,x.totalDeltaIdr,x.paymentStatus==='paid'?'yes':'no'];
    lines.push(values.map(csvField).join(','));
   }
   return '\uFEFF'+lines.join('\r\n')+'\r\n';
  });
 }
}
