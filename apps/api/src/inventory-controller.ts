import {Body,Controller,Get,Param,Post,Req,UseGuards} from '@nestjs/common';
import {AdminGuard,type Principal} from './auth';
import {InventoryService} from './inventory';
@Controller('v1/admin/inventory')
@UseGuards(AdminGuard)
export class InventoryController {
 constructor(private readonly inventory:InventoryService){}
 @Get(':productId/movements') events(@Param('productId') id:string){return this.inventory.events(id);}
 @Post('adjust') adjust(@Req() req:{user:Principal},@Body() body:unknown){return this.inventory.adjust(req.user,body);}
}
