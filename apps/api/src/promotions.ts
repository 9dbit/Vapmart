import {BadRequestException,ConflictException,Injectable,NotFoundException} from '@nestjs/common';
import type {PoolClient} from 'pg';
import {DatabaseService} from './database';
import type {Principal} from './auth';
import {assertVersion,parsePage,pageResult,requireActor} from './data-integrity';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Lifecycle='draft'|'scheduled'|'active'|'expired'|'archived';
type ScopeMode='all'|'products'|'categories';
type StackingRule='exclusive'|'with_voucher';
type DiscountType='percentage'|'fixed';
type Target={id:string;name:string};
type PromotionShape={
 slug:string;title:string;description:string;starts_at:string;ends_at:string;status:'draft'|'published'|'archived';
 member_only:boolean;discount_type:DiscountType;discount_value:number;minimum_spend_idr:number;max_uses_per_user:number;
 auto_apply:boolean;stacking_rule:StackingRule;scope_mode:ScopeMode;max_discount_idr:number|null;priority:number;
 product_ids:string[];category_ids:string[];
};
type Query=(sql:string,params:unknown[])=>Promise<{rows:any[]}>;

function record(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Data campaign tidak valid');
 return raw as Record<string,unknown>;
}
function text(raw:unknown,label:string,min:number,max:number){
 if(typeof raw!=='string'||raw.trim().length<min||raw.trim().length>max)throw new BadRequestException(label+' tidak valid');
 return raw.trim();
}
function slug(raw:unknown){
 const value=text(raw,'Slug campaign',3,80).toLowerCase();
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))throw new BadRequestException('Slug campaign hanya huruf kecil, angka, dan tanda -');
 return value;
}
function integer(raw:unknown,label:string,min:number,max:number){
 const n=typeof raw==='string'&&raw.trim()!==''?Number(raw):raw;
 if(!Number.isSafeInteger(n)||Number(n)<min||Number(n)>max)throw new BadRequestException(label+' tidak valid');
 return Number(n);
}
function nullableInteger(raw:unknown,label:string,min:number,max:number){
 if(raw===null||raw===undefined||raw==='')return null;
 return integer(raw,label,min,max);
}
function bool(raw:unknown,label:string){
 if(typeof raw!=='boolean')throw new BadRequestException(label+' tidak valid');
 return raw;
}
function iso(raw:unknown,label:string){
 if(typeof raw!=='string'||!raw.trim())throw new BadRequestException(label+' wajib diisi');
 const d=new Date(raw);if(Number.isNaN(d.valueOf()))throw new BadRequestException(label+' tidak valid');
 return d.toISOString();
}
function ids(raw:unknown,label:string,max:number){
 if(raw===undefined||raw===null)return [];
 if(!Array.isArray(raw)||raw.length>max)throw new BadRequestException(label+' tidak valid');
 const values=[...new Set(raw.map(x=>{if(typeof x!=='string'||!uuid.test(x))throw new BadRequestException(label+' tidak valid');return x;}))];
 return values;
}
function lifecycle(row:any):Lifecycle{
 if(row.status==='archived')return 'archived';
 if(row.status==='draft')return 'draft';
 const now=Date.now();
 if(Date.parse(row.starts_at)>now)return 'scheduled';
 if(Date.parse(row.ends_at)<=now)return 'expired';
 return 'active';
}
function shape(raw:Record<string,unknown>,base?:PromotionShape):PromotionShape{
 const discountType=(raw.discountType??base?.discount_type) as unknown;
 if(discountType!=='percentage'&&discountType!=='fixed')throw new BadRequestException('Tipe diskon harus percentage atau fixed');
 const discountValue=integer(raw.discountValue??base?.discount_value,'Nilai diskon',1,discountType==='percentage'?100:2_000_000_000);
 const startsAt=iso(raw.startsAt??base?.starts_at,'Mulai campaign');
 const endsAt=iso(raw.endsAt??base?.ends_at,'Berakhir campaign');
 if(Date.parse(startsAt)>=Date.parse(endsAt))throw new BadRequestException('Waktu mulai harus lebih awal dari waktu berakhir');
 const status=(raw.status??base?.status??'draft') as unknown;
 if(!['draft','published','archived'].includes(String(status)))throw new BadRequestException('Status campaign tidak valid');
 const stacking=(raw.stackingRule??base?.stacking_rule??'exclusive') as unknown;
 if(stacking!=='exclusive'&&stacking!=='with_voucher')throw new BadRequestException('Aturan stacking tidak valid');
 const scope=(raw.scopeMode??base?.scope_mode??'all') as unknown;
 if(scope!=='all'&&scope!=='products'&&scope!=='categories')throw new BadRequestException('Scope campaign tidak valid');
 const productIds=raw.productIds===undefined?(base?.product_ids??[]):ids(raw.productIds,'Target produk',100);
 const categoryIds=raw.categoryIds===undefined?(base?.category_ids??[]):ids(raw.categoryIds,'Target kategori',50);
 if(scope==='all'&&(productIds.length||categoryIds.length))throw new BadRequestException('Campaign semua produk tidak boleh menyimpan target khusus');
 if(scope==='products'&&(productIds.length<1||categoryIds.length))throw new BadRequestException('Pilih minimal satu produk untuk campaign produk');
 if(scope==='categories'&&(categoryIds.length<1||productIds.length))throw new BadRequestException('Pilih minimal satu kategori untuk campaign kategori');
 const maxDiscount=discountType==='percentage'
  ?nullableInteger(raw.maxDiscountIdr===undefined?base?.max_discount_idr:raw.maxDiscountIdr,'Maksimum diskon',1,2_000_000_000):null;
 return {
  slug:slug(raw.slug??base?.slug),title:text(raw.title??base?.title,'Judul campaign',2,120),
  description:text(raw.description??base?.description??'','Deskripsi campaign',0,2000),
  starts_at:startsAt,ends_at:endsAt,status:status as PromotionShape['status'],
  member_only:raw.memberOnly===undefined?(base?.member_only??false):bool(raw.memberOnly,'Member only'),
  discount_type:discountType,discount_value:discountValue,
  minimum_spend_idr:integer(raw.minimumSpendIdr??base?.minimum_spend_idr??0,'Minimum belanja',0,2_000_000_000),
  max_uses_per_user:integer(raw.maxUsesPerUser??base?.max_uses_per_user??0,'Batas penggunaan per user',0,1_000_000),
  auto_apply:raw.autoApply===undefined?(base?.auto_apply??false):bool(raw.autoApply,'Auto apply'),
  stacking_rule:stacking,scope_mode:scope,max_discount_idr:maxDiscount,
  priority:integer(raw.priority??base?.priority??100,'Priority',0,10000),
  product_ids:productIds,category_ids:categoryIds
 };
}
async function targetSnapshot(q:Query,id:string){
 const [products,categories]=await Promise.all([
  q('SELECT p.id,p.name FROM promotion.event_products ep JOIN product.products p ON p.id=ep.product_id WHERE ep.event_id=$1 ORDER BY p.name,p.id',[id]),
  q('SELECT c.id,c.name FROM promotion.event_categories ec JOIN product.categories c ON c.id=ec.category_id WHERE ec.event_id=$1 ORDER BY c.name,c.id',[id])
 ]);
 return {products:products.rows as Target[],categories:categories.rows as Target[]};
}
async function validateTargets(q:Query,data:PromotionShape){
 if(data.scope_mode==='products'){
  const r=await q('SELECT id,is_active,archived_at,parent_product_id FROM product.products WHERE id=ANY($1::uuid[])',[data.product_ids]);
  if(r.rows.length!==data.product_ids.length||r.rows.some(x=>x.parent_product_id||x.archived_at))
   throw new ConflictException('Target produk tidak ditemukan atau bukan produk utama');
  if(data.status==='published'&&r.rows.some(x=>!x.is_active))throw new ConflictException('Campaign published hanya boleh menargetkan produk aktif');
 }
 if(data.scope_mode==='categories'){
  const r=await q('SELECT id,is_active FROM product.categories WHERE id=ANY($1::uuid[])',[data.category_ids]);
  if(r.rows.length!==data.category_ids.length)throw new ConflictException('Target kategori tidak ditemukan');
  if(data.status==='published'&&r.rows.some(x=>!x.is_active))throw new ConflictException('Campaign published hanya boleh menargetkan kategori aktif');
 }
}
async function saveTargets(q:Query,id:string,data:PromotionShape){
 await q('DELETE FROM promotion.event_products WHERE event_id=$1',[id]);
 await q('DELETE FROM promotion.event_categories WHERE event_id=$1',[id]);
 if(data.scope_mode==='products')await q('INSERT INTO promotion.event_products(event_id,product_id) SELECT $1,unnest($2::uuid[])',[id,data.product_ids]);
 if(data.scope_mode==='categories')await q('INSERT INTO promotion.event_categories(event_id,category_id) SELECT $1,unnest($2::uuid[])',[id,data.category_ids]);
}
async function audit(client:PoolClient,actor:string,id:string,action:string,before:any,after:any){
 await client.query('INSERT INTO product.catalog_audit(actor_id,entity_type,entity_id,action,before_data,after_data) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',
  [actor,'promotion_event',id,action,before?JSON.stringify(before):null,JSON.stringify(after)]);
}
function mapRow(row:any){
 return {
  id:row.id,slug:row.slug,title:row.title,description:row.description,startsAt:row.starts_at,endsAt:row.ends_at,status:row.status,
  lifecycle:(row.lifecycle||lifecycle(row)) as Lifecycle,memberOnly:Boolean(row.member_only),discountType:row.discount_type,
  discountValue:Number(row.discount_value),minimumSpendIdr:Number(row.minimum_spend_idr||0),maxUsesPerUser:Number(row.max_uses_per_user||0),
  autoApply:Boolean(row.auto_apply),stackingRule:row.stacking_rule,scopeMode:row.scope_mode,
  maxDiscountIdr:row.max_discount_idr===null||row.max_discount_idr===undefined?null:Number(row.max_discount_idr),
  priority:Number(row.priority),editVersion:Number(row.edit_version),usedPaid:Number(row.used_paid||0),
  products:row.products||[],categories:row.categories||[],createdAt:row.created_at,updatedAt:row.updated_at
 };
}
function rowLifecycleSql(alias='e'){
 return "CASE WHEN "+alias+".status='archived' THEN 'archived' WHEN "+alias+".status='draft' THEN 'draft' WHEN "+alias+".starts_at>now() THEN 'scheduled' WHEN "+alias+".ends_at<=now() THEN 'expired' ELSE 'active' END";
}

