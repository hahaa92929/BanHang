import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ShippingCarrier, ShippingMethod, ShippingStatus } from '@prisma/client';
import { generateId } from '../../common/security';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';

type ZoneCode = 'south' | 'central' | 'north';

type ShippingQuote = {
  carrier: ShippingCarrier;
  carrierName: string;
  serviceCode: string;
  fee: number;
  estimatedDelivery: string;
  zone: ZoneCode;
  supportsCod: boolean;
  labelUrl: string;
  appliedRules: string[];
};

type ShipmentDraft = {
  carrier: ShippingCarrier;
  carrierName: string;
  serviceCode: string;
  fee: number;
  estimatedDelivery: string;
  labelUrl: string;
};

type ShippingCalculation = {
  shippingMethod: ShippingMethod;
  zone: ZoneCode;
  fee: number;
  estimatedDelivery: string;
  carrier: ShippingCarrier;
  carrierName: string;
  serviceCode: string;
  appliedRules: string[];
  quotes: ShippingQuote[];
};

type CarrierProfile = {
  carrier: Exclude<ShippingCarrier, 'internal'>;
  name: string;
  supportedMethods: ShippingMethod[];
  supportedZones: ZoneCode[];
  multipliers: Record<ZoneCode, number>;
  serviceCodes: Record<'standard' | 'express' | 'same_day', string>;
  eta: Record<'standard' | 'express' | 'same_day', string>;
  supportsCod: boolean;
  labelBaseUrl: string;
};

@Injectable()
export class ShippingService {
  private readonly baseFees: Record<ShippingMethod, number> = {
    standard: 30_000,
    express: 60_000,
    same_day: 90_000,
    pickup: 0,
  };

