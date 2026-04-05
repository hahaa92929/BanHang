import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  Coupon,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ReservationStatus,
  ShippingMethod,
  ShippingStatus,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { generateId } from '../../common/security';
import { AppEnv } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CheckoutDto } from './dto/checkout.dto';

type ActorRole = 'super_admin' | 'admin' | 'manager' | 'staff' | 'customer' | 'guest';

@Injectable()
export class OrdersService {
  private readonly shippingFeeMap: Record<ShippingMethod, number> = {
    standard: 30_000,
    express: 60_000,
    same_day: 90_000,
    pickup: 0,
  };

  private readonly reservationTtlMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService<AppEnv, true>,
  ) {
    this.reservationTtlMinutes = Number(
      this.config?.get('RESERVATION_TTL_MINUTES', { infer: true }) ??
        process.env.RESERVATION_TTL_MINUTES ??
        15,
    );
  }

  async getCurrentReservation(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.releaseExpiredInTx(tx);

      const reservation = await tx.inventoryReservation.findFirst({
        where: {
          userId,
          status: 'active',
          expiresAt: { gt: new Date() },
        },
        include: this.reservationInclude(),
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
        include: this.reservationInclude(),
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        return this.toReservationSummary(existing);
      }

      const cartRows = await tx.cartItem.findMany({
        where: { userId },
        include: { product: true, variant: true },
      });

      if (!cartRows.length) {
        throw new BadRequestException('Cart is empty');
      }

      for (const row of cartRows) {
        if (row.product.status !== 'active') {
          throw new BadRequestException(`${row.product.name} is not available`);
        }

        if (!row.variant) {
          throw new BadRequestException(`Variant is missing for ${row.product.name}`);
        }

        if (row.quantity > row.variant.stock) {
          throw new BadRequestException(`Stock is not enough for ${row.product.name}`);
        }
      }

      const reservedRows: Array<{
        row: (typeof cartRows)[number];
        allocations: Array<{ warehouseId: string; warehouseCode: string; warehouseName: string; quantity: number }>;
      }> = [];

      for (const row of cartRows) {
        const allocations = await this.reserveVariantStockInTx(
          tx,
          {
            productId: row.productId,
            productName: row.product.name,
            variantId: row.variantId,
            quantity: row.quantity,
          },
          userId,
        );

        const variantUpdated = await tx.productVariant.updateMany({
          where: {
            id: row.variantId,
            stock: { gte: row.quantity },
          },
          data: {
            stock: { decrement: row.quantity },
          },
        });

        if (variantUpdated.count !== 1) {
          throw new BadRequestException(`Stock conflict for ${row.product.name}`);
        }

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

        reservedRows.push({
          row,
          allocations,
        });
      }

      const expiresAt = new Date(Date.now() + this.reservationTtlMinutes * 60 * 1000);

      const reservation = await tx.inventoryReservation.create({
        data: {
          userId,
          status: 'active',
          expiresAt,
        },
      });

      for (const reserved of reservedRows) {
        const item = await tx.inventoryReservationItem.create({
          data: {
            reservationId: reservation.id,
            productId: reserved.row.productId,
            variantId: reserved.row.variantId,
            name: reserved.row.product.name,
            unitPrice: reserved.row.variant.price,
            quantity: reserved.row.quantity,
          },
        });

        await tx.inventoryReservationAllocation.createMany({
          data: reserved.allocations.map((allocation) => ({
            reservationItemId: item.id,
            warehouseId: allocation.warehouseId,
            quantity: allocation.quantity,
          })),
        });
      }

      const reservationWithItems = await tx.inventoryReservation.findUnique({
        where: { id: reservation.id },
        include: this.reservationInclude(),
      });

      if (!reservationWithItems) {
        throw new NotFoundException('Reservation not found after create');
      }

      return this.toReservationSummary(reservationWithItems);
    });
  }

  async cancelReservation(id: string, userId: string, role: ActorRole) {
    return this.prisma.$transaction(async (tx) => {
      await this.releaseExpiredInTx(tx);

      const reservation = await tx.inventoryReservation.findUnique({
        where: { id },
        include: this.reservationInclude(),
      });

      if (!reservation) {
        throw new NotFoundException('Reservation not found');
      }

      if (!this.canManageAllOrders(role) && reservation.userId !== userId) {
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

      await this.releaseReservationStockInTx(tx, reservation.items, userId, 'Reservation canceled');

      return {
        success: true,
        reservationId: id,
      };
    });
  }

  async releaseExpiredReservations(actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const expiredCount = await this.releaseExpiredInTx(tx, actorUserId);
      return { expiredCount };
    });
  }

  async list(userId: string, role: ActorRole) {
    const where: Prisma.OrderWhereInput = this.canManageAllOrders(role) ? {} : { userId };

    const [total, data] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: this.orderInclude(),
      }),
    ]);

    return { total, data };
  }

  async getById(id: string, userId: string, role: ActorRole) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.orderInclude(),
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!this.canManageAllOrders(role) && order.userId !== userId) {
      throw new ForbiddenException('Cannot access this order');
    }

    return order;
  }

  async checkout(userId: string, payload: CheckoutDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.releaseExpiredInTx(tx);

      const reservation = await tx.inventoryReservation.findUnique({
        where: { id: payload.reservationId },
        include: this.reservationInclude(),
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
        await this.expireReservationInTx(tx, reservation.id, userId);
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
      const cartCoupon = await tx.cartCoupon.findUnique({
        where: { userId },
        include: { coupon: true },
      });
      const discountAmount = cartCoupon
        ? this.calculateCouponDiscount(cartCoupon.coupon, subtotal, shippingFee)
        : 0;
      const taxAmount = 0;
      const total = Math.max(0, subtotal + shippingFee + taxAmount - discountAmount);
      const paymentStatus: PaymentStatus =
        payload.paymentMethod === 'cod' ? 'pending' : 'authorized';
      const shippingStatus: ShippingStatus =
        payload.shippingMethod === 'pickup' ? 'packed' : 'pending';
      const addressJson = await this.resolveAddress(tx, userId, payload);

      const order = await tx.order.create({
        data: {
          userId,
          orderNumber: this.generateOrderNumber(),
          reservationId: reservation.id,
          couponId: cartCoupon?.couponId,
          status: 'created',
          paymentMethod: payload.paymentMethod,
          paymentStatus,
          shippingMethod: payload.shippingMethod,
          shippingStatus,
          addressJson,
          notes: payload.notes ?? '',
          subtotal,
          discountAmount,
          taxAmount,
          shippingFee,
          total,
          trackingCode: payload.shippingMethod === 'pickup' ? null : this.generateTrackingCode(),
        },
      });

      await tx.orderItem.createMany({
        data: reservation.items.map((item) => ({
          orderId: order.id,
          productId: item.productId,
          variantId: item.variantId,
          sku: item.variant?.sku ?? item.product.sku,
          name: item.name,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          totalPrice: item.unitPrice * item.quantity,
        })),
      });

      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          fromStatus: null,
          toStatus: 'created',
          actorId: userId,
          note: 'Order created from checkout',
        },
      });

      await tx.payment.create({
        data: {
          orderId: order.id,
          gateway: this.resolveGateway(payload.paymentMethod),
          method: payload.paymentMethod,
          amount: total,
          currency: 'VND',
          status: paymentStatus,
          metadata: {
            reservationId: reservation.id,
          },
        },
      });

      await tx.inventoryReservation.update({
        where: { id: reservation.id },
        data: {
          status: 'consumed',
          consumedAt: new Date(),
        },
      });

      if (cartCoupon) {
        await tx.coupon.update({
          where: { id: cartCoupon.couponId },
          data: { usedCount: { increment: 1 } },
        });

        await tx.cartCoupon.delete({ where: { userId } });
      }

      await tx.cartItem.deleteMany({ where: { userId } });

      await tx.notification.create({
        data: {
          userId,
          type: 'order',
          title: 'Order created',
          content: `Order ${order.orderNumber} has been created successfully.`,
          data: {
            orderId: order.id,
            orderNumber: order.orderNumber,
          },
        },
      });

      return tx.order.findUnique({
        where: { id: order.id },
        include: this.orderInclude(),
      });
    });
  }

  async updateStatus(
    id: string,
    nextStatus: 'confirmed' | 'shipping' | 'completed',
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: {
          payments: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const flow: OrderStatus[] = ['created', 'confirmed', 'shipping', 'completed'];
      const currentIndex = flow.indexOf(order.status);
      const nextIndex = flow.indexOf(nextStatus);

      if (currentIndex === -1 || nextIndex !== currentIndex + 1) {
        throw new BadRequestException('Order status must follow 4-step flow');
      }

      let paymentStatus: PaymentStatus = order.paymentStatus;
      let shippingStatus: ShippingStatus = order.shippingStatus;
      const now = new Date();
      const data: Prisma.OrderUpdateInput = {
        status: nextStatus,
      };

      if (nextStatus === 'confirmed') {
        shippingStatus = order.shippingMethod === 'pickup' ? 'packed' : 'packed';
        data.confirmedAt = now;
      }

      if (nextStatus === 'shipping') {
        shippingStatus = order.shippingMethod === 'pickup' ? 'packed' : 'in_transit';
        data.shippedAt = now;
      }

      if (nextStatus === 'completed') {
        shippingStatus = 'delivered';
        data.deliveredAt = now;
        data.completedAt = now;

        if (order.paymentMethod === 'cod' && order.paymentStatus === 'pending') {
          paymentStatus = 'paid';
        }
      }

      data.paymentStatus = paymentStatus;
      data.shippingStatus = shippingStatus;

      await tx.order.update({
        where: { id },
        data,
      });

      if (nextStatus === 'completed' && paymentStatus === 'paid') {
        await tx.payment.updateMany({
          where: { orderId: id },
          data: { status: 'paid' },
        });
      }

      await tx.orderStatusEvent.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: nextStatus,
          actorId: actorUserId,
        },
      });

      await tx.notification.create({
        data: {
          userId: order.userId,
          type: 'order',
          title: 'Order updated',
          content: `Order ${order.orderNumber} is now ${nextStatus}.`,
          data: {
            orderId: order.id,
            status: nextStatus,
          },
        },
      });

      return tx.order.findUnique({
        where: { id },
        include: this.orderInclude(),
      });
    });
  }

  async cancelOrder(id: string, userId: string, role: ActorRole, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
          reservation: {
            include: {
              items: {
                include: {
                  product: true,
                  variant: true,
                  allocations: {
                    include: {
                      warehouse: true,
                    },
                  },
                },
              },
            },
          },
          payments: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (!this.canManageAllOrders(role) && order.userId !== userId) {
        throw new ForbiddenException('Cannot cancel this order');
      }

      if (!['created', 'confirmed'].includes(order.status)) {
        throw new BadRequestException('Only newly created orders can be canceled');
      }

      const nextPaymentStatus: PaymentStatus =
        order.paymentStatus === 'paid' ? 'refunded' : 'canceled';

      await tx.order.update({
        where: { id },
        data: {
          status: 'canceled',
          paymentStatus: nextPaymentStatus,
          shippingStatus: 'canceled',
          canceledAt: new Date(),
        },
      });

      await tx.payment.updateMany({
        where: { orderId: id },
        data: {
          status: nextPaymentStatus,
          refundedAmount: nextPaymentStatus === 'refunded' ? order.total : 0,
        },
      });

      if (order.reservation?.items.length) {
        await this.releaseReservationStockInTx(
          tx,
          order.reservation.items,
          userId,
          'Order canceled and stock restored',
        );
      } else {
        for (const item of order.items) {
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: {
                stock: { increment: item.quantity },
              },
            });
          }

          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity },
            },
          });

          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              variantId: item.variantId,
              actorId: userId,
              type: 'release',
              quantity: item.quantity,
              note: 'Order canceled and stock restored',
            },
          });
        }
      }

      await tx.orderStatusEvent.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: 'canceled',
          actorId: userId,
          note: note ?? 'Order canceled',
        },
      });

      await tx.notification.create({
        data: {
          userId: order.userId,
          type: 'order',
          title: 'Order canceled',
          content: `Order ${order.orderNumber} has been canceled.`,
          data: {
            orderId: order.id,
          },
        },
      });

      return tx.order.findUnique({
        where: { id },
        include: this.orderInclude(),
      });
    });
  }

  async requestReturn(id: string, userId: string, role: ActorRole, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id } });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (!this.canManageAllOrders(role) && order.userId !== userId) {
        throw new ForbiddenException('Cannot return this order');
      }

      if (order.status !== 'completed') {
        throw new BadRequestException('Only completed orders can be returned');
      }

      await tx.order.update({
        where: { id },
        data: {
          status: 'returned',
          shippingStatus: 'returned',
          returnedAt: new Date(),
        },
      });

      await tx.orderStatusEvent.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: 'returned',
          actorId: userId,
          note: note ?? 'Return requested',
        },
      });

      await tx.notification.create({
        data: {
          userId: order.userId,
          type: 'order',
          title: 'Return requested',
          content: `Return requested for order ${order.orderNumber}.`,
          data: {
            orderId: order.id,
          },
        },
      });

      return tx.order.findUnique({
        where: { id },
        include: this.orderInclude(),
      });
    });
  }

  async getTracking(id: string, userId: string, role: ActorRole) {
    const order = await this.getById(id, userId, role);
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      trackingCode: order.trackingCode,
      shippingStatus: order.shippingStatus,
      timeline: order.history.map((item) => ({
        fromStatus: item.fromStatus,
        toStatus: item.toStatus,
        note: item.note,
        createdAt: item.createdAt,
      })),
    };
  }

  async getInvoice(id: string, userId: string, role: ActorRole) {
    const order = await this.getById(id, userId, role);
    return {
      invoiceNumber: `INV-${order.orderNumber}`,
      orderNumber: order.orderNumber,
      issuedAt: order.createdAt,
      currency: order.currency,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      shippingFee: order.shippingFee,
      taxAmount: order.taxAmount,
      total: order.total,
      items: order.items.map((item) => ({
        sku: item.sku,
        name: item.name,
        variantId: item.variantId ?? null,
        variantName: item.variant?.name ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      shippingAddress: order.addressJson,
    };
  }

  private async releaseExpiredInTx(tx: Prisma.TransactionClient, actorUserId = 'system') {
    const expiredReservations = await tx.inventoryReservation.findMany({
      where: {
        status: 'active',
        expiresAt: { lt: new Date() },
      },
      select: { id: true },
    });

    let expiredCount = 0;

    for (const reservation of expiredReservations) {
      const expired = await this.expireReservationInTx(tx, reservation.id, actorUserId);
      if (expired) {
        expiredCount += 1;
      }
    }

    return expiredCount;
  }

  private async expireReservationInTx(
    tx: Prisma.TransactionClient,
    reservationId: string,
    actorUserId: string,
  ) {
    const reservation = await tx.inventoryReservation.findUnique({
      where: { id: reservationId },
      include: this.reservationInclude(),
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

    await this.releaseReservationStockInTx(
      tx,
      reservation.items,
      actorUserId,
      'Expired reservation released',
    );

    return true;
  }

  private async reserveVariantStockInTx(
    tx: Prisma.TransactionClient,
    item: {
      productId: string;
      productName: string;
      variantId: string;
      quantity: number;
    },
    actorUserId: string,
  ) {
    const levels = await tx.inventoryLevel.findMany({
      where: {
        productId: item.productId,
        variantId: item.variantId,
        available: { gt: 0 },
      },
      include: {
        warehouse: true,
      },
    });

    const sorted = [...levels].sort(
      (left, right) =>
        Number(right.warehouse.isDefault) - Number(left.warehouse.isDefault) ||
        left.createdAt.getTime() - right.createdAt.getTime(),
    );

    const totalAvailable = sorted.reduce((sum, level) => sum + level.available, 0);
    if (totalAvailable < item.quantity) {
      throw new BadRequestException(`Stock is not enough for ${item.productName}`);
    }

    const allocations: Array<{
      warehouseId: string;
      warehouseCode: string;
      warehouseName: string;
      quantity: number;
    }> = [];
    let remaining = item.quantity;

    for (const level of sorted) {
      if (remaining <= 0) {
        break;
      }

      const quantity = Math.min(level.available, remaining);
      if (quantity <= 0) {
        continue;
      }

      await tx.inventoryLevel.update({
        where: {
          variantId_warehouseId: {
            variantId: item.variantId,
            warehouseId: level.warehouseId,
          },
        },
        data: {
          available: { decrement: quantity },
          reserved: { increment: quantity },
        },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          variantId: item.variantId,
          warehouseId: level.warehouseId,
          actorId: actorUserId,
          type: 'reserve',
          quantity,
          note: 'Reserved from cart checkout flow',
        },
      });

      allocations.push({
        warehouseId: level.warehouseId,
        warehouseCode: level.warehouse.code,
        warehouseName: level.warehouse.name,
        quantity,
      });
      remaining -= quantity;
    }

    return allocations;
  }

  private async releaseReservationStockInTx(
    tx: Prisma.TransactionClient,
    items: Array<{
      productId: string;
      variantId: string;
      quantity: number;
      allocations?: Array<{
        warehouseId: string;
        quantity: number;
        warehouse?: {
          code: string;
          name: string;
        };
      }>;
    }>,
    actorUserId: string,
    note: string,
  ) {
    for (const item of items) {
      const allocations = item.allocations ?? [];

      for (const allocation of allocations) {
        await tx.inventoryLevel.update({
          where: {
            variantId_warehouseId: {
              variantId: item.variantId,
              warehouseId: allocation.warehouseId,
            },
          },
          data: {
            available: { increment: allocation.quantity },
            reserved: { decrement: allocation.quantity },
          },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            variantId: item.variantId,
            warehouseId: allocation.warehouseId,
            actorId: actorUserId,
            type: 'release',
            quantity: allocation.quantity,
            note,
          },
        });
      }

      await tx.productVariant.update({
        where: { id: item.variantId },
        data: {
          stock: { increment: item.quantity },
        },
      });

      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: { increment: item.quantity },
        },
      });
    }
  }

  private async resolveAddress(
    tx: Prisma.TransactionClient,
    userId: string,
    payload: CheckoutDto,
  ) {
    if (payload.addressId) {
      const address = await tx.address.findFirst({
        where: {
          id: payload.addressId,
          userId,
        },
      });

      if (!address) {
        throw new NotFoundException('Address not found');
      }

      return {
        receiverName: address.fullName,
        phone: address.phone,
        province: address.province,
        district: address.district,
        ward: address.ward,
        addressLine: address.addressLine,
        country: address.country,
      };
    }

    if (!payload.address) {
      throw new BadRequestException('Address is required');
    }

    if (payload.saveAddress) {
      await tx.address.create({
        data: {
          userId,
          fullName: payload.address.receiverName,
          phone: payload.address.phone,
          province: payload.address.province,
          district: payload.address.district,
          ward: payload.address.ward,
          addressLine: payload.address.addressLine,
          country: payload.address.country,
        },
      });
    }

    return {
      receiverName: payload.address.receiverName,
      phone: payload.address.phone,
      province: payload.address.province,
      district: payload.address.district,
      ward: payload.address.ward,
      addressLine: payload.address.addressLine,
      country: payload.address.country,
    };
  }

  private calculateCouponDiscount(coupon: Coupon, subtotal: number, shippingFee: number) {
    const now = Date.now();

    if (coupon.startsAt.getTime() > now || coupon.expiresAt.getTime() < now) {
      throw new BadRequestException('Coupon is expired or not active yet');
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit exceeded');
    }

    if (subtotal < coupon.minOrderAmount) {
      throw new BadRequestException('Cart subtotal does not meet coupon minimum');
    }

    switch (coupon.type) {
      case 'fixed':
        return Math.min(subtotal, coupon.value);
      case 'percent': {
        const raw = Math.floor((subtotal * coupon.value) / 100);
        return coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
      }
      case 'free_shipping':
      default:
        return shippingFee;
    }
  }

  private resolveGateway(paymentMethod: PaymentMethod) {
    if (paymentMethod === 'cod') {
      return 'offline';
    }

    return paymentMethod;
  }

  private canManageAllOrders(role: ActorRole) {
    return ['super_admin', 'admin', 'manager', 'staff'].includes(role);
  }

  private reservationInclude() {
    return {
      items: {
        include: {
          product: true,
          variant: true,
          allocations: {
            include: {
              warehouse: true,
            },
          },
        },
      },
    };
  }

  private orderInclude() {
    return {
      items: {
        include: {
          product: true,
          variant: true,
        },
      },
      history: {
        orderBy: { createdAt: 'asc' as const },
      },
      reservation: {
        include: this.reservationInclude(),
      },
      coupon: true,
      payments: {
        orderBy: { createdAt: 'asc' as const },
      },
    };
  }

  private generateOrderNumber() {
    const now = new Date();
    const date =
      now.getFullYear().toString() +
      `${now.getMonth() + 1}`.padStart(2, '0') +
      `${now.getDate()}`.padStart(2, '0');
    return `ORD-${date}-${generateId('ord').slice(-8).toUpperCase()}`;
  }

  private generateTrackingCode() {
    return `TRK-${generateId('trk').slice(-8).toUpperCase()}`;
  }

  private toReservationSummary(
    reservation: {
      id: string;
      status: ReservationStatus;
      expiresAt: Date;
      items: Array<{
        productId: string;
        variantId: string;
        name: string;
        unitPrice: number;
        quantity: number;
        variant?: {
          sku: string;
          name: string;
          attributes: unknown;
        } | null;
        allocations?: Array<{
          warehouseId: string;
          quantity: number;
          warehouse: {
            code: string;
            name: string;
          };
        }>;
      }>;
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
      items: reservation.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        variantSku: item.variant?.sku ?? null,
        variantName: item.variant?.name ?? null,
        variantAttributes: item.variant?.attributes ?? null,
        allocations: (item.allocations ?? []).map((allocation) => ({
          warehouseId: allocation.warehouseId,
          warehouseCode: allocation.warehouse.code,
          warehouseName: allocation.warehouse.name,
          quantity: allocation.quantity,
        })),
        name: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      })),
    };
  }
}
