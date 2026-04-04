import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

type PaymentRecord = {
  id: string;
  orderId: string;
  gateway: string;
  method: 'vnpay' | 'cod';
  amount: number;
  currency: string;
  status: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'partially_refunded' | 'canceled';
  transactionId: string | null;
  metadata: Record<string, unknown> | null;
  refundedAmount: number;
  createdAt: Date;
  updatedAt: Date;
};

function buildMockPrisma(initialPaymentStatus: PaymentRecord['status'] = 'authorized') {
  const events = new Map<string, Record<string, unknown>>();
  const payments = new Map<string, PaymentRecord>([
    [
      'pay-1',
      {
        id: 'pay-1',
        orderId: 'ord-1',
        gateway: 'vnpay',
        method: 'vnpay',
        amount: 150_000,
        currency: 'VND',
        status: initialPaymentStatus,
        transactionId: null,
        metadata: null,
        refundedAmount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  ]);
  const orders = new Map([
    [
      'ord-1',
      {
        id: 'ord-1',
        total: 150_000,
        currency: 'VND',
        paymentMethod: 'vnpay' as const,
        paymentStatus: initialPaymentStatus,
      },
    ],
    [
      'ord-2',
      {
        id: 'ord-2',
        total: 90_000,
        currency: 'VND',
        paymentMethod: 'cod' as const,
        paymentStatus: 'pending' as const,
      },
    ],
  ]);

  const tx = {
    paymentWebhookEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        events.set(data.eventId as string, data);
        return data;
      },
    },
    payment: {
      findUnique: async ({ where, include }: { where: { id: string }; include?: { order?: true } }) => {
        const payment = payments.get(where.id) ?? null;
        if (!payment) return null;
        return include?.order ? { ...payment, order: orders.get(payment.orderId)! } : payment;
      },
      findFirst: async ({ where }: { where: { orderId: string } }) =>
        [...payments.values()].find((payment) => payment.orderId === where.orderId) ?? null,
      update: async ({ where, data, select }: { where: { id: string }; data: Partial<PaymentRecord>; select?: { id: true; status: true } }) => {
        const payment = payments.get(where.id);
        if (!payment) throw new Error('payment not found');
        const updated = { ...payment, ...data, updatedAt: new Date() };
        payments.set(payment.id, updated);
        return select ? { id: updated.id, status: updated.status } : updated;
      },
      create: async ({ data }: { data: Omit<PaymentRecord, 'id' | 'createdAt' | 'updatedAt' | 'refundedAmount'> }) => {
        const created: PaymentRecord = {
          id: `pay-${payments.size + 1}`,
          refundedAmount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: null,
          transactionId: null,
          ...data,
        };
        payments.set(created.id, created);
        return created;
      },
    },
    order: {
      findUnique: async ({ where, include }: { where: { id: string }; include?: { payments?: { orderBy: { createdAt: 'desc' } } } }) => {
        const order = orders.get(where.id) ?? null;
        if (!order) return null;
        if (!include?.payments) return order;
        return {
          ...order,
          payments: [...payments.values()]
            .filter((payment) => payment.orderId === order.id)
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
        };
      },
      update: async ({
        where,
        data,
        select,
      }: {
        where: { id: string };
        data: { paymentMethod?: PaymentRecord['method']; paymentStatus: PaymentRecord['status'] };
        select?: { id: true; paymentStatus: true };
      }) => {
        const order = orders.get(where.id);
        if (!order) throw new Error('order not found');
        const updated = { ...order, ...data };
        orders.set(order.id, updated);
        return select ? { id: updated.id, paymentStatus: updated.paymentStatus } : updated;
      },
    },
  };

  const prisma = {
    paymentWebhookEvent: {
      findUnique: async ({ where }: { where: { eventId: string } }) => events.get(where.eventId) ?? null,
    },
    payment: tx.payment,
    order: tx.order,
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
  };

  return { prisma, events, payments, orders };
}

function signPayload(payload: unknown, secret: string) {
  return createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
}

test('payments.processWebhook skips duplicate events', async () => {
  process.env.PAYMENT_WEBHOOK_SECRET = 'test-payment-webhook-secret-12345678901234567890';
  const { prisma, events } = buildMockPrisma();
  events.set('evt-dup', { eventId: 'evt-dup' });

  const service = new PaymentsService(prisma as never);
  const body = {
    eventId: 'evt-dup',
    type: 'payment.captured',
    orderId: 'ord-1',
    paymentId: 'pay-1',
    payload: { amount: 150_000 },
  };

  const result = await service.processWebhook(
    'vnpay',
    signPayload(body, process.env.PAYMENT_WEBHOOK_SECRET!),
    body,
  );

  assert.equal(result.processed, false);
  assert.equal(result.reason, 'duplicate_event');
});

