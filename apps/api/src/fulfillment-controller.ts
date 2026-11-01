import {Body,Controller,Get,Param,Post,Req,UseGuards} from '@nestjs/common';
import {AdminGuard,CustomerGuard,type Principal} from './auth';
import {FulfillmentService} from './fulfillment';
@Controller('v1/admin/fulfillment')
@UseGuards(AdminGuard)
export class FulfillmentAdminController {
 constructor(private readonly fulfillment:FulfillmentService){}
 @Get('batches') list(){return this.fulfillment.list();}
 @Get('orders/:orderId/plan') plan(@Param('orderId') orderId:string){return this.fulfillment.plan(orderId);}
 @Post('orders/:orderId/prepare') prepare(@Req() req:{user:Principal},@Param('orderId') orderId:string,@Body() body:unknown){
  return this.fulfillment.prepare(req.user,orderId,body);
 }
 @Get('batches/:batchId/timeline') timeline(@Param('batchId') id:string){return this.fulfillment.timeline(id);}
 @Post('batches/:batchId/state') transition(@Req() req:{user:Principal},@Param('batchId') id:string,@Body() body:unknown){
  return this.fulfillment.transition(req.user,id,body);
 }
 @Post('batches/:batchId/release') release(@Req() req:{user:Principal},@Param('batchId') id:string,@Body() body:unknown){
  return this.fulfillment.release(req.user,id,body);
 }
}
@Controller('v1/customer-fulfillment')
@UseGuards(CustomerGuard)
export class CustomerFulfillmentController {
 constructor(private readonly fulfillment:FulfillmentService){}
 @Get('orders/:orderId/tracking') tracking(@Req() req:{user:Principal},@Param('orderId') orderId:string){
  return this.fulfillment.customerTracking(req.user,orderId);
 }
}
