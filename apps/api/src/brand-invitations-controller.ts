import {Body,Controller,Get,Param,Post,Req,UseGuards} from '@nestjs/common';
import {AdminGuard,CustomerGuard,type Principal} from './auth';
import {BrandInvitationsService} from './brand-invitations';
@Controller('v1/admin/brand-invitations')
@UseGuards(AdminGuard)
export class AdminBrandInvitationsController{
 constructor(private readonly invites:BrandInvitationsService){}
 @Get(':brandId') list(@Param('brandId') brandId:string){return this.invites.list(brandId);}
 @Post(':brandId') create(@Req() req:{user:Principal},@Param('brandId') id:string,@Body() body:unknown){
  return this.invites.create(req.user,id,body);
 }
 @Post(':brandId/:inviteId/revoke') revoke(@Req() req:{user:Principal},@Param('brandId') id:string,@Param('inviteId') inviteId:string){
  return this.invites.revoke(req.user,id,inviteId);
 }
}
@Controller('v1/brand-invitations')
export class AcceptBrandInvitationController{
 constructor(private readonly invites:BrandInvitationsService){}
 @Post('accept') @UseGuards(CustomerGuard)
 accept(@Req() req:{user:Principal},@Body() body:unknown){return this.invites.accept(req.user,body);}
}
