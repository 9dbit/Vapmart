import {Body,Controller,Get,Header,Post,Req,UseGuards} from '@nestjs/common';
import {CustomerGuard,type Principal} from './auth';
import {CustomerFavoritesService} from './customer-favorites';
type CustomerRequest={user:Principal};
@Controller('v1/customer/favorites')
@UseGuards(CustomerGuard)
export class CustomerFavoritesController{
 constructor(private readonly favorites:CustomerFavoritesService){}
 @Get() @Header('Cache-Control','private, no-store')
 list(@Req() request:CustomerRequest){return this.favorites.list(request.user);}
 @Post() @Header('Cache-Control','private, no-store')
 set(@Req() request:CustomerRequest,@Body() body:unknown){return this.favorites.set(request.user,body);}
}
