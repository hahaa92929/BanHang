import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';

@Injectable()
export class PaymentsService {
  private readonly webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || 'dev-webhook-secret';

  constructor(private readonly prisma: PrismaService) {}

  async processWebhook(signature: string | undefined, body: PaymentWebhookDto) {
    this.verifySignature(signature, body);

    const existing = await this.prisma.paymentWebhookEvent.findUnique({
      where: { eventId: body.eventId },
    });

    if (existing) {
      return { processed: false, reason: 'duplicate_event' };
    }

    let orderUpdate: { id: string; paymentStatus: PaymentStatus } | null = null;

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentWebhookEvent.create({
        data: {
          eventId: body.eventId,
          type: body.type,
          orderId: body.orderId,
          payload: body.payload as Prisma.InputJsonValue,
        },
      });

      if (!body.orderId) {
        return;
      }

      const order = await tx.order.findUnique({ where: { id: body.orderId } });
      if (!order) {
        return;
      }

      const paymentStatus = this.resolvePaymentStatus(body.type, order.paymentStatus);

      if (paymentStatus !== order.paymentStatus) {
        const updated = await tx.order.update({
          where: { id: body.orderId },
          data: { paymentStatus },
          select: {
            id: true,
            paymentStatus: true,
          },
        });

        orderUpdate = updated;
      }
    });

    return {
      processed: true,
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
      case 'payment.authorized':
        return 'authorized';
      case 'payment.captured':
        return 'paid';
      case 'payment.failed':
        return 'failed';
      default:
        if (type.startsWith('payment.')) {
          return current;
        }
        throw new BadRequestException('Unsupported webhook event type');
    }
  }
}
