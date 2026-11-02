import {Body,Controller,Get,Headers,Param,Post,Req,UseGuards} from '@nestjs/common';
import {CustomerGuard,type Principal} from './auth';
import {MemberCommerceService} from './member-commerce';
import {SandboxPaymentsService} from './sandbox-payments';

type CustomerRequest={headers:{authorization?:string};user:Principal};
@Controller('v1/coin-packs')
export class CoinPacksController{
 constructor(private readonly member:MemberCommerceService){}
 @Get()
 packs(){return this.member.packs();}
}
@Controller('v1/member')
@UseGuards(CustomerGuard)
export class MemberController{
 constructor(private readonly member:MemberCommerceService){}
 @Get('overview')
 overview(@Req() req:CustomerRequest){return this.member.overview(req.user);}
}
@Controller('v1/digital-orders')
@UseGuards(CustomerGuard)
export class DigitalOrderController{
 constructor(private readonly member:MemberCommerceService){}
 @Post()
 create(@Req() req:CustomerRequest,@Body() body:unknown){
   return this.member.createOrder(req.user,body);
 }
 @Get(':id')
 get(@Req() req:CustomerRequest,@Param('id') id:string){
   return this.member.getOrder(req.user,id);
 }
 @Post(':id/payment-session')
 paymentSession(@Req() req:CustomerRequest,@Param('id') id:string){
   void req;void id;
   return this.member.paymentSession();
 }
}
@Controller('v1/payments/sandbox')
export class SandboxWebhookController{
 constructor(private readonly sandbox:SandboxPaymentsService){}
 @Post('webhook')
 receive(@Body() body:unknown,
   @Req() request:{rawBody?:Buffer},
   @Headers('x-vapmart-signature') signature:string|undefined){
   return this.sandbox.receive(body,request.rawBody,signature);
 }
}
