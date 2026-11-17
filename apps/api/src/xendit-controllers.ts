import {Body,Controller,Get,Headers,HttpCode,Param,Post,Req,UseGuards} from '@nestjs/common';
import {AdminGuard,CustomerGuard,type Principal} from './auth';
import {XenditPaymentSessionsService} from './xendit-payment-sessions';
import {XenditWebhookInboxService} from './xendit-webhook-inbox';

@Controller('v1/webhooks/xendit')
export class XenditWebhookController{
 constructor(private readonly inbox:XenditWebhookInboxService){}
 @Post('payment-sessions') @HttpCode(200)
 receive(@Req() req:{rawBody?:Buffer},@Headers('x-callback-token') token?:string){
  return this.inbox.receive(req.rawBody,token);
 }
}

@Controller('v1/admin/payments/xendit')
@UseGuards(AdminGuard)
export class XenditPaymentAdminController{
 constructor(private readonly sessions:XenditPaymentSessionsService){}
 @Get('readiness')
 readiness(){return this.sessions.readiness();}
}
