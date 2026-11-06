import {Body,Controller,Get,Patch,Post,Query,Req,UseGuards} from '@nestjs/common';
import {AdminGuard,CustomerGuard,type Principal} from './auth';
import {ShippingService} from './shipping';
import {CourierVisibilityService} from './courier-visibility';
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

@Controller('v1/admin/shipping')
@UseGuards(AdminGuard)
export class ShippingAdminController{
 constructor(private readonly visibility:CourierVisibilityService){}
 @Get('couriers') list(){return this.visibility.list();}
 @Patch('couriers') save(@Req() req:{user:Principal},@Body() body:unknown){return this.visibility.save(req.user,body);}
}
