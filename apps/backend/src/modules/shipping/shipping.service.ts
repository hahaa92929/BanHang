import { Injectable, NotFoundException } from '@nestjs/common';
import { generateId } from '../../common/security';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class ShippingService {
  private readonly baseFees = {
    standard: 30_000,
    express: 60_000,
    same_day: 90_000,
    pickup: 0,
  } as const;

  constructor(private readonly prisma: PrismaService) {}

  calculate(subtotal: number, shippingMethod: keyof typeof this.baseFees, province?: string) {
    const zoneMultiplier = province?.toLowerCase().includes('ho chi minh') ? 1 : 1.1;
    const fee = Math.round(this.baseFees[shippingMethod] * zoneMultiplier);
    const discountedFee = subtotal >= 1_000_000 && shippingMethod === 'standard' ? 0 : fee;

    return {
      shippingMethod,
      fee: discountedFee,
      estimatedDelivery:
        shippingMethod === 'same_day'
          ? 'Same day'
          : shippingMethod === 'express'
            ? '1-2 days'
            : shippingMethod === 'pickup'
              ? 'Ready in 2 hours'
              : '3-5 days',
    };
  }

  async createShipment(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const trackingCode = order.trackingCode ?? `SHIP-${generateId('ship').slice(-8).toUpperCase()}`;
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        trackingCode,
        shippingStatus: order.shippingMethod === 'pickup' ? 'packed' : 'in_transit',
      },
    });

    return {
      orderId: updated.id,
      trackingCode: updated.trackingCode,
      labelUrl: `https://shipping.local/labels/${trackingCode}.pdf`,
    };
  }

  async tracking(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      trackingCode: order.trackingCode,
      shippingStatus: order.shippingStatus,
      shippingMethod: order.shippingMethod,
    };
  }

  async label(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || !order.trackingCode) {
      throw new NotFoundException('Shipment label not available');
    }

    return {
      orderId: order.id,
      trackingCode: order.trackingCode,
      labelUrl: `https://shipping.local/labels/${order.trackingCode}.pdf`,
    };
  }

  zones() {
    return {
      data: [
        { code: 'south', name: 'Southern Vietnam', carriers: ['GHN', 'GHTK', 'Grab Express'] },
        { code: 'central', name: 'Central Vietnam', carriers: ['GHN', 'J&T'] },
        { code: 'north', name: 'Northern Vietnam', carriers: ['GHN', 'Viettel Post'] },
      ],
    };
  }
}
