import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { QueryProductsDto } from './dto/query-products.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryProductsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;

    const where: Prisma.ProductWhereInput = {};

    if (query.q) {
      const keyword = query.q.trim();
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    if (query.category) {
      where.category = { equals: query.category, mode: 'insensitive' };
    }

    if (typeof query.minPrice === 'number' || typeof query.maxPrice === 'number') {
      where.price = {};

      if (typeof query.minPrice === 'number') {
        where.price.gte = query.minPrice;
      }

      if (typeof query.maxPrice === 'number') {
        where.price.lte = query.maxPrice;
      }
    }

    if (query.inStock) {
      where.stock = { gt: 0 };
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };

    switch (query.sort) {
      case 'price_asc':
        orderBy = { price: 'asc' };
        break;
      case 'price_desc':
        orderBy = { price: 'desc' };
        break;
      case 'rating_desc':
        orderBy = { rating: 'desc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    const total = await this.prisma.product.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * limit;

    const [data, categories] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.listCategories(),
    ]);

    return {
      total,
      page: safePage,
      limit,
      totalPages,
      categories,
      data,
    };
  }

  async listCategories() {
    const rows = await this.prisma.product.findMany({
      distinct: ['category'],
      select: {
        category: true,
      },
      orderBy: {
        category: 'asc',
      },
    });

    return rows.map((row) => row.category);
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }
}
