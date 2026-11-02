import {Body,Controller,Get,Param,Patch,Post,Req,UseGuards} from '@nestjs/common';
import {AdminGuard,type Principal} from './auth';
import {WarehouseService} from './warehouses';
@Controller('v1/admin/warehouses')
@UseGuards(AdminGuard)
export class WarehouseController{
 constructor(private readonly warehouse:WarehouseService){}
 @Get() list(){return this.warehouse.list();}
 @Post() create(@Req() req:{user:Principal},@Body() body:unknown){return this.warehouse.create(req.user,body);}
 @Patch(':warehouseId') update(@Req() req:{user:Principal},@Param('warehouseId') id:string,@Body() body:unknown){return this.warehouse.update(req.user,id,body);}
 @Post('stock/adjust') adjust(@Req() req:{user:Principal},@Body() body:unknown){return this.warehouse.adjust(req.user,body);}
 @Post('stock/transfer') transfer(@Req() req:{user:Principal},@Body() body:unknown){return this.warehouse.transfer(req.user,body);}
 @Get(':warehouseId/stock/:productId/events') events(@Param('warehouseId') wid:string,@Param('productId') pid:string){return this.warehouse.events(wid,pid);}
}
