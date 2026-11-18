import {Body,Controller,Get,Patch,Post,Query,Req,UseGuards} from '@nestjs/common';
import {AdminGuard,CustomerGuard,type Principal} from './auth';
import {ShippingService} from './shipping';
import {CourierVisibilityService} from './courier-visibility';
import {resolveMapPin} from './shipping-pin';
import {JubelioShipmentClient} from './jubelio-shipment';
@Controller('v1/shipping')
export class ShippingController{
 constructor(private readonly shipping:ShippingService,private readonly jubelio:JubelioShipmentClient){}
 @Get('config') config(){return this.shipping.config();}
 @Get('areas')
 async areas(@Query('level') level:string,@Query('parentId') parentId?:string){return {items:await this.jubelio.hierarchy(level,parentId||'')};}
 @Get('regions') @UseGuards(CustomerGuard)
 async regions(@Query('q') q:string){return {regions:await this.jubelio.regions(q)};}
 @Get('connection') @UseGuards(AdminGuard)
 connection(){return this.jubelio.status();}
 @Post('estimate')
 estimate(@Body() body:unknown){return this.shipping.estimate(body);}
 @Post('map-pin')
 mapPin(@Body() body:unknown){return resolveMapPin(body);}
 @Post('rates') @UseGuards(CustomerGuard)
 rates(@Req() req:{user:Principal},@Body() body:unknown){return this.shipping.rates(req.user,body);}
}

@Controller('v1/admin/shipping')
@UseGuards(AdminGuard)
export class ShippingAdminController{
 constructor(private readonly visibility:CourierVisibilityService,private readonly shipping:ShippingService){}
 @Get('origin-pin') originPin(){return this.shipping.originPinSettings();}
 @Post('origin-pin') savePin(@Req() req:{user:Principal},@Body() body:unknown){return this.shipping.saveOriginPin(req.user,body);}
 @Get('couriers') list(){return this.visibility.list();}
 @Patch('couriers') save(@Req() req:{user:Principal},@Body() body:unknown){return this.visibility.save(req.user,body);}
}
