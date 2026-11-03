import {Body,Controller,Get,Header,Param,Patch,Post,Req,StreamableFile,UploadedFile,UseGuards,UseInterceptors} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {AdminGuard,type Principal} from './auth';
import {HeroBannersService} from './hero-banners';
import {HERO_MAX_BYTES,type HeroUpload} from './hero-images';
@Controller('v1/admin/hero-banners')
@UseGuards(AdminGuard)
export class HeroBannersAdminController{
 constructor(private readonly banners:HeroBannersService){}
 @Get() @Header('Cache-Control','private, no-store') list(){return this.banners.list();}
 @Post('assets') @Header('Cache-Control','private, no-store')
 @UseInterceptors(FileInterceptor('file',{limits:{fileSize:HERO_MAX_BYTES,files:1,fields:0,parts:2}}))
 upload(@Req() req:{user:Principal},@UploadedFile() file:HeroUpload){return this.banners.upload(req.user,file);}
 @Get('assets/:id/content') @Header('Cache-Control','private, no-store') @Header('X-Content-Type-Options','nosniff') @Header('Content-Security-Policy',"default-src 'none'; sandbox")
 async content(@Param('id') id:string){return new StreamableFile(await this.banners.bytes(id,true),{type:'image/webp'});}
 @Post('reorder') @Header('Cache-Control','private, no-store') reorder(@Req() req:{user:Principal},@Body() body:unknown){return this.banners.reorder(req.user,body);}
 @Post() @Header('Cache-Control','private, no-store') create(@Req() req:{user:Principal},@Body() body:unknown){return this.banners.create(req.user,body);}
 @Patch(':id') @Header('Cache-Control','private, no-store') update(@Req() req:{user:Principal},@Param('id') id:string,@Body() body:unknown){return this.banners.update(req.user,id,body);}
 @Post(':id/state') @Header('Cache-Control','private, no-store') state(@Req() req:{user:Principal},@Param('id') id:string,@Body() body:unknown){return this.banners.state(req.user,id,body,'state');}
 @Post(':id/trash') @Header('Cache-Control','private, no-store') trash(@Req() req:{user:Principal},@Param('id') id:string,@Body() body:unknown){return this.banners.state(req.user,id,body,'trash');}
 @Post(':id/restore') @Header('Cache-Control','private, no-store') restore(@Req() req:{user:Principal},@Param('id') id:string,@Body() body:unknown){return this.banners.state(req.user,id,body,'restore');}
}
@Controller('v1/hero-banners')
export class HeroBannersPublicController{
 constructor(private readonly banners:HeroBannersService){}
 @Get() @Header('Cache-Control','no-store') list(){return this.banners.publicList();}
 @Get('assets/:id') @Header('Cache-Control','no-store') @Header('X-Content-Type-Options','nosniff') @Header('Content-Security-Policy',"default-src 'none'; sandbox")
 async content(@Param('id') id:string){return new StreamableFile(await this.banners.bytes(id),{type:'image/webp'});}
}
