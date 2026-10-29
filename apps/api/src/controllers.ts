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
  constructor(private readonly products: ProductsService) {}
  @Get('status')
  status() { return { admin: true }; }
  @Get('products')
  async listProducts() { return { items: await this.products.listAdmin() }; }
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
