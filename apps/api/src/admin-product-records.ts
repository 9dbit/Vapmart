import {BadRequestException,Controller,Get,Header,Injectable,Logger,OnModuleInit,Query,UseGuards} from '@nestjs/common';
import {DatabaseService} from './database';
import {AdminGuard} from './auth';

export function parseRecordQuery(raw:Record<string,unknown>={}){
 const allowed=['q','source','status','brand','category','page','pageSize'];
 if(Object.keys(raw).some(k=>!allowed.includes(k)))throw new BadRequestException('Unknown catalog filter');
 function text(key:string,fallback:string,max:number){const v=raw[key];if(v===undefined)return fallback;if(typeof v!=='string'||v.length>max)throw new BadRequestException('Invalid '+key);return v.trim();}
 const q=text('q','',120),source=text('source','all',16),status=text('status','all',16);
 const brand=text('brand','',100),category=text('category','',80);
 if(!['all','existing','managed'].includes(source)||!['all','published','draft','unverified'].includes(status))throw new BadRequestException('Unsupported catalog filter');
 function integer(key:string,defaultValue:number,max:number){const v=text(key,String(defaultValue),8);if(!/^[1-9][0-9]*$/.test(v)||Number(v)>max)throw new BadRequestException('Invalid '+key);return Number(v);}
 return {q,source,status,brand,category,page:integer('page',1,100000),pageSize:integer('pageSize',24,100)};
}

// Read-through projection only. Missing SKU/stock stays NULL; historical prices
// never overwrite current prices. No product, brand, inventory or payment writes.
export const productRecordsSql=`WITH records AS (
 SELECT 'managed:'||p.id::text AS record_id,'managed'::text AS record_kind,
 p.id::text AS product_id,p.slug,p.name,coalesce(b.name,'') AS brand,p.category,p.sku,
 p.price_idr::integer AS price_idr,p.stock_qty,p.is_active,
 NULL::text AS historical_price,NULL::text AS historical_original_price,
 p.image_url,NULL::text AS original_path,NULL::text AS media_id,
 'product.products'::text AS source_snapshot,p.updated_at AS source_updated_at,false AS read_only,
 ARRAY_REMOVE(ARRAY[CASE WHEN p.sku IS NULL THEN 'sku' END,CASE WHEN p.image_url IS NULL THEN 'photo' END],NULL) AS missing_fields,
 jsonb_build_object('id',p.id,'slug',p.slug,'name',p.name,'sku',p.sku,'brand_id',p.brand_id,'brand_name',b.name,
 'description',p.description,'category',p.category,'price_idr',p.price_idr::integer,'stock_qty',p.stock_qty,
 'image_url',p.image_url,'gallery_urls',p.gallery_urls,'is_active',p.is_active,
 'weight_grams',p.weight_grams,'length_cm',p.length_cm,'width_cm',p.width_cm,'height_cm',p.height_cm) AS product
 FROM product.products p LEFT JOIN product.brands b ON b.id=p.brand_id WHERE p.slug NOT LIKE 'demo-%'
 UNION ALL
 SELECT 'existing:'||a.slug,'existing',NULL::text,a.slug,a.name,a.brand,a.category,NULL::text,
 NULL::integer,NULL::integer,false,a.historical_price,a.historical_original_price,
 NULL::text,a.image_path,m.id::text,a.source_snapshot,a.imported_at,true,
 CASE WHEN m.id IS NULL THEN ARRAY['sku','stock','current_price','description','variants','weight','photo']::text[]
 ELSE ARRAY['sku','stock','current_price','description','variants','weight']::text[] END,NULL::jsonb
 FROM product.legacy_archive a LEFT JOIN content.media_library_assets m
 ON m.original_path=('apps/web/public'||a.image_path) AND m.kind='product_image'
), filtered AS (
 SELECT * FROM records WHERE ($1::text='' OR strpos(lower(concat_ws(' ',name,slug,sku,brand,category)),lower($1))>0)
 AND ($2::text='all' OR record_kind=$2)
 AND ($3::text='all' OR ($3='published' AND record_kind='managed' AND is_active)
 OR ($3='draft' AND record_kind='managed' AND NOT is_active) OR ($3='unverified' AND record_kind='existing'))
 AND ($4::text='' OR brand=$4) AND ($5::text='' OR category=$5)
), selected AS (
 SELECT * FROM filtered ORDER BY record_kind,name,record_id LIMIT $6 OFFSET $7
)
SELECT jsonb_build_object(
 'items',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.record_kind,s.name,s.record_id) FROM selected s),'[]'::jsonb),
 'matched',(SELECT count(*)::integer FROM filtered),
 'summary',jsonb_build_object('total',(SELECT count(*)::integer FROM records),
 'existing',(SELECT count(*)::integer FROM records WHERE record_kind='existing'),
 'managed',(SELECT count(*)::integer FROM records WHERE record_kind='managed'),
 'published',(SELECT count(*)::integer FROM records WHERE record_kind='managed' AND is_active),
 'drafts',(SELECT count(*)::integer FROM records WHERE record_kind='managed' AND NOT is_active),
 'existing_media_linked',(SELECT count(*)::integer FROM records WHERE record_kind='existing' AND media_id IS NOT NULL),
 'existing_media_missing',(SELECT count(*)::integer FROM records WHERE record_kind='existing' AND media_id IS NULL),
 'existing_brands',(SELECT count(DISTINCT brand)::integer FROM records WHERE record_kind='existing')),
 'facets',jsonb_build_object(
 'brands',coalesce((SELECT jsonb_agg(brand ORDER BY brand) FROM (SELECT DISTINCT brand FROM records WHERE brand<>'') b),'[]'::jsonb),
 'categories',coalesce((SELECT jsonb_agg(category ORDER BY category) FROM (SELECT DISTINCT category FROM records) c),'[]'::jsonb),
 'snapshots',coalesce((SELECT jsonb_agg(source_snapshot ORDER BY source_snapshot) FROM (SELECT DISTINCT source_snapshot FROM records WHERE record_kind='existing') t),'[]'::jsonb))
) AS result`;

