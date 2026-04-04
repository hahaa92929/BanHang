import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { PaymentStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';

type EventRecord = {
  eventId: string;
  type: string;
  orderId?: string;
  payload: unknown;
  processedAt: Date;
};

type OrderRecord = {
  id: string;
  paymentStatus: PaymentStatus;
};

function buildMockPrisma(initialOrderStatus: PaymentStatus = 'pending') {
  const events = new Map<string, EventRecord>();
  const orders = new Map<string, OrderRecord>([['ord-1', { id: 'ord-1', paymentStatus: initialOrderStatus }]]);

  const tx = {
    paymentWebhookEvent: {
      create: async ({ data }: { data: { eventId: string; type: string; orderId?: string; payload: unknown } }) => {
        const record: EventRecord = {
          eventId: data.eventId,
          type: data.type,
          orderId: data.orderId,
          payload: data.payload,
          processedAt: new Date(),
        };

        events.set(data.eventId, record);
        return record;
      },
    },
    order: {
      findUnique: async ({ where }: { where: { id: string } }) => orders.get(where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: { paymentStatus: PaymentStatus } }) => {
        const existing = orders.get(where.id);
        if (!existing) throw new Error('order not found');

        const updated: OrderRecord = { ...existing, paymentStatus: data.paymentStatus };
        orders.set(where.id, updated);

        return { id: updated.id, paymentStatus: updated.paymentStatus };
      },
    },
  };

  const prisma = {
    paymentWebhookEvent: {
      findUnique: async ({ where }: { where: { eventId: string } }) => events.get(where.eventId) ?? null,
    },
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
  };

  return { prisma, events, orders };
}

function signPayload(payload: unknown, secret: string) {
  const raw = JSON.stringify(payload);
  return createHmac('sha256', secret).update(raw).digest('hex');
}

test('processWebhook should skip duplicate event', async () => {
  const secret = 'test-secret';
  process.env.PAYMENT_WEBHOOK_SECRET = secret;

  const { prisma, events } = buildMockPrisma();
  events.set('evt-dup', {
    eventId: 'evt-dup',
    type: 'payment.captured',
    orderId: 'ord-1',
    payload: { amount: 1000 },
    processedAt: new Date(),
  });

  const service = new PaymentsService(prisma as never);
  const body = {
    eventId: 'evt-dup',
    type: 'payment.captured',
    orderId: 'ord-1',
    payload: { amount: 1000 },
  };

  const signature = signPayload(body, secret);
  const result = await service.processWebhook(signature, body);

  assert.equal(result.processed, false);
  assert.equal(result.reason, 'duplicate_event');
});

test('processWebhook should update order payment status on captured event', async () => {
  const secret = 'test-secret';
  process.env.PAYMENT_WEBHOOK_SECRET = secret;

  const { prisma, orders, events } = buildMockPrisma('authorized');
  const service = new PaymentsService(prisma as never);

  const body = {
    eventId: 'evt-paid',
    type: 'payment.captured',
    orderId: 'ord-1',
    payload: { gateway: 'vnpay', amount: 150000 },
  };

  const signature = signPayload(body, secret);
  const result = await service.processWebhook(signature, body);

  assert.equal(result.processed, true);
  assert.equal(result.orderUpdate?.paymentStatus, 'paid');
  assert.equal(orders.get('ord-1')?.paymentStatus, 'paid');
  assert.ok(events.has('evt-paid'));
});

test('processWebhook should reject invalid signature', async () => {
  const secret = 'test-secret';
  process.env.PAYMENT_WEBHOOK_SECRET = secret;

  const { prisma } = buildMockPrisma();
  const service = new PaymentsService(prisma as never);

  const body = {
    eventId: 'evt-invalid',
    type: 'payment.captured',
    orderId: 'ord-1',
    payload: { gateway: 'momo' },
  };

  await assert.rejects(
    async () => service.processWebhook('invalid-signature', body),
    /Invalid webhook signature/,
  );
});

test('processWebhook should keep current payment status for unknown payment.* event', async () => {
  const secret = 'test-secret';
  process.env.PAYMENT_WEBHOOK_SECRET = secret;

  const { prisma, orders } = buildMockPrisma('authorized');
  const service = new PaymentsService(prisma as never);

  const body = {
    eventId: 'evt-unknown-payment',
    type: 'payment.pending_review',
    orderId: 'ord-1',
    payload: { provider: 'vnpay' },
  };

  const signature = signPayload(body, secret);
  const result = await service.processWebhook(signature, body);

  assert.equal(result.processed, true);
  assert.equal(result.orderUpdate, null);
  assert.equal(orders.get('ord-1')?.paymentStatus, 'authorized');
});

test('processWebhook should reject unsupported non-payment event', async () => {
  const secret = 'test-secret';
  process.env.PAYMENT_WEBHOOK_SECRET = secret;

  const { prisma } = buildMockPrisma('pending');
  const service = new PaymentsService(prisma as never);

  const body = {
    eventId: 'evt-bad-type',
    type: 'shipment.updated',
    orderId: 'ord-1',
    payload: { code: 'x' },
  };

  const signature = signPayload(body, secret);

  await assert.rejects(
    async () => service.processWebhook(signature, body),
    /Unsupported webhook event type/,
  );
});
