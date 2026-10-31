import { Module } from '@nestjs/common';
import { AdminGuard, CustomerGuard, SupabaseAuthService } from './auth';
import {CoinPacksController,MemberController,DigitalOrderController,SandboxWebhookController} from './customer-controllers';
import {MemberCommerceService} from './member-commerce';
import {SandboxPaymentsService} from './sandbox-payments';
import { HealthController, CatalogController, AdminController, OrdersController, BrandsController, MediaController, CheckoutController } from './controllers';
import { DatabaseService } from './database';
import { ProductsService } from './products';
import {BrandsService} from './brands';
import {MediaService} from './media';
import {CheckoutService} from './checkout';

@Module({
  controllers: [HealthController, CatalogController, AdminController, OrdersController, BrandsController, MediaController, CheckoutController, CoinPacksController,MemberController,DigitalOrderController,SandboxWebhookController],
  providers: [DatabaseService, ProductsService, BrandsService, MediaService, CheckoutService, SupabaseAuthService, AdminGuard, CustomerGuard,MemberCommerceService,SandboxPaymentsService],
})
export class AppModule {}
