import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service';

type ProductRecord = { id: string; name: string; price: number; stock: number };
type CartRecord = { id: string; userId: string; productId: string; quantity: number; createdAt: Date };
type ReservationRecord = {
  id: string;
  userId: string;
  status: 'active' | 'consumed' | 'canceled' | 'expired';
  expiresAt: Date;
  createdAt: Date;
  consumedAt?: Date | null;
  canceledAt?: Date | null;
  expiredAt?: Date | null;
};
type ReservationItemRecord = {
  id: string;
  reservationId: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};
type OrderRecord = {
  id: string;
  userId: string;
  reservationId?: string | null;
  status: 'created' | 'confirmed' | 'shipping' | 'completed';
  paymentMethod: 'cod' | 'vnpay' | 'momo';
  paymentStatus: 'pending' | 'authorized' | 'paid' | 'failed';
  shippingMethod: 'standard' | 'express';
  shippingStatus: 'pending' | 'packed' | 'in_transit' | 'delivered';
  addressJson: Record<string, unknown>;
  notes: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  createdAt: Date;
  updatedAt: Date;
};
type OrderItemRecord = {
  id: string;
  orderId: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};
type OrderEventRecord = {
  id: string;
  orderId: string;
  status: 'created' | 'confirmed' | 'shipping' | 'completed';
  actorId: string;
  createdAt: Date;
};

