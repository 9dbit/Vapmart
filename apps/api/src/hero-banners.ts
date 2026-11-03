import {BadRequestException,ConflictException,Injectable,NotFoundException} from '@nestjs/common';
import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {DatabaseService} from './database';
import type {Principal} from './auth';
import {validateHeroImage,type HeroUpload} from './hero-images';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function heroId(id:unknown):string{if(typeof id!=='string'||!uuid.test(id))throw new BadRequestException('ID banner tidak valid.');return id;}
function object(raw:unknown,keys:string[]){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Data banner diperlukan.');
 const v=raw as Record<string,unknown>;
 if(Object.keys(v).some(k=>!keys.includes(k)))throw new BadRequestException('Kolom banner tidak dikenali.');
 return v;
}
function version(n:unknown):number{if(!Number.isSafeInteger(n)||Number(n)<1)throw new BadRequestException('Versi data diperlukan. Muat ulang daftar.');return Number(n);}
export function parseHero(raw:unknown,editing=false){
 const v=object(raw,['title','alt','desktopAssetId','mobileAssetId',...(editing?['expectedVersion']:['idempotencyKey'])]);
 const title=typeof v.title==='string'?v.title.trim():'',alt=typeof v.alt==='string'?v.alt.trim():'';
 if(!title||title.length>120||!alt||alt.length>240||/[\x00-\x1f\x7f]/.test(title+alt))throw new BadRequestException('Nama 1-120 karakter dan teks alternatif 1-240 karakter diperlukan.');
 return {title,alt,idempotencyKey:editing?undefined:heroId(v.idempotencyKey),desktop:v.desktopAssetId===undefined&&editing?undefined:heroId(v.desktopAssetId),
  mobile:v.mobileAssetId===undefined&&editing?undefined:heroId(v.mobileAssetId),expectedVersion:editing?version(v.expectedVersion):undefined};
}
const select=`SELECT id,title,alt_text AS alt,desktop_asset_id AS "desktopAssetId",mobile_asset_id AS "mobileAssetId",
 desktop_path AS "desktopPath",mobile_path AS "mobilePath",position,is_active AS active,edit_version AS "editVersion",
 deleted_at AS "deletedAt",created_at AS "createdAt",updated_at AS "updatedAt" FROM content.hero_banners`;