@Injectable()
export class AdminProductRecordsService implements OnModuleInit{
 private readonly log=new Logger('AdminProductRecords');
 constructor(private readonly db:DatabaseService){}
 async list(raw:Record<string,unknown>={}){
  const f=parseRecordQuery(raw);
  const r=await this.db.query<{result:{items:Record<string,unknown>[];matched:number;summary:Record<string,number>;facets:Record<string,string[]>}}>(productRecordsSql,
   [f.q,f.source,f.status,f.brand,f.category,f.pageSize,(f.page-1)*f.pageSize]);
  const data=r.rows[0].result;
  return {...data,page:f.page,pageSize:f.pageSize,pages:Math.ceil(data.matched/f.pageSize),
   hasMore:f.page*f.pageSize<data.matched,syncedAt:new Date().toISOString(),storage:'postgresql',scope:'admin_only',
   synchronization:'read_through_no_copy',existingReadOnly:true,fullWooCommerceExportVerified:false,
   existingPublicationEnabled:false};
 }
 async onModuleInit(){
  if(!this.db.configured)return;
  try{const r=await this.list({pageSize:'1'});this.log.log('VAPMART_EXISTING_PRODUCTS_SYNC '+JSON.stringify({summary:r.summary,storage:r.storage,existingPublicationEnabled:false}));}
  catch{this.log.warn('Existing product source verification unavailable; protected endpoint will fail closed.');}
 }
}
@Controller('v1/admin/product-records')
@UseGuards(AdminGuard)
export class AdminProductRecordsController{
 constructor(private readonly records:AdminProductRecordsService){}
 @Get() @Header('Cache-Control','private, no-store')
 list(@Query() query:Record<string,unknown>){return this.records.list(query);}
}
