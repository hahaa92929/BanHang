import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class ReportingService {
  private readonly revenueStatuses: OrderStatus[] = ['confirmed', 'shipping', 'completed'];

  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [ordersToday, totalOrders, totalRevenueAgg, totalCustomers, lowStockProducts, topProducts] =
      await Promise.all([
        this.prisma.order.count({
          where: { createdAt: { gte: startOfToday } },
        }),
        this.prisma.order.count(),
        this.prisma.order.aggregate({
          _sum: {
            total: true,
          },
          where: {
            status: {
              in: ['confirmed', 'shipping', 'completed'],
            },
          },
        }),
        this.prisma.user.count({
          where: { role: 'customer' },
        }),
        this.prisma.product.count({
          where: {
            status: 'active',
            stock: { lte: 5 },
          },
        }),
        this.prisma.product.findMany({
          orderBy: [{ totalSold: 'desc' }, { createdAt: 'desc' }],
          take: 5,
          select: {
            id: true,
            sku: true,
            name: true,
            totalSold: true,
            stock: true,
          },
        }),
      ]);

    return {
      revenue: totalRevenueAgg._sum.total ?? 0,
      totalOrders,
      ordersToday,
      totalCustomers,
      lowStockProducts,
      topProducts,
    };
  }

  async revenue(days = 7) {
    const rangeDays = Math.max(1, Math.min(days, 90));
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (rangeDays - 1));

    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: from },
        status: { in: this.revenueStatuses },
      },
      select: {
        createdAt: true,
        total: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const buckets = new Map<string, { date: string; revenue: number; orders: number }>();
    for (let offset = 0; offset < rangeDays; offset += 1) {
      const current = new Date(from);
      current.setDate(from.getDate() + offset);
      const key = this.formatDateKey(current);
      buckets.set(key, { date: key, revenue: 0, orders: 0 });
    }

    for (const order of orders) {
      const key = this.formatDateKey(order.createdAt);
      const bucket = buckets.get(key);
      if (!bucket) {
        continue;
      }

      bucket.revenue += order.total;
      bucket.orders += 1;
    }

    return {
      days: rangeDays,
      data: [...buckets.values()],
    };
  }

  async topProducts(limit = 10) {
    const take = Math.max(1, Math.min(limit, 50));

    return {
      data: await this.prisma.product.findMany({
        orderBy: [{ totalSold: 'desc' }, { createdAt: 'desc' }],
        take,
        select: {
          id: true,
          sku: true,
          name: true,
          totalSold: true,
          stock: true,
          price: true,
          rating: true,
          totalReviews: true,
        },
      }),
    };
  }

  async couponUsage(limit = 10) {
    const take = Math.max(1, Math.min(limit, 50));
    const orders = await this.prisma.order.findMany({
      where: {
        couponId: { not: null },
      },
      include: {
        coupon: {
          select: {
            id: true,
            code: true,
            type: true,
            value: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(take * 20, 50),
    });

    const usage = new Map<
      string,
      {
        couponId: string;
        code: string;
        type: string;
        value: number;
        orderCount: number;
        revenue: number;
        discountAmount: number;
      }
    >();

    for (const order of orders) {
      if (!order.coupon) {
        continue;
      }

      const current =
        usage.get(order.couponId!) ?? {
          couponId: order.coupon.id,
          code: order.coupon.code,
          type: order.coupon.type,
          value: order.coupon.value,
          orderCount: 0,
          revenue: 0,
          discountAmount: 0,
        };

      current.orderCount += 1;
      current.revenue += order.total;
      current.discountAmount += order.discountAmount;
      usage.set(order.couponId!, current);
    }

    return {
      data: [...usage.values()]
        .sort((left, right) => right.orderCount - left.orderCount || right.revenue - left.revenue)
        .slice(0, take),
    };
  }

  private formatDateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }
}
