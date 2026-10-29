import { Body, Controller, Get, HttpCode, Param, Patch, Post, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { AdminGuard } from './auth';
import { DatabaseService } from './database';
import { ProductsService } from './products';

@Controller()
export class HealthController {
  constructor(private readonly db: DatabaseService) {}
  @Get('health')
  getHealth() {
    return { status: 'ok', service: 'vapmart-api', database: this.db.configured ? 'configured' : 'unconfigured', checkout: 'disabled' };
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
  constructor(private readonly products: ProductsService) {}
  @Get('status')
  status() { return { admin: true }; }
  @Post('products')
  async create(@Body() body: unknown) { return this.products.create(body); }
  @Patch('products/:id')
  async update(@Param('id') id: string, @Body() body: unknown) { return this.products.update(id, body); }
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
