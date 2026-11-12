import {Body,Controller,Get,HttpCode,Param,Post,Req,UseGuards} from '@nestjs/common';
import {AdminGuard,CustomerGuard,type Principal} from './auth';
import {CourierManifestService} from './courier-manifests';
import {CourierEventService} from './courier-events';
import {CourierReturnService} from './courier-returns';
import {JubelioDispatchService} from './jubelio-dispatch';

@Controller('v1/admin/courier')
@UseGuards(AdminGuard)
export class CourierAdminController {
 constructor(private readonly manifest:CourierManifestService,private readonly events:CourierEventService,private readonly dispatch:JubelioDispatchService){}
 @Get('config') config(){return this.manifest.config();}
 @Get('batches') list(){return this.manifest.list();}
 @Get('orders/:orderId') orderBatches(@Param('orderId') id:string){return this.manifest.orderBatches(id);}
 @Get('batches/:batchId/preview') preview(@Param('batchId') id:string){return this.manifest.preview(id);}
 @Post('batches/:batchId/manifest') manifestCreate(@Req() req:{user:Principal},@Param('batchId') id:string,@Body() body:unknown){
  return this.manifest.prepare(req.user,id,body);
 }
 @Get('batches/:batchId/packing-slip') packingSlip(@Param('batchId') id:string){return this.manifest.packingSlip(id);}
 @Get('batches/:batchId/events') timeline(@Param('batchId') id:string){return this.events.adminEvents(id);}
 @Get('batches/:batchId/booking-preview') bookingPreview(@Param('batchId') id:string){return this.dispatch.preview(id);}
 @Post('batches/:batchId/book') book(@Req() req:{user:Principal},@Param('batchId') id:string,@Body() body:unknown){return this.dispatch.book(req.user,id,body);}
 @Post('batches/:batchId/reconcile') reconcile(@Param('batchId') id:string){return this.dispatch.reconcile(id);}
 @Post('batches/:batchId/sync') sync(@Param('batchId') id:string){return this.dispatch.sync(id);}
 @Post('batches/:batchId/label') label(@Param('batchId') id:string){return this.dispatch.label(id);}

}
@Controller('v1/webhooks/biteship')
export class BiteshipWebhookController {
 constructor(private readonly events:CourierEventService){}
 @Post() @HttpCode(200)
 ingest(@Req() req:{headers:Record<string,string|string[]|undefined>;rawBody?:Buffer}){
  return this.events.ingest(req.headers,req.rawBody);
 }
}
@Controller('v1/admin/courier-returns')
@UseGuards(AdminGuard)
export class CourierReturnAdminController {
 constructor(private readonly returns:CourierReturnService){}
 @Get() list(){return this.returns.adminList();}
 @Get(':id/timeline') timeline(@Param('id') id:string){return this.returns.timeline(id);}
 @Post(':id/review') review(@Req() req:{user:Principal},@Param('id') id:string,@Body() body:unknown){
  return this.returns.review(req.user,id,body);
 }
 @Post(':id/receive') receive(@Req() req:{user:Principal},@Param('id') id:string,@Body() body:unknown){
  return this.returns.receive(req.user,id,body);
 }
 @Post(':id/restock') restock(@Req() req:{user:Principal},@Param('id') id:string,@Body() body:unknown){
  return this.returns.restock(req.user,id,body);
 }
}
@Controller('v1/customer-returns')
@UseGuards(CustomerGuard)
export class CourierReturnCustomerController {
 constructor(private readonly returns:CourierReturnService){}
 @Get() list(@Req() req:{user:Principal}){return this.returns.customerList(req.user);}
 @Post() request(@Req() req:{user:Principal},@Body() body:unknown){return this.returns.request(req.user,body);}
}
@Controller('v1/customer-courier')
@UseGuards(CustomerGuard)
export class CourierTrackingCustomerController {
 constructor(private readonly events:CourierEventService){}
 @Get('orders/:orderId') tracking(@Req() req:{user:Principal},@Param('orderId') id:string){
  return this.events.customerEvents(req.user.id,id);
 }
}

@Controller('v1/webhooks/jubelio')
export class JubelioWebhookController {
 constructor(private readonly dispatch:JubelioDispatchService){}
 @Post(':token') @HttpCode(200)
 ingest(@Param('token') token:string,@Req() req:{rawBody?:Buffer}){return this.dispatch.webhook(token,req.rawBody);}
}
