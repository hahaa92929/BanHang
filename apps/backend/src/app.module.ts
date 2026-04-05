import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
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
import { InventoryModule } from './modules/inventory/inventory.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProductsModule } from './modules/products/products.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    AuthModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    InventoryModule,
    ShippingModule,
    NotificationsModule,
    ReportingModule,
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
