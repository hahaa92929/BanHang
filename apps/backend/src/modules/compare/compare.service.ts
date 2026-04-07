import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class CompareService {
  private readonly maxItems = 4;

  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const data = await this.prisma.compareItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          include: {
            category: true,
            brand: true,
            media: {
              orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
              take: 1,
            },
            variants: {
              where: { isActive: true },
              orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
              select: {
                id: true,
                sku: true,
                name: true,
                price: true,
                stock: true,
              },
            },
          },
        },
      },
    });
    type CompareRow = (typeof data)[number];

    const products = data.map((item: CompareRow) => item.product);
    const differingFields = this.resolveDifferingFields(products);

    return {
      total: data.length,
      maxItems: this.maxItems,
      differingFields,
      data: data.map((item: CompareRow) => ({
        id: item.id,
        createdAt: item.createdAt,
        product: item.product,
      })),
    };
  }

  async addItem(userId: string, productId: string) {
    const [product, existing, count] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          status: true,
        },
      }),
      this.prisma.compareItem.findUnique({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
        select: { id: true },
      }),
      this.prisma.compareItem.count({ where: { userId } }),
    ]);

    if (!product || product.status !== ProductStatus.active) {
      throw new NotFoundException('Product not found');
    }

    if (!existing && count >= this.maxItems) {
      throw new BadRequestException(`Compare list supports up to ${this.maxItems} products`);
    }

    await this.prisma.compareItem.upsert({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
      create: {
        userId,
        productId,
      },
      update: {},
    });

    return this.list(userId);
  }

  async removeItem(userId: string, productId: string) {
    await this.prisma.compareItem.deleteMany({
      where: {
        userId,
        productId,
      },
    });

    return this.list(userId);
  }

  async clear(userId: string) {
    await this.prisma.compareItem.deleteMany({
      where: { userId },
    });

    return this.list(userId);
  }

  private resolveDifferingFields(
    products: Array<{
      brand: { name: string } | null;
      category: { name: string } | null;
      price: number;
      rating: number;
      stock: number;
      tags: string[];
      variants: Array<{ sku: string }>;
    }>,
  ) {
    if (products.length < 2) {
      return [] as string[];
    }

    const fields = {
      brand: products.map((product) => product.brand?.name ?? null),
      category: products.map((product) => product.category?.name ?? null),
      price: products.map((product) => product.price),
      rating: products.map((product) => product.rating),
      stock: products.map((product) => product.stock),
      tags: products.map((product) => [...product.tags].sort().join('|')),
      variants: products.map((product) => product.variants.map((variant) => variant.sku).join('|')),
    };

    return Object.entries(fields)
      .filter(([, values]) => new Set(values.map((value) => String(value))).size > 1)
      .map(([field]) => field);
  }
}
