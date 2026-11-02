import {Body,Controller,Get,Param,Post,Req,UseGuards} from '@nestjs/common';
import {AdminGuard,CustomerGuard,type Principal} from './auth';
import {BrandPortalService} from './brand-portal';
import {FulfillmentService} from './fulfillment';
@Controller('v1/brand-portal')
@UseGuards(CustomerGuard)
export class BrandPortalController {
 constructor(private readonly portal:BrandPortalService,private readonly fulfillmentEngine:FulfillmentService){}
 @Get('me') me(@Req() req:{user:Principal}){return this.portal.myBrands(req.user);}
 @Get(':brandId/overview') overview(@Req() req:{user:Principal},@Param('brandId') id:string){return this.portal.overview(req.user,id);}
 @Get(':brandId/products') products(@Req() req:{user:Principal},@Param('brandId') id:string){return this.portal.products(req.user,id);}
 @Get(':brandId/warehouses') warehouseStock(@Req() req:{user:Principal},@Param('brandId') id:string){return this.portal.warehouseStock(req.user,id);}
 @Get(':brandId/fulfillment') fulfillment(@Req() req:{user:Principal},@Param('brandId') id:string){return this.portal.fulfillment(req.user,id);}
 @Post(':brandId/fulfillment/:batchId/state')
 async updateFulfillment(@Req() req:{user:Principal},@Param('brandId') brandId:string,@Param('batchId') batchId:string,@Body() body:unknown){
  await this.portal.assertCanManageFulfillment(req.user,brandId);
  return this.fulfillmentEngine.transition(req.user,batchId,body,brandId);
 }
 @Get(':brandId/sales') sales(@Req() req:{user:Principal},@Param('brandId') id:string){return this.portal.sales(req.user,id);}
}
@Controller('v1/admin/brand-access')
@UseGuards(AdminGuard)
export class BrandAccessAdminController {
 constructor(private readonly portal:BrandPortalService){}
 @Get(':brandId') members(@Param('brandId') id:string){return this.portal.members(id);}
 @Post(':brandId') setMember(@Req() req:{user:Principal},@Param('brandId') id:string,@Body() body:unknown){return this.portal.setMember(req.user,id,body);}
}
