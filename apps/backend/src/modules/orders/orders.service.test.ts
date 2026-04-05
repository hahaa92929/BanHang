import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

type ProductRecord = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  status: 'active' | 'draft' | 'archived';
};

type ProductVariantRecord = {
  id: string;
  productId: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  isDefault: boolean;
  isActive: boolean;
  attributes: Record<string, unknown> | null;
  createdAt: Date;
};

type CartRecord = { id: string; userId: string; productId: string; variantId: string; quantity: number; createdAt: Date };
type ReservationRecord = {
  id: string;
  userId: string;
  status: 'active' | 'consumed' | 'canceled' | 'expired';
  expiresAt: Date;
  consumedAt: Date | null;
  canceledAt: Date | null;
  expiredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
type ReservationItemRecord = {
  id: string;
  reservationId: string;
  productId: string;
  variantId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};
type ReservationAllocationRecord = {
  id: string;
  reservationItemId: string;
  warehouseId: string;
  quantity: number;
};
type WarehouseRecord = {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
};
type InventoryLevelRecord = {
  id: string;
  productId: string;
  variantId: string;
  warehouseId: string;
  available: number;
  reserved: number;
  createdAt: Date;
  updatedAt: Date;
};
type OrderRecord = {
  id: string;
  orderNumber: string;
  userId: string;
  reservationId: string | null;
  couponId: string | null;
  status: 'created' | 'confirmed' | 'shipping' | 'completed' | 'canceled' | 'returned';
  paymentMethod: 'cod' | 'vnpay' | 'momo';
  paymentStatus: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'partially_refunded' | 'canceled';
  shippingMethod: 'standard' | 'express' | 'same_day' | 'pickup';
  shippingStatus: 'pending' | 'packed' | 'in_transit' | 'delivered' | 'returned' | 'canceled';
  addressJson: Record<string, unknown>;
  notes: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingFee: number;
  total: number;
  currency: string;
  trackingCode: string | null;
  confirmedAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  completedAt: Date | null;
  canceledAt: Date | null;
  returnedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
type OrderItemRecord = {
  id: string;
  orderId: string;
  productId: string;
  variantId: string | null;
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
};
type OrderEventRecord = {
  id: string;
  orderId: string;
  fromStatus: OrderRecord['status'] | null;
  toStatus: OrderRecord['status'];
  note: string | null;
  actorId: string;
  createdAt: Date;
};
type PaymentRecord = {
  id: string;
  orderId: string;
  gateway: string;
  method: OrderRecord['paymentMethod'];
  amount: number;
  currency: string;
  status: OrderRecord['paymentStatus'];
  transactionId: string | null;
  metadata: Record<string, unknown> | null;
  refundedAmount: number;
  createdAt: Date;
  updatedAt: Date;
};

function createOrdersMock() {
  const state = {
    products: new Map<string, ProductRecord>([
      [
        'p-1',
        {
          id: 'p-1',
          sku: 'SKU-1',
          slug: 'iphone-15',
          name: 'iPhone 15',
          description: 'Demo',
          price: 20_000_000,
          stock: 10,
          status: 'active',
        },
      ],
    ]),
    variants: new Map<string, ProductVariantRecord>([
      [
        'pv-1',
        {
          id: 'pv-1',
          productId: 'p-1',
          sku: 'SKU-1-BLACK',
          name: 'Black 128GB',
          price: 20_000_000,
          stock: 10,
          isDefault: true,
          isActive: true,
          attributes: { color: 'Black' },
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    ]),
    warehouses: new Map<string, WarehouseRecord>([
      [
        'w-main',
        {
          id: 'w-main',
          code: 'MAIN',
          name: 'Main Warehouse',
          isDefault: true,
        },
      ],
      [
        'w-hn',
        {
          id: 'w-hn',
          code: 'HN',
          name: 'Ha Noi Warehouse',
          isDefault: false,
        },
      ],
    ]),
    inventoryLevels: [] as InventoryLevelRecord[],
    cartItems: [] as CartRecord[],
    reservations: new Map<string, ReservationRecord>(),
    reservationItems: [] as ReservationItemRecord[],
    reservationAllocations: [] as ReservationAllocationRecord[],
    orders: new Map<string, OrderRecord>(),
    orderItems: [] as OrderItemRecord[],
    orderEvents: [] as OrderEventRecord[],
    payments: [] as PaymentRecord[],
    notifications: [] as Array<Record<string, unknown>>,
    inventoryMovements: [] as Array<Record<string, unknown>>,
    seq: 1,
  };

  state.inventoryLevels.push(
    {
      id: 'il-1',
      productId: 'p-1',
      variantId: 'pv-1',
      warehouseId: 'w-main',
      available: 6,
      reserved: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      id: 'il-2',
      productId: 'p-1',
      variantId: 'pv-1',
      warehouseId: 'w-hn',
      available: 4,
      reserved: 0,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    },
  );

  function addCart(userId: string, productId: string, quantity: number, variantId = 'pv-1') {
    state.cartItems.push({
      id: `ci-${state.seq++}`,
      userId,
      productId,
      variantId,
      quantity,
      createdAt: new Date(),
    });
  }

  function materializeReservation(reservation: ReservationRecord) {
    return {
      ...reservation,
      items: state.reservationItems
        .filter((item) => item.reservationId === reservation.id)
        .map((item) => ({
          ...item,
          product: state.products.get(item.productId)!,
          variant: state.variants.get(item.variantId)!,
          allocations: state.reservationAllocations
            .filter((allocation) => allocation.reservationItemId === item.id)
            .map((allocation) => ({
              ...allocation,
              warehouse: state.warehouses.get(allocation.warehouseId)!,
            })),
        })),
    };
  }

  function materializeOrder(order: OrderRecord, include?: Record<string, unknown>) {
    if (!include) return { ...order };
    return {
      ...order,
      items: include.items
        ? state.orderItems
            .filter((item) => item.orderId === order.id)
            .map((item) => ({
              ...item,
              product: state.products.get(item.productId)!,
              variant: item.variantId ? state.variants.get(item.variantId) ?? null : null,
            }))
        : undefined,
      history: include.history
        ? state.orderEvents
            .filter((event) => event.orderId === order.id)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        : undefined,
      reservation:
        include.reservation && order.reservationId
          ? materializeReservation(state.reservations.get(order.reservationId)!)
          : null,
      coupon: null,
      payments: include.payments ? state.payments.filter((payment) => payment.orderId === order.id) : undefined,
    };
  }

  const tx = {
    inventoryReservation: {
      findMany: async (args: { where: { status?: string; expiresAt?: { lt?: Date } }; select?: { id: true } }) => {
        let rows = [...state.reservations.values()];
        if (args.where.status) rows = rows.filter((row) => row.status === args.where.status);
        if (args.where.expiresAt?.lt) rows = rows.filter((row) => row.expiresAt < args.where.expiresAt.lt!);
        return args.select?.id ? rows.map((row) => ({ id: row.id })) : rows;
      },
      findFirst: async (args: { where: { userId: string; status: string; expiresAt: { gt: Date } }; include?: Record<string, unknown> }) => {
        const found = [...state.reservations.values()].find(
          (row) =>
            row.userId === args.where.userId &&
            row.status === args.where.status &&
            row.expiresAt > args.where.expiresAt.gt,
        );
        if (!found) return null;
        return args.include ? materializeReservation(found) : found;
      },
      findUnique: async (args: { where: { id: string }; include?: Record<string, unknown> }) => {
        const found = state.reservations.get(args.where.id);
        if (!found) return null;
        return args.include ? materializeReservation(found) : found;
      },
      create: async (args: { data: { userId: string; status: ReservationRecord['status']; expiresAt: Date } }) => {
        const reservation: ReservationRecord = {
          id: `res-${state.seq++}`,
          userId: args.data.userId,
          status: args.data.status,
          expiresAt: args.data.expiresAt,
          consumedAt: null,
          canceledAt: null,
          expiredAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.reservations.set(reservation.id, reservation);
        return reservation;
      },
      updateMany: async (args: { where: { id: string; status: ReservationRecord['status'] }; data: Partial<ReservationRecord> }) => {
        const reservation = state.reservations.get(args.where.id);
        if (!reservation || reservation.status !== args.where.status) return { count: 0 };
        state.reservations.set(reservation.id, { ...reservation, ...args.data, updatedAt: new Date() });
        return { count: 1 };
      },
      update: async (args: { where: { id: string }; data: Partial<ReservationRecord> }) => {
        const reservation = state.reservations.get(args.where.id);
        if (!reservation) throw new Error('reservation not found');
        const updated = { ...reservation, ...args.data, updatedAt: new Date() };
        state.reservations.set(updated.id, updated);
        return updated;
      },
    },
    inventoryReservationItem: {
      create: async (args: { data: Omit<ReservationItemRecord, 'id'> }) => {
        const item: ReservationItemRecord = {
          id: `ri-${state.seq++}`,
          ...args.data,
        };
        state.reservationItems.push(item);
        return item;
      },
      createMany: async (args: { data: Array<Omit<ReservationItemRecord, 'id'>> }) => {
        for (const item of args.data) {
          state.reservationItems.push({
            id: `ri-${state.seq++}`,
            ...item,
          });
        }
        return { count: args.data.length };
      },
    },
    inventoryReservationAllocation: {
      createMany: async (args: { data: Array<Omit<ReservationAllocationRecord, 'id'>> }) => {
        for (const item of args.data) {
          state.reservationAllocations.push({
            id: `ra-${state.seq++}`,
            ...item,
          });
        }
        return { count: args.data.length };
      },
    },
    inventoryLevel: {
      findMany: async (args: {
        where: { productId: string; variantId: string; available: { gt: number } };
        include?: { warehouse?: true };
      }) =>
        state.inventoryLevels
          .filter(
            (level) =>
              level.productId === args.where.productId &&
              level.variantId === args.where.variantId &&
              level.available > args.where.available.gt,
          )
          .map((level) => ({
            ...level,
            warehouse: args.include?.warehouse ? state.warehouses.get(level.warehouseId)! : undefined,
          })),
      update: async (args: {
        where: { variantId_warehouseId: { variantId: string; warehouseId: string } };
        data: { available?: { decrement?: number; increment?: number }; reserved?: { decrement?: number; increment?: number } };
      }) => {
        const level = state.inventoryLevels.find(
          (item) =>
            item.variantId === args.where.variantId_warehouseId.variantId &&
            item.warehouseId === args.where.variantId_warehouseId.warehouseId,
        );
        if (!level) {
          throw new Error('inventory level not found');
        }

        if (args.data.available?.decrement) {
          level.available -= args.data.available.decrement;
        }
        if (args.data.available?.increment) {
          level.available += args.data.available.increment;
        }
        if (args.data.reserved?.decrement) {
          level.reserved -= args.data.reserved.decrement;
        }
        if (args.data.reserved?.increment) {
          level.reserved += args.data.reserved.increment;
        }
        level.updatedAt = new Date();
        return level;
      },
    },
    cartItem: {
      findMany: async (args: { where: { userId: string }; include?: { product?: true; variant?: true } }) =>
        state.cartItems
          .filter((row) => row.userId === args.where.userId)
          .map((row) => ({
            ...row,
            product: args.include?.product ? state.products.get(row.productId)! : undefined,
            variant: args.include?.variant ? state.variants.get(row.variantId)! : undefined,
          })),
      deleteMany: async (args: { where: { userId: string } }) => {
        const before = state.cartItems.length;
        state.cartItems = state.cartItems.filter((row) => row.userId !== args.where.userId);
        return { count: before - state.cartItems.length };
      },
    },
    productVariant: {
      updateMany: async (args: { where: { id: string; stock: { gte: number } }; data: { stock: { decrement: number } } }) => {
        const variant = state.variants.get(args.where.id);
        if (!variant || variant.stock < args.where.stock.gte) return { count: 0 };
        variant.stock -= args.data.stock.decrement;
        state.variants.set(variant.id, variant);
        return { count: 1 };
      },
      update: async (args: { where: { id: string }; data: { stock: { increment: number } } }) => {
        const variant = state.variants.get(args.where.id);
        if (!variant) throw new Error('variant not found');
        variant.stock += args.data.stock.increment;
        state.variants.set(variant.id, variant);
        return variant;
      },
    },
    product: {
      updateMany: async (args: { where: { id: string; stock: { gte: number } }; data: { stock: { decrement: number } } }) => {
        const product = state.products.get(args.where.id);
        if (!product || product.stock < args.where.stock.gte) return { count: 0 };
        product.stock -= args.data.stock.decrement;
        state.products.set(product.id, product);
        return { count: 1 };
      },
      update: async (args: { where: { id: string }; data: { stock: { increment: number } } }) => {
        const product = state.products.get(args.where.id);
        if (!product) throw new Error('product not found');
        product.stock += args.data.stock.increment;
        state.products.set(product.id, product);
        return product;
      },
    },
    inventoryMovement: {
      create: async (args: { data: Record<string, unknown> }) => {
        state.inventoryMovements.push(args.data);
        return args.data;
      },
    },
    cartCoupon: {
      findUnique: async () => null,
    },
    address: {
      findFirst: async () => null,
      create: async (args: { data: Record<string, unknown> }) => args.data,
    },
    order: {
      create: async (args: { data: Omit<OrderRecord, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const order: OrderRecord = {
          id: `ord-${state.seq++}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.data,
        };
        state.orders.set(order.id, order);
        return order;
      },
      findUnique: async (args: { where: { id: string }; include?: Record<string, unknown> }) => {
        const order = state.orders.get(args.where.id);
        if (!order) return null;
        return materializeOrder(order, args.include);
      },
      update: async (args: { where: { id: string }; data: Partial<OrderRecord> }) => {
        const order = state.orders.get(args.where.id);
        if (!order) throw new Error('order not found');
        const updated = { ...order, ...args.data, updatedAt: new Date() };
        state.orders.set(order.id, updated);
        return updated;
      },
      count: async () => state.orders.size,
      findMany: async (args: { include?: Record<string, unknown> }) =>
        [...state.orders.values()].map((order) => materializeOrder(order, args.include)),
    },
    orderItem: {
      createMany: async (args: { data: Array<Omit<OrderItemRecord, 'id'>> }) => {
        for (const item of args.data) {
          state.orderItems.push({
            id: `oi-${state.seq++}`,
            ...item,
          });
        }
        return { count: args.data.length };
      },
    },
    orderStatusEvent: {
      create: async (args: { data: Omit<OrderEventRecord, 'id' | 'createdAt'> }) => {
        const event: OrderEventRecord = {
          id: `oe-${state.seq++}`,
          createdAt: new Date(),
          ...args.data,
        };
        state.orderEvents.push(event);
        return event;
      },
    },
    payment: {
      create: async (args: { data: Omit<PaymentRecord, 'id' | 'createdAt' | 'updatedAt' | 'transactionId' | 'metadata' | 'refundedAmount'> & { transactionId?: string | null; metadata?: Record<string, unknown> } }) => {
        const payment: PaymentRecord = {
          id: `pay-${state.seq++}`,
          transactionId: args.data.transactionId ?? null,
          metadata: args.data.metadata ?? null,
          refundedAmount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.data,
        };
        state.payments.push(payment);
        return payment;
      },
      updateMany: async (args: { where: { orderId: string }; data: Partial<PaymentRecord> }) => {
        let count = 0;
        state.payments = state.payments.map((payment) => {
          if (payment.orderId !== args.where.orderId) return payment;
          count += 1;
          return { ...payment, ...args.data, updatedAt: new Date() };
        });
        return { count };
      },
    },
    coupon: {
      update: async () => ({ count: 1 }),
    },
    notification: {
      create: async (args: { data: Record<string, unknown> }) => {
        state.notifications.push(args.data);
        return args.data;
      },
    },
  };

  const prisma = {
    $transaction: async <T>(callback: (tx: typeof tx) => Promise<T>) => callback(tx),
    order: {
      count: tx.order.count,
      findMany: tx.order.findMany,
      findUnique: tx.order.findUnique,
    },
  };

  return { prisma, state, addCart };
}

function checkoutPayload(reservationId: string) {
  return {
    reservationId,
    paymentMethod: 'cod' as const,
    shippingMethod: 'standard' as const,
    address: {
      receiverName: 'Khach Demo',
      phone: '0900000000',
      province: 'Ho Chi Minh',
      district: 'Quan 1',
      ward: 'Ben Nghe',
      addressLine: '123 Nguyen Trai',
      country: 'Viet Nam',
    },
  };
}

test('orders.createReservationFromCart reserves stock from cart', async () => {
  const mock = createOrdersMock();
  mock.addCart('u-1', 'p-1', 2);
  const service = new OrdersService(mock.prisma as never);

  const reservation = await service.createReservationFromCart('u-1');

  assert.equal(reservation.status, 'active');
  assert.equal(reservation.totalItems, 2);
  assert.equal(mock.state.products.get('p-1')?.stock, 8);
  assert.equal(mock.state.variants.get('pv-1')?.stock, 8);
  assert.equal(mock.state.inventoryMovements.length, 1);
  assert.equal(reservation.items[0].variantId, 'pv-1');
  assert.equal(reservation.items[0].allocations[0].warehouseCode, 'MAIN');
  assert.equal(mock.state.inventoryLevels[0].available, 4);
  assert.equal(mock.state.inventoryLevels[0].reserved, 2);
});

test('orders.checkout creates order, payment and clears cart', async () => {
  const mock = createOrdersMock();
  mock.addCart('u-1', 'p-1', 1);
  const service = new OrdersService(mock.prisma as never);

  const reservation = await service.createReservationFromCart('u-1');
  const order = await service.checkout('u-1', checkoutPayload(reservation.id));

  assert.ok(order?.orderNumber);
  assert.equal(order?.status, 'created');
  assert.equal(mock.state.cartItems.length, 0);
  assert.equal(mock.state.payments.length, 1);
  assert.equal(mock.state.notifications.length, 1);
  assert.equal(mock.state.orderItems[0].variantId, 'pv-1');
  assert.equal(mock.state.orderItems[0].sku, 'SKU-1-BLACK');
});

test('orders.cancelOrder restores stock and marks payment canceled', async () => {
  const mock = createOrdersMock();
  mock.addCart('u-1', 'p-1', 1);
  const service = new OrdersService(mock.prisma as never);

  const reservation = await service.createReservationFromCart('u-1');
  const order = await service.checkout('u-1', checkoutPayload(reservation.id));
  const canceled = await service.cancelOrder(order!.id, 'u-1', 'customer');

  assert.equal(canceled?.status, 'canceled');
  assert.equal(mock.state.products.get('p-1')?.stock, 10);
  assert.equal(mock.state.variants.get('pv-1')?.stock, 10);
  assert.equal(mock.state.payments[0].status, 'canceled');
  assert.equal(mock.state.inventoryLevels[0].available, 6);
  assert.equal(mock.state.inventoryLevels[0].reserved, 0);
});

test('orders.updateStatus follows 4-step flow and marks COD paid at completion', async () => {
  const mock = createOrdersMock();
  mock.addCart('u-1', 'p-1', 1);
  const service = new OrdersService(mock.prisma as never);

  const reservation = await service.createReservationFromCart('u-1');
  const order = await service.checkout('u-1', checkoutPayload(reservation.id));

  await assert.rejects(
    async () => service.updateStatus(order!.id, 'shipping', 'u-admin'),
    (error: unknown) => error instanceof BadRequestException,
  );

  await service.updateStatus(order!.id, 'confirmed', 'u-admin');
  await service.updateStatus(order!.id, 'shipping', 'u-admin');
  const completed = await service.updateStatus(order!.id, 'completed', 'u-admin');

  assert.equal(completed?.status, 'completed');
  assert.equal(completed?.shippingStatus, 'delivered');
  assert.equal(completed?.paymentStatus, 'paid');
});

test('orders.reservation lifecycle APIs return summaries and release expired stock', async () => {
  const mock = createOrdersMock();
  mock.addCart('u-1', 'p-1', 2);
  const service = new OrdersService(mock.prisma as never);

  const reservation = await service.createReservationFromCart('u-1');
  const current = await service.getCurrentReservation('u-1');
  const canceled = await service.cancelReservation(reservation.id, 'u-1', 'customer');

  assert.equal(current.data?.id, reservation.id);
  assert.equal(canceled.success, true);
  assert.equal(mock.state.products.get('p-1')?.stock, 10);
  assert.equal(mock.state.inventoryLevels[0].reserved, 0);

  mock.addCart('u-1', 'p-1', 1);
  const expiredReservation = await service.createReservationFromCart('u-1');
  const expired = mock.state.reservations.get(expiredReservation.id)!;
  expired.expiresAt = new Date(Date.now() - 60_000);
  mock.state.reservations.set(expired.id, expired);

  const release = await service.releaseExpiredReservations('u-admin');
  assert.equal(release.expiredCount, 1);
  assert.equal(mock.state.products.get('p-1')?.stock, 10);
  assert.equal(mock.state.inventoryLevels[0].reserved, 0);
});

test('orders.list detail tracking invoice and return request cover customer lifecycle', async () => {
  const mock = createOrdersMock();
  mock.addCart('u-1', 'p-1', 1);
  const service = new OrdersService(mock.prisma as never);

  const reservation = await service.createReservationFromCart('u-1');
  const order = await service.checkout('u-1', checkoutPayload(reservation.id));
  await service.updateStatus(order!.id, 'confirmed', 'u-admin');
  await service.updateStatus(order!.id, 'shipping', 'u-admin');
  await service.updateStatus(order!.id, 'completed', 'u-admin');

  const list = await service.list('u-1', 'customer');
  const detail = await service.getById(order!.id, 'u-1', 'customer');
  const tracking = await service.getTracking(order!.id, 'u-1', 'customer');
  const invoice = await service.getInvoice(order!.id, 'u-1', 'customer');
  const returned = await service.requestReturn(order!.id, 'u-1', 'customer');

  assert.equal(list.total, 1);
  assert.equal(detail.id, order!.id);
  assert.equal(tracking.orderId, order!.id);
  assert.ok(Array.isArray(tracking.timeline));
  assert.equal(invoice.orderNumber, order!.orderNumber);
  assert.equal(invoice.items.length, 1);
  assert.equal(invoice.items[0].variantName, 'Black 128GB');
  assert.equal(returned?.status, 'returned');
});

test('orders.private helpers resolve addresses and coupon discounts across edge cases', async () => {
  const service = new OrdersService({} as never);

  const txWithStoredAddress = {
    address: {
      findFirst: async () => ({
        id: 'addr-1',
        userId: 'u-1',
        fullName: 'Stored User',
        phone: '0900000000',
        province: 'Ho Chi Minh',
        district: 'Quan 1',
        ward: 'Ben Nghe',
        addressLine: '12 Nguyen Hue',
        country: 'Viet Nam',
      }),
      create: async () => null,
    },
  };

  const storedAddress = await (service as any).resolveAddress(txWithStoredAddress, 'u-1', {
    reservationId: 'res-1',
    addressId: 'addr-1',
    paymentMethod: 'cod',
    shippingMethod: 'standard',
  });
  assert.equal(storedAddress.receiverName, 'Stored User');

  await assert.rejects(
    async () =>
      (service as any).resolveAddress(
        {
          address: {
            findFirst: async () => null,
            create: async () => null,
          },
        },
        'u-1',
        {
          reservationId: 'res-1',
          addressId: 'missing',
          paymentMethod: 'cod',
          shippingMethod: 'standard',
        },
      ),
    (error: unknown) => error instanceof NotFoundException,
  );

  const savedAddresses: Array<Record<string, unknown>> = [];
  const inlineAddress = await (service as any).resolveAddress(
    {
      address: {
        findFirst: async () => null,
        create: async (args: { data: Record<string, unknown> }) => {
          savedAddresses.push(args.data);
          return args.data;
        },
      },
    },
    'u-1',
    {
      reservationId: 'res-1',
      paymentMethod: 'cod',
      shippingMethod: 'standard',
      saveAddress: true,
      address: checkoutPayload('res-1').address,
    },
  );
  assert.equal(inlineAddress.receiverName, 'Khach Demo');
  assert.equal(savedAddresses.length, 1);

  await assert.rejects(
    async () =>
      (service as any).resolveAddress(
        {
          address: {
            findFirst: async () => null,
            create: async () => null,
          },
        },
        'u-1',
        {
          reservationId: 'res-1',
          paymentMethod: 'cod',
          shippingMethod: 'standard',
        },
      ),
    (error: unknown) => error instanceof BadRequestException,
  );

  const fixedDiscount = (service as any).calculateCouponDiscount(
    {
      type: 'fixed',
      value: 50_000,
      minOrderAmount: 100_000,
      maxDiscount: null,
      usageLimit: null,
      usedCount: 0,
      startsAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60_000),
    },
    200_000,
    30_000,
  );
  const percentDiscount = (service as any).calculateCouponDiscount(
    {
      type: 'percent',
      value: 20,
      minOrderAmount: 100_000,
      maxDiscount: 25_000,
      usageLimit: null,
      usedCount: 0,
      startsAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60_000),
    },
    200_000,
    30_000,
  );
  const shippingDiscount = (service as any).calculateCouponDiscount(
    {
      type: 'free_shipping',
      value: 0,
      minOrderAmount: 100_000,
      maxDiscount: null,
      usageLimit: null,
      usedCount: 0,
      startsAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60_000),
    },
    200_000,
    30_000,
  );

  assert.equal(fixedDiscount, 50_000);
  assert.equal(percentDiscount, 25_000);
  assert.equal(shippingDiscount, 30_000);

  await assert.rejects(
    async () =>
      (service as any).calculateCouponDiscount(
        {
          type: 'fixed',
          value: 10_000,
          minOrderAmount: 0,
          maxDiscount: null,
          usageLimit: null,
          usedCount: 0,
          startsAt: new Date(Date.now() + 60_000),
          expiresAt: new Date(Date.now() + 120_000),
        },
        200_000,
        30_000,
      ),
    (error: unknown) => error instanceof BadRequestException,
  );

  await assert.rejects(
    async () =>
      (service as any).calculateCouponDiscount(
        {
          type: 'fixed',
          value: 10_000,
          minOrderAmount: 0,
          maxDiscount: null,
          usageLimit: 1,
          usedCount: 1,
          startsAt: new Date(Date.now() - 60_000),
          expiresAt: new Date(Date.now() + 60_000),
        },
        200_000,
        30_000,
      ),
    (error: unknown) => error instanceof BadRequestException,
  );

  await assert.rejects(
    async () =>
      (service as any).calculateCouponDiscount(
        {
          type: 'fixed',
          value: 10_000,
          minOrderAmount: 500_000,
          maxDiscount: null,
          usageLimit: null,
          usedCount: 0,
          startsAt: new Date(Date.now() - 60_000),
          expiresAt: new Date(Date.now() + 60_000),
        },
        200_000,
        30_000,
      ),
    (error: unknown) => error instanceof BadRequestException,
  );
});
