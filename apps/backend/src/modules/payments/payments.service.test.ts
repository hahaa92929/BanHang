import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

type PaymentRecord = {
  id: string;
  orderId: string;
  gateway: string;
  method: 'vnpay' | 'cod' | 'stripe' | 'paypal' | 'momo' | 'zalopay' | 'bank_transfer';
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
  const savedPaymentMethods = new Map([
    [
      'spm-1',
      {
        id: 'spm-1',
        userId: 'u-1',
        gateway: 'stripe',
        method: 'stripe',
        label: 'Visa ending 4242',
        brand: 'Visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2030,
        tokenRef: 'tok_demo_4242',
        providerCustomerRef: 'cus_demo',
        isDefault: true,
        metadata: { network: 'visa' },
        createdAt: new Date('2026-04-05T00:00:00.000Z'),
        updatedAt: new Date('2026-04-05T00:00:00.000Z'),
      },
    ],
  ]);
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
        userId: 'u-1',
        orderNumber: 'ORD-1',
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
        userId: 'u-1',
        orderNumber: 'ORD-2',
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
    savedPaymentMethod: {
      findMany: async ({ where }: { where: { userId: string } }) =>
        [...savedPaymentMethods.values()]
          .filter((item) => item.userId === where.userId)
          .sort(
            (left, right) =>
              Number(right.isDefault) - Number(left.isDefault) ||
              right.createdAt.getTime() - left.createdAt.getTime(),
          ),
      findFirst: async ({ where }: { where: { userId?: string; id?: string; isDefault?: boolean } }) =>
        [...savedPaymentMethods.values()].find(
          (item) =>
            (where.userId === undefined || item.userId === where.userId) &&
            (where.id === undefined || item.id === where.id) &&
            (where.isDefault === undefined || item.isDefault === where.isDefault),
        ) ?? null,
      create: async ({
        data,
      }: {
        data: {
          userId: string;
          gateway: string;
          method: PaymentRecord['method'];
          label: string;
          brand: string | null;
          last4: string | null;
          expiryMonth: number | null;
          expiryYear: number | null;
          tokenRef: string;
          providerCustomerRef: string | null;
          isDefault: boolean;
          metadata: Record<string, unknown> | null;
        };
      }) => {
        const created = {
          id: `spm-${savedPaymentMethods.size + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        savedPaymentMethods.set(created.id, created);
        return created;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { userId: string };
        data: { isDefault: boolean };
      }) => {
        let count = 0;
        for (const item of savedPaymentMethods.values()) {
          if (item.userId === where.userId) {
            item.isDefault = data.isDefault;
            item.updatedAt = new Date();
            count += 1;
          }
        }
        return { count };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { isDefault: boolean };
      }) => {
        const item = savedPaymentMethods.get(where.id);
        if (!item) {
          throw new Error('saved payment method not found');
        }
        const updated = { ...item, ...data, updatedAt: new Date() };
        savedPaymentMethods.set(item.id, updated);
        return updated;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const item = savedPaymentMethods.get(where.id);
        if (!item) {
          throw new Error('saved payment method not found');
        }
        savedPaymentMethods.delete(where.id);
        return item;
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
    savedPaymentMethod: tx.savedPaymentMethod,
    order: tx.order,
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
  };

  return { prisma, events, payments, orders, savedPaymentMethods };
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
  assert.equal(methods.data.find((item) => item.method === 'vnpay')?.status, 'disabled');
});

test('payments.saved payment methods CRUD and initiate by saved method work', async () => {
  const { prisma, savedPaymentMethods, payments } = buildMockPrisma('authorized');
  const service = new PaymentsService(prisma as never);

  const listed = await service.listSavedMethods('u-1');
  const created = await service.createSavedMethod('u-1', {
    method: 'paypal',
    gateway: 'paypal',
    label: 'PayPal john@example.com',
    tokenRef: 'tok_paypal_demo',
    isDefault: false,
  });
  const setDefault = await service.setDefaultSavedMethod('u-1', 'spm-2');
  const initiated = await service.initiate({
    orderId: 'ord-1',
    savedPaymentMethodId: 'spm-2',
  });
  const removed = await service.removeSavedMethod('u-1', 'spm-1');

  assert.equal(listed.total, 1);
  assert.equal(listed.data[0]?.maskedDetails, '•••• 4242');
  assert.equal(created.total, 2);
  assert.equal(setDefault.data[0]?.id, 'spm-2');
  assert.equal(initiated.gateway, 'paypal');
  assert.equal(initiated.method, 'paypal');
  assert.equal((payments.get('pay-1')?.metadata?.savedPaymentMethodId as string) ?? null, 'spm-2');
  assert.equal(removed.total, 1);
  assert.equal(savedPaymentMethods.has('spm-1'), false);
});

test('payments.initiate builds signed VNPay checkout urls when gateway config exists', async () => {
  const previous = {
    VNPAY_TMN_CODE: process.env.VNPAY_TMN_CODE,
    VNPAY_HASH_SECRET: process.env.VNPAY_HASH_SECRET,
    VNPAY_PAYMENT_URL: process.env.VNPAY_PAYMENT_URL,
    VNPAY_RETURN_URL: process.env.VNPAY_RETURN_URL,
  };
  process.env.VNPAY_TMN_CODE = 'BANHANG01';
  process.env.VNPAY_HASH_SECRET = 'vnpay-secret-demo';
  process.env.VNPAY_PAYMENT_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  process.env.VNPAY_RETURN_URL = 'https://app.example.com/payment/vnpay-return';

  try {
    const { prisma } = buildMockPrisma('authorized');
    const service = new PaymentsService(prisma as never);
    const initiated = await service.initiate({
      orderId: 'ord-1',
      method: 'vnpay',
      ipAddress: '10.0.0.1',
      returnUrl: 'https://shop.example.com/checkout/result',
      locale: 'vn',
    });

    const redirectUrl = new URL(initiated.redirectUrl!);
    const secureHash = redirectUrl.searchParams.get('vnp_SecureHash');
    const baseParams = new URLSearchParams(redirectUrl.search);
    baseParams.delete('vnp_SecureHash');
    const signatureBase = new URLSearchParams(
      [...baseParams.entries()].sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
    ).toString();
    const expectedHash = createHmac('sha512', process.env.VNPAY_HASH_SECRET!)
      .update(signatureBase)
      .digest('hex');

    assert.equal(redirectUrl.origin, 'https://sandbox.vnpayment.vn');
    assert.equal(redirectUrl.searchParams.get('vnp_TmnCode'), 'BANHANG01');
    assert.equal(redirectUrl.searchParams.get('vnp_ReturnUrl'), 'https://shop.example.com/checkout/result');
    assert.equal(redirectUrl.searchParams.get('vnp_IpAddr'), '10.0.0.1');
    assert.equal(redirectUrl.searchParams.get('vnp_OrderInfo'), 'Thanh toan don ORD-1');
    assert.equal(secureHash, expectedHash);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
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
      service.initiate({
        orderId: 'ord-1',
        savedPaymentMethodId: 'missing-method',
      }),
    (error: unknown) => error instanceof NotFoundException,
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
