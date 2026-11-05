import {BadRequestException,ConflictException,Injectable,NotFoundException} from '@nestjs/common';
import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {DatabaseService} from './database';
import type {Principal} from './auth';
import {requireActor} from './data-integrity';
import {inventoryLock,requireUuid} from './warehouses';
import {CatalogWorkspaceService,catalogAudit,family} from './catalog-workspace';
import {parseCSV,importFields,csvInteger,plainDescription,slugify} from './catalog-csv';
import * as V from './catalog-validation';
type Issue={row:number;field:string;message:string};
function message(e:unknown){return e instanceof Error?e.message:'Data tidak valid';}
function dt(s:string){if(!s.trim())return null;const t=s.trim().replace(' ','T');return V.date(/(?:Z|[+-]\d\d:\d\d)$/.test(t)?t:(t.includes('T')?t:t+'T00:00:00')+'+07:00');}
function existingVariant(v:any){return {id:v.id,expectedVersion:v.edit_version,sku:v.sku,price_idr:Number(v.price_idr),sale_price_idr:v.sale_price_idr===null?null:Number(v.sale_price_idr),sale_starts_at:v.sale_starts_at,sale_ends_at:v.sale_ends_at,option_values:v.option_values,enabled:v.is_active,image_url:v.image_url,gallery_urls:v.gallery_urls,weight_grams:v.weight_grams,length_cm:v.length_cm,width_cm:v.width_cm,height_cm:v.height_cm,warehouseStocks:[]};}
@Injectable()
export class CatalogImportService{
 constructor(private readonly db:DatabaseService,private readonly catalog:CatalogWorkspaceService){}
 private receipt(row:any){const p=row.plan;return {id:row.id,state:row.state,expiresAt:row.expires_at,report:row.report,columns:p.columns,mapping:p.mapping,summary:p.summary,errors:p.errors,warnings:p.warnings,rows:p.rows,newProductsAreDraft:true,existingStatusPreserved:true,blankStockIgnored:true};}
 async get(actor:Principal,id:string){requireUuid(id,'impor');const r=(await this.db.query('SELECT * FROM product.catalog_imports WHERE id=$1 AND actor_id=$2',[id,requireActor(actor)])).rows[0];if(!r)throw new NotFoundException();return this.receipt(r);}
 async preview(actor:Principal,raw:unknown){
  const who=requireActor(actor),x=V.record(raw,['csv','mapping','sourceKey','mode','warehouseId','warehouseColumns']);
  const sourceKey=V.text(x.sourceKey,'Nama sumber',2,80);if(!/^[a-zA-Z0-9._-]+$/.test(sourceKey))throw new BadRequestException('Nama sumber hanya huruf, angka, titik, garis bawah dan tanda hubung');
  if(!['create','upsert'].includes(x.mode))throw new BadRequestException('Mode impor tidak valid');
  const parsed=parseCSV(x.csv),custom=V.record(x.mapping??{});if(Object.keys(custom).some(k=>!Object.hasOwn(importFields,k)))throw new BadRequestException('Pemetaan tidak dikenal');
  const mapping:Record<string,string>={};for(const [k,header] of Object.entries(importFields)){const selected=custom[k]??(parsed.headers.includes(header)?header:'');if(typeof selected!=='string'||selected&&!parsed.headers.includes(selected))throw new BadRequestException('Kolom pemetaan tidak ditemukan');mapping[k]=selected;}
  if(!mapping.name)throw new BadRequestException('Petakan kolom nama produk');
  const warehouseId=x.warehouseId?requireUuid(x.warehouseId,'gudang impor'):null,warehouseColumns=V.record(x.warehouseColumns??{});
  if(Object.keys(warehouseColumns).length>50)throw new BadRequestException('Terlalu banyak kolom gudang');
  for(const [header,id] of Object.entries(warehouseColumns)){if(!parsed.headers.includes(header))throw new BadRequestException('Kolom stok tidak ditemukan');requireUuid(id,'gudang');}
  const finger=createHash('sha256').update(JSON.stringify({csv:x.csv,mapping,sourceKey,mode:x.mode,warehouseId,warehouseColumns})).digest('hex');
  const replay=(await this.db.query("SELECT * FROM product.catalog_imports WHERE actor_id=$1 AND fingerprint=$2 AND (state='applied' OR expires_at>now())",[who,finger])).rows[0];if(replay)return {...this.receipt(replay),replayed:true};
  const errors:Issue[]=[],warnings:Issue[]=[...parsed.warnings],display:any[]=[],groups:any[]=[];
  const get=(row:Record<string,string>,key:string)=>mapping[key]?row[mapping[key]]?.trim()||'':'';
  const input=parsed.rows.map((raw,i)=>({raw,row:i+2,type:(get(raw,'type')||'simple').toLowerCase(),sourceId:get(raw,'id')||'sku:'+get(raw,'sku').toUpperCase(),sku:get(raw,'sku').toUpperCase(),name:get(raw,'name'),parent:get(raw,'parent')}));
  const sourceIds=new Set<string>(),skus=new Set<string>();
  for(const row of input){
   if(!['simple','variable','variation'].includes(row.type))errors.push({row:row.row,field:'type',message:'Hanya simple, variable dan variation yang didukung'});
   if(!row.name)errors.push({row:row.row,field:'name',message:'Nama wajib diisi'});
   if(row.sourceId==='sku:')errors.push({row:row.row,field:'id',message:'ID sumber atau SKU diperlukan agar impor tidak menggandakan produk'});
   if(sourceIds.has(row.sourceId))errors.push({row:row.row,field:'id',message:'ID sumber ganda'});sourceIds.add(row.sourceId);
   if(row.sku){if(skus.has(row.sku))errors.push({row:row.row,field:'sku',message:'SKU ganda dalam CSV'});skus.add(row.sku);}
  }
  const roots=input.filter(r=>r.type!=='variation');if(roots.length>1000)throw new BadRequestException('Maksimal 1.000 produk utama per impor');
  const known=(await this.db.query('SELECT * FROM product.products WHERE sku=ANY($1::text[]) AND archived_at IS NULL',[[...skus]])).rows;
  const source=(await this.db.query('SELECT source_id,product_id FROM product.catalog_source_rows WHERE source_key=$1 AND source_id=ANY($2::text[])',[sourceKey,[...sourceIds]])).rows;
  const mapped=new Map(source.map(r=>[r.source_id,r.product_id])),knownBySku=new Map(known.map(r=>[r.sku,r]));
  const allWarehouses=(await this.db.query('SELECT id,code,is_active,is_system_hold FROM product.warehouses')).rows;
  const brands=(await this.db.query('SELECT id,name FROM product.brands')).rows;
  const children=new Map<number,typeof input>();
  for(const v of input.filter(r=>r.type==='variation')){
   const parent=roots.find(p=>v.parent.startsWith('id:')?p.sourceId===v.parent.slice(3):p.sku&&p.sku===v.parent.toUpperCase()||p.sourceId===v.parent);
   if(!parent||parent.type!=='variable'){errors.push({row:v.row,field:'parent',message:'Induk variable tidak ditemukan; sertakan baris induk dengan ID/SKU yang sesuai'});continue;}
   children.set(parent.row,[...(children.get(parent.row)??[]),v]);
  }
  for(const row of roots){
   let before:any=null,oldVariants:any[]=[],stock:any[]=[];
   try{
    const mappedId=mapped.get(row.sourceId),bySku=knownBySku.get(row.sku);
    if(mappedId&&bySku&&mappedId!==bySku.id)throw new ConflictException('ID sumber dan SKU menunjuk produk yang berbeda');
    const id=mappedId||bySku?.id||null;
    if(id){if(x.mode==='create')throw new ConflictException('Produk existing terdeteksi; pilih mode perbarui berdasarkan ID sumber/SKU');const f=await family(this.db,id);before=f.product;oldVariants=f.variants;stock=f.stock;
     if(before.parent_product_id||before.product_type!==row.type)throw new ConflictException('Jenis produk existing berbeda');}
    const attrs:V.Attribute[]=[];
    for(let n=1;n<=3;n++){const name=get(row.raw,'attribute'+n),values=get(row.raw,'values'+n);if(name||values)attrs.push({name,values:values.split(',').map(s=>s.trim()).filter(Boolean)});}
    const definitions=V.attributes(attrs.length?attrs:before?.attributes??[]);
    if(row.type==='variable'&&!definitions.length)throw new BadRequestException('Produk variable memerlukan definisi atribut');
    if(row.type==='simple'&&definitions.length)warnings.push({row:row.row,field:'attributes',message:'Atribut deskriptif simple tidak membentuk varian; detail sumber tetap di preview'});
    const gallery=get(row.raw,'images')?get(row.raw,'images').split(',').map(s=>V.imageUrl(s.trim())).filter(Boolean):null;
    if(gallery&&gallery.length>21)throw new BadRequestException('Maksimal satu gambar utama dan 20 pendukung');
    const paths=get(row.raw,'categories').split(',').filter(s=>s.trim()).map(s=>s.split('>').map(p=>V.text(p.trim(),'Kategori',2,100)));
    if(paths.some(p=>p.length>5)||paths.length>15)throw new BadRequestException('Kategori maksimal lima tingkat dan 15 pilihan');paths.forEach(p=>V.safeCatalogTerms(p));
    const brandName=get(row.raw,'brand'),brand=brandName?brands.find(b=>b.name.toLowerCase()===brandName.toLowerCase()):null;
    if(brandName&&!brand)warnings.push({row:row.row,field:'brand',message:'Brand sumber belum cocok. Produk tidak otomatis dikaitkan ke mitra; brand lama dipertahankan atau kosong.'});
    const price=get(row.raw,'regularPrice')?csvInteger(get(row.raw,'regularPrice'),'Harga normal'):before?Number(before.price_idr):row.type==='variable'?0:null;
    if(price===null)throw new BadRequestException('Harga normal produk simple belum diisi');
    const product:any={name:V.text(row.name,'Nama',2,140),slug:before?.slug||get(row.raw,'slug')||slugify(row.name).slice(0,100)+'-'+createHash('sha256').update(sourceKey+':'+row.sourceId).digest('hex').slice(0,10),
     sku:V.sku(row.sku||before?.sku),description:plainDescription(get(row.raw,'description')||get(row.raw,'shortDescription')||before?.description||''),
     categoryIds:before?.category_ids??[],brand_id:brand?.id||before?.brand_id||null,fulfillment_owner_brand_id:before?.fulfillment_owner_brand_id??null,product_type:row.type,attributes:row.type==='variable'?definitions:[],
     image_url:gallery?.[0]||before?.image_url||null,gallery_urls:gallery?gallery.slice(1):before?.gallery_urls??[],price_idr:price,sale_price_idr:mapping.salePrice?csvInteger(get(row.raw,'salePrice'),'Harga promo',true):before?.sale_price_idr==null?null:Number(before.sale_price_idr),sale_starts_at:mapping.saleStart?dt(get(row.raw,'saleStart')):before?.sale_starts_at??null,sale_ends_at:mapping.saleEnd?dt(get(row.raw,'saleEnd')):before?.sale_ends_at??null};
    for(const [field,key] of [['weight_grams','weight'],['length_cm','length'],['width_cm','width'],['height_cm','height']] as const)product[field]=get(row.raw,key)?(csvInteger(get(row.raw,key),key)||null):before?.[field]??null;
    V.slug(product.slug);V.text(product.description,'Deskripsi',0,20000);V.priceFields(product);V.safeCatalogTerms(product.name,product.description,product.slug,product.sku,product.attributes);
    const stocksFor=(r:typeof row,productId:string|null)=>{
     const values:Record<string,number>={};const rawStock=get(r.raw,'stock');
     if(rawStock!==''){if(!warehouseId)throw new BadRequestException('Pilih gudang tujuan untuk kolom Stock, atau kosongkan pemetaan Stock');values[warehouseId]=csvInteger(rawStock,'Stok')!;}
     for(const [header,wid] of Object.entries(warehouseColumns))if(r.raw[header].trim()!==''){
      if(Object.hasOwn(values,String(wid)))throw new BadRequestException('Dua kolom mengisi gudang yang sama');values[String(wid)]=csvInteger(r.raw[header],'Stok')!;
     }
     if(!Object.keys(values).length)warnings.push({row:r.row,field:'stock',message:'Stok kosong: saldo tidak diubah dan tidak dianggap hasil hitung fisik'});
     return Object.entries(values).map(([wid,onHand])=>{const w=allWarehouses.find(w=>w.id===wid);if(!w?.is_active||w.is_system_hold)throw new BadRequestException('Gudang impor harus fisik dan aktif');const old=stock.find(s=>s.product_id===productId&&s.warehouse_id===wid);
      if(onHand<(old?.reserved??0))throw new BadRequestException('Stok tidak boleh kurang dari reservasi');return {warehouseId:wid,onHand,expectedOnHand:old?.on_hand??0,expectedReserved:old?.reserved??0,notes:'Impor '+sourceKey+' record '+r.sourceId};});
    };
    const variants:any[]=oldVariants.map(existingVariant),refs:any[]=[{sourceId:row.sourceId,variantOptions:null,expectedId:before?.id??null}];
    for(const child of children.get(row.row)??[]){
     try{
      const opt:Record<string,string>={};for(let n=1;n<=3;n++){const key=get(child.raw,'attribute'+n),val=get(child.raw,'values'+n);if(key){const def=definitions.find(d=>d.name.toLowerCase()===key.toLowerCase());if(!def)throw new BadRequestException('Atribut varian tidak cocok dengan induk');opt[def.name]=val;}}
      const normalized=V.options(opt,definitions),mappedChild=mapped.get(child.sourceId),oldBySku=child.sku?knownBySku.get(child.sku):null;
      if(mappedChild&&oldBySku&&mappedChild!==oldBySku.id)throw new ConflictException('ID dan SKU varian berbeda');
      const oldId=mappedChild||oldBySku?.id,old=oldId?oldVariants.find(v=>v.id===oldId):null;if(oldId&&!old)throw new ConflictException('Varian sudah terkait dengan produk lain');
      const pics=get(child.raw,'images')?get(child.raw,'images').split(',').map(s=>V.imageUrl(s.trim())):null;
      if(pics&&pics.length>21)throw new BadRequestException('Maksimal 21 gambar varian');
      const vp:any={id:old?.id,expectedVersion:old?.edit_version,sku:V.sku(child.sku||old?.sku),option_values:normalized,enabled:old?.is_active??true,
       price_idr:get(child.raw,'regularPrice')?csvInteger(get(child.raw,'regularPrice'),'Harga varian'):old?Number(old.price_idr):null,
       sale_price_idr:mapping.salePrice?csvInteger(get(child.raw,'salePrice'),'Harga promo varian',true):old?.sale_price_idr==null?null:Number(old.sale_price_idr),sale_starts_at:mapping.saleStart?dt(get(child.raw,'saleStart')):old?.sale_starts_at??null,sale_ends_at:mapping.saleEnd?dt(get(child.raw,'saleEnd')):old?.sale_ends_at??null,
       image_url:pics?.[0]||old?.image_url||product.image_url,gallery_urls:pics?pics.slice(1):old?.gallery_urls??product.gallery_urls,warehouseStocks:stocksFor(child,old?.id??null)};
      if(vp.price_idr===null)throw new BadRequestException('Harga varian belum diisi');V.priceFields(vp);V.safeCatalogTerms(vp.sku,normalized);
      for(const [field,key] of [['weight_grams','weight'],['length_cm','length'],['width_cm','width'],['height_cm','height']] as const)vp[field]=get(child.raw,key)?(csvInteger(get(child.raw,key),key)||null):old?.[field]??product[field];
      const index=old?variants.findIndex(v=>v.id===old.id):-1;if(index>=0)variants[index]=vp;else variants.push(vp);
      refs.push({sourceId:child.sourceId,variantOptions:normalized,expectedId:old?.id??null});display.push({row:child.row,type:'variation',name:child.name,sku:vp.sku,action:old?'update':'create',stockSpecified:vp.warehouseStocks.length>0});
     }catch(e){errors.push({row:child.row,field:'variant',message:message(e)});}
    }
    if(row.type==='variable'){
     if(get(row.raw,'stock'))throw new BadRequestException('Stok induk variable tidak diimpor; isi stok pada baris variation');
     if(!variants.length||variants.length>200)throw new BadRequestException('Produk variable membutuhkan 1-200 varian');
     const keys=variants.map(v=>JSON.stringify(V.options(v.option_values,definitions)));if(new Set(keys).size!==keys.length)throw new BadRequestException('Kombinasi variasi ganda');
    }
    const warehouseStocks=row.type==='simple'?stocksFor(row,before?.id??null):[];
    if(gallery)warnings.push({row:row.row,field:'images',message:'URL gambar dipertahankan; tidak ada unduhan server atau verifikasi hak penggunaan otomatis'});
    if(!product.sku)warnings.push({row:row.row,field:'sku',message:'SKU belum diisi; publikasi SKU simple/varian tetap memerlukan SKU unik'});
    groups.push({row:row.row,id:before?.id??null,expectedVersion:before?.edit_version,product,variants,warehouseStocks,categoryPaths:paths,sourceRefs:refs});
    display.push({row:row.row,type:row.type,name:product.name,sku:product.sku,action:before?'update':'create',stockSpecified:warehouseStocks.length>0});
   }catch(e){errors.push({row:row.row,field:'product',message:message(e)});}
  }
  const plan={columns:parsed.headers,mapping,sourceKey,mode:x.mode,groups,errors,warnings,rows:display.sort((a,b)=>a.row-b.row),summary:{rows:input.length,products:roots.length,variants:input.length-roots.length,create:display.filter(r=>r.action==='create').length,update:display.filter(r=>r.action==='update').length,errors:errors.length,warnings:warnings.length}};
  const saved=(await this.db.query(`INSERT INTO product.catalog_imports(actor_id,fingerprint,source_key,mode,plan) VALUES($1,$2,$3,$4,$5::jsonb)
 ON CONFLICT(actor_id,fingerprint) DO UPDATE SET plan=CASE WHEN product.catalog_imports.state='preview' THEN EXCLUDED.plan ELSE product.catalog_imports.plan END,expires_at=CASE WHEN product.catalog_imports.state='preview' THEN now()+interval '30 minutes' ELSE product.catalog_imports.expires_at END RETURNING *`,[who,finger,sourceKey,x.mode,JSON.stringify(plan)])).rows[0];return this.receipt(saved);
 }
 private async resolveCategories(client:PoolClient,actor:string,paths:string[][],previous:string[]){
  if(!paths.length){if(previous.length)return previous;return [(await client.query("SELECT id FROM product.categories WHERE slug='other' AND is_active")).rows[0]?.id].filter(Boolean);}
  const ids:string[]=[];
  for(const path of paths){let parent:string|null=null;let joined='';
   for(const name of path){joined+=(joined?'-':'')+slugify(name);const code=joined.length>110?joined.slice(0,95)+'-'+createHash('sha256').update(joined).digest('hex').slice(0,10):joined;
    const found:any[]=(await client.query('SELECT * FROM product.categories WHERE (lower(name)=lower($1) AND parent_id IS NOT DISTINCT FROM $2::uuid) OR slug=$3 ORDER BY id',[name,parent,code])).rows;
    if(found.length>1)throw new ConflictException('Kategori sumber ambigu: '+name);
    let c:any=found[0];if(c&&(!c.is_active||c.parent_id!==parent))throw new ConflictException('Kategori sumber tidak cocok atau nonaktif: '+name);
    if(!c){c=(await client.query('INSERT INTO product.categories(name,slug,parent_id) VALUES($1,$2,$3) RETURNING *',[name,code,parent])).rows[0];await catalogAudit(client,actor,'category',c.id,'import_create',null,c);}
    parent=c.id;
   }
   if(parent)ids.push(parent);
  }
  return [...new Set(ids)];
 }
 async apply(actor:Principal,id:string,raw:unknown){
  const who=requireActor(actor),x=V.record(raw,['confirm']);requireUuid(id,'impor');if(x.confirm!==true)throw new BadRequestException('Konfirmasi preview impor diperlukan');
  try{return await this.db.transaction(async client=>{await inventoryLock(client);
   const job=(await client.query('SELECT * FROM product.catalog_imports WHERE id=$1 AND actor_id=$2 FOR UPDATE',[id,who])).rows[0];if(!job)throw new NotFoundException();if(job.state==='applied')return {report:job.report,replayed:true};
   if(new Date(job.expires_at).valueOf()<=Date.now())throw new ConflictException('Preview kedaluwarsa; buat preview baru');if(job.plan.errors.length)throw new ConflictException('Perbaiki seluruh error sebelum impor');
   const report={productsCreated:0,productsUpdated:0,variantsCreated:0,variantsUpdated:0,stockChanges:0,rows:[] as any[],paymentEnabled:false};
   for(const g of job.plan.groups){
    for(const ref of g.sourceRefs){const current=(await client.query('SELECT product_id FROM product.catalog_source_rows WHERE source_key=$1 AND source_id=$2 FOR UPDATE',[job.source_key,ref.sourceId])).rows[0];if(current&&current.product_id!==ref.expectedId)throw new ConflictException('Sumber sudah diimpor oleh proses lain. Muat ulang preview.');}
    g.product.categoryIds=await this.resolveCategories(client,who,g.categoryPaths,g.product.categoryIds);
    const saved=await this.catalog.saveFamily(client,actor,g.id,g);if(g.id)report.productsUpdated++;else report.productsCreated++;
    for(const ref of g.sourceRefs){const target=ref.variantOptions?saved.variants.find((v:any)=>Object.entries(ref.variantOptions).every(([k,val])=>v.option_values[k]===val)):saved.product;if(!target)throw new ConflictException('Pemetaan hasil varian gagal');
     await client.query('INSERT INTO product.catalog_source_rows(source_key,source_id,product_id) VALUES($1,$2,$3) ON CONFLICT(source_key,source_id) DO NOTHING',[job.source_key,ref.sourceId,target.id]);
     if(ref.variantOptions){if(ref.expectedId)report.variantsUpdated++;else report.variantsCreated++;}
     report.rows.push({sourceId:ref.sourceId,productId:target.id,status:ref.expectedId?'updated':'created'});
    }
    report.stockChanges+=[...g.warehouseStocks,...g.variants.flatMap((v:any)=>v.warehouseStocks??[])].filter((s:any)=>s.onHand!==s.expectedOnHand).length;
   }
   await client.query("UPDATE product.catalog_imports SET state='applied',report=$2::jsonb,applied_at=now() WHERE id=$1",[id,JSON.stringify(report)]);await catalogAudit(client,who,'import',id,'apply',null,report);return {report,replayed:false};
  });}catch(e){if((e as {code?:string}).code==='23505')throw new ConflictException('Data berubah sejak preview: SKU, slug, atau variasi sudah digunakan. Buat preview baru.');throw e;}
 }
}
