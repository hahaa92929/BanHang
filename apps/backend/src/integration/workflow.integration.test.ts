import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrdersService } from '../modules/orders/orders.service';
import { PaymentsService } from '../modules/payments/payments.service';

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
};

type CartItem = {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  createdAt: Date;
};

type Reservation = {
  id: string;
  userId: string;
  status: 'active' | 'consumed' | 'canceled' | 'expired';
  expiresAt: Date;
  createdAt: Date;
  consumedAt: Date | null;
  canceledAt: Date | null;
  expiredAt: Date | null;
};

type ReservationItem = {
  id: string;
  reservationId: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

type Order = {
  id: string;
  userId: string;
  reservationId: string | null;
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

type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

type OrderEvent = {
  id: string;
  orderId: string;
  status: 'created' | 'confirmed' | 'shipping' | 'completed';
  actorId: string;
  createdAt: Date;
};

type PaymentEvent = {
  eventId: string;
  type: string;
  orderId?: string;
  payload: unknown;
  processedAt: Date;
};

function createWorkflowMock() {
  const state = {
    products: new Map<string, Product>([
      ['p-1', { id: 'p-1', name: 'Laptop', price: 20_000_000, stock: 8 }],
      ['p-2', { id: 'p-2', name: 'Mouse', price: 500_000, stock: 20 }],
    ]),
    cartItems: [] as CartItem[],
    reservations: new Map<string, Reservation>(),
    reservationItems: [] as ReservationItem[],
    orders: new Map<string, Order>(),
    orderItems: [] as OrderItem[],
    orderEvents: [] as OrderEvent[],
    paymentEvents: new Map<string, PaymentEvent>(),
    seq: {
      cart: 1,
      reservation: 1,
      reservationItem: 1,
      order: 1,
      orderItem: 1,
      orderEvent: 1,
    },
  };

  function addCart(userId: string, productId: string, quantity: number) {
    state.cartItems.push({
      id: `ci-${state.seq.cart++}`,
      userId,
      productId,
      quantity,
      createdAt: new Date(),
    });
  }

  function addReservation(input: {
    id?: string;
    userId: string;
    status?: Reservation['status'];
    expiresAt: Date;
    items: Array<{ productId: string; quantity: number; unitPrice?: number; name?: string }>;
  }) {
    const id = input.id ?? `res-${state.seq.reservation++}`;
    const reservation: Reservation = {
      id,
      userId: input.userId,
      status: input.status ?? 'active',
      expiresAt: input.expiresAt,
      createdAt: new Date(),
      consumedAt: null,
      canceledAt: null,
      expiredAt: null,
    };

    state.reservations.set(id, reservation);

    for (const item of input.items) {
      const product = state.products.get(item.productId)!;
      state.reservationItems.push({
        id: `ri-${state.seq.reservationItem++}`,
        reservationId: id,
        productId: item.productId,
        name: item.name ?? product.name,
        unitPrice: item.unitPrice ?? product.price,
        quantity: item.quantity,
      });
    }

    return id;
  }

  function materializeReservation(reservation: Reservation) {
    return {
      ...reservation,
      items: state.reservationItems.filter((item) => item.reservationId === reservation.id),
    };
  }

  function filterOrders(where?: { userId?: string }) {
    const rows = [...state.orders.values()];
    if (!where?.userId) return rows;
    return rows.filter((row) => row.userId === where.userId);
  }

  function materializeOrder(order: Order, include?: Record<string, unknown>) {
    if (!include) return { ...order };

    const out: Record<string, unknown> = { ...order };

    if (include.items) {
      out.items = state.orderItems.filter((item) => item.orderId === order.id);
    }

    if (include.history) {
      out.history = state.orderEvents
        .filter((event) => event.orderId === order.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    if (include.reservation) {
      if (!order.reservationId) {
        out.reservation = null;
      } else {
        const reservation = state.reservations.get(order.reservationId);
        out.reservation = reservation ? materializeReservation(reservation) : null;
      }
    }

    return out;
  }

  const tx = {
    inventoryReservation: {
      findMany: async (args: { where: { status?: string; expiresAt?: { lt?: Date; gt?: Date } }; select?: { id: true } }) => {
        let rows = [...state.reservations.values()];

        if (args.where.status) {
          rows = rows.filter((row) => row.status === args.where.status);
        }
        if (args.where.expiresAt?.lt) {
          rows = rows.filter((row) => row.expiresAt < args.where.expiresAt!.lt!);
        }
        if (args.where.expiresAt?.gt) {
          rows = rows.filter((row) => row.expiresAt > args.where.expiresAt!.gt!);
        }

        if (args.select?.id) {
          return rows.map((row) => ({ id: row.id }));
        }

        return rows;
      },
      findFirst: async (args: { where: { userId: string; status: string; expiresAt: { gt: Date } }; include?: { items: true } }) => {
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
        return args.include?.items ? materializeReservation(found) : { ...found };
      },
      findUnique: async (args: { where: { id: string }; include?: { items: true } }) => {
        const found = state.reservations.get(args.where.id);
        if (!found) return null;
        return args.include?.items ? materializeReservation(found) : { ...found };
      },
      create: async (args: { data: { userId: string; status: Reservation['status']; expiresAt: Date } }) => {
        const reservation: Reservation = {
          id: `res-${state.seq.reservation++}`,
          userId: args.data.userId,
          status: args.data.status,
          expiresAt: args.data.expiresAt,
          createdAt: new Date(),
          consumedAt: null,
          canceledAt: null,
          expiredAt: null,
        };

        state.reservations.set(reservation.id, reservation);
        return reservation;
      },
      updateMany: async (args: { where: { id: string; status: Reservation['status'] }; data: Partial<Reservation> }) => {
        const found = state.reservations.get(args.where.id);
        if (!found || found.status !== args.where.status) return { count: 0 };
        state.reservations.set(found.id, { ...found, ...args.data });
        return { count: 1 };
      },
      update: async (args: { where: { id: string }; data: Partial<Reservation> }) => {
        const found = state.reservations.get(args.where.id);
        if (!found) throw new Error('reservation not found');
        const updated = { ...found, ...args.data };
        state.reservations.set(found.id, updated);
        return updated;
      },
    },
    inventoryReservationItem: {
      createMany: async (args: { data: Array<{ reservationId: string; productId: string; name: string; unitPrice: number; quantity: number }> }) => {
        for (const item of args.data) {
          state.reservationItems.push({
            id: `ri-${state.seq.reservationItem++}`,
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
      updateMany: async (args: { where: { id: string; stock: { gte: number } }; data: { stock: { decrement: number } } }) => {
        const found = state.products.get(args.where.id);
        if (!found) return { count: 0 };
        if (found.stock < args.where.stock.gte) return { count: 0 };
        found.stock -= args.data.stock.decrement;
        state.products.set(found.id, found);
        return { count: 1 };
      },
      update: async (args: { where: { id: string }; data: { stock: { increment: number } } }) => {
        const found = state.products.get(args.where.id);
        if (!found) throw new Error('product not found');
        found.stock += args.data.stock.increment;
        state.products.set(found.id, found);
        return found;
      },
    },
    order: {
      create: async (args: { data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const now = new Date();
        const order: Order = {
          id: `ord-${state.seq.order++}`,
          ...args.data,
          createdAt: now,
          updatedAt: now,
        };
        state.orders.set(order.id, order);
        return order;
      },
      findUnique: async (args: { where: { id: string }; include?: Record<string, unknown> }) => {
        const found = state.orders.get(args.where.id);
        if (!found) return null;
        return materializeOrder(found, args.include);
      },
      update: async (args: { where: { id: string }; data: Partial<Order>; select?: { id: true; paymentStatus: true } }) => {
        const found = state.orders.get(args.where.id);
        if (!found) throw new Error('order not found');
        const updated = { ...found, ...args.data, updatedAt: new Date() };
        state.orders.set(found.id, updated);

        if (args.select) {
          return { id: updated.id, paymentStatus: updated.paymentStatus };
        }

        return updated;
      },
    },
    orderItem: {
      createMany: async (args: { data: Array<{ orderId: string; productId: string; name: string; unitPrice: number; quantity: number }> }) => {
        for (const item of args.data) {
          state.orderItems.push({
            id: `oi-${state.seq.orderItem++}`,
            ...item,
          });
        }
        return { count: args.data.length };
      },
    },
    orderStatusEvent: {
      create: async (args: { data: { orderId: string; status: OrderEvent['status']; actorId: string } }) => {
        const event: OrderEvent = {
          id: `oe-${state.seq.orderEvent++}`,
          orderId: args.data.orderId,
          status: args.data.status,
          actorId: args.data.actorId,
          createdAt: new Date(),
        };
        state.orderEvents.push(event);
        return event;
      },
    },
    paymentWebhookEvent: {
      create: async (args: { data: { eventId: string; type: string; orderId?: string; payload: unknown } }) => {
        const event: PaymentEvent = {
          eventId: args.data.eventId,
          type: args.data.type,
          orderId: args.data.orderId,
          payload: args.data.payload,
          processedAt: new Date(),
        };
        state.paymentEvents.set(event.eventId, event);
        return event;
      },
    },
  };

  const prisma = {
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
    order: {
      count: async (args: { where?: { userId?: string } }) => filterOrders(args.where).length,
      findMany: async (args: { where?: { userId?: string }; include?: Record<string, unknown> }) =>
        filterOrders(args.where).map((order) => materializeOrder(order, args.include)),
      findUnique: async (args: { where: { id: string }; include?: Record<string, unknown> }) => {
        const found = state.orders.get(args.where.id);
        if (!found) return null;
        return materializeOrder(found, args.include);
      },
    },
    paymentWebhookEvent: {
      findUnique: async (args: { where: { eventId: string } }) => state.paymentEvents.get(args.where.eventId) ?? null,
    },
  };

  return {
    prisma,
    state,
    addCart,
    addReservation,
  };
}

function checkoutPayload(reservationId: string, paymentMethod: 'cod' | 'vnpay' = 'cod') {
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
    paymentMethod,
    shippingMethod: 'standard' as const,
    notes: '',
  };
}

function sign(body: unknown, secret: string) {
  return createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
}

test('workflow reserve -> checkout -> webhook captured sets paymentStatus paid', async () => {
  const mock = createWorkflowMock();
  process.env.PAYMENT_WEBHOOK_SECRET = 'workflow-secret';

  const orders = new OrdersService(mock.prisma as never);
  const payments = new PaymentsService(mock.prisma as never);

  mock.addCart('u-1', 'p-1', 1);

  const reservation = await orders.createReservationFromCart('u-1');
  const order = await orders.checkout('u-1', checkoutPayload(reservation.id, 'vnpay'));

  assert.equal(order?.paymentStatus, 'authorized');

  const body = {
    eventId: 'evt-captured-1',
    type: 'payment.captured',
    orderId: order!.id,
    payload: { amount: order!.total },
  };

  const result = await payments.processWebhook(sign(body, 'workflow-secret'), body);

  assert.equal(result.processed, true);
  assert.equal(result.orderUpdate?.paymentStatus, 'paid');
  assert.equal(mock.state.orders.get(order!.id)?.paymentStatus, 'paid');
});

test('workflow webhook duplicate event is idempotent', async () => {
  const mock = createWorkflowMock();
  process.env.PAYMENT_WEBHOOK_SECRET = 'workflow-secret';

  const orders = new OrdersService(mock.prisma as never);
  const payments = new PaymentsService(mock.prisma as never);

  mock.addCart('u-1', 'p-1', 1);
  const reservation = await orders.createReservationFromCart('u-1');
  const order = await orders.checkout('u-1', checkoutPayload(reservation.id, 'vnpay'));

  const body = {
    eventId: 'evt-dup-1',
    type: 'payment.captured',
    orderId: order!.id,
    payload: { amount: order!.total },
  };

  const signature = sign(body, 'workflow-secret');

  const first = await payments.processWebhook(signature, body);
  const second = await payments.processWebhook(signature, body);

  assert.equal(first.processed, true);
  assert.equal(second.processed, false);
  assert.equal(second.reason, 'duplicate_event');
});

test('workflow cancel reservation restores stock and blocks checkout', async () => {
  const mock = createWorkflowMock();
  const orders = new OrdersService(mock.prisma as never);

  mock.addCart('u-1', 'p-1', 2);
  const reservation = await orders.createReservationFromCart('u-1');

  assert.equal(mock.state.products.get('p-1')?.stock, 6);

  await orders.cancelReservation(reservation.id, 'u-1', 'customer');

  assert.equal(mock.state.products.get('p-1')?.stock, 8);

  await assert.rejects(
    async () => orders.checkout('u-1', checkoutPayload(reservation.id, 'cod')),
    (error: unknown) => error instanceof BadRequestException,
  );
});

test('workflow expired reservation can be released and no longer active', async () => {
  const mock = createWorkflowMock();
  const orders = new OrdersService(mock.prisma as never);

  mock.state.products.get('p-1')!.stock = 5;
  mock.addReservation({
    id: 'res-expired',
    userId: 'u-1',
    status: 'active',
    expiresAt: new Date(Date.now() - 30_000),
    items: [{ productId: 'p-1', quantity: 2 }],
  });

  const result = await orders.releaseExpiredReservations('u-admin');

  assert.equal(result.expiredCount, 1);
  assert.equal(mock.state.reservations.get('res-expired')?.status, 'expired');
  assert.equal(mock.state.products.get('p-1')?.stock, 7);

  const current = await orders.getCurrentReservation('u-1');
  assert.equal(current.data, null);
});

test('workflow getById prevents other customer from reading order', async () => {
  const mock = createWorkflowMock();
  const orders = new OrdersService(mock.prisma as never);

  mock.addCart('u-1', 'p-1', 1);
  const reservation = await orders.createReservationFromCart('u-1');
  const order = await orders.checkout('u-1', checkoutPayload(reservation.id));

  await assert.rejects(
    async () => orders.getById(order!.id, 'u-other', 'customer'),
    (error: unknown) => error instanceof ForbiddenException,
  );

  const adminView = await orders.getById(order!.id, 'u-admin', 'admin');
  assert.equal(adminView.id, order!.id);
});

test('workflow admin transitions order through full 4-step state machine', async () => {
  const mock = createWorkflowMock();
  const orders = new OrdersService(mock.prisma as never);

  mock.addCart('u-1', 'p-1', 1);
  const reservation = await orders.createReservationFromCart('u-1');
  const order = await orders.checkout('u-1', checkoutPayload(reservation.id, 'cod'));

  const confirmed = await orders.updateStatus(order!.id, 'confirmed', 'u-admin');
  assert.equal(confirmed?.status, 'confirmed');
  assert.equal(confirmed?.shippingStatus, 'packed');

  const shipping = await orders.updateStatus(order!.id, 'shipping', 'u-admin');
  assert.equal(shipping?.status, 'shipping');
  assert.equal(shipping?.shippingStatus, 'in_transit');

  const completed = await orders.updateStatus(order!.id, 'completed', 'u-admin');
  assert.equal(completed?.status, 'completed');
  assert.equal(completed?.shippingStatus, 'delivered');
});
