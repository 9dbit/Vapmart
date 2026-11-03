import {Body,Controller,Get,Header,Param,Patch,Post,Query,Req,UseGuards} from '@nestjs/common';
import {AdminGuard,CustomerGuard,type Principal} from './auth';
import {CatalogWorkspaceService} from './catalog-workspace';
import {CatalogImportService} from './catalog-import';
import {CatalogReviewsService} from './catalog-reviews';
type AuthRequest={user:Principal};
@Controller('v1/admin/catalog')
@UseGuards(AdminGuard)
export class CatalogAdminController{
 constructor(private readonly catalog:CatalogWorkspaceService,private readonly imports:CatalogImportService,private readonly reviews:CatalogReviewsService){}
 @Header('Cache-Control','private, no-store') @Get('lookups') lookups(){return this.catalog.lookups();}
 @Header('Cache-Control','private, no-store') @Get('products') products(@Query() q:Record<string,unknown>){return this.catalog.list(q);}
 @Header('Cache-Control','private, no-store') @Get('products/:id') product(@Param('id') id:string){return this.catalog.detail(id);}
 @Header('Cache-Control','private, no-store') @Post('products') create(@Req() r:AuthRequest,@Body() b:unknown){return this.catalog.save(r.user,null,b);}
 @Header('Cache-Control','private, no-store') @Patch('products/:id') edit(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){return this.catalog.save(r.user,id,b);}
 @Header('Cache-Control','private, no-store') @Post('products/:id/quick') quick(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){return this.catalog.quick(r.user,id,b);}
 @Header('Cache-Control','private, no-store') @Post('products/:id/state') state(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){return this.catalog.state(r.user,id,b);}
 @Header('Cache-Control','private, no-store') @Get('categories') categories(){return this.catalog.categories();}
 @Header('Cache-Control','private, no-store') @Post('categories') newCategory(@Req() r:AuthRequest,@Body() b:unknown){return this.catalog.categorySave(r.user,null,b);}
 @Header('Cache-Control','private, no-store') @Patch('categories/:id') category(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){return this.catalog.categorySave(r.user,id,b);}
 @Header('Cache-Control','private, no-store') @Post('categories/:id/archive') archiveCategory(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){return this.catalog.categoryArchive(r.user,id,b);}
 @Header('Cache-Control','private, no-store') @Get('reviews') reviewList(@Query() q:Record<string,unknown>){return this.reviews.list(q);}
 @Header('Cache-Control','private, no-store') @Post('reviews/:id/moderate') moderate(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){return this.reviews.moderate(r.user,id,b);}
 @Header('Cache-Control','private, no-store') @Post('imports/preview') preview(@Req() r:AuthRequest,@Body() b:unknown){return this.imports.preview(r.user,b);}
 @Header('Cache-Control','private, no-store') @Get('imports/:id') importReport(@Req() r:AuthRequest,@Param('id') id:string){return this.imports.get(r.user,id);}
 @Header('Cache-Control','private, no-store') @Post('imports/:id/apply') apply(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){return this.imports.apply(r.user,id,b);}
 @Header('Cache-Control','private, no-store') @Get('orders') orders(@Query() q:Record<string,unknown>){return this.catalog.orders(q);}
 @Header('Cache-Control','private, no-store') @Get('orders/:id') order(@Param('id') id:string){return this.catalog.orderDetail(id);}
}
@Controller('v1/catalog')
export class CatalogPublicController{
 constructor(private readonly catalog:CatalogWorkspaceService,private readonly reviews:CatalogReviewsService){}
 @Header('Cache-Control','private, no-store') @Get('categories') categories(){return this.catalog.categories(true);}
 @Header('Cache-Control','private, no-store') @Get('selection') selection(@Query('ids') ids:unknown){return this.catalog.selection(ids);}
 @Header('Cache-Control','private, no-store') @Get('reviews/:slug') reviewList(@Param('slug') slug:string,@Query() q:Record<string,unknown>){return this.reviews.publicList(slug,q);}
}
@Controller('v1/customer/catalog')
@UseGuards(CustomerGuard)
export class CatalogCustomerController{
 constructor(private readonly catalog:CatalogWorkspaceService,private readonly reviews:CatalogReviewsService){}
 @Header('Cache-Control','private, no-store') @Get('review-eligible') eligible(@Req() r:AuthRequest){return this.reviews.eligible(r.user);}
 @Header('Cache-Control','private, no-store') @Post('reviews') review(@Req() r:AuthRequest,@Body() b:unknown){return this.reviews.create(r.user,b);}
 @Header('Cache-Control','private, no-store') @Get('orders') orders(@Req() r:AuthRequest,@Query() q:Record<string,unknown>){return this.catalog.orders(q,r.user.id);}
}
