import {Body,Controller,Get,Post,Req,UseGuards} from '@nestjs/common';
import {CustomerGuard,type Principal} from './auth';
import {ShippingService} from './shipping';
@Controller('v1/shipping')
export class ShippingController{
 constructor(private readonly shipping:ShippingService){}
 @Get('config') config(){return this.shipping.config();}
 @Post('rates') @UseGuards(CustomerGuard)
 rates(@Req() req:{user:Principal},@Body() body:unknown){return this.shipping.rates(req.user,body);}
}