@Injectable()
export class PromotionAdminService{
 constructor(private readonly db:DatabaseService){}
 async list(raw:Record<string,unknown>={}){
  const f=parsePage(raw);if(f.status&&!['draft','scheduled','active','expired','archived'].includes(f.status))throw new BadRequestException('Status campaign tidak valid');
  const life=rowLifecycleSql('e');
  const sql="WITH base AS (SELECT e.*,"+life+" lifecycle,"+
   " (SELECT count(*)::int FROM product.orders o WHERE o.promotion_event_id=e.id AND o.payment_status='paid') used_paid,"+
   " (SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) ORDER BY p.name,p.id),'[]'::jsonb) FROM promotion.event_products ep JOIN product.products p ON p.id=ep.product_id WHERE ep.event_id=e.id) products,"+
   " (SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id),'[]'::jsonb) FROM promotion.event_categories ec JOIN product.categories c ON c.id=ec.category_id WHERE ec.event_id=e.id) categories"+
   " FROM promotion.events e WHERE ($1::text='' OR strpos(lower(concat_ws(' ',e.title,e.slug,e.description)),lower($1))>0)),"+
   " filtered AS (SELECT * FROM base WHERE ($2::text='' OR lifecycle=$2)),"+
   " selected AS (SELECT * FROM filtered ORDER BY updated_at DESC,id DESC LIMIT $3 OFFSET $4)"+
   " SELECT coalesce(jsonb_agg(to_jsonb(selected) ORDER BY updated_at DESC,id DESC),'[]'::jsonb) items,(SELECT count(*)::int FROM filtered) total FROM selected";
  const r=await this.db.query(sql,[f.q,f.status,f.pageSize,(f.page-1)*f.pageSize]);
  return pageResult((r.rows[0]?.items||[]).map(mapRow),Number(r.rows[0]?.total||0),f.page,f.pageSize);
 }
 async detail(id:string){
  if(!uuid.test(id))throw new BadRequestException('ID campaign tidak valid');
  const life=rowLifecycleSql('e');
  const r=await this.db.query("SELECT e.*,"+life+" lifecycle,"+
   " (SELECT count(*)::int FROM product.orders o WHERE o.promotion_event_id=e.id AND o.payment_status='paid') used_paid,"+
   " (SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) ORDER BY p.name,p.id),'[]'::jsonb) FROM promotion.event_products ep JOIN product.products p ON p.id=ep.product_id WHERE ep.event_id=e.id) products,"+
   " (SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) ORDER BY c.name,c.id),'[]'::jsonb) FROM promotion.event_categories ec JOIN product.categories c ON c.id=ec.category_id WHERE ec.event_id=e.id) categories"+
   " FROM promotion.events e WHERE e.id=$1",[id]);
  if(!r.rows[0])throw new NotFoundException('Campaign tidak ditemukan');
  return mapRow(r.rows[0]);
 }
 async create(actor:Principal,raw:unknown){
  const who=requireActor(actor),x=record(raw);
  const allowed=['slug','title','description','startsAt','endsAt','status','memberOnly','discountType','discountValue','minimumSpendIdr','maxUsesPerUser','autoApply','stackingRule','scopeMode','maxDiscountIdr','priority','productIds','categoryIds'];
  if(Object.keys(x).some(k=>!allowed.includes(k)))throw new BadRequestException('Kolom campaign tidak dikenali');
  const data=shape(x);
  try{return await this.db.transaction(async client=>{
   await validateTargets(client,data);
   const r=await client.query('INSERT INTO promotion.events(slug,title,description,starts_at,ends_at,status,member_only,discount_type,discount_value,minimum_spend_idr,max_uses_per_user,auto_apply,stacking_rule,scope_mode,max_discount_idr,priority,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17) RETURNING *',
    [data.slug,data.title,data.description,data.starts_at,data.ends_at,data.status,data.member_only,data.discount_type,data.discount_value,data.minimum_spend_idr,data.max_uses_per_user,data.auto_apply,data.stacking_rule,data.scope_mode,data.max_discount_idr,data.priority,who]);
   const row=r.rows[0];await saveTargets(client,row.id,data);const targets=await targetSnapshot(client,row.id);const after={...row,...targets};await audit(client,who,row.id,'create',null,after);
   return mapRow({...row,...targets,used_paid:0,lifecycle:lifecycle(row)});
  });}catch(e:any){if(e?.code==='23505')throw new ConflictException('Slug campaign sudah digunakan');throw e;}
 }
 async update(actor:Principal,id:string,raw:unknown){
  if(!uuid.test(id))throw new BadRequestException('ID campaign tidak valid');
  const who=requireActor(actor),x=record(raw);
  const allowed=['expectedVersion','slug','title','description','startsAt','endsAt','status','memberOnly','discountType','discountValue','minimumSpendIdr','maxUsesPerUser','autoApply','stackingRule','scopeMode','maxDiscountIdr','priority','productIds','categoryIds'];
  if(Object.keys(x).some(k=>!allowed.includes(k)))throw new BadRequestException('Kolom campaign tidak dikenali');
  const expected=integer(x.expectedVersion,'Versi campaign',1,2_000_000_000);
  try{return await this.db.transaction(async client=>{
   const current=await client.query('SELECT * FROM promotion.events WHERE id=$1 FOR UPDATE',[id]);const before=current.rows[0];
   if(!before)throw new NotFoundException('Campaign tidak ditemukan');assertVersion(Number(before.edit_version),expected);
   const beforeTargets=await targetSnapshot(client,id);
   const data=shape(x,{
    slug:before.slug,title:before.title,description:before.description,starts_at:new Date(before.starts_at).toISOString(),ends_at:new Date(before.ends_at).toISOString(),
    status:before.status,member_only:before.member_only,discount_type:before.discount_type,discount_value:Number(before.discount_value),
    minimum_spend_idr:Number(before.minimum_spend_idr),max_uses_per_user:Number(before.max_uses_per_user),auto_apply:before.auto_apply,
    stacking_rule:before.stacking_rule,scope_mode:before.scope_mode,max_discount_idr:before.max_discount_idr===null?null:Number(before.max_discount_idr),
    priority:Number(before.priority),product_ids:beforeTargets.products.map(x=>x.id),category_ids:beforeTargets.categories.map(x=>x.id)
   });
   await validateTargets(client,data);
   const r=await client.query('UPDATE promotion.events SET slug=$2,title=$3,description=$4,starts_at=$5,ends_at=$6,status=$7,member_only=$8,discount_type=$9,discount_value=$10,minimum_spend_idr=$11,max_uses_per_user=$12,auto_apply=$13,stacking_rule=$14,scope_mode=$15,max_discount_idr=$16,priority=$17,updated_by=$18,updated_at=now(),edit_version=edit_version+1 WHERE id=$1 RETURNING *',
    [id,data.slug,data.title,data.description,data.starts_at,data.ends_at,data.status,data.member_only,data.discount_type,data.discount_value,data.minimum_spend_idr,data.max_uses_per_user,data.auto_apply,data.stacking_rule,data.scope_mode,data.max_discount_idr,data.priority,who]);
   const afterRow=r.rows[0];await saveTargets(client,id,data);const afterTargets=await targetSnapshot(client,id);
   const action=before.status!==afterRow.status?(afterRow.status==='published'?'publish':afterRow.status==='archived'?'archive':'unpublish'):'update';
   await audit(client,who,id,action,{...before,...beforeTargets},{...afterRow,...afterTargets});
   const usage=await client.query("SELECT count(*)::int n FROM product.orders WHERE promotion_event_id=$1 AND payment_status='paid'",[id]);
   return mapRow({...afterRow,...afterTargets,used_paid:usage.rows[0]?.n||0,lifecycle:lifecycle(afterRow)});
  });}catch(e:any){if(e?.code==='23505')throw new ConflictException('Slug campaign sudah digunakan');throw e;}
 }
}

