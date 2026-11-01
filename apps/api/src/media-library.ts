import {BadRequestException,Controller,Get,Header,Injectable,NotFoundException,Param,Patch,Body,Req,StreamableFile,UseGuards} from '@nestjs/common';
import {createHash} from 'node:crypto';
import {DatabaseService} from './database';
import {AdminGuard,type Principal} from './auth';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validId(id:string){if(!uuid.test(id))throw new BadRequestException('Invalid media ID');}
export function parseMediaNotes(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new BadRequestException('Metadata object required');
 const value=raw as Record<string,unknown>;
 if(!Object.keys(value).length||Object.keys(value).some(k=>!['title','notes'].includes(k)))throw new BadRequestException('Only internal title and notes can be changed');
 const out:{title?:string;notes?:string}={};
 if('title' in value){if(typeof value.title!=='string'||!value.title.trim()||value.title.length>160)throw new BadRequestException('Title must have 1-160 characters');out.title=value.title.trim();}
 if('notes' in value){if(typeof value.notes!=='string'||value.notes.length>1000)throw new BadRequestException('Notes limit is 1000 characters');out.notes=value.notes.trim();}
 return out;
}
@Injectable()
export class MediaLibraryService{
 constructor(private readonly db:DatabaseService){}
 async list(){
  const r=await this.db.query('SELECT id,filename,title,kind,mime_type,size_bytes,sha256,original_path,source_path,notes,visibility,imported_at,updated_at FROM content.media_library_assets ORDER BY kind,original_path');
  return {items:r.rows,total:r.rows.length,storage:'postgresql',scope:'admin_only',publicationEnabled:false,originalFilesPreserved:true};
 }
 async bytes(id:string){
  validId(id);
  const r=await this.db.query<{content:Buffer;sha256:string;mime_type:string;filename:string;size_bytes:number}>('SELECT content,sha256,mime_type,filename,size_bytes FROM content.media_library_assets WHERE id=$1',[id]);
  const row=r.rows[0];if(!row)throw new NotFoundException('Media asset not found');
  if(row.content.length!==row.size_bytes||createHash('sha256').update(row.content).digest('hex')!==row.sha256)throw new Error('Stored media integrity mismatch');
  return row;
 }
 async update(actor:Principal,id:string,raw:unknown){
  validId(id);const next=parseMediaNotes(raw);
  return this.db.transaction(async client=>{
   const r=await client.query<{title:string;notes:string}>('SELECT title,notes FROM content.media_library_assets WHERE id=$1 FOR UPDATE',[id]);
   const before=r.rows[0];if(!before)throw new NotFoundException('Media asset not found');
   const after={title:next.title??before.title,notes:next.notes??before.notes};
   await client.query('UPDATE content.media_library_assets SET title=$2,notes=$3,updated_at=now() WHERE id=$1',[id,after.title,after.notes]);
   await client.query('INSERT INTO content.media_library_audit(asset_id,actor_id,before_metadata,after_metadata) VALUES($1,$2,$3,$4)',[id,actor.id,JSON.stringify(before),JSON.stringify(after)]);
   return {id,...after,visibility:'internal',publicationEnabled:false};
  });
 }
}
@Controller('v1/admin/media-library')
@UseGuards(AdminGuard)
export class MediaLibraryController{
 constructor(private readonly library:MediaLibraryService){}
 @Get() @Header('Cache-Control','private, no-store') list(){return this.library.list();}
 @Get(':id/content') @Header('Cache-Control','private, no-store') @Header('X-Content-Type-Options','nosniff') @Header('Content-Security-Policy',"default-src 'none'; sandbox")
 async content(@Param('id') id:string){const asset=await this.library.bytes(id);return new StreamableFile(asset.content,{type:asset.mime_type,length:asset.size_bytes,disposition:'inline; filename="'+asset.filename.replace(/[^a-zA-Z0-9._-]/g,'_')+'"'});}
 @Patch(':id') @Header('Cache-Control','private, no-store') update(@Req() req:{user:Principal},@Param('id') id:string,@Body() body:unknown){return this.library.update(req.user,id,body);}
}