function createOrdersMock() {
  const state = {
    products: new Map<string, ProductRecord>([
      ['p-1', { id: 'p-1', name: 'Laptop', price: 2000, stock: 10 }],
      ['p-2', { id: 'p-2', name: 'Mouse', price: 300, stock: 8 }],
    ]),
    cartItems: [] as CartRecord[],
    reservations: new Map<string, ReservationRecord>(),
    reservationItems: [] as ReservationItemRecord[],
    orders: new Map<string, OrderRecord>(),
    orderItems: [] as OrderItemRecord[],
    orderEvents: [] as OrderEventRecord[],
    ids: {
      reservation: 1,
      reservationItem: 1,
      cart: 1,
      order: 1,
      orderItem: 1,
      orderEvent: 1,
    },
  };

  function addCart(userId: string, productId: string, quantity: number) {
    state.cartItems.push({
      id: `ci-${state.ids.cart++}`,
      userId,
      productId,
      quantity,
      createdAt: new Date(),
    });
  }

  function addReservation(input: {
    id?: string;
    userId: string;
    status?: ReservationRecord['status'];
    expiresAt: Date;
    createdAt?: Date;
    items: Array<{ productId: string; quantity: number; unitPrice?: number; name?: string }>;
  }) {
    const id = input.id ?? `res-${state.ids.reservation++}`;

    state.reservations.set(id, {
      id,
      userId: input.userId,
      status: input.status ?? 'active',
      expiresAt: input.expiresAt,
      createdAt: input.createdAt ?? new Date(),
      consumedAt: null,
      canceledAt: null,
      expiredAt: null,
    });

    for (const item of input.items) {
      const product = state.products.get(item.productId)!;
      state.reservationItems.push({
        id: `ri-${state.ids.reservationItem++}`,
        reservationId: id,
        productId: item.productId,
        name: item.name ?? product.name,
        unitPrice: item.unitPrice ?? product.price,
        quantity: item.quantity,
      });
    }

    return id;
  }

  function addOrder(input: Partial<OrderRecord> & { id?: string; userId: string }) {
    const id = input.id ?? `ord-${state.ids.order++}`;
    const now = new Date();

    state.orders.set(id, {
      id,
      userId: input.userId,
      reservationId: input.reservationId ?? null,
      status: input.status ?? 'created',
      paymentMethod: input.paymentMethod ?? 'cod',
      paymentStatus: input.paymentStatus ?? 'pending',
      shippingMethod: input.shippingMethod ?? 'standard',
      shippingStatus: input.shippingStatus ?? 'pending',
      addressJson: input.addressJson ?? {},
      notes: input.notes ?? '',
      subtotal: input.subtotal ?? 0,
      shippingFee: input.shippingFee ?? 0,
      total: input.total ?? 0,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    });

    return id;
  }

  function materializeReservation(reservation: ReservationRecord) {
    const items = state.reservationItems.filter((item) => item.reservationId === reservation.id);
    return { ...reservation, items };
  }

  function materializeOrder(order: OrderRecord, include?: Record<string, unknown>) {
    if (!include) return { ...order };

    const result: Record<string, unknown> = { ...order };

    if (include.items) {
      result.items = state.orderItems.filter((item) => item.orderId === order.id);
    }

    if (include.history) {
      result.history = state.orderEvents
        .filter((event) => event.orderId === order.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    if (include.reservation) {
      if (!order.reservationId) {
        result.reservation = null;
      } else {
        const reservation = state.reservations.get(order.reservationId) ?? null;
        result.reservation = reservation ? materializeReservation(reservation) : null;
      }
    }

    return result;
  }

  const tx = {
    inventoryReservation: {
      findMany: async (args: {
        where: { status?: string; expiresAt?: { lt?: Date; gt?: Date } };
        select?: { id: true };
      }) => {
        let rows = [...state.reservations.values()];

        if (args.where?.status) {
          rows = rows.filter((row) => row.status === args.where.status);
        }

        if (args.where?.expiresAt?.lt) {
          rows = rows.filter((row) => row.expiresAt < args.where.expiresAt!.lt!);
        }

        if (args.where?.expiresAt?.gt) {
          rows = rows.filter((row) => row.expiresAt > args.where.expiresAt!.gt!);
        }

        if (args.select?.id) {
          return rows.map((row) => ({ id: row.id }));
        }

        return rows;
      },
      findFirst: async (args: {
        where: { userId: string; status: string; expiresAt: { gt: Date } };
        include?: { items: true };
      }) => {
        const rows = [...state.reservations.values()]
          .filter(
            (row) =>
              row.userId === args.where.userId &&
              row.status === args.where.status &&
              row.expiresAt > args.where.expiresAt.gt,
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        const found = rows[0];
        if (!found) return null;
        if (args.include?.items) return materializeReservation(found);
        return { ...found };
      },
      findUnique: async (args: { where: { id: string }; include?: { items: true } }) => {
        const found = state.reservations.get(args.where.id);
        if (!found) return null;
        if (args.include?.items) return materializeReservation(found);
        return { ...found };
      },
      create: async (args: {
        data: { userId: string; status: ReservationRecord['status']; expiresAt: Date };
      }) => {
        const id = `res-${state.ids.reservation++}`;
        const reservation: ReservationRecord = {
          id,
          userId: args.data.userId,
          status: args.data.status,
          expiresAt: args.data.expiresAt,
          createdAt: new Date(),
          consumedAt: null,
          canceledAt: null,
          expiredAt: null,
        };

        state.reservations.set(id, reservation);
        return reservation;
      },
      updateMany: async (args: {
        where: { id: string; status: ReservationRecord['status'] };
        data: Partial<ReservationRecord>;
      }) => {
        const found = state.reservations.get(args.where.id);
        if (!found || found.status !== args.where.status) {
          return { count: 0 };
        }

        state.reservations.set(found.id, { ...found, ...args.data });
        return { count: 1 };
      },
      update: async (args: { where: { id: string }; data: Partial<ReservationRecord> }) => {
        const found = state.reservations.get(args.where.id);
        if (!found) throw new Error('reservation not found');
        const updated = { ...found, ...args.data };
        state.reservations.set(found.id, updated);
        return updated;
      },
    },
    inventoryReservationItem: {
      createMany: async (args: {
        data: Array<{ reservationId: string; productId: string; name: string; unitPrice: number; quantity: number }>;
      }) => {
        for (const item of args.data) {
          state.reservationItems.push({
            id: `ri-${state.ids.reservationItem++}`,
            ...item,
          });
        }

        return { count: args.data.length };
      },
    },
    cartItem: {
      findMany: async (args: { where: { userId: string } }) =>
        state.cartItems
          .filter((row) => row.userId === args.where.userId)
          .map((row) => ({ ...row, product: state.products.get(row.productId)! })),
      deleteMany: async (args: { where: { userId: string } }) => {
        const before = state.cartItems.length;
        state.cartItems = state.cartItems.filter((row) => row.userId !== args.where.userId);
        return { count: before - state.cartItems.length };
      },
    },
    product: {
      updateMany: async (args: {
        where: { id: string; stock: { gte: number } };
        data: { stock: { decrement: number } };
      }) => {
        const product = state.products.get(args.where.id);
        if (!product) return { count: 0 };
        if (product.stock < args.where.stock.gte) return { count: 0 };

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
    order: {
      create: async (args: { data: Omit<OrderRecord, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const id = `ord-${state.ids.order++}`;
        const now = new Date();
        const order: OrderRecord = {
          id,
          ...args.data,
          createdAt: now,
          updatedAt: now,
        };

        state.orders.set(id, order);
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
    },
    orderItem: {
      createMany: async (args: {
        data: Array<{ orderId: string; productId: string; name: string; unitPrice: number; quantity: number }>;
      }) => {
        for (const item of args.data) {
          state.orderItems.push({
            id: `oi-${state.ids.orderItem++}`,
            ...item,
          });
        }
        return { count: args.data.length };
      },
    },
    orderStatusEvent: {
      create: async (args: {
        data: { orderId: string; status: OrderEventRecord['status']; actorId: string };
      }) => {
        const event: OrderEventRecord = {
          id: `oe-${state.ids.orderEvent++}`,
          orderId: args.data.orderId,
          status: args.data.status,
          actorId: args.data.actorId,
          createdAt: new Date(),
        };
        state.orderEvents.push(event);
        return event;
      },
    },
  };

  const prisma = {
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
    order: {
      count: async () => state.orders.size,
      findMany: async (args: { include?: Record<string, unknown> }) =>
        [...state.orders.values()].map((order) => materializeOrder(order, args.include)),
      findUnique: async (args: { where: { id: string }; include?: Record<string, unknown> }) => {
        const order = state.orders.get(args.where.id);
        if (!order) return null;
        return materializeOrder(order, args.include);
      },
    },
  };

  return {
    prisma,
    state,
    addCart,
    addReservation,
    addOrder,
  };
}

function createCheckoutPayload(reservationId: string) {
  return {
    reservationId,
    address: {
      receiverName: 'Khach Demo',
      phone: '0900000000',
      line1: '123 Nguyen Trai',
      district: 'Quan 1',
      city: 'Ho Chi Minh',
      country: 'Viet Nam',
    },
    paymentMethod: 'cod' as const,
    shippingMethod: 'standard' as const,
    notes: '',
  };
}

test('orders.createReservationFromCart returns existing active reservation', async () => {
  const mock = createOrdersMock();
  const reservationId = mock.addReservation({
    id: 'res-existing',
    userId: 'u-1',
    expiresAt: new Date(Date.now() + 30 * 60_000),
    items: [{ productId: 'p-1', quantity: 1 }],
  });

  const initialStock = mock.state.products.get('p-1')!.stock;
  const service = new OrdersService(mock.prisma as never);

  const result = await service.createReservationFromCart('u-1');

  assert.equal(result.id, reservationId);
  assert.equal(result.totalItems, 1);
  assert.equal(mock.state.products.get('p-1')!.stock, initialStock);
});

test('orders.createReservationFromCart reserves stock from cart', async () => {
  const mock = createOrdersMock();
  mock.addCart('u-1', 'p-1', 2);

  const service = new OrdersService(mock.prisma as never);
  const result = await service.createReservationFromCart('u-1');

  assert.equal(result.status, 'active');
  assert.equal(result.totalItems, 2);
  assert.equal(mock.state.products.get('p-1')!.stock, 8);
});

test('orders.createReservationFromCart throws when cart is empty', async () => {
  const mock = createOrdersMock();
  const service = new OrdersService(mock.prisma as never);

  await assert.rejects(
    async () => service.createReservationFromCart('u-1'),
    (error: unknown) => error instanceof BadRequestException,
  );
});

test('orders.cancelReservation rejects non-owner customer', async () => {
  const mock = createOrdersMock();
  mock.addReservation({
    id: 'res-1',
    userId: 'u-owner',
    expiresAt: new Date(Date.now() + 60_000),
    items: [{ productId: 'p-1', quantity: 1 }],
  });

  const service = new OrdersService(mock.prisma as never);

  await assert.rejects(
    async () => service.cancelReservation('res-1', 'u-other', 'customer'),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test('orders.cancelReservation releases stock and marks reservation canceled', async () => {
  const mock = createOrdersMock();
  mock.state.products.get('p-1')!.stock = 6;
  mock.addReservation({
    id: 'res-1',
    userId: 'u-1',
    expiresAt: new Date(Date.now() + 60_000),
    items: [{ productId: 'p-1', quantity: 2 }],
  });

  const service = new OrdersService(mock.prisma as never);
  const result = await service.cancelReservation('res-1', 'u-1', 'customer');

  assert.equal(result.success, true);
  assert.equal(mock.state.reservations.get('res-1')?.status, 'canceled');
  assert.equal(mock.state.products.get('p-1')!.stock, 8);
});

test('orders.checkout consumes reservation and creates order', async () => {
  const mock = createOrdersMock();
  mock.addCart('u-1', 'p-1', 1);
  const reservationId = mock.addReservation({
    id: 'res-checkout',
    userId: 'u-1',
    expiresAt: new Date(Date.now() + 60_000),
    items: [{ productId: 'p-1', quantity: 1 }],
  });

  const service = new OrdersService(mock.prisma as never);
  const order = await service.checkout('u-1', createCheckoutPayload(reservationId));

  assert.ok(order?.id);
  assert.equal(order?.status, 'created');
  assert.equal(order?.reservationId, reservationId);
  assert.equal(mock.state.reservations.get(reservationId)?.status, 'consumed');
  assert.equal(mock.state.cartItems.length, 0);
});

test('orders.checkout expires reservation when reservation already expired', async () => {
  const mock = createOrdersMock();
  mock.state.products.get('p-1')!.stock = 5;

  const reservationId = mock.addReservation({
    id: 'res-expired',
    userId: 'u-1',
    expiresAt: new Date(Date.now() - 10_000),
    items: [{ productId: 'p-1', quantity: 2 }],
  });

  const service = new OrdersService(mock.prisma as never);

  await assert.rejects(
    async () => service.checkout('u-1', createCheckoutPayload(reservationId)),
    (error: unknown) => error instanceof BadRequestException,
  );

  assert.equal(mock.state.reservations.get(reservationId)?.status, 'expired');
  assert.equal(mock.state.products.get('p-1')!.stock, 7);
});

test('orders.updateStatus allows only sequential transitions', async () => {
  const mock = createOrdersMock();
  const orderId = mock.addOrder({
    id: 'ord-1',
    userId: 'u-1',
    status: 'created',
    paymentStatus: 'pending',
    shippingStatus: 'pending',
  });

  const service = new OrdersService(mock.prisma as never);

  await assert.rejects(
    async () => service.updateStatus(orderId, 'shipping', 'u-admin'),
    (error: unknown) => error instanceof BadRequestException,
  );

  const updated = await service.updateStatus(orderId, 'confirmed', 'u-admin');
  assert.equal(updated?.status, 'confirmed');
  assert.equal(updated?.paymentStatus, 'paid');
  assert.equal(updated?.shippingStatus, 'packed');
});

test('orders.releaseExpiredReservations releases only expired active reservations', async () => {
  const mock = createOrdersMock();
  mock.state.products.get('p-1')!.stock = 4;
  mock.state.products.get('p-2')!.stock = 5;

  mock.addReservation({
    id: 'res-old-1',
    userId: 'u-1',
    expiresAt: new Date(Date.now() - 60_000),
    items: [{ productId: 'p-1', quantity: 2 }],
  });

  mock.addReservation({
    id: 'res-old-2',
    userId: 'u-2',
    expiresAt: new Date(Date.now() - 30_000),
    items: [{ productId: 'p-2', quantity: 1 }],
  });

  mock.addReservation({
    id: 'res-active',
    userId: 'u-3',
    expiresAt: new Date(Date.now() + 120_000),
    items: [{ productId: 'p-1', quantity: 1 }],
  });

  const service = new OrdersService(mock.prisma as never);
  const result = await service.releaseExpiredReservations('u-admin');

  assert.equal(result.expiredCount, 2);
  assert.equal(mock.state.reservations.get('res-old-1')?.status, 'expired');
  assert.equal(mock.state.reservations.get('res-old-2')?.status, 'expired');
  assert.equal(mock.state.reservations.get('res-active')?.status, 'active');
  assert.equal(mock.state.products.get('p-1')!.stock, 6);
  assert.equal(mock.state.products.get('p-2')!.stock, 6);
});
