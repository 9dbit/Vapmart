import {Body,Controller,Get,Post,Query,Req,UseGuards} from '@nestjs/common';
import {AdminGuard,CustomerGuard,type Principal} from './auth';
import {ShippingService} from './shipping';
import {JubelioShipmentClient} from './jubelio-shipment';
@Controller('v1/shipping')
export class ShippingController{
 constructor(private readonly shipping:ShippingService,private readonly jubelio:JubelioShipmentClient){}
 @Get('config') config(){return this.shipping.config();}
 @Get('regions') @UseGuards(CustomerGuard)
 async regions(@Query('q') q:string){return {regions:await this.jubelio.regions(q)};}
 @Get('connection') @UseGuards(AdminGuard)
 connection(){return this.jubelio.status();}
 @Post('rates') @UseGuards(CustomerGuard)
 rates(@Req() req:{user:Principal},@Body() body:unknown){return this.shipping.rates(req.user,body);}
}
