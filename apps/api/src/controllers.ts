import { Body, Controller, Get, Header, HttpCode, Param, Patch, Post, Req, ServiceUnavailableException, StreamableFile, UseGuards } from '@nestjs/common';
import { AdminGuard,CustomerGuard,type Principal } from './auth';
import {BrandsService} from './brands';
import {MediaService} from './media';
import {CheckoutService} from './checkout';
import { DatabaseService } from './database';
import { ProductsService } from './products';

@Controller()
export class HealthController {
  constructor(private readonly db: DatabaseService) {}
  @Get('health')
  getHealth() {
    return { status: 'ok', service: 'vapmart-api', database: this.db.configured ? 'configured' : 'unconfigured', checkout: 'disabled' };
  }
  @Get('ready')
  async getReady() {
    if (!this.db.configured) throw new ServiceUnavailableException({ code: 'DATABASE_URL_MISSING' });
    try {
      const result = await this.db.query<{ ready: boolean }>("SELECT (to_regclass('product.products') IS NOT NULL AND to_regclass('public.staff_roles') IS NOT NULL) AS ready");
      if (!result.rows[0]?.ready) throw new Error('Required schema missing');
      return { status: 'ready', service: 'vapmart-api', database: 'ready', checkout: 'disabled' };
    } catch {
      throw new ServiceUnavailableException({ code: 'DATABASE_MIGRATION_REQUIRED' });
    }
  }
}

@Controller('v1/products')
export class CatalogController {
  constructor(private readonly products: ProductsService) {}
  @Get()
  async list() { return { items: await this.products.list() }; }
  @Get(':slug')
  async bySlug(@Param('slug') slug: string) { return this.products.bySlug(slug); }
}

@Controller('v1/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly products: ProductsService, private readonly brands:BrandsService, private readonly media:MediaService, private readonly checkout:CheckoutService) {}
  @Get('status')
  status() { return { admin: true }; }
  @Get('products')
  async listProducts() { return { items: await this.products.listAdmin() }; }
  @Post('products')
  async create(@Body() body: unknown) { return this.products.create(body); }
  @Patch('products/:id')
  async update(@Param('id') id: string, @Body() body: unknown) { return this.products.update(id, body); }
  @Get('brands')
  listBrands(){return this.brands.list();}
  @Post('brands')
  addBrand(@Body() body:unknown){return this.brands.create(body);}
  @Patch('brands/:id')
  editBrand(@Param('id') id:string,@Body() body:unknown){return this.brands.update(id,body);}
  @Post('media')
  uploadMedia(@Req() req:{user:Principal},@Body() body:unknown){return this.media.upload(req.user,body);}
  @Get('orders')
  listOrders(){return this.checkout.adminOrders();}
}
@Controller('v1/brands')
export class BrandsController{
 constructor(private readonly brands:BrandsService){}
 @Get()
 list(){return this.brands.publicList();}
}
@Controller('v1/media')
export class MediaController{
 constructor(private readonly media:MediaService){}
 @Get(':id')
 @Header('Cache-Control','public, max-age=86400, immutable')
 @Header('X-Content-Type-Options','nosniff')
 async byId(@Param('id') id:string){
  const item=await this.media.get(id);
  return new StreamableFile(item.content,{type:item.mime_type});
 }
}
@Controller('v1/checkout')
export class CheckoutController{
 constructor(private readonly checkout:CheckoutService){}
 @Get('config')
 config(){return this.checkout.config();}
 @Post('quote')
 quote(@Body() body:unknown){return this.checkout.quote(body);}
 @Post('orders')
 @UseGuards(CustomerGuard)
 createDraft(@Req() req:{user:Principal},@Body() body:unknown){return this.checkout.createDraft(req.user,body);}
 @Get('orders/:id')
 @UseGuards(CustomerGuard)
 order(@Req() req:{user:Principal},@Param('id') id:string){return this.checkout.getOrder(req.user,id);}
 @Post('orders/:id/payment-session')
 @UseGuards(CustomerGuard)
 paymentSession(){return this.checkout.paymentSession();}
}

@Controller('v1/orders')
export class OrdersController {
  // Explicitly closed until DB migrations, payment and shipping are verified.
  @Post()
  @HttpCode(503)
  create() {
    throw new ServiceUnavailableException({ code: 'CHECKOUT_DISABLED', message: 'Checkout not yet enabled in staging' });
  }
}
