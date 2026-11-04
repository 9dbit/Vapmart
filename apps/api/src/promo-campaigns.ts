import {BadRequestException,ConflictException,Injectable,NotFoundException} from '@nestjs/common';
import {DatabaseService} from './database';
import {requireActor,assertVersion,parsePage,pageResult} from './data-integrity';
import type {Principal} from './auth';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function obj(raw:unknown):Record<string,unknown>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Data campaign tidak valid');
 return raw as Record<string,unknown>;
}
function int(v:unknown,label:string,min:number,max:number):number{
 if(typeof v==='string'&&v.trim()!=='')v=Number(v);
 if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)throw new BadRequestException(label+' tidak valid');
 return v;
}
function optionalInt(v:unknown,label:string,min:number,max:number):number|null{
 return v===null||v===undefined||v===''?null:int(v,label,min,max);
}
function date(v:unknown,label:string):string|null{
 if(v===null||v===undefined||v==='')return null;
 if(typeof v!=='string'||Number.isNaN(Date.parse(v)))throw new BadRequestException(label+' tidak valid');
 return new Date(v).toISOString();
}
function validated(raw:Record<string,unknown>){
 const allowed=['name','campaignCode','discountType','discountValue','maxDiscountIdr','minSubtotalIdr','usageLimit','scopeType','targetIds','stackingPolicy','priority','startsAt','endsAt','isActive','expectedVersion'];
 if(Object.keys(raw).some(k=>!allowed.includes(k)))throw new BadRequestException('Kolom campaign tidak dikenal');
 const name=String(raw.name||'').trim();
 if(name.length<3||name.length>120)throw new BadRequestException('Nama campaign 3-120 karakter');
 const campaignCode=String(raw.campaignCode||'').trim().toUpperCase();
 if(!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(campaignCode))throw new BadRequestException('Kode campaign tidak valid');
 const discountType=raw.discountType;
 if(discountType!=='fixed'&&discountType!=='percent')throw new BadRequestException('Tipe diskon tidak valid');
 const discountValue=int(raw.discountValue,'Diskon',1,discountType==='percent'?100:2_000_000_000);
 const maxDiscountIdr=discountType==='percent'?optionalInt(raw.maxDiscountIdr,'Maksimum diskon',1,2_000_000_000):null;
 const minSubtotalIdr=int(raw.minSubtotalIdr??0,'Minimum belanja',0,2_000_000_000);
 const usageLimit=optionalInt(raw.usageLimit,'Kuota',1,10_000_000);
 const scopeType=raw.scopeType??'all';
 if(!['all','products','categories'].includes(String(scopeType)))throw new BadRequestException('Target campaign tidak valid');
 if(!Array.isArray(raw.targetIds))throw new BadRequestException('Daftar target wajib berupa array');
 const targetIds=[...new Set(raw.targetIds)];
 if(targetIds.some(x=>typeof x!=='string'||!uuid.test(x))||targetIds.length>200)throw new BadRequestException('Target campaign tidak valid');
 if((scopeType==='all'&&targetIds.length!==0)||(scopeType!=='all'&&targetIds.length===0))throw new BadRequestException('Target campaign belum sesuai scope');
 const stackingPolicy=raw.stackingPolicy??'exclusive';
 if(!['exclusive','allow_voucher'].includes(String(stackingPolicy)))throw new BadRequestException('Aturan stacking tidak valid');
 const priority=int(raw.priority??100,'Prioritas',0,10000);
 const startsAt=date(raw.startsAt,'Tanggal mulai'),endsAt=date(raw.endsAt,'Tanggal akhir');
 if(startsAt&&endsAt&&Date.parse(startsAt)>=Date.parse(endsAt))throw new BadRequestException('Periode campaign tidak valid');
 if(typeof raw.isActive!=='boolean')throw new BadRequestException('Status campaign tidak valid');
 return {name,campaignCode,discountType,discountValue,maxDiscountIdr,minSubtotalIdr,usageLimit,scopeType,stackingPolicy,priority,startsAt,endsAt,isActive:raw.isActive,targetIds};
}
@Injectable()
export class PromoCampaignService{
 constructor(private readonly db:DatabaseService){}
 async list(q:Record<string,unknown>={}){
  const f=parsePage(q);
  const r=await this.db.query(`WITH filtered AS (
   SELECT c.*,coalesce((SELECT jsonb_agg(t.target_id ORDER BY t.target_id) FROM product.promo_campaign_targets t WHERE t.campaign_id=c.id),'[]'::jsonb) target_ids
   FROM product.promo_campaigns c WHERE ($1::text='' OR strpos(lower(concat_ws(' ',c.name,c.campaign_code)),lower($1))>0)
  ), selected AS (SELECT * FROM filtered ORDER BY updated_at DESC,id DESC LIMIT $2 OFFSET $3)
  SELECT coalesce(jsonb_agg(to_jsonb(selected) ORDER BY updated_at DESC,id DESC),'[]'::jsonb) items,
   (SELECT count(*)::int FROM filtered) total FROM selected`,[f.q,f.pageSize,(f.page-1)*f.pageSize]);
  return pageResult(r.rows[0]?.items||[],Number(r.rows[0]?.total||0),f.page,f.pageSize);
 }
 async save(actor:Principal,id:string|null,raw:unknown){
  const operator=requireActor(actor),body=obj(raw),v=validated(body);
  if(id&&!uuid.test(id))throw new BadRequestException('ID campaign tidak valid');
  try{return await this.db.transaction(async client=>{
   let before:any=null;
   if(id){
    const found=await client.query('SELECT * FROM product.promo_campaigns WHERE id=$1 FOR UPDATE',[id]);
    before=found.rows[0];if(!before)throw new NotFoundException('Campaign tidak ditemukan');
    assertVersion(Number(before.edit_version),int(body.expectedVersion,'Versi campaign',1,2_000_000_000));
   }
   // Verify every target exists before persisting; archived categories cannot be targeted.
   if(v.targetIds.length){
    const table=v.scopeType==='products'?'product.products':'product.categories';
    const lookup=await client.query('SELECT id FROM '+table+' WHERE id=ANY($1::uuid[])',[v.targetIds]);
    if(lookup.rows.length!==v.targetIds.length)throw new BadRequestException('Ada target yang tidak ditemukan');
   }
   const values=[v.name,v.campaignCode,v.discountType,v.discountValue,v.maxDiscountIdr,v.minSubtotalIdr,v.usageLimit,v.scopeType,v.stackingPolicy,v.priority,v.startsAt,v.endsAt,v.isActive,operator];
   const result=id?await client.query(
    'UPDATE product.promo_campaigns SET name=$1,campaign_code=$2,discount_type=$3,discount_value=$4,max_discount_idr=$5,min_subtotal_idr=$6,usage_limit=$7,scope_type=$8,stacking_policy=$9,priority=$10,starts_at=$11,ends_at=$12,is_active=$13,updated_by=$14,updated_at=now(),edit_version=edit_version+1 WHERE id=$15 RETURNING *',[...values,id]
   ):await client.query(
    'INSERT INTO product.promo_campaigns(name,campaign_code,discount_type,discount_value,max_discount_idr,min_subtotal_idr,usage_limit,scope_type,stacking_policy,priority,starts_at,ends_at,is_active,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14) RETURNING *',values
   );
   const after=result.rows[0];
   await client.query('DELETE FROM product.promo_campaign_targets WHERE campaign_id=$1',[after.id]);
   for(const targetId of v.targetIds)await client.query('INSERT INTO product.promo_campaign_targets(campaign_id,target_type,target_id) VALUES($1,$2,$3)',[after.id,v.scopeType==='products'?'product':'category',targetId]);
   await client.query('INSERT INTO product.catalog_audit(actor_id,entity_type,entity_id,action,before_data,after_data) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',[operator,'promo_campaign',after.id,id?'update':'create',before?JSON.stringify(before):null,JSON.stringify({...after,targetIds:v.targetIds})]);
   return {...after,target_ids:v.targetIds};
  });}catch(e:any){if(e?.code==='23505')throw new ConflictException('Kode campaign sudah digunakan');throw e;}
 }
}
