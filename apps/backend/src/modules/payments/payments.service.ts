import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { generateId } from '../../common/security';
import { AppEnv } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';

@Injectable()
export class PaymentsService {
  private readonly webhookSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService<AppEnv, true>,
  ) {
    this.webhookSecret =
      this.config?.get('PAYMENT_WEBHOOK_SECRET', { infer: true }) ??
      process.env.PAYMENT_WEBHOOK_SECRET ??
      'test-payment-webhook-secret-12345678901234567890';
  }

  listMethods() {
    return {
      data: [
        { method: 'cod', gateway: 'offline', status: 'enabled' },
        { method: 'vnpay', gateway: 'vnpay', status: 'enabled' },
        { method: 'momo', gateway: 'momo', status: 'enabled' },
        { method: 'zalopay', gateway: 'zalopay', status: 'enabled' },
        { method: 'stripe', gateway: 'stripe', status: 'enabled' },
        { method: 'paypal', gateway: 'paypal', status: 'enabled' },
        { method: 'bank_transfer', gateway: 'bank_transfer', status: 'enabled' },
      ],
    };
  }

  async initiate(payload: InitiatePaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: payload.orderId },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const method = payload.method ?? order.paymentMethod;
    const gateway = this.resolveGateway(method);
    const transactionId = generateId('txn').toUpperCase();
    const paymentStatus: PaymentStatus = method === 'cod' ? 'pending' : 'authorized';

    const payment = order.payments[0]
      ? await this.prisma.payment.update({
          where: { id: order.payments[0].id },
          data: {
            gateway,
            method,
            status: paymentStatus,
            transactionId,
            metadata: {
              initiatedAt: new Date().toISOString(),
            },
          },
        })
      : await this.prisma.payment.create({
          data: {
            orderId: order.id,
            gateway,
            method,
            amount: order.total,
            currency: order.currency,
            status: paymentStatus,
            transactionId,
            metadata: {
              initiatedAt: new Date().toISOString(),
            },
          },
        });

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentMethod: method,
        paymentStatus,
      },
    });

    return {
      paymentId: payment.id,
      orderId: order.id,
      gateway,
      method,
      status: payment.status,
      transactionId: payment.transactionId,
      redirectUrl:
        method === 'cod'
          ? null
          : `https://payments.local/${gateway}/checkout?paymentId=${payment.id}`,
    };
  }

  async getStatus(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async refund(paymentId: string, payload: RefundPaymentDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (!['paid', 'authorized', 'partially_refunded'].includes(payment.status)) {
      throw new BadRequestException('Payment cannot be refunded');
    }

    const maxRefundable = payment.amount - payment.refundedAmount;
    const amount = payload.amount ?? maxRefundable;

    if (amount <= 0 || amount > maxRefundable) {
      throw new BadRequestException('Invalid refund amount');
    }

    const refundedAmount = payment.refundedAmount + amount;
    const nextStatus: PaymentStatus =
      refundedAmount >= payment.amount ? 'refunded' : 'partially_refunded';

    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        refundedAmount,
        status: nextStatus,
        metadata: {
          ...(payment.metadata as Record<string, unknown> | null),
          lastRefundAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    await this.prisma.order.update({
      where: { id: payment.orderId },
      data: {
        paymentStatus: nextStatus,
      },
    });

    return updatedPayment;
  }

  async processWebhook(
    gateway: string,
    signature: string | undefined,
    body: PaymentWebhookDto,
  ) {
    this.verifySignature(signature, body);

    const existing = await this.prisma.paymentWebhookEvent.findUnique({
      where: { eventId: body.eventId },
    });

    if (existing) {
      return { processed: false, reason: 'duplicate_event' };
    }

    let paymentUpdate: { id: string; status: PaymentStatus } | null = null;
    let orderUpdate: { id: string; paymentStatus: PaymentStatus } | null = null;

    await this.prisma.$transaction(async (tx) => {
      let payment = body.paymentId
        ? await tx.payment.findUnique({ where: { id: body.paymentId } })
        : null;

      if (!payment && body.orderId) {
        payment = await tx.payment.findFirst({
          where: { orderId: body.orderId },
          orderBy: { createdAt: 'desc' },
        });
      }

      await tx.paymentWebhookEvent.create({
        data: {
          eventId: body.eventId,
          gateway,
          type: body.type,
          orderId: body.orderId ?? payment?.orderId,
          paymentId: payment?.id ?? body.paymentId,
          payload: body.payload as Prisma.InputJsonValue,
        },
      });

      const nextStatus = this.resolvePaymentStatus(
        body.type,
        payment?.status ?? 'pending',
      );

      if (payment && nextStatus !== payment.status) {
        paymentUpdate = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: nextStatus,
            transactionId: body.transactionId ?? payment.transactionId,
          },
          select: {
            id: true,
            status: true,
          },
        });
      }

      const orderId = body.orderId ?? payment?.orderId;
      if (orderId) {
        const order = await tx.order.findUnique({ where: { id: orderId } });
        if (order && nextStatus !== order.paymentStatus) {
          orderUpdate = await tx.order.update({
            where: { id: orderId },
            data: {
              paymentStatus: nextStatus,
            },
            select: {
              id: true,
              paymentStatus: true,
            },
          });
        }
      }
    });

    return {
      processed: true,
      paymentUpdate,
      orderUpdate,
    };
  }

  private verifySignature(signature: string | undefined, body: PaymentWebhookDto) {
    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const raw = JSON.stringify(body);
    const expected = createHmac('sha256', this.webhookSecret).update(raw).digest('hex');

    if (!this.safeEqual(signature, expected)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private safeEqual(input: string, expected: string) {
    const inputBuffer = Buffer.from(input);
    const expectedBuffer = Buffer.from(expected);

    if (inputBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(inputBuffer, expectedBuffer);
  }

  private resolvePaymentStatus(type: string, current: PaymentStatus): PaymentStatus {
    switch (type) {
      case 'payment.initiated':
        return 'pending';
      case 'payment.authorized':
        return 'authorized';
      case 'payment.captured':
        return 'paid';
      case 'payment.failed':
        return 'failed';
      case 'payment.refunded':
        return 'refunded';
      case 'payment.partially_refunded':
        return 'partially_refunded';
      case 'payment.canceled':
        return 'canceled';
      default:
        if (type.startsWith('payment.')) {
          return current;
        }
        throw new BadRequestException('Unsupported webhook event type');
    }
  }

  private resolveGateway(method: PaymentMethod) {
    return method === 'cod' ? 'offline' : method;
  }
}
