import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { ShippingService } from './shipping.service';

function createShippingMock() {
  const orders = [
    {
      id: 'ord-1',
      orderNumber: 'ORD-100',
      userId: 'u-1',
      status: 'created',
      subtotal: 1_500_000,
      total: 1_530_000,
      shippingMethod: 'standard',
      shippingStatus: 'pending',
      addressJson: {
        province: 'Ho Chi Minh',
        district: 'District 1',
      },
      trackingCode: null,
      shippingCarrier: null,
      shippingServiceCode: null,
      shippingLabelUrl: null,
      shippedAt: null,
      deliveredAt: null,
      reservation: {
        items: [
          {
            allocations: [
              {
                quantity: 2,
                warehouse: {
                  code: 'HCM',
                  name: 'HCM Fulfillment Center',
                },
              },
            ],
          },
        ],
      },
      trackingEvents: [] as Array<Record<string, unknown>>,
    },
    {
      id: 'ord-2',
      orderNumber: 'ORD-101',
      userId: 'u-2',
      status: 'confirmed',
      subtotal: 250_000,
      total: 250_000,
      shippingMethod: 'pickup',
      shippingStatus: 'pending',
      addressJson: {
        province: 'Ha Noi',
      },
      trackingCode: null,
      shippingCarrier: null,
      shippingServiceCode: null,
      shippingLabelUrl: null,
      shippedAt: null,
      deliveredAt: null,
      reservation: null,
      trackingEvents: [] as Array<Record<string, unknown>>,
    },
  ];
  const notifications: Array<Record<string, unknown>> = [];
  const trackingEvents: Array<Record<string, unknown>> = [];

  function findOrder(id: string) {
    return orders.find((order) => order.id === id) ?? null;
  }

  function materializeOrder(
    order: (typeof orders)[number],
    include?: {
      reservation?: unknown;
      trackingEvents?: { orderBy?: { occurredAt: 'asc' | 'desc' } };
    },
  ) {
    return {
      ...order,
      reservation: include?.reservation ? order.reservation : undefined,
      trackingEvents: include?.trackingEvents
        ? [...trackingEvents]
            .filter((event) => event.orderId === order.id)
            .sort((left, right) =>
              include.trackingEvents?.orderBy?.occurredAt === 'desc'
                ? Number(right.occurredAt) - Number(left.occurredAt)
                : Number(left.occurredAt) - Number(right.occurredAt),
            )
        : undefined,
    };
  }

  const tx = {
    order: {
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const order = findOrder(args.where.id);
        if (!order) {
          throw new Error('order not found');
        }
        Object.assign(order, args.data);
        return { ...order };
      },
    },
    shippingTrackingEvent: {
      create: async (args: { data: Record<string, unknown> }) => {
        const event = {
          id: `ste-${trackingEvents.length + 1}`,
          createdAt: new Date(),
          ...args.data,
        };
        trackingEvents.push(event);
        return event;
      },
    },
    notification: {
      create: async (args: { data: Record<string, unknown> }) => {
        const notification = {
          id: `n-${notifications.length + 1}`,
          createdAt: new Date(),
          ...args.data,
        };
        notifications.push(notification);
        return notification;
      },
    },
  };

  const prisma = {
    order: {
      findUnique: async (args: {
        where: { id: string };
        include?: {
          reservation?: unknown;
          trackingEvents?: { orderBy?: { occurredAt: 'asc' | 'desc' } };
        };
      }) => {
        const order = findOrder(args.where.id);
        return order ? materializeOrder(order, args.include) : null;
      },
      update: tx.order.update,
    },
    shippingTrackingEvent: tx.shippingTrackingEvent,
    notification: tx.notification,
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
  };

  return {
    prisma,
    orders,
    notifications,
    trackingEvents,
  };
}

test('shipping.calculate returns filtered carrier quotes with free shipping rules', () => {
  const mock = createShippingMock();
  const service = new ShippingService(mock.prisma as never);

  const calculated = service.calculate(
    1_500_000,
    'standard',
    'Ho Chi Minh',
    'District 1',
    500,
  );
  const sameDay = service.calculate(500_000, 'same_day', 'Ha Noi', 'Dong Da', 700, 'grab_express');

  assert.equal(calculated.fee, 0);
  assert.equal(calculated.appliedRules[0], 'free_shipping_threshold');
  assert.ok(calculated.quotes.length >= 3);
  assert.equal(sameDay.carrier, 'grab_express');
  assert.equal(sameDay.quotes.length, 1);
});

test('shipping.createShipment tracking and label persist carrier metadata', async () => {
  const mock = createShippingMock();
  const service = new ShippingService(mock.prisma as never);

  const shipment = await service.createShipment('ord-1', 'ghn');
  const tracking = await service.tracking('ord-1');
  const label = await service.label('ord-1');

  assert.equal(shipment.carrier, 'ghn');
  assert.equal(mock.orders[0].shippingCarrier, 'ghn');
  assert.equal(mock.orders[0].shippingServiceCode, 'GHN-STD');
  assert.equal(mock.orders[0].shippingStatus, 'packed');
  assert.equal(mock.trackingEvents.length, 1);
  assert.equal(tracking.timeline.length, 1);
  assert.equal(tracking.timeline[0].code, 'shipment_created');
  assert.equal(label.carrier, 'ghn');
  assert.match(label.returnLabelUrl, /returns/i);
  assert.equal(mock.notifications.length, 1);
});

test('shipping.addTrackingEvent updates shipment lifecycle and supports pickup orders', async () => {
  const mock = createShippingMock();
  const service = new ShippingService(mock.prisma as never);

  const pickupShipment = await service.createShipment('ord-2');
  const updatedTracking = await service.addTrackingEvent('ord-1', {
    status: 'delivered',
    location: 'Ho Chi Minh City',
    description: 'Package delivered to customer',
  });

  assert.equal(pickupShipment.carrier, 'internal');
  assert.equal(mock.orders[1].shippingStatus, 'packed');
  assert.equal(updatedTracking.shippingStatus, 'delivered');
  assert.equal(updatedTracking.timeline.at(-1)?.location, 'Ho Chi Minh City');
  assert.ok(mock.orders[0].deliveredAt instanceof Date);
  assert.equal(mock.notifications.length, 2);

  await assert.rejects(
    async () => service.tracking('missing-order'),
    (error: unknown) => error instanceof NotFoundException,
  );
});