export type PromotionApplication={id:string;title:string;discountIdr:number;scopeMode:ScopeMode;stackingRule:StackingRule};
export async function bestAutomaticPromotion(input:{
 items:Array<{productId:string;lineTotalIdr:number}>;subtotalIdr:number;voucherDiscountIdr:number;voucherApplied:boolean;userId:string|null;query:Query;
}):Promise<PromotionApplication|null>{
 const {items,subtotalIdr,voucherDiscountIdr,voucherApplied,userId,query}=input;
 if(!items.length||subtotalIdr<=0)return null;
 const c=await query("SELECT id,title,discount_type,discount_value,max_discount_idr::text,minimum_spend_idr::text,max_uses_per_user,member_only,stacking_rule,scope_mode,priority,starts_at FROM promotion.events WHERE status='published' AND auto_apply AND starts_at<=now() AND ends_at>now() AND discount_type IN('percentage','fixed') AND minimum_spend_idr<=$1 AND ($2::boolean=false OR stacking_rule='with_voucher') ORDER BY priority ASC,starts_at ASC,id ASC LIMIT 100",[subtotalIdr,voucherApplied]);
 const candidates=c.rows;if(!candidates.length)return null;
 let memberActive=false;
 if(userId&&candidates.some(x=>x.member_only)){
  const m=await query("SELECT 1 FROM membership.accounts WHERE user_id=$1 AND status='ACTIVE' LIMIT 1",[userId]);memberActive=Boolean(m.rows[0]);
 }
 const candidateIds=candidates.map(x=>x.id);
 const [products,categories,metadata,usage]=await Promise.all([
  query('SELECT event_id,product_id FROM promotion.event_products WHERE event_id=ANY($1::uuid[])',[candidateIds]),
  query('SELECT event_id,category_id FROM promotion.event_categories WHERE event_id=ANY($1::uuid[])',[candidateIds]),
  query("SELECT p.id,p.parent_product_id,coalesce(array_agg(pc.category_id) FILTER(WHERE pc.category_id IS NOT NULL),'{}'::uuid[]) category_ids FROM product.products p LEFT JOIN product.product_categories pc ON pc.product_id=p.id WHERE p.id=ANY($1::uuid[]) GROUP BY p.id,p.parent_product_id",[items.map(x=>x.productId)]),
  userId?query("SELECT promotion_event_id,count(*)::int n FROM product.orders WHERE customer_user_id=$1 AND promotion_event_id=ANY($2::uuid[]) AND payment_status='paid' GROUP BY promotion_event_id",[userId,candidateIds]):Promise.resolve({rows:[]})
 ]);
 const productTargets=new Map<string,Set<string>>(),categoryTargets=new Map<string,Set<string>>();
 for(const x of products.rows){if(!productTargets.has(x.event_id))productTargets.set(x.event_id,new Set());productTargets.get(x.event_id)!.add(x.product_id);}
 for(const x of categories.rows){if(!categoryTargets.has(x.event_id))categoryTargets.set(x.event_id,new Set());categoryTargets.get(x.event_id)!.add(x.category_id);}
 const meta=new Map(metadata.rows.map(x=>[x.id,{parentId:x.parent_product_id as string|null,categories:new Set<string>(x.category_ids||[])}]));
 const used=new Map(usage.rows.map(x=>[x.promotion_event_id,Number(x.n)]));
 const eligible:PromotionApplication[]=[];
 for(const x of candidates){
  if(x.member_only&&(!userId||!memberActive))continue;
  const maxUses=Number(x.max_uses_per_user||0);if(maxUses>0&&(!userId||(used.get(x.id)||0)>=maxUses))continue;
  let eligibleSubtotal=0;
  if(x.scope_mode==='all')eligibleSubtotal=subtotalIdr;
  else for(const item of items){
   const m=meta.get(item.productId);if(!m)continue;
   if(x.scope_mode==='products'){
    const targets=productTargets.get(x.id);if(targets&&(targets.has(item.productId)||(m.parentId&&targets.has(m.parentId))))eligibleSubtotal+=item.lineTotalIdr;
   }else{
    const targets=categoryTargets.get(x.id);if(targets&&[...m.categories].some(id=>targets.has(id)))eligibleSubtotal+=item.lineTotalIdr;
   }
  }
  if(eligibleSubtotal<=0)continue;
  let discount=x.discount_type==='percentage'?Math.floor(eligibleSubtotal*Number(x.discount_value)/100):Math.min(Number(x.discount_value),eligibleSubtotal);
  if(x.max_discount_idr!==null&&x.max_discount_idr!==undefined)discount=Math.min(discount,Number(x.max_discount_idr));
  discount=Math.min(discount,Math.max(0,subtotalIdr-voucherDiscountIdr));
  if(discount<=0)continue;
  eligible.push({id:x.id,title:x.title,discountIdr:discount,scopeMode:x.scope_mode,stackingRule:x.stacking_rule});
 }
 if(!eligible.length)return null;
 eligible.sort((a,b)=>{
  const pa=Number(candidates.find(x=>x.id===a.id)?.priority||0),pb=Number(candidates.find(x=>x.id===b.id)?.priority||0);
  return pa-pb||b.discountIdr-a.discountIdr||a.id.localeCompare(b.id);
 });
 return eligible[0];
}
