import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReportingService } from './reporting.service';

function createReportingMock() {
  const now = new Date();
  now.setHours(9, 0, 0, 0);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(now.getDate() - 2);
  const orders = [
    {
      id: 'ord-1',
      createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      total: 150_000,
      status: 'completed',
      couponId: 'coupon-1',
      discountAmount: 20_000,
      coupon: {
        id: 'coupon-1',
        code: 'SAVE20',
        type: 'percentage',
        value: 20,
      },
    },
    {
      id: 'ord-2',
      createdAt: new Date(yesterday.getTime() - 6 * 60 * 60 * 1000),
      total: 90_000,
      status: 'shipping',
      couponId: 'coupon-1',
      discountAmount: 10_000,
      coupon: {
        id: 'coupon-1',
        code: 'SAVE20',
        type: 'percentage',
        value: 20,
      },
    },
    {
      id: 'ord-3',
      createdAt: new Date(twoDaysAgo.getTime() - 6 * 60 * 60 * 1000),
      total: 200_000,
      status: 'pending',
      couponId: null,
      discountAmount: 0,
      coupon: null,
    },
  ];
  const products = [
    {
      id: 'p-1',
      sku: 'SKU-1',
      name: 'iPhone 15',
      totalSold: 25,
      stock: 3,
      price: 20_000_000,
      rating: 4.8,
      totalReviews: 18,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      status: 'active',
    },
    {
      id: 'p-2',
      sku: 'SKU-2',
      name: 'AirPods Pro',
      totalSold: 10,
      stock: 12,
      price: 5_000_000,
      rating: 4.6,
      totalReviews: 9,
      createdAt: new Date('2026-03-10T00:00:00.000Z'),
      status: 'active',
    },
  ];
  const users = [{ id: 'u-1', role: 'customer' }, { id: 'u-2', role: 'customer' }];

  const prisma = {
    order: {
      count: async (args?: { where?: { createdAt?: { gte: Date } } }) =>
        orders.filter((order) => {
          if (!args?.where?.createdAt?.gte) {
            return true;
          }

          return order.createdAt >= args.where.createdAt.gte;
        }).length,
      aggregate: async () => ({
        _sum: {
          total: orders
            .filter((order) => ['confirmed', 'shipping', 'completed'].includes(order.status))
            .reduce((sum, order) => sum + order.total, 0),
        },
      }),
      findMany: async (args: {
        where?: {
          createdAt?: { gte: Date };
          status?: { in: string[] };
          couponId?: { not: null };
        };
        select?: { createdAt: true; total: true };
        include?: { coupon: { select: { id: true; code: true; type: true; value: true } } };
        orderBy?: { createdAt: 'asc' | 'desc' };
        take?: number;
      }) => {
        let rows = [...orders];

        if (args.where?.createdAt?.gte) {
          rows = rows.filter((order) => order.createdAt >= args.where!.createdAt!.gte);
        }

        if (args.where?.status?.in) {
          rows = rows.filter((order) => args.where!.status!.in.includes(order.status));
        }

        if (args.where?.couponId?.not === null) {
          rows = rows.filter((order) => order.couponId !== null);
        }

        rows.sort((left, right) =>
          args.orderBy?.createdAt === 'asc'
            ? left.createdAt.getTime() - right.createdAt.getTime()
            : right.createdAt.getTime() - left.createdAt.getTime(),
        );

        if (args.take) {
          rows = rows.slice(0, args.take);
        }

        if (args.select) {
          return rows.map((order) => ({ createdAt: order.createdAt, total: order.total }));
        }

        return rows;
      },
    },
    user: {
      count: async () => users.length,
    },
    product: {
      count: async () => products.filter((product) => product.status === 'active' && product.stock <= 5).length,
      findMany: async (args: {
        orderBy: Array<{ totalSold?: 'asc' | 'desc'; createdAt?: 'asc' | 'desc' }>;
        take: number;
      }) =>
        [...products]
          .sort((left, right) => right.totalSold - left.totalSold || right.createdAt.getTime() - left.createdAt.getTime())
          .slice(0, args.take),
    },
  };

  return { prisma, now };
}

test('reporting.summary revenue top products and low stock metrics aggregate correctly', async () => {
  const { prisma } = createReportingMock();
  const service = new ReportingService(prisma as never);

  const summary = await service.summary();

  assert.equal(summary.revenue, 240_000);
  assert.equal(summary.totalOrders, 3);
  assert.equal(summary.totalCustomers, 2);
  assert.equal(summary.lowStockProducts, 1);
  assert.equal(summary.topProducts[0].sku, 'SKU-1');
});

test('reporting.revenue topProducts and couponUsage provide breakdown endpoints', async () => {
  const { prisma } = createReportingMock();
  const service = new ReportingService(prisma as never);

  const revenue = await service.revenue(3);
  const topProducts = await service.topProducts(1);
  const coupons = await service.couponUsage(5);

  assert.equal(revenue.days, 3);
  assert.equal(revenue.data.length, 3);
  assert.equal(revenue.data[revenue.data.length - 1].revenue, 150_000);
  assert.equal(topProducts.data.length, 1);
  assert.equal(topProducts.data[0].sku, 'SKU-1');
  assert.equal(coupons.data.length, 1);
  assert.equal(coupons.data[0].code, 'SAVE20');
  assert.equal(coupons.data[0].orderCount, 2);
  assert.equal(coupons.data[0].discountAmount, 30_000);
});