  private readonly carrierProfiles: CarrierProfile[] = [
    {
      carrier: 'ghn',
      name: 'GHN',
      supportedMethods: ['standard', 'express', 'same_day'],
      supportedZones: ['south', 'central', 'north'],
      multipliers: { south: 0.98, central: 1.04, north: 1.08 },
      serviceCodes: {
        standard: 'GHN-STD',
        express: 'GHN-EXP',
        same_day: 'GHN-SMD',
      },
      eta: {
        standard: '3-5 days',
        express: '1-2 days',
        same_day: 'Same day',
      },
      supportsCod: true,
      labelBaseUrl: 'https://shipping.local/ghn',
    },
    {
      carrier: 'ghtk',
      name: 'GHTK',
      supportedMethods: ['standard', 'express'],
      supportedZones: ['south', 'central', 'north'],
      multipliers: { south: 1, central: 1.06, north: 1.1 },
      serviceCodes: {
        standard: 'GHTK-STD',
        express: 'GHTK-EXP',
        same_day: 'GHTK-SMD',
      },
      eta: {
        standard: '3-5 days',
        express: '1-2 days',
        same_day: 'Same day',
      },
      supportsCod: true,
      labelBaseUrl: 'https://shipping.local/ghtk',
    },
    {
      carrier: 'jt',
      name: 'J&T Express',
      supportedMethods: ['standard', 'express'],
      supportedZones: ['south', 'central', 'north'],
      multipliers: { south: 1.02, central: 1.03, north: 1.07 },
      serviceCodes: {
        standard: 'JT-STD',
        express: 'JT-EXP',
        same_day: 'JT-SMD',
      },
      eta: {
        standard: '3-5 days',
        express: '1-2 days',
        same_day: 'Same day',
      },
      supportsCod: true,
      labelBaseUrl: 'https://shipping.local/jt',
    },
    {
      carrier: 'viettel_post',
      name: 'Viettel Post',
      supportedMethods: ['standard', 'express'],
      supportedZones: ['south', 'central', 'north'],
      multipliers: { south: 1.03, central: 1.05, north: 1.06 },
      serviceCodes: {
        standard: 'VTP-STD',
        express: 'VTP-EXP',
        same_day: 'VTP-SMD',
      },
      eta: {
        standard: '3-6 days',
        express: '1-2 days',
        same_day: 'Same day',
      },
      supportsCod: true,
      labelBaseUrl: 'https://shipping.local/viettel-post',
    },
    {
      carrier: 'grab_express',
      name: 'Grab Express',
      supportedMethods: ['same_day', 'express'],
      supportedZones: ['south', 'north'],
      multipliers: { south: 1, central: 1.35, north: 1.08 },
      serviceCodes: {
        standard: 'GRAB-STD',
        express: 'GRAB-EXP',
        same_day: 'GRAB-SMD',
      },
      eta: {
        standard: '3-5 days',
        express: '4-8 hours',
        same_day: '2-6 hours',
      },
      supportsCod: false,
      labelBaseUrl: 'https://shipping.local/grab-express',
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  calculate(
    subtotal: number,
    shippingMethod: ShippingMethod,
    province?: string,
    district?: string,
    weightGrams = 500,
    carrier?: ShippingCarrier,
  ): ShippingCalculation {
    if (shippingMethod === 'pickup') {
      return {
        shippingMethod,
        zone: this.resolveZone(province),
        fee: 0,
        estimatedDelivery: 'Ready in 2 hours',
        carrier: 'internal',
        carrierName: 'Store pickup',
        serviceCode: 'PICKUP-COUNTER',
        appliedRules: ['pickup'],
        quotes: [
          {
            carrier: 'internal',
            carrierName: 'Store pickup',
            serviceCode: 'PICKUP-COUNTER',
            fee: 0,
            estimatedDelivery: 'Ready in 2 hours',
            zone: this.resolveZone(province),
            supportsCod: false,
            labelUrl: `https://shipping.local/pickup/labels/PICKUP-${generateId('pickup').slice(-8).toUpperCase()}.pdf`,
            appliedRules: ['pickup'],
          } satisfies ShippingQuote,
        ],
      };
    }

    const zone = this.resolveZone(province);
    const methodKey = shippingMethod as Exclude<ShippingMethod, 'pickup'>;
    const profiles = this.carrierProfiles.filter(
      (profile) =>
        profile.supportedMethods.includes(shippingMethod) &&
        profile.supportedZones.includes(zone) &&
        (!carrier || profile.carrier === carrier),
    );

    if (!profiles.length) {
      throw new BadRequestException('No carrier supports this route');
    }

    const freeShippingApplied = subtotal >= 1_000_000 && shippingMethod === 'standard';
    const deliveryHint = district?.trim() ? ` to ${district.trim()}` : '';
    const quotes: ShippingQuote[] = profiles
      .map((profile) => {
        const appliedRules = freeShippingApplied ? ['free_shipping_threshold'] : [];
        const fee = freeShippingApplied
          ? 0
          : this.calculateCarrierFee(profile, shippingMethod, zone, weightGrams);

        return {
          carrier: profile.carrier,
          carrierName: profile.name,
          serviceCode: profile.serviceCodes[methodKey],
          fee,
          estimatedDelivery: `${profile.eta[methodKey]}${deliveryHint}`,
          zone,
          supportsCod: profile.supportsCod,
          labelUrl: `${profile.labelBaseUrl}/labels/${profile.serviceCodes[methodKey]}.pdf`,
          appliedRules,
        } satisfies ShippingQuote;
      })
      .sort((left, right) => left.fee - right.fee || left.carrierName.localeCompare(right.carrierName));

    const selected = quotes[0]!;

    return {
      shippingMethod,
      zone,
      fee: selected.fee,
      estimatedDelivery: selected.estimatedDelivery,
      carrier: selected.carrier,
      carrierName: selected.carrierName,
      serviceCode: selected.serviceCode,
      appliedRules: selected.appliedRules,
      quotes,
    };
  }

  async createShipment(orderId: string, carrier?: ShippingCarrier, serviceCode?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        reservation: {
          include: {
            items: {
              include: {
                allocations: {
                  include: {
                    warehouse: true,
                  },
                },
              },
            },
          },
        },
        trackingEvents: {
          orderBy: { occurredAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const shipment =
      order.shippingMethod === 'pickup'
        ? this.buildPickupShipment(order.id)
        : this.resolveShipmentQuote(order, carrier, serviceCode);
    const trackingCode = order.trackingCode ?? this.generateTrackingCode();
    const shippingStatus =
      order.shippingMethod === 'pickup'
        ? ShippingStatus.packed
        : order.status === 'shipping' || order.shippingStatus === 'in_transit'
          ? ShippingStatus.in_transit
          : ShippingStatus.packed;
    const now = new Date();
    const originWarehouse = this.resolveOriginWarehouse(order.reservation);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          trackingCode,
          shippingCarrier: shipment.carrier,
          shippingServiceCode: shipment.serviceCode,
          shippingLabelUrl: shipment.labelUrl,
          shippingStatus,
          ...(shippingStatus === 'in_transit' && !order.shippedAt ? { shippedAt: now } : {}),
        },
      });

      const existingCodes = new Set(order.trackingEvents.map((event) => event.code));
      const baseEvents: Array<{
        status: ShippingStatus;
        code: string;
        title: string;
        description: string;
      }> = [
        {
          status: 'packed' as const,
          code: 'shipment_created',
          title: 'Shipment created',
          description: `${shipment.carrierName} created shipment ${trackingCode}.`,
        },
      ];

      if (shippingStatus === 'in_transit' && !existingCodes.has('shipment_in_transit')) {
        baseEvents.push({
          status: 'in_transit' as const,
          code: 'shipment_in_transit',
          title: 'Shipment in transit',
          description: `${shipment.carrierName} picked up order ${order.orderNumber}.`,
        });
      }

      for (const event of baseEvents) {
        if (existingCodes.has(event.code)) {
          continue;
        }

        await tx.shippingTrackingEvent.create({
          data: {
            orderId: order.id,
            carrier: shipment.carrier,
            status: event.status,
            code: event.code,
            title: event.title,
            description: event.description,
            location: originWarehouse?.name ?? this.extractAddressField(order.addressJson, 'province'),
            occurredAt: now,
            source: 'shipping.create',
          },
        });
      }

      await tx.notification.create({
        data: {
          userId: order.userId,
          type: 'order',
          channel: 'in_app',
          templateKey: 'shipping.shipment_created',
          title: order.shippingMethod === 'pickup' ? 'Pickup ready soon' : 'Shipment created',
          content:
            order.shippingMethod === 'pickup'
              ? `Pickup for order ${order.orderNumber} is being prepared.`
              : `Shipment ${trackingCode} was created with ${shipment.carrierName}.`,
          data: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            carrier: shipment.carrier,
            serviceCode: shipment.serviceCode,
            trackingCode,
          },
          deliveredAt: now,
        },
      });

      return {
        orderId: updated.id,
        orderNumber: updated.orderNumber,
        trackingCode,
        shippingStatus: updated.shippingStatus,
        carrier: shipment.carrier,
        carrierName: shipment.carrierName,
        serviceCode: shipment.serviceCode,
        fee: shipment.fee,
        estimatedDelivery: shipment.estimatedDelivery,
        labelUrl: shipment.labelUrl,
        originWarehouse,
      };
    });
  }

  async tracking(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        trackingEvents: {
          orderBy: { occurredAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      trackingCode: order.trackingCode,
      shippingStatus: order.shippingStatus,
      shippingMethod: order.shippingMethod,
      carrier: order.shippingCarrier,
      serviceCode: order.shippingServiceCode,
      labelUrl: order.shippingLabelUrl,
      timeline: order.trackingEvents.map((event) => ({
        code: event.code,
        title: event.title,
        description: event.description,
        location: event.location,
        status: event.status,
        carrier: event.carrier,
        occurredAt: event.occurredAt,
        source: event.source,
      })),
    };
  }

  async label(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || !order.trackingCode || !order.shippingLabelUrl) {
      throw new NotFoundException('Shipment label not available');
    }

    const baseUrl = order.shippingLabelUrl.replace(/\/labels\/.+$/, '');

    return {
      orderId: order.id,
      trackingCode: order.trackingCode,
      carrier: order.shippingCarrier,
      labelUrl: order.shippingLabelUrl,
      returnLabelUrl: `${baseUrl}/returns/${order.trackingCode}.pdf`,
    };
  }

  async addTrackingEvent(orderId: string, payload: CreateTrackingEventDto, actorId = 'system') {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const occurredAt = payload.occurredAt ? new Date(payload.occurredAt) : new Date();
    const carrier = payload.carrier ?? order.shippingCarrier ?? null;
    const title = payload.title ?? this.defaultTrackingTitle(payload.status);
    const code = payload.code?.trim() || `shipment_${payload.status}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.shippingTrackingEvent.create({
        data: {
          orderId,
          status: payload.status,
          carrier,
          code,
          title,
          description: payload.description,
          location: payload.location,
          occurredAt,
          source: actorId,
        },
      });

      const orderUpdate: Prisma.OrderUpdateInput = {
        shippingStatus: payload.status,
      };

      if (payload.status === 'in_transit' && !order.shippedAt) {
        orderUpdate.shippedAt = occurredAt;
      }

      if (payload.status === 'delivered' && !order.deliveredAt) {
        orderUpdate.deliveredAt = occurredAt;
      }

      await tx.order.update({
        where: { id: orderId },
        data: orderUpdate,
      });

      await tx.notification.create({
        data: {
          userId: order.userId,
          type: 'order',
          channel: 'in_app',
          templateKey: `shipping.${payload.status}`,
          title,
          content: payload.description ?? `Order ${order.orderNumber} is now ${payload.status}.`,
          data: {
            orderId,
            orderNumber: order.orderNumber,
            trackingCode: order.trackingCode,
            status: payload.status,
            location: payload.location ?? null,
          },
          deliveredAt: occurredAt,
        },
      });
    });

    return this.tracking(orderId);
  }

  zones() {
    return {
      data: [
        {
          code: 'south',
          name: 'Southern Vietnam',
          carriers: ['GHN', 'GHTK', 'Grab Express', 'J&T Express'],
          supportsSameDay: true,
        },
        {
          code: 'central',
          name: 'Central Vietnam',
          carriers: ['GHN', 'GHTK', 'J&T Express', 'Viettel Post'],
          supportsSameDay: false,
        },
        {
          code: 'north',
          name: 'Northern Vietnam',
          carriers: ['GHN', 'J&T Express', 'Viettel Post', 'Grab Express'],
          supportsSameDay: true,
        },
      ],
    };
  }

  private resolveShipmentQuote(
    order: {
      id: string;
      subtotal: number;
      shippingMethod: ShippingMethod;
      addressJson: Prisma.JsonValue;
    },
    carrier?: ShippingCarrier,
    serviceCode?: string,
  ): ShipmentDraft {
    const province = this.extractAddressField(order.addressJson, 'province');
    const district = this.extractAddressField(order.addressJson, 'district');
    const calculated = this.calculate(
      order.subtotal,
      order.shippingMethod,
      province,
      district,
      this.estimateWeight(order),
      carrier,
    );

    const selected = serviceCode
      ? calculated.quotes.find((quote) => quote.serviceCode === serviceCode)
      : calculated.quotes[0];

    if (!selected) {
      throw new BadRequestException('Requested shipping service is not available');
    }

    return {
      carrier: selected.carrier,
      carrierName: selected.carrierName,
      serviceCode: selected.serviceCode,
      fee: selected.fee,
      estimatedDelivery: selected.estimatedDelivery,
      labelUrl: selected.labelUrl.replace(
        /\.pdf$/,
        `-${order.id.slice(-6).toUpperCase()}.pdf`,
      ),
    };
  }

  private buildPickupShipment(orderId: string): ShipmentDraft {
    const trackingCode = `PICKUP-${generateId('pickup').slice(-8).toUpperCase()}`;
    return {
      carrier: 'internal' as const,
      carrierName: 'Store pickup',
      serviceCode: 'PICKUP-COUNTER',
      fee: 0,
      estimatedDelivery: 'Ready in 2 hours',
      labelUrl: `https://shipping.local/pickup/labels/${trackingCode}-${orderId.slice(-6).toUpperCase()}.pdf`,
    };
  }

  private calculateCarrierFee(
    profile: CarrierProfile,
    shippingMethod: ShippingMethod,
    zone: ZoneCode,
    weightGrams: number,
  ) {
    const baseFee = this.baseFees[shippingMethod];
    const normalizedWeight = Math.max(500, weightGrams);
    const weightSurcharge = Math.max(0, Math.ceil((normalizedWeight - 500) / 500) * 5_000);
    return Math.round(baseFee * profile.multipliers[zone] + weightSurcharge);
  }

  private resolveZone(province?: string): ZoneCode {
    const normalized = province?.trim().toLowerCase() ?? '';

    if (
      ['ho chi minh', 'binh duong', 'dong nai', 'ba ria', 'can tho', 'long an'].some((keyword) =>
        normalized.includes(keyword),
      )
    ) {
      return 'south';
    }

    if (
      ['ha noi', 'hai phong', 'bac ninh', 'quang ninh', 'nam dinh', 'thai binh'].some((keyword) =>
        normalized.includes(keyword),
      )
    ) {
      return 'north';
    }

    return 'central';
  }

  private resolveOriginWarehouse(
    reservation:
      | {
          items: Array<{
            allocations: Array<{
              quantity: number;
              warehouse: {
                code: string;
                name: string;
              };
            }>;
          }>;
        }
      | null
      | undefined,
  ) {
    if (!reservation) {
      return null;
    }

    const totals = new Map<string, { code: string; name: string; quantity: number }>();

    for (const item of reservation.items) {
      for (const allocation of item.allocations) {
        const key = allocation.warehouse.code;
        const existing = totals.get(key);
        if (existing) {
          existing.quantity += allocation.quantity;
          continue;
        }

        totals.set(key, {
          code: allocation.warehouse.code,
          name: allocation.warehouse.name,
          quantity: allocation.quantity,
        });
      }
    }

    return [...totals.values()].sort((left, right) => right.quantity - left.quantity)[0] ?? null;
  }

  private extractAddressField(addressJson: Prisma.JsonValue, field: string) {
    if (!addressJson || typeof addressJson !== 'object' || Array.isArray(addressJson)) {
      return undefined;
    }

    const value = (addressJson as Record<string, unknown>)[field];
    return typeof value === 'string' ? value : undefined;
  }

  private estimateWeight(order: { subtotal: number }) {
    if (order.subtotal >= 10_000_000) {
      return 1_500;
    }

    if (order.subtotal >= 2_000_000) {
      return 1_000;
    }

    return 500;
  }

  private generateTrackingCode() {
    return `SHIP-${generateId('ship').slice(-10).toUpperCase()}`;
  }

  private defaultTrackingTitle(status: ShippingStatus) {
    switch (status) {
      case 'packed':
        return 'Shipment packed';
      case 'in_transit':
        return 'Shipment in transit';
      case 'delivered':
        return 'Shipment delivered';
      case 'returned':
        return 'Shipment returned';
      case 'canceled':
        return 'Shipment canceled';
      case 'pending':
      default:
        return 'Shipment pending';
    }
  }
}
