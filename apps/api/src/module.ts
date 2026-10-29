import { Module } from '@nestjs/common';
import { AdminGuard, SupabaseAuthService } from './auth';
import { HealthController, CatalogController, AdminController, OrdersController } from './controllers';
import { DatabaseService } from './database';
import { ProductsService } from './products';

@Module({
  controllers: [HealthController, CatalogController, AdminController, OrdersController],
  providers: [DatabaseService, ProductsService, SupabaseAuthService, AdminGuard],
})
export class AppModule {}