@Injectable()
export class HeroBannersService{
 constructor(private readonly db:DatabaseService){}
 private async locked<T>(fn:(c:PoolClient,revision:number)=>Promise<T>){
  return this.db.transaction(async c=>{const r=await c.query('SELECT revision FROM content.hero_banner_state WHERE singleton=true FOR UPDATE');return fn(c,r.rows[0].revision);});
 }
 private async changed(c:PoolClient,actor:Principal,id:string|null,action:string,before:unknown,after:unknown){
  await c.query('INSERT INTO content.hero_banner_audit(banner_id,actor_id,action,before_data,after_data) VALUES($1,$2,$3,$4,$5)',[id,actor.id,action,JSON.stringify(before),JSON.stringify(after)]);
  await c.query('UPDATE content.hero_banner_state SET revision=revision+1 WHERE singleton=true');
 }
 private async current(c:PoolClient,id:string,expected:unknown){
  heroId(id);const r=await c.query(select+' WHERE id=$1 FOR UPDATE',[id]);
  const row=r.rows[0];if(!row)throw new NotFoundException('Banner tidak ditemukan.');
  if(row.editVersion!==version(expected))throw new ConflictException('Banner diubah operator lain. Input Anda tetap tersimpan; muat ulang sebelum menyimpan lagi.');
  return row;
 }
 private async assetExists(c:PoolClient,id:string|undefined){
  if(id&&(await c.query('SELECT 1 FROM content.hero_banner_assets WHERE id=$1',[id])).rowCount!==1)throw new BadRequestException('Gambar belum diunggah atau tidak ditemukan.');
 }
 private async capacity(c:PoolClient){const n=await c.query('SELECT count(*)::int AS n FROM content.hero_banners WHERE deleted_at IS NULL');if(n.rows[0].n>=30)throw new BadRequestException('Maksimal 30 banner. Pindahkan banner yang tidak digunakan ke sampah.');}
 async list(){
  return this.locked(async(c,revision)=>({items:(await c.query(select+' ORDER BY position,id')).rows,revision,maxBanners:30,maxFileBytes:5242880}));
 }
 async publicList(){
  const r=await this.db.query(select+' WHERE is_active=true AND deleted_at IS NULL ORDER BY position,id');
  return {items:r.rows.map(b=>({key:b.id,desktop:b.desktopPath||'/api/hero-banners/assets/'+b.desktopAssetId,
   mobile:b.mobilePath||'/api/hero-banners/assets/'+b.mobileAssetId,label:b.alt,reference:!!(b.desktopPath||b.mobilePath)}))};
 }
 async upload(actor:Principal,file:HeroUpload|undefined){
  const img=await validateHeroImage(file);
  return this.locked(async c=>{
   const duplicate=await c.query('SELECT id,filename,width,height,original_bytes AS "originalBytes",display_bytes AS "displayBytes" FROM content.hero_banner_assets WHERE uploaded_by=$1 AND original_sha256=$2',[actor.id,img.originalHash]);
   if(duplicate.rows[0])return duplicate.rows[0];
   const limits=await c.query(`SELECT count(*) FILTER (WHERE uploaded_by=$1 AND created_at>now()-interval '1 hour')::int AS recent,
    coalesce(sum(original_bytes+display_bytes),0)::bigint AS bytes FROM content.hero_banner_assets`,[actor.id]);
   if(limits.rows[0].recent>=60)throw new BadRequestException('Batas 60 upload per jam tercapai.');
   if(Number(limits.rows[0].bytes)+img.original.length+img.display.length>536870912)throw new BadRequestException('Penyimpanan banner mencapai batas 512 MiB. Hubungi pengelola.');
   const r=await c.query(`INSERT INTO content.hero_banner_assets(filename,original_mime,original_bytes,original_sha256,original_content,display_content,display_bytes,display_sha256,width,height,uploaded_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,filename,width,height,original_bytes AS "originalBytes",display_bytes AS "displayBytes"`,
    [img.filename,img.mime,img.original.length,img.originalHash,img.original,img.display,img.display.length,img.displayHash,img.width,img.height,actor.id]);
   return r.rows[0];
  });
 }
 async bytes(id:string,privateAccess=false){
  heroId(id);
  const r=await this.db.query(`SELECT display_content,display_bytes,display_sha256 FROM content.hero_banner_assets a WHERE a.id=$1`+
   (privateAccess?'':` AND EXISTS(SELECT 1 FROM content.hero_banners b WHERE b.deleted_at IS NULL AND b.is_active=true AND (b.desktop_asset_id=a.id OR b.mobile_asset_id=a.id))`),[id]);
  const a=r.rows[0];if(!a)throw new NotFoundException('Gambar tidak tersedia.');
  if(a.display_content.length!==a.display_bytes||createHash('sha256').update(a.display_content).digest('hex')!==a.display_sha256)throw Error('Hero asset integrity mismatch');
  return a.display_content as Buffer;
 }
 async create(actor:Principal,raw:unknown){
  const p=parseHero(raw);
  return this.locked(async c=>{
   const prior=(await c.query(select+' WHERE request_key=$1',[p.idempotencyKey])).rows[0];
   if(prior){if(prior.title!==p.title||prior.alt!==p.alt||prior.desktopAssetId!==p.desktop||prior.mobileAssetId!==p.mobile)throw new ConflictException('Kunci penyimpanan sudah dipakai. Muat ulang daftar.');return prior;}
   await this.capacity(c);await this.assetExists(c,p.desktop);await this.assetExists(c,p.mobile);
   const r=await c.query(`INSERT INTO content.hero_banners(title,alt_text,desktop_asset_id,mobile_asset_id,position,created_by,updated_by,request_key)
    VALUES($1,$2,$3,$4,(SELECT coalesce(max(position),0)+10 FROM content.hero_banners WHERE deleted_at IS NULL),$5,$5,$6) RETURNING id`,[p.title,p.alt,p.desktop,p.mobile,actor.id,p.idempotencyKey]);
   const after=(await c.query(select+' WHERE id=$1',[r.rows[0].id])).rows[0];
   await this.changed(c,actor,after.id,'create_draft',null,after);return after;
  });
 }
 async update(actor:Principal,id:string,raw:unknown){
  const p=parseHero(raw,true);
  return this.locked(async c=>{
   const before=await this.current(c,id,p.expectedVersion);if(before.deletedAt)throw new BadRequestException('Pulihkan banner sebelum mengedit.');
   await this.assetExists(c,p.desktop);await this.assetExists(c,p.mobile);
   await c.query(`UPDATE content.hero_banners SET title=$2,alt_text=$3,desktop_asset_id=$4,mobile_asset_id=$5,desktop_path=$6,mobile_path=$7,
    updated_by=$8,updated_at=now(),edit_version=edit_version+1 WHERE id=$1`,
    [id,p.title,p.alt,p.desktop??before.desktopAssetId,p.mobile??before.mobileAssetId,p.desktop?null:before.desktopPath,p.mobile?null:before.mobilePath,actor.id]);
   const after=(await c.query(select+' WHERE id=$1',[id])).rows[0];
   await this.changed(c,actor,id,'edit',before,after);return after;
  });
 }
 async state(actor:Principal,id:string,raw:unknown,action:'state'|'trash'|'restore'){
  const v=object(raw,['expectedVersion',...(action==='state'?['active']:action==='trash'?['confirm']:[])]);
  if(action==='state'&&typeof v.active!=='boolean')throw new BadRequestException('Status aktif harus boolean.');
  if(action==='trash'&&v.confirm!==true)throw new BadRequestException('Konfirmasi hapus diperlukan.');
  return this.locked(async c=>{
   const before=await this.current(c,id,v.expectedVersion);
   if(action==='restore'){
    if(!before.deletedAt)throw new BadRequestException('Banner tidak berada di sampah.');await this.capacity(c);
    await c.query(`UPDATE content.hero_banners SET deleted_at=NULL,is_active=false,position=(SELECT coalesce(max(position),0)+10 FROM content.hero_banners WHERE deleted_at IS NULL),
     updated_by=$2,updated_at=now(),edit_version=edit_version+1 WHERE id=$1`,[id,actor.id]);
   }else{
    if(before.deletedAt)throw new BadRequestException('Banner sudah dihapus.');
    await c.query(`UPDATE content.hero_banners SET is_active=$2,deleted_at=CASE WHEN $3 THEN now() ELSE NULL END,
     updated_by=$4,updated_at=now(),edit_version=edit_version+1 WHERE id=$1`,[id,action==='state'?v.active:false,action==='trash',actor.id]);
   }
   const after=(await c.query(select+' WHERE id=$1',[id])).rows[0];
   await this.changed(c,actor,id,action==='state'?(v.active?'activate':'deactivate'):action,before,after);return after;
  });
 }
 async reorder(actor:Principal,raw:unknown){
  const v=object(raw,['ids','expectedRevision']);const expected=version(v.expectedRevision);
  if(!Array.isArray(v.ids)||v.ids.length>30)throw new BadRequestException('Daftar urutan tidak valid.');
  const ids=v.ids.map(heroId);if(new Set(ids).size!==ids.length)throw new BadRequestException('Urutan memiliki duplikat.');
  return this.locked(async(c,revision)=>{
   if(expected!==revision)throw new ConflictException('Daftar berubah. Muat ulang sebelum mengatur urutan.');
   const before=(await c.query(select+' WHERE deleted_at IS NULL ORDER BY position,id')).rows;
   if(ids.length!==before.length||before.some(b=>!ids.includes(b.id)))throw new ConflictException('Daftar urutan tidak lengkap. Muat ulang.');
   for(const [i,id] of ids.entries())await c.query('UPDATE content.hero_banners SET position=$2,updated_by=$3,updated_at=now(),edit_version=edit_version+1 WHERE id=$1',[id,(i+1)*10,actor.id]);
   await this.changed(c,actor,null,'reorder',before.map(b=>b.id),ids);return {ok:true,revision:revision+1};
  });
 }
}
