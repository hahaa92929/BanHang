import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class ReportingService {
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
}
