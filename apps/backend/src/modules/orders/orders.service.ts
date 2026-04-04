import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  ShippingStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CheckoutDto } from './dto/checkout.dto';

@Injectable()
export class OrdersService {
  private readonly shippingFeeMap: Record<'standard' | 'express', number> = {
    standard: 30000,
    express: 60000,
  };

  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, role: UserRole) {
    const where: Prisma.OrderWhereInput = role === 'admin' ? {} : { userId };

    const [total, data] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          history: {
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
    ]);

    return { total, data };
  }

  async getById(id: string, userId: string, role: UserRole) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        history: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (role !== 'admin' && order.userId !== userId) {
      throw new ForbiddenException('Cannot access this order');
    }

    return order;
  }

  async checkout(userId: string, payload: CheckoutDto) {
    return this.prisma.$transaction(async (tx) => {
      const cartRows = await tx.cartItem.findMany({
        where: { userId },
        include: { product: true },
      });

      if (!cartRows.length) {
        throw new BadRequestException('Cart is empty');
      }

      for (const row of cartRows) {
        if (row.quantity > row.product.stock) {
          throw new BadRequestException(`Stock is not enough for ${row.product.name}`);
        }
      }

      for (const row of cartRows) {
        const updated = await tx.product.updateMany({
          where: {
            id: row.productId,
            stock: { gte: row.quantity },
          },
          data: {
            stock: { decrement: row.quantity },
          },
        });

        if (updated.count !== 1) {
          throw new BadRequestException(`Stock conflict for ${row.product.name}`);
        }
      }

      const subtotal = cartRows.reduce((sum, row) => sum + row.product.price * row.quantity, 0);
      const shippingFee = this.shippingFeeMap[payload.shippingMethod];
      const total = subtotal + shippingFee;
      const paymentStatus: PaymentStatus =
        payload.paymentMethod === 'cod' ? 'pending' : 'authorized';
      const shippingStatus: ShippingStatus = 'pending';

      const order = await tx.order.create({
        data: {
          userId,
          status: 'created',
          paymentMethod: payload.paymentMethod,
          paymentStatus,
          shippingMethod: payload.shippingMethod,
          shippingStatus,
          addressJson: {
            receiverName: payload.address.receiverName,
            phone: payload.address.phone,
            line1: payload.address.line1,
            district: payload.address.district,
            city: payload.address.city,
            country: payload.address.country,
          },
          notes: payload.notes ?? '',
          subtotal,
          shippingFee,
          total,
        },
      });

      await tx.orderItem.createMany({
        data: cartRows.map((row) => ({
          orderId: order.id,
          productId: row.productId,
          name: row.product.name,
          unitPrice: row.product.price,
          quantity: row.quantity,
        })),
      });

      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          status: 'created',
          actorId: userId,
        },
      });

      await tx.cartItem.deleteMany({ where: { userId } });

      return tx.order.findUnique({
        where: { id: order.id },
        include: {
          items: true,
          history: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });
  }

  async updateStatus(
    id: string,
    nextStatus: 'confirmed' | 'shipping' | 'completed',
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id } });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const flow: OrderStatus[] = ['created', 'confirmed', 'shipping', 'completed'];
      const currentIndex = flow.indexOf(order.status);
      const nextIndex = flow.indexOf(nextStatus);

      if (nextIndex !== currentIndex + 1) {
        throw new BadRequestException('Order status must follow 4-step flow');
      }

      let paymentStatus: PaymentStatus = order.paymentStatus;
      let shippingStatus: ShippingStatus = order.shippingStatus;

      if (nextStatus === 'confirmed') {
        paymentStatus = 'paid';
        shippingStatus = 'packed';
      }

      if (nextStatus === 'shipping') {
        shippingStatus = 'in_transit';
      }

      if (nextStatus === 'completed') {
        paymentStatus = 'paid';
        shippingStatus = 'delivered';
      }

      await tx.order.update({
        where: { id },
        data: {
          status: nextStatus,
          paymentStatus,
          shippingStatus,
        },
      });

      await tx.orderStatusEvent.create({
        data: {
          orderId: id,
          status: nextStatus,
          actorId: actorUserId,
        },
      });

      return tx.order.findUnique({
        where: { id },
        include: {
          items: true,
          history: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });
  }
}
