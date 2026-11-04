import {BadRequestException,Body,ConflictException,Controller,Get,Header,Injectable,Logger,OnModuleInit,Param,Post,Query,Req,UseGuards} from '@nestjs/common';
import {DatabaseService} from './database';
import {AdminGuard,type Principal} from './auth';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {validateHeroImage} from './hero-images';
import {MAX_IMAGE_BYTES} from './media';
import {CatalogWorkspaceService,catalogAudit} from './catalog-workspace';
import {inventoryLock} from './warehouses';

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
 p.image_url,NULL::text AS original_path,NULL::text AS media_id,NULL::text AS converted_product_id,
 'product.products'::text AS source_snapshot,p.updated_at AS source_updated_at,false AS read_only,
 ARRAY_REMOVE(ARRAY[CASE WHEN p.sku IS NULL THEN 'sku' END,CASE WHEN p.image_url IS NULL THEN 'photo' END],NULL) AS missing_fields,
 jsonb_build_object('id',p.id,'slug',p.slug,'name',p.name,'sku',p.sku,'brand_id',p.brand_id,'brand_name',b.name,
 'description',p.description,'category',p.category,'price_idr',p.price_idr::integer,'stock_qty',p.stock_qty,
 'image_url',p.image_url,'gallery_urls',p.gallery_urls,'is_active',p.is_active,
 'weight_grams',p.weight_grams,'length_cm',p.length_cm,'width_cm',p.width_cm,'height_cm',p.height_cm,'edit_version',p.edit_version) AS product
 FROM product.products p LEFT JOIN product.brands b ON b.id=p.brand_id WHERE p.slug NOT LIKE 'demo-%'
 UNION ALL
 SELECT 'existing:'||a.slug,'existing',NULL::text,a.slug,a.name,a.brand,a.category,NULL::text,
 NULL::integer,NULL::integer,false,a.historical_price,a.historical_original_price,
 NULL::text,a.image_path,m.id::text,link.product_id::text,a.source_snapshot,a.imported_at,true,
 CASE WHEN m.id IS NULL THEN ARRAY['sku','stock','current_price','description','variants','weight','photo']::text[]
 ELSE ARRAY['sku','stock','current_price','description','variants','weight']::text[] END,NULL::jsonb
 FROM product.legacy_archive a LEFT JOIN content.media_library_assets m
 ON m.original_path=('apps/web/public'||a.image_path) AND m.kind='product_image'
 LEFT JOIN product.catalog_source_rows link ON link.source_key='legacy_archive_v1' AND link.source_id=a.slug
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
 'converted_existing',(SELECT count(*)::integer FROM records WHERE record_kind='existing' AND converted_product_id IS NOT NULL),
 'existing_brands',(SELECT count(DISTINCT brand)::integer FROM records WHERE record_kind='existing')),
 'facets',jsonb_build_object(
 'brands',coalesce((SELECT jsonb_agg(brand ORDER BY brand) FROM (SELECT DISTINCT brand FROM records WHERE brand<>'') b),'[]'::jsonb),
 'categories',coalesce((SELECT jsonb_agg(category ORDER BY category) FROM (SELECT DISTINCT category FROM records) c),'[]'::jsonb),
 'snapshots',coalesce((SELECT jsonb_agg(source_snapshot ORDER BY source_snapshot) FROM (SELECT DISTINCT source_snapshot FROM records WHERE record_kind='existing') t),'[]'::jsonb))
) AS result`;

@Injectable()
export class AdminProductRecordsService implements OnModuleInit{
 private readonly log=new Logger('AdminProductRecords');
 constructor(private readonly db:DatabaseService,private readonly catalog:CatalogWorkspaceService){}
 async list(raw:Record<string,unknown>={}){
  const f=parseRecordQuery(raw);
  const r=await this.db.query<{result:{items:Record<string,unknown>[];matched:number;summary:Record<string,number>;facets:Record<string,string[]>}}>(productRecordsSql,
   [f.q,f.source,f.status,f.brand,f.category,f.pageSize,(f.page-1)*f.pageSize]);
  const data=r.rows[0].result;
  return {...data,page:f.page,pageSize:f.pageSize,pages:Math.ceil(data.matched/f.pageSize),
   hasMore:f.page*f.pageSize<data.matched,syncedAt:new Date().toISOString(),storage:'postgresql',scope:'admin_only',
   synchronization:'read_through_no_copy',existingReadOnly:true,fullWooCommerceExportVerified:false,
   existingPublicationEnabled:false,archiveConversionEnabled:true};
 }

 async convert(actor:Principal,slug:string,raw:unknown){
  if(!actor.emailVerified)throw new ConflictException('Administrator harus memiliki email terverifikasi');
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>120)throw new BadRequestException('Slug sumber tidak valid');
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw as object).length!==1||(raw as Record<string,unknown>).confirm!==true)
   throw new BadRequestException('Konfirmasi konversi draft diperlukan');
  const prior=await this.db.query('SELECT product_id FROM product.catalog_source_rows WHERE source_key=$1 AND source_id=$2',['legacy_archive_v1',slug]);
  if(prior.rows[0])return {created:false,productId:prior.rows[0].product_id,status:'draft_or_managed',replayed:true};
  const source=await this.db.query(
   "SELECT a.slug,a.name,a.brand,a.category,a.historical_price,a.historical_original_price,a.source_snapshot,m.content,m.mime_type,m.size_bytes,m.sha256,m.filename "+
   "FROM product.legacy_archive a LEFT JOIN content.media_library_assets m ON m.original_path=('apps/web/public'||a.image_path) AND m.kind='product_image' "+
   "WHERE a.slug=$1",[slug]);
  const a=source.rows[0];
  if(!a)throw new BadRequestException('Arsip tidak ditemukan');
  if(!Buffer.isBuffer(a.content)||a.content.length!==a.size_bytes||
     createHash('sha256').update(a.content).digest('hex')!==a.sha256)
   throw new ConflictException('Foto arsip belum tervalidasi. Konversi tidak dijalankan.');
  const validated=await validateHeroImage({buffer:a.content,originalname:a.filename,mimetype:a.mime_type,size:a.content.length});
  let display=validated.display;
  if(display.length>MAX_IMAGE_BYTES)display=await sharp(display).resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:77}).toBuffer();
  if(display.length>MAX_IMAGE_BYTES)throw new ConflictException('Foto arsip terlalu besar. Optimasi foto dahulu.');
  return this.db.transaction(async client=>{
   await inventoryLock(client);
   const existing=await client.query('SELECT product_id FROM product.catalog_source_rows WHERE source_key=$1 AND source_id=$2',['legacy_archive_v1',slug]);
   if(existing.rows[0])return {created:false,productId:existing.rows[0].product_id,status:'draft_or_managed',replayed:true};
   const category=await client.query("SELECT id FROM product.categories WHERE slug='other' AND is_active LIMIT 1");
   if(!category.rows[0])throw new ConflictException('Aktifkan kategori Other sebagai kategori draft sementara');
   const code='archive-'+slug.slice(0,75)+'-'+createHash('sha256').update(slug).digest('hex').slice(0,10);
   if((await client.query('SELECT 1 FROM product.products WHERE slug=$1',[code])).rows.length)
    throw new ConflictException('Draft ber-slug sama sudah ada; perlu rekonsiliasi manual');
   const image=await client.query<{id:string}>('INSERT INTO product.media_assets(uploaded_by,filename,mime_type,size_bytes,content) VALUES($1,$2,$3,$4,$5) RETURNING id',
    [actor.id,validated.filename,'image/webp',display.length,display]);
   const product={
    name:a.name,slug:code,sku:null,description:'',categoryIds:[category.rows[0].id],brand_id:null,
    fulfillment_owner_brand_id:null,image_url:'/api/media/'+image.rows[0].id,gallery_urls:[],
    price_idr:0,sale_price_idr:null,sale_starts_at:null,sale_ends_at:null,
    weight_grams:null,length_cm:null,width_cm:null,height_cm:null,product_type:'simple',attributes:[]
   };
   const saved=await this.catalog.saveFamily(client,actor,null,{product,variants:[],warehouseStocks:[]});
   if(saved.product.is_active)throw new ConflictException('Arsip hanya boleh dikonversi menjadi draft privat');
   await client.query('INSERT INTO product.catalog_source_rows(source_key,source_id,product_id) VALUES($1,$2,$3)',
    ['legacy_archive_v1',slug,saved.product.id]);
   await catalogAudit(client,actor.id,'archive_conversion',saved.product.id,'convert_to_private_draft',
    {slug:a.slug,name:a.name,brand:a.brand,category:a.category,sourceSnapshot:a.source_snapshot,
     historicalPrice:a.historical_price,historicalOriginalPrice:a.historical_original_price},
    {productId:saved.product.id,mediaId:image.rows[0].id,active:false,priceIdr:0,stockQty:0});
   return {created:true,productId:saved.product.id,status:'draft',sourceSlug:slug,priceIdr:0,
    stockQty:0,photoReady:true,needsReview:['sku','category','description','weight','dimensions','warehouse_stock','current_price','publication']};
  });
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
 @Post(':slug/convert') @Header('Cache-Control','private, no-store')
 convert(@Req() r:{user:Principal},@Param('slug') slug:string,@Body() body:unknown){return this.records.convert(r.user,slug,body);}
}
