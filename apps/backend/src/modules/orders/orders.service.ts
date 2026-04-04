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
  ReservationStatus,
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

  private readonly reservationTtlMinutes = Number(process.env.RESERVATION_TTL_MINUTES || '15');

  constructor(private readonly prisma: PrismaService) {}

  async getCurrentReservation(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.releaseExpiredInTx(tx);

      const reservation = await tx.inventoryReservation.findFirst({
        where: {
          userId,
          status: 'active',
          expiresAt: { gt: new Date() },
        },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });

      return {
        data: reservation ? this.toReservationSummary(reservation) : null,
      };
    });
  }

  async createReservationFromCart(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.releaseExpiredInTx(tx);

      const existing = await tx.inventoryReservation.findFirst({
        where: {
          userId,
          status: 'active',
          expiresAt: { gt: new Date() },
        },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        return this.toReservationSummary(existing);
      }

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

      const expiresAt = new Date(Date.now() + this.reservationTtlMinutes * 60 * 1000);

      const reservation = await tx.inventoryReservation.create({
        data: {
          userId,
          status: 'active',
          expiresAt,
        },
      });

      await tx.inventoryReservationItem.createMany({
        data: cartRows.map((row) => ({
          reservationId: reservation.id,
          productId: row.productId,
          name: row.product.name,
          unitPrice: row.product.price,
          quantity: row.quantity,
        })),
      });

      const reservationWithItems = await tx.inventoryReservation.findUnique({
        where: { id: reservation.id },
        include: { items: true },
      });

      if (!reservationWithItems) {
        throw new NotFoundException('Reservation not found after create');
      }

      return this.toReservationSummary(reservationWithItems);
    });
  }

  async cancelReservation(id: string, userId: string, role: UserRole) {
    return this.prisma.$transaction(async (tx) => {
      await this.releaseExpiredInTx(tx);

      const reservation = await tx.inventoryReservation.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!reservation) {
        throw new NotFoundException('Reservation not found');
      }

      if (role !== 'admin' && reservation.userId !== userId) {
        throw new ForbiddenException('Cannot cancel this reservation');
      }

      if (reservation.status !== 'active') {
        throw new BadRequestException('Reservation is not active');
      }

      const updated = await tx.inventoryReservation.updateMany({
        where: {
          id,
          status: 'active',
        },
        data: {
          status: 'canceled',
          canceledAt: new Date(),
        },
      });

      if (updated.count !== 1) {
        throw new BadRequestException('Reservation already updated');
      }

      for (const item of reservation.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
          },
        });
      }

      return {
        success: true,
        reservationId: id,
      };
    });
  }

  async releaseExpiredReservations(_actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const expiredCount = await this.releaseExpiredInTx(tx);
      return { expiredCount };
    });
  }

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
          reservation: {
            include: { items: true },
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
        reservation: {
          include: { items: true },
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
      await this.releaseExpiredInTx(tx);

      const reservation = await tx.inventoryReservation.findUnique({
        where: { id: payload.reservationId },
        include: { items: true },
      });

      if (!reservation) {
        throw new NotFoundException('Reservation not found');
      }

      if (reservation.userId !== userId) {
        throw new ForbiddenException('Cannot checkout this reservation');
      }

      if (reservation.status !== 'active') {
        throw new BadRequestException('Reservation is not active');
      }

      if (reservation.expiresAt.getTime() < Date.now()) {
        await this.expireReservationInTx(tx, reservation.id);
        throw new BadRequestException('Reservation expired');
      }

      if (!reservation.items.length) {
        throw new BadRequestException('Reservation has no items');
      }

      const subtotal = reservation.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      );
      const shippingFee = this.shippingFeeMap[payload.shippingMethod];
      const total = subtotal + shippingFee;
      const paymentStatus: PaymentStatus =
        payload.paymentMethod === 'cod' ? 'pending' : 'authorized';
      const shippingStatus: ShippingStatus = 'pending';

      const order = await tx.order.create({
        data: {
          userId,
          reservationId: reservation.id,
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
        data: reservation.items.map((item) => ({
          orderId: order.id,
          productId: item.productId,
          name: item.name,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        })),
      });

      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          status: 'created',
          actorId: userId,
        },
      });

      await tx.inventoryReservation.update({
        where: { id: reservation.id },
        data: {
          status: 'consumed',
          consumedAt: new Date(),
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
          reservation: {
            include: { items: true },
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
          reservation: {
            include: { items: true },
          },
        },
      });
    });
  }

  private async releaseExpiredInTx(tx: Prisma.TransactionClient) {
    const expiredReservations = await tx.inventoryReservation.findMany({
      where: {
        status: 'active',
        expiresAt: { lt: new Date() },
      },
      select: { id: true },
    });

    let expiredCount = 0;

    for (const reservation of expiredReservations) {
      const expired = await this.expireReservationInTx(tx, reservation.id);
      if (expired) {
        expiredCount += 1;
      }
    }

    return expiredCount;
  }

  private async expireReservationInTx(tx: Prisma.TransactionClient, reservationId: string) {
    const reservation = await tx.inventoryReservation.findUnique({
      where: { id: reservationId },
      include: { items: true },
    });

    if (!reservation || reservation.status !== 'active') {
      return false;
    }

    const updated = await tx.inventoryReservation.updateMany({
      where: {
        id: reservation.id,
        status: 'active',
      },
      data: {
        status: ReservationStatus.expired,
        expiredAt: new Date(),
      },
    });

    if (updated.count !== 1) {
      return false;
    }

    for (const item of reservation.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: { increment: item.quantity },
        },
      });
    }

    return true;
  }

  private toReservationSummary(
    reservation: {
      id: string;
      status: ReservationStatus;
      expiresAt: Date;
      items: Array<{ productId: string; name: string; unitPrice: number; quantity: number }>;
    },
  ) {
    const subtotal = reservation.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const totalItems = reservation.items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      id: reservation.id,
      status: reservation.status,
      expiresAt: reservation.expiresAt,
      subtotal,
      totalItems,
      items: reservation.items,
    };
  }
}
