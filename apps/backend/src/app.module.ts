import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { JwtGuard } from './common/jwt.guard';
import { RolesGuard } from './common/roles.guard';
import { PrismaModule } from './infra/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProductsModule } from './modules/products/products.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';

@Module({
  imports: [PrismaModule, AuthModule, ProductsModule, CartModule, OrdersModule, PaymentsModule],
  controllers: [AppController],
  providers: [JwtGuard, RolesGuard],
})
export class AppModule {}
