import { Module } from '@nestjs/common';
import { AdminGuard, CustomerGuard, SupabaseAuthService } from './auth';
import {CoinPacksController,MemberController,DigitalOrderController,SandboxWebhookController} from './customer-controllers';
import {MemberCommerceService} from './member-commerce';
import {SandboxPaymentsService} from './sandbox-payments';
import { HealthController, CatalogController, AdminController, OrdersController } from './controllers';
import { DatabaseService } from './database';
import { ProductsService } from './products';

@Module({
  controllers: [HealthController, CatalogController, AdminController, OrdersController, CoinPacksController,MemberController,DigitalOrderController,SandboxWebhookController],
  providers: [DatabaseService, ProductsService, SupabaseAuthService, AdminGuard, CustomerGuard,MemberCommerceService,SandboxPaymentsService],
})
export class AppModule {}
