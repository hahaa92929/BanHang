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
import { CreateSavedPaymentMethodDto } from './dto/create-saved-payment-method.dto';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';

@Injectable()
export class PaymentsService {
  private readonly webhookSecret: string;
  private readonly vnpayConfig:
    | {
        tmnCode: string;
        hashSecret: string;
        paymentUrl: string;
        returnUrl: string;
      }
    | undefined;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService<AppEnv, true>,
  ) {
    this.webhookSecret =
      this.config?.get('PAYMENT_WEBHOOK_SECRET', { infer: true }) ??
      process.env.PAYMENT_WEBHOOK_SECRET ??
      'test-payment-webhook-secret-12345678901234567890';
    const tmnCode = this.config?.get('VNPAY_TMN_CODE', { infer: true }) ?? process.env.VNPAY_TMN_CODE;
    const hashSecret =
      this.config?.get('VNPAY_HASH_SECRET', { infer: true }) ?? process.env.VNPAY_HASH_SECRET;
    const paymentUrl =
      this.config?.get('VNPAY_PAYMENT_URL', { infer: true }) ?? process.env.VNPAY_PAYMENT_URL;
    const returnUrl =
      this.config?.get('VNPAY_RETURN_URL', { infer: true }) ?? process.env.VNPAY_RETURN_URL;
    this.vnpayConfig =
      tmnCode && hashSecret && paymentUrl && returnUrl
        ? { tmnCode, hashSecret, paymentUrl, returnUrl }
        : undefined;
  }

  listMethods() {
    return {
      data: [
        { method: 'cod', gateway: 'offline', status: 'enabled' },
        {
          method: 'vnpay',
          gateway: 'vnpay',
          status: this.vnpayConfig ? 'enabled' : 'disabled',
        },
        { method: 'momo', gateway: 'momo', status: 'enabled' },
        { method: 'zalopay', gateway: 'zalopay', status: 'enabled' },
        { method: 'stripe', gateway: 'stripe', status: 'enabled' },
        { method: 'paypal', gateway: 'paypal', status: 'enabled' },
        { method: 'bank_transfer', gateway: 'bank_transfer', status: 'enabled' },
      ],
    };
  }

  async listSavedMethods(userId: string) {
    const data = await this.prisma.savedPaymentMethod.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      total: data.length,
      data: data.map((item) => this.toSavedMethodSummary(item)),
    };
  }

  async createSavedMethod(userId: string, payload: CreateSavedPaymentMethodDto) {
    const existingDefault = await this.prisma.savedPaymentMethod.findFirst({
      where: {
        userId,
        isDefault: true,
      },
    });
    const shouldSetDefault = payload.isDefault ?? !existingDefault;

    await this.prisma.$transaction(async (tx) => {
      if (shouldSetDefault) {
        await tx.savedPaymentMethod.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      await tx.savedPaymentMethod.create({
        data: {
          userId,
          gateway: payload.gateway?.trim() || payload.method,
          method: payload.method,
          label: payload.label.trim(),
          brand: payload.brand?.trim() || null,
          last4: payload.last4 ?? null,
          expiryMonth: payload.expiryMonth ?? null,
          expiryYear: payload.expiryYear ?? null,
          tokenRef: payload.tokenRef.trim(),
          providerCustomerRef: payload.providerCustomerRef?.trim() || null,
          isDefault: shouldSetDefault,
          metadata: (payload.metadata ?? null) as Prisma.InputJsonValue,
        },
      });
    });

    return this.listSavedMethods(userId);
  }

  async setDefaultSavedMethod(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.savedPaymentMethod.findFirst({
        where: {
          id,
          userId,
        },
      });

      if (!existing) {
        throw new NotFoundException('Saved payment method not found');
      }

      await tx.savedPaymentMethod.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      await tx.savedPaymentMethod.update({
        where: { id },
        data: { isDefault: true },
      });

      const data = await tx.savedPaymentMethod.findMany({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      return {
        total: data.length,
        data: data.map((item) => this.toSavedMethodSummary(item)),
      };
    });
  }

  async removeSavedMethod(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.savedPaymentMethod.findFirst({
        where: {
          id,
          userId,
        },
      });

      if (!existing) {
        throw new NotFoundException('Saved payment method not found');
      }

      await tx.savedPaymentMethod.delete({
        where: { id },
      });

      if (existing.isDefault) {
        const fallback = await tx.savedPaymentMethod.findFirst({
          where: { userId },
          orderBy: [{ createdAt: 'desc' }],
        });

        if (fallback) {
          await tx.savedPaymentMethod.update({
            where: { id: fallback.id },
            data: { isDefault: true },
          });
        }
      }

      const data = await tx.savedPaymentMethod.findMany({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      return {
        total: data.length,
        data: data.map((item) => this.toSavedMethodSummary(item)),
      };
    });
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

    const savedMethod = payload.savedPaymentMethodId
      ? await this.prisma.savedPaymentMethod.findFirst({
          where: {
            id: payload.savedPaymentMethodId,
            userId: order.userId,
          },
        })
      : null;

    if (payload.savedPaymentMethodId && !savedMethod) {
      throw new NotFoundException('Saved payment method not found');
    }

    if (savedMethod && payload.method && payload.method !== savedMethod.method) {
      throw new BadRequestException('Saved payment method does not match requested method');
    }

    const method = savedMethod?.method ?? payload.method ?? order.paymentMethod;
    if (method === 'vnpay' && !this.vnpayConfig) {
      throw new BadRequestException('VNPay is not configured');
    }
    const gateway = savedMethod?.gateway ?? this.resolveGateway(method);
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
              savedPaymentMethodId: savedMethod?.id ?? null,
              savedPaymentMethodLabel: savedMethod?.label ?? null,
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
              savedPaymentMethodId: savedMethod?.id ?? null,
              savedPaymentMethodLabel: savedMethod?.label ?? null,
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
      redirectUrl: this.buildRedirectUrl(payment, order, payload),
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

  private toSavedMethodSummary(item: {
    id: string;
    gateway: string;
    method: PaymentMethod;
    label: string;
    brand: string | null;
    last4: string | null;
    expiryMonth: number | null;
    expiryYear: number | null;
    providerCustomerRef: string | null;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: item.id,
      gateway: item.gateway,
      method: item.method,
      label: item.label,
      brand: item.brand,
      last4: item.last4,
      expiryMonth: item.expiryMonth,
      expiryYear: item.expiryYear,
      providerCustomerRef: item.providerCustomerRef,
      isDefault: item.isDefault,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      maskedDetails: item.last4 ? `•••• ${item.last4}` : item.label,
    };
  }

  private buildRedirectUrl(
    payment: {
      id: string;
      gateway: string;
      amount: number;
      transactionId: string | null;
      orderId: string;
      currency: string;
    },
    order: {
      orderNumber: string;
    },
    payload: Pick<InitiatePaymentDto, 'method' | 'returnUrl' | 'ipAddress' | 'locale'>,
  ) {
    if (payment.gateway === 'offline') {
      return null;
    }

    if (payment.gateway === 'vnpay') {
      if (!this.vnpayConfig) {
        throw new BadRequestException('VNPay is not configured');
      }

      return this.buildVnpayRedirectUrl(payment, order, payload);
    }

    return `https://payments.local/${payment.gateway}/checkout?paymentId=${payment.id}`;
  }

  private buildVnpayRedirectUrl(
    payment: {
      id: string;
      amount: number;
      transactionId: string | null;
      orderId: string;
      currency: string;
    },
    order: {
      orderNumber: string;
    },
    payload: Pick<InitiatePaymentDto, 'returnUrl' | 'ipAddress' | 'locale'>,
  ) {
    const txnRef = payment.transactionId ?? payment.id;
    const params = new URLSearchParams({
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.vnpayConfig!.tmnCode,
      vnp_Amount: `${payment.amount * 100}`,
      vnp_CreateDate: this.formatVnpayDate(new Date()),
      vnp_CurrCode: payment.currency,
      vnp_IpAddr: payload.ipAddress?.trim() || '127.0.0.1',
      vnp_Locale: payload.locale?.trim() || 'vn',
      vnp_OrderInfo: `Thanh toan don ${order.orderNumber}`,
      vnp_OrderType: 'other',
      vnp_ReturnUrl: payload.returnUrl?.trim() || this.vnpayConfig!.returnUrl,
      vnp_TxnRef: txnRef,
    });

    const sortedParams = this.sortQueryParams(params);
    const signature = createHmac('sha512', this.vnpayConfig!.hashSecret)
      .update(sortedParams.toString())
      .digest('hex');
    sortedParams.set('vnp_SecureHash', signature);

    return `${this.vnpayConfig!.paymentUrl}?${sortedParams.toString()}`;
  }

  private sortQueryParams(input: URLSearchParams) {
    const sorted = new URLSearchParams();
    const pairs = [...input.entries()].sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
    for (const [key, value] of pairs) {
      sorted.append(key, value);
    }

    return sorted;
  }

  private formatVnpayDate(date: Date) {
    const yyyy = date.getFullYear().toString();
    const mm = `${date.getMonth() + 1}`.padStart(2, '0');
    const dd = `${date.getDate()}`.padStart(2, '0');
    const hh = `${date.getHours()}`.padStart(2, '0');
    const mi = `${date.getMinutes()}`.padStart(2, '0');
    const ss = `${date.getSeconds()}`.padStart(2, '0');
    return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
  }
}
