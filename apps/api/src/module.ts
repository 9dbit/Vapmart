import {CatalogAdminController,CatalogPublicController,CatalogCustomerController} from './catalog-controller';
import {CatalogWorkspaceService} from './catalog-workspace';
import {CatalogImportService} from './catalog-import';
import {CatalogReviewsService} from './catalog-reviews';
import {HeroBannersService} from './hero-banners';
import {HeroBannersAdminController,HeroBannersPublicController} from './hero-banners-controller';
import {AdminProductRecordsService,AdminProductRecordsController} from './admin-product-records';
import {MediaLibraryService,MediaLibraryController} from './media-library';
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
import {VoucherAdminService} from './vouchers';
import {PromotionAdminService} from './promotions';
import {PromotionAnalyticsService} from './promotion-analytics';
import {InventoryService} from './inventory';
import {WarehouseService} from './warehouses';
import {WarehouseController} from './warehouse-controller';
import {FulfillmentService} from './fulfillment';
import {FulfillmentAdminController,CustomerFulfillmentController} from './fulfillment-controller';
import {BrandInvitationsService} from './brand-invitations';
import {AdminBrandInvitationsController,AcceptBrandInvitationController} from './brand-invitations-controller';
import {InventoryController} from './inventory-controller';
import {BrandPortalService} from './brand-portal';
import {BrandPortalController,BrandAccessAdminController} from './brand-portal-controllers';
import {ShippingService} from './shipping';
import {ShippingController} from './shipping-controller';
import {CourierManifestService} from './courier-manifests';
import {CourierEventService} from './courier-events';
import {CourierReturnService} from './courier-returns';
import {CourierAdminController,BiteshipWebhookController,CourierReturnAdminController,CourierReturnCustomerController,CourierTrackingCustomerController} from './courier-controllers';

@Module({
 controllers:[CatalogAdminController,CatalogPublicController,CatalogCustomerController,HeroBannersAdminController,HeroBannersPublicController,AdminProductRecordsController,MediaLibraryController,HealthController,CatalogController,AdminController,OrdersController,BrandsController,MediaController,CheckoutController,CoinPacksController,MemberController,DigitalOrderController,SandboxWebhookController,BrandPortalController,BrandAccessAdminController,ShippingController,CourierAdminController,BiteshipWebhookController,CourierReturnAdminController,CourierReturnCustomerController,CourierTrackingCustomerController,InventoryController,WarehouseController,FulfillmentAdminController,CustomerFulfillmentController,AdminBrandInvitationsController,AcceptBrandInvitationController],
 providers:[CatalogWorkspaceService,CatalogImportService,CatalogReviewsService,HeroBannersService,AdminProductRecordsService,MediaLibraryService,DatabaseService,ProductsService,BrandsService,MediaService,CheckoutService,VoucherAdminService,PromotionAdminService,PromotionAnalyticsService,SupabaseAuthService,AdminGuard,CustomerGuard,MemberCommerceService,SandboxPaymentsService,BrandPortalService,ShippingService,CourierManifestService,CourierEventService,CourierReturnService,InventoryService,WarehouseService,FulfillmentService,BrandInvitationsService]
})
export class AppModule {}
