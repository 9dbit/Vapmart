import {StoreProfileService} from './store-profile';
import {Body,Controller,Get,Header,Param,Patch,Post,Query,Req,UseGuards} from '@nestjs/common';
import {AdminGuard,CustomerGuard,type Principal} from './auth';
import {OrderManagementService} from './order-management';
import {CatalogWorkspaceService} from './catalog-workspace';
import {parseCSV} from './catalog-csv';
import {CatalogImportService} from './catalog-import';
import {CatalogReviewsService} from './catalog-reviews';
import {VoucherAdminService} from './vouchers';
import {PromotionAdminService} from './promotions';
import {PromotionAnalyticsService} from './promotion-analytics';
type AuthRequest={user:Principal};
@Controller('v1/admin/catalog')
@UseGuards(AdminGuard)
export class CatalogAdminController{
 constructor(private readonly storeProfile:StoreProfileService,private readonly catalog:CatalogWorkspaceService,private readonly imports:CatalogImportService,private readonly reviews:CatalogReviewsService,private readonly vouchers:VoucherAdminService,private readonly promotions:PromotionAdminService,private readonly analytics:PromotionAnalyticsService,private readonly orderManagement:OrderManagementService){}
 @Header('Cache-Control','private, no-store') @Get('store-profile') store(){return this.storeProfile.get();}
 @Header('Cache-Control','private, no-store') @Patch('store-profile') saveStore(@Req() r:AuthRequest,@Body() b:unknown){return this.storeProfile.save(r.user,b);}
 @Header('Cache-Control','private, no-store') @Post('orders/:id/confirm-payment') confirmPayment(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){return this.orderManagement.confirmPayment(r.user,id,b);}
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
 @Header('Cache-Control','private, no-store') @Post('imports/columns') importColumns(@Body() b:{csv?:unknown}){const p=parseCSV(b?.csv as string);return {headers:p.headers,delimiter:p.delimiter,warnings:p.warnings};}
 @Header('Cache-Control','private, no-store') @Post('imports/preview') preview(@Req() r:AuthRequest,@Body() b:unknown){return this.imports.preview(r.user,b);}
 @Header('Cache-Control','private, no-store') @Get('imports/:id') importReport(@Req() r:AuthRequest,@Param('id') id:string){return this.imports.get(r.user,id);}
 @Header('Cache-Control','private, no-store') @Post('imports/:id/apply') apply(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){return this.imports.apply(r.user,id,b);}
 @Header('Cache-Control','private, no-store') @Get('vouchers') voucherList(@Query() q:Record<string,unknown>){return this.vouchers.list(q);}
 @Header('Cache-Control','private, no-store') @Get('vouchers/:id') voucher(@Param('id') id:string){return this.vouchers.detail(id);}
 @Header('Cache-Control','private, no-store') @Post('vouchers') voucherCreate(@Req() r:AuthRequest,@Body() b:unknown){return this.vouchers.create(r.user,b);}
 @Header('Cache-Control','private, no-store') @Patch('vouchers/:id') voucherUpdate(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){return this.vouchers.update(r.user,id,b);}
 @Header('Cache-Control','private, no-store') @Get('promotions') promotionList(@Query() q:Record<string,unknown>){return this.promotions.list(q);}
 @Header('Cache-Control','private, no-store') @Get('promotions/:id') promotion(@Param('id') id:string){return this.promotions.detail(id);}
 @Header('Cache-Control','private, no-store') @Post('promotions') promotionCreate(@Req() r:AuthRequest,@Body() b:unknown){return this.promotions.create(r.user,b);}
 @Header('Cache-Control','private, no-store') @Patch('promotions/:id') promotionUpdate(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){return this.promotions.update(r.user,id,b);}
 @Header('Cache-Control','private, no-store') @Get('analytics/summary') promotionAnalytics(@Query() q:Record<string,unknown>){return this.analytics.overview(q);}
 @Header('Cache-Control','private, no-store') @Get('analytics/ledger') promotionLedger(@Query() q:Record<string,unknown>){return this.analytics.ledger(q);}
 @Header('Cache-Control','private, no-store') @Header('Content-Type','text/csv; charset=utf-8') @Header('Content-Disposition','attachment; filename="vapmart-promotion-ledger.csv"') @Get('analytics/ledger.csv') promotionLedgerExport(@Query() q:Record<string,unknown>){return this.analytics.csv(q);}
 @Header('Cache-Control','private, no-store') @Get('orders') orders(@Query() q:Record<string,unknown>){return this.catalog.orders(q);}
 @Header('Cache-Control','private, no-store') @Get('orders/products') orderProducts(@Query('q') q:unknown){return this.orderManagement.products(q);}
 @Header('Cache-Control','private, no-store') @Get('orders/:id') order(@Param('id') id:string){return this.orderManagement.detail(id);}
 @Header('Cache-Control','private, no-store') @Post('orders/:id/rates') orderRates(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){return this.orderManagement.rates(r.user,id,b);}
 @Header('Cache-Control','private, no-store') @Post('orders/:id/preview') orderPreview(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){return this.orderManagement.preview(r.user,id,b);}
 @Header('Cache-Control','private, no-store') @Patch('orders/:id') orderSave(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){return this.orderManagement.save(r.user,id,b);}
 @Header('Cache-Control','private, no-store') @Post('orders/:id/status') orderStatus(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:unknown){return this.orderManagement.transition(r.user,id,b);}
 @Header('Cache-Control','private, no-store') @Post('orders/:id/invoice') orderInvoice(@Req() r:AuthRequest,@Param('id') id:string,@Body() b:{revision?:unknown}){return this.orderManagement.invoice(r.user,id,b?.revision);}
}
@Controller('v1/catalog')
export class CatalogPublicController{
 constructor(private readonly storeProfile:StoreProfileService,private readonly catalog:CatalogWorkspaceService,private readonly reviews:CatalogReviewsService){}
 @Header('Cache-Control','private, no-store') @Get('categories') categories(){return this.catalog.categories(true);}
 @Header('Cache-Control','private, no-store') @Get('selection') selection(@Query('ids') ids:unknown){return this.catalog.selection(ids);}
 @Header('Cache-Control','private, no-store') @Get('reviews/:slug') reviewList(@Param('slug') slug:string,@Query() q:Record<string,unknown>){return this.reviews.publicList(slug,q);}
}
@Controller('v1/customer/catalog')
@UseGuards(CustomerGuard)
export class CatalogCustomerController{
 constructor(private readonly storeProfile:StoreProfileService,private readonly catalog:CatalogWorkspaceService,private readonly reviews:CatalogReviewsService){}
 @Header('Cache-Control','private, no-store') @Get('review-eligible') eligible(@Req() r:AuthRequest){return this.reviews.eligible(r.user);}
 @Header('Cache-Control','private, no-store') @Post('reviews') review(@Req() r:AuthRequest,@Body() b:unknown){return this.reviews.create(r.user,b);}
 @Header('Cache-Control','private, no-store') @Get('orders') orders(@Req() r:AuthRequest,@Query() q:Record<string,unknown>){return this.catalog.orders(q,r.user.id);}
}
