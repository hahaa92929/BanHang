import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { resolve } from 'node:path';
import { AppController } from './app.controller';
import { AccountModule } from './modules/account/account.module';
import { AuthOrApiKeyGuard } from './common/auth-or-api-key.guard';
import { AppThrottlerGuard } from './common/app-throttler.guard';
import { JwtGuard } from './common/jwt.guard';
import { PermissionsGuard } from './common/permissions.guard';
import { RequestLoggingMiddleware } from './common/request-logging.middleware';
import { RolesGuard } from './common/roles.guard';
import { validateEnv } from './config/env';
import { PrismaModule } from './infra/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CartModule } from './modules/cart/cart.module';
import { CompareModule } from './modules/compare/compare.module';
import { ContentModule } from './modules/content/content.module';
import { CrmModule } from './modules/crm/crm.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProductsModule } from './modules/products/products.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { SearchModule } from './modules/search/search.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { StoresModule } from './modules/stores/stores.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), '.env'),
        resolve(process.cwd(), '..', '..', '.env'),
      ],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    AccountModule,
    AuthModule,
    ContentModule,
    CrmModule,
    ProductsModule,
    CartModule,
    CompareModule,
    OrdersModule,
    PaymentsModule,
    InventoryModule,
    ShippingModule,
    StoresModule,
    NotificationsModule,
    ReportingModule,
    SearchModule,
    WishlistModule,
  ],
  controllers: [AppController],
  providers: [
    JwtGuard,
    AuthOrApiKeyGuard,
    RolesGuard,
    PermissionsGuard,
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