test('payments.processWebhook updates payment and order statuses', async () => {
  process.env.PAYMENT_WEBHOOK_SECRET = 'test-payment-webhook-secret-12345678901234567890';
  const { prisma, payments, orders } = buildMockPrisma('authorized');
  const service = new PaymentsService(prisma as never);

  const body = {
    eventId: 'evt-paid',
    type: 'payment.captured',
    orderId: 'ord-1',
    paymentId: 'pay-1',
    transactionId: 'txn-123',
    payload: { gateway: 'vnpay' },
  };

  const result = await service.processWebhook(
    'vnpay',
    signPayload(body, process.env.PAYMENT_WEBHOOK_SECRET!),
    body,
  );

  assert.equal(result.processed, true);
  assert.equal(payments.get('pay-1')?.status, 'paid');
  assert.equal(orders.get('ord-1')?.paymentStatus, 'paid');
});

test('payments.refund supports partial refunds', async () => {
  const { prisma, payments } = buildMockPrisma('paid');
  const service = new PaymentsService(prisma as never);

  const updated = await service.refund('pay-1', { amount: 50_000 });

  assert.equal(updated.status, 'partially_refunded');
  assert.equal(payments.get('pay-1')?.refundedAmount, 50_000);
});

test('payments.listMethods initiate and getStatus support checkout orchestration', async () => {
  const { prisma } = buildMockPrisma('authorized');
  const service = new PaymentsService(prisma as never);

  const methods = service.listMethods();
  const initiated = await service.initiate({ orderId: 'ord-2', method: 'cod' });
  const status = await service.getStatus('pay-1');

  assert.equal(methods.data.length, 7);
  assert.equal(initiated.gateway, 'offline');
  assert.equal(initiated.redirectUrl, null);
  assert.equal(initiated.status, 'pending');
  assert.equal(status.id, 'pay-1');
  assert.equal(status.order.id, 'ord-1');
});

test('payments.reject invalid refunds signatures and unsupported webhook events', async () => {
  process.env.PAYMENT_WEBHOOK_SECRET = 'test-payment-webhook-secret-12345678901234567890';
  const { prisma } = buildMockPrisma('failed');
  const service = new PaymentsService(prisma as never);

  await assert.rejects(
    async () => service.refund('missing', {}),
    (error: unknown) => error instanceof NotFoundException,
  );

  await assert.rejects(
    async () => service.refund('pay-1', {}),
    (error: unknown) => error instanceof BadRequestException,
  );

  await assert.rejects(
    async () =>
      service.processWebhook('vnpay', undefined, {
        eventId: 'evt-no-signature',
        type: 'payment.captured',
        orderId: 'ord-1',
        paymentId: 'pay-1',
        payload: {},
      }),
    (error: unknown) => error instanceof UnauthorizedException,
  );

  const unsupportedBody = {
    eventId: 'evt-unsupported',
    type: 'shipment.created',
    orderId: 'ord-1',
    paymentId: 'pay-1',
    payload: {},
  };

  await assert.rejects(
    async () =>
      service.processWebhook(
        'vnpay',
        signPayload(unsupportedBody, process.env.PAYMENT_WEBHOOK_SECRET!),
        unsupportedBody,
      ),
    (error: unknown) => error instanceof BadRequestException,
  );
});

test('payments.private helpers cover gateway signature and status branches', () => {
  process.env.PAYMENT_WEBHOOK_SECRET = 'test-payment-webhook-secret-12345678901234567890';
  const { prisma } = buildMockPrisma('authorized');
  const service = new PaymentsService(prisma as never);

  assert.equal((service as any).safeEqual('abc', 'abcd'), false);
  assert.equal((service as any).resolveGateway('cod'), 'offline');
  assert.equal((service as any).resolveGateway('paypal'), 'paypal');

  assert.equal((service as any).resolvePaymentStatus('payment.initiated', 'paid'), 'pending');
  assert.equal((service as any).resolvePaymentStatus('payment.authorized', 'pending'), 'authorized');
  assert.equal((service as any).resolvePaymentStatus('payment.failed', 'authorized'), 'failed');
  assert.equal((service as any).resolvePaymentStatus('payment.refunded', 'paid'), 'refunded');
  assert.equal(
    (service as any).resolvePaymentStatus('payment.partially_refunded', 'paid'),
    'partially_refunded',
  );
  assert.equal((service as any).resolvePaymentStatus('payment.canceled', 'authorized'), 'canceled');
  assert.equal((service as any).resolvePaymentStatus('payment.unknown', 'authorized'), 'authorized');

  assert.throws(
    () => (service as any).resolvePaymentStatus('inventory.adjusted', 'authorized'),
    (error: unknown) => error instanceof BadRequestException,
  );
});
