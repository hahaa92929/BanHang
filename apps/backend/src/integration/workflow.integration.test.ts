import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { OrdersService } from '../modules/orders/orders.service';
import { PaymentsService } from '../modules/payments/payments.service';

function sign(body: unknown, secret: string) {
  return createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
}

function createWorkflowMock() {
  const state = {
    product: {
      id: 'p-1',
      sku: 'SKU-1',
      slug: 'iphone-15',
      name: 'iPhone 15',
      description: 'Demo',
      price: 20_000_000,
      stock: 8,
      status: 'active' as const,
    },
    cartItems: [{ id: 'ci-1', userId: 'u-1', productId: 'p-1', quantity: 1, createdAt: new Date() }],
    reservations: new Map<string, any>(),
    reservationItems: [] as any[],
    orders: new Map<string, any>(),
    orderItems: [] as any[],
    orderEvents: [] as any[],
    payments: new Map<string, any>(),
    paymentEvents: new Map<string, any>(),
    notifications: [] as any[],
    movements: [] as any[],
    seq: 1,
  };

  function materializeReservation(reservation: any) {
    return {
      ...reservation,
      items: state.reservationItems
        .filter((item) => item.reservationId === reservation.id)
        .map((item) => ({ ...item, product: state.product })),
    };
  }

  function materializeOrder(order: any, include?: Record<string, unknown>) {
    return {
      ...order,
      items: include?.items ? state.orderItems.filter((item) => item.orderId === order.id) : undefined,
      history: include?.history ? state.orderEvents.filter((item) => item.orderId === order.id) : undefined,
      reservation:
        include?.reservation && order.reservationId
          ? materializeReservation(state.reservations.get(order.reservationId))
          : null,
      payments: include?.payments ? [...state.payments.values()].filter((item) => item.orderId === order.id) : undefined,
      coupon: null,
    };
  }

  const tx = {
    inventoryReservation: {
      findMany: async () =>
        [...state.reservations.values()].filter(
          (item) => item.status === 'active' && item.expiresAt < new Date(),
        ).map((item) => ({ id: item.id })),
      findFirst: async () => null,
      findUnique: async ({ where, include }: { where: { id: string }; include?: any }) => {
        const reservation = state.reservations.get(where.id) ?? null;
        if (!reservation) return null;
        return include ? materializeReservation(reservation) : reservation;
      },
      create: async ({ data }: { data: any }) => {
        const reservation = {
          id: `res-${state.seq++}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          consumedAt: null,
          canceledAt: null,
          expiredAt: null,
          ...data,
        };
        state.reservations.set(reservation.id, reservation);
        return reservation;
      },
      updateMany: async ({ where, data }: { where: { id: string; status: string }; data: any }) => {
        const reservation = state.reservations.get(where.id);
        if (!reservation || reservation.status !== where.status) return { count: 0 };
        state.reservations.set(where.id, { ...reservation, ...data, updatedAt: new Date() });
        return { count: 1 };
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const reservation = state.reservations.get(where.id)!;
        const updated = { ...reservation, ...data, updatedAt: new Date() };
        state.reservations.set(where.id, updated);
        return updated;
      },
    },
    inventoryReservationItem: {
      createMany: async ({ data }: { data: any[] }) => {
        state.reservationItems.push(...data.map((item) => ({ id: `ri-${state.seq++}`, ...item })));
        return { count: data.length };
      },
    },
    cartItem: {
      findMany: async () => state.cartItems.map((item) => ({ ...item, product: state.product })),
      deleteMany: async () => {
        const count = state.cartItems.length;
        state.cartItems = [];
        return { count };
      },
    },
    product: {
      updateMany: async ({ where, data }: { where: { id: string; stock: { gte: number } }; data: { stock: { decrement: number } } }) => {
        if (state.product.id !== where.id || state.product.stock < where.stock.gte) return { count: 0 };
        state.product.stock -= data.stock.decrement;
        return { count: 1 };
      },
      update: async ({ data }: { where: { id: string }; data: { stock: { increment: number } } }) => {
        state.product.stock += data.stock.increment;
        return state.product;
      },
    },
    inventoryMovement: {
      create: async ({ data }: { data: any }) => {
        state.movements.push(data);
        return data;
      },
    },
    cartCoupon: {
      findUnique: async () => null,
    },
    address: {
      findFirst: async () => null,
      create: async ({ data }: { data: any }) => data,
    },
    order: {
      create: async ({ data }: { data: any }) => {
        const order = {
          id: `ord-${state.seq++}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          confirmedAt: null,
          shippedAt: null,
          deliveredAt: null,
          completedAt: null,
          canceledAt: null,
          returnedAt: null,
          ...data,
        };
        state.orders.set(order.id, order);
        return order;
      },
      findUnique: async ({ where, include }: { where: { id: string }; include?: any }) => {
        const order = state.orders.get(where.id) ?? null;
        if (!order) return null;
        return materializeOrder(order, include);
      },
      update: async ({ where, data, select }: { where: { id: string }; data: any; select?: any }) => {
        const order = state.orders.get(where.id)!;
        const updated = { ...order, ...data, updatedAt: new Date() };
        state.orders.set(where.id, updated);
        return select ? { id: updated.id, paymentStatus: updated.paymentStatus } : updated;
      },
      count: async () => state.orders.size,
      findMany: async ({ include }: { include?: any }) =>
        [...state.orders.values()].map((order) => materializeOrder(order, include)),
    },
    orderItem: {
      createMany: async ({ data }: { data: any[] }) => {
        state.orderItems.push(...data.map((item) => ({ id: `oi-${state.seq++}`, ...item })));
        return { count: data.length };
      },
    },
    orderStatusEvent: {
      create: async ({ data }: { data: any }) => {
        const event = { id: `oe-${state.seq++}`, createdAt: new Date(), ...data };
        state.orderEvents.push(event);
        return event;
      },
    },
    payment: {
      create: async ({ data }: { data: any }) => {
        const payment = {
          id: `pay-${state.seq++}`,
          transactionId: null,
          metadata: null,
          refundedAmount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        state.payments.set(payment.id, payment);
        return payment;
      },
      findUnique: async ({ where }: { where: { id: string } }) => state.payments.get(where.id) ?? null,
      findFirst: async ({ where }: { where: { orderId: string } }) =>
        [...state.payments.values()].find((payment) => payment.orderId === where.orderId) ?? null,
      update: async ({ where, data, select }: { where: { id: string }; data: any; select?: any }) => {
        const payment = state.payments.get(where.id)!;
        const updated = { ...payment, ...data, updatedAt: new Date() };
        state.payments.set(where.id, updated);
        return select ? { id: updated.id, status: updated.status } : updated;
      },
      updateMany: async ({ where, data }: { where: { orderId: string }; data: any }) => {
        let count = 0;
        for (const [id, payment] of state.payments.entries()) {
          if (payment.orderId !== where.orderId) continue;
          state.payments.set(id, { ...payment, ...data, updatedAt: new Date() });
          count += 1;
        }
        return { count };
      },
    },
    coupon: { update: async () => ({ count: 1 }) },
    notification: {
      create: async ({ data }: { data: any }) => {
        state.notifications.push(data);
        return data;
      },
    },
    paymentWebhookEvent: {
      create: async ({ data }: { data: any }) => {
        state.paymentEvents.set(data.eventId, data);
        return data;
      },
    },
  };

  const prisma = {
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
    order: {
      count: tx.order.count,
      findMany: tx.order.findMany,
      findUnique: tx.order.findUnique,
      update: tx.order.update,
    },
    payment: tx.payment,
    paymentWebhookEvent: {
      findUnique: async ({ where }: { where: { eventId: string } }) => state.paymentEvents.get(where.eventId) ?? null,
    },
  };

  return { prisma, state };
}

function checkoutPayload(reservationId: string, paymentMethod: 'cod' | 'vnpay' = 'cod') {
  return {
    reservationId,
    paymentMethod,
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

test('workflow reserve -> checkout -> payment webhook -> complete order', async () => {
  process.env.PAYMENT_WEBHOOK_SECRET = 'test-payment-webhook-secret-12345678901234567890';
  const mock = createWorkflowMock();
  const orders = new OrdersService(mock.prisma as never);
  const payments = new PaymentsService(mock.prisma as never);

  const reservation = await orders.createReservationFromCart('u-1');
  const order = await orders.checkout('u-1', checkoutPayload(reservation.id, 'vnpay'));
  const payment = [...mock.state.payments.values()][0];

  const webhookBody = {
    eventId: 'evt-paid-1',
    type: 'payment.captured',
    orderId: order!.id,
    paymentId: payment.id,
    transactionId: 'txn-1',
    payload: { amount: order!.total },
  };

  await payments.processWebhook(
    'vnpay',
    sign(webhookBody, process.env.PAYMENT_WEBHOOK_SECRET!),
    webhookBody,
  );

  const completed = await orders.updateStatus(order!.id, 'confirmed', 'u-admin');
  assert.equal(completed?.status, 'confirmed');
  assert.equal(mock.state.payments.get(payment.id)?.status, 'paid');
});

test('workflow duplicate webhook remains idempotent', async () => {
  process.env.PAYMENT_WEBHOOK_SECRET = 'test-payment-webhook-secret-12345678901234567890';
  const mock = createWorkflowMock();
  const orders = new OrdersService(mock.prisma as never);
  const payments = new PaymentsService(mock.prisma as never);

  const reservation = await orders.createReservationFromCart('u-1');
  const order = await orders.checkout('u-1', checkoutPayload(reservation.id, 'vnpay'));
  const payment = [...mock.state.payments.values()][0];

  const webhookBody = {
    eventId: 'evt-paid-dup',
    type: 'payment.captured',
    orderId: order!.id,
    paymentId: payment.id,
    payload: { amount: order!.total },
  };

  const signature = sign(webhookBody, process.env.PAYMENT_WEBHOOK_SECRET!);
  const first = await payments.processWebhook('vnpay', signature, webhookBody);
  const second = await payments.processWebhook('vnpay', signature, webhookBody);

  assert.equal(first.processed, true);
  assert.equal(second.processed, false);
});
