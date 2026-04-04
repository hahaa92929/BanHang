import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Coupon, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string) {
    const [rows, cartCoupon] = await Promise.all([
      this.prisma.cartItem.findMany({
        where: { userId },
        include: {
          product: {
            include: {
              media: {
                orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cartCoupon.findUnique({
        where: { userId },
        include: { coupon: true },
      }),
    ]);

    return this.formatCart(rows, cartCoupon?.coupon ?? null);
  }

  async addItem(userId: string, productId: string, quantity: number) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });

    if (!product || product.status !== ProductStatus.active) {
      throw new NotFoundException('Product not found');
    }

    const existing = await this.prisma.cartItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    this.assertStock(product.stock, nextQuantity);

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: nextQuantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          userId,
          productId,
          quantity,
        },
      });
    }

    return this.getCart(userId);
  }

  async setQuantity(userId: string, productId: string, quantity: number) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });

    if (!product || product.status !== ProductStatus.active) {
      throw new NotFoundException('Product not found');
    }

    this.assertStock(product.stock, quantity);

    const existing = await this.prisma.cartItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Item not found in cart');
    }

    await this.prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity },
    });

    return this.getCart(userId);
  }

  async removeItem(userId: string, productId: string) {
    await this.prisma.cartItem.deleteMany({
      where: {
        userId,
        productId,
      },
    });

    return this.getCart(userId);
  }

  async merge(userId: string, items: Array<{ productId: string; quantity: number }>) {
    for (const item of items) {
      await this.addItem(userId, item.productId, item.quantity);
    }

    return this.getCart(userId);
  }

  async applyCoupon(userId: string, code: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        code: { equals: code.trim(), mode: 'insensitive' },
        isActive: true,
      },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    const cart = await this.getCart(userId);
    this.assertCouponValid(coupon, cart.subtotal);

    await this.prisma.cartCoupon.upsert({
      where: { userId },
      create: {
        userId,
        couponId: coupon.id,
      },
      update: {
        couponId: coupon.id,
        appliedAt: new Date(),
      },
    });

    return this.getCart(userId);
  }

  async removeCoupon(userId: string) {
    await this.prisma.cartCoupon.deleteMany({
      where: { userId },
    });

    return this.getCart(userId);
  }

  async saveForLater(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({
        where: {
          userId,
          productId,
        },
      });

      await tx.wishlistItem.upsert({
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
    });

    return this.getCart(userId);
  }

  async clear(userId: string) {
    await this.prisma.cartItem.deleteMany({
      where: { userId },
    });

    return {
      items: [],
      subtotal: 0,
      totalItems: 0,
      discountAmount: 0,
      total: 0,
      coupon: null,
    };
  }

  private formatCart(
    rows: Array<{
      quantity: number;
      product: {
        id: string;
        slug: string;
        name: string;
        price: number;
        stock: number;
        media: Array<{ url: string }>;
      };
    }>,
    coupon: Coupon | null,
  ) {
    const items = rows.map((row) => ({
      productId: row.product.id,
      slug: row.product.slug,
      name: row.product.name,
      imageUrl: row.product.media[0]?.url ?? null,
      unitPrice: row.product.price,
      quantity: row.quantity,
      stock: row.product.stock,
      lineTotal: row.product.price * row.quantity,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const discountAmount = coupon ? this.calculateDiscount(coupon, subtotal) : 0;

    return {
      items,
      subtotal,
      totalItems,
      discountAmount,
      total: Math.max(0, subtotal - discountAmount),
      coupon: coupon
        ? {
            code: coupon.code,
            type: coupon.type,
            value: coupon.value,
          }
        : null,
    };
  }

  private assertStock(stock: number, quantity: number) {
    if (quantity > stock) {
      throw new BadRequestException('Quantity exceeds stock');
    }
  }

  private assertCouponValid(coupon: Coupon, subtotal: number) {
    const now = Date.now();

    if (coupon.startsAt.getTime() > now || coupon.expiresAt.getTime() < now) {
      throw new BadRequestException('Coupon is expired or not active yet');
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit exceeded');
    }

    if (subtotal < coupon.minOrderAmount) {
      throw new BadRequestException('Cart subtotal does not meet coupon minimum');
    }
  }

  private calculateDiscount(coupon: Coupon, subtotal: number) {
    switch (coupon.type) {
      case 'fixed':
        return Math.min(subtotal, coupon.value);
      case 'percent': {
        const raw = Math.floor((subtotal * coupon.value) / 100);
        return coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
      }
      case 'free_shipping':
      default:
        return 0;
    }
  }
}
