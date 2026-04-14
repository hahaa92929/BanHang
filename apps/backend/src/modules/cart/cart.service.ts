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
          variant: true,
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


  async addItem(userId: string, productId: string, quantity: number, variantId?: string) {
    const selection = await this.resolvePurchaseSelection(productId, variantId);
    const existing = await this.prisma.cartItem.findFirst({
      where: {
        userId,
        productId,
        variantId: selection.variant.id,
      },
    });

    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    this.assertStock(selection.variant.stock, nextQuantity);

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
          variantId: selection.variant.id,
          quantity,
        },
      });
    }

    return this.getCart(userId);
  }

  async setQuantity(userId: string, productId: string, quantity: number, variantId?: string) {
    const selection = await this.resolvePurchaseSelection(productId, variantId);
    this.assertStock(selection.variant.stock, quantity);

    const existing = await this.resolveCartLine(userId, productId, selection.variant.id);

    if (!existing) {
      throw new NotFoundException('Item not found in cart');
    }

    await this.prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity },
    });

    return this.getCart(userId);
  }

  async removeItem(userId: string, productId: string, variantId?: string) {
    const target = await this.resolveCartLine(userId, productId, variantId);

    await this.prisma.cartItem.deleteMany({
      where: {
        userId,
        productId,
        variantId: target.variantId,
      },
    });

    return this.getCart(userId);
  }

  async merge(userId: string, items: Array<{ productId: string; quantity: number; variantId?: string }>) {
    for (const item of items) {
      await this.addItem(userId, item.productId, item.quantity, item.variantId);
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

  async saveForLater(userId: string, productId: string, variantId?: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const target = await this.resolveCartLine(userId, productId, variantId);

    await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({
        where: {
          userId,
          productId,
          variantId: target.variantId,
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
      variantId: string;
      quantity: number;
      product: {
        id: string;
        sku: string;
        slug: string;
        name: string;
        price: number;
        stock: number;
        media: Array<{ url: string }>;
      };
      variant: {
        id: string;
        sku: string;
        name: string;
        price: number;
        stock: number;
        attributes: unknown;
      };
    }>,
    coupon: Coupon | null,
  ) {
    const items = rows.map((row) => ({
      productId: row.product.id,
      productSku: row.product.sku,
      slug: row.product.slug,
      name: row.product.name,
      imageUrl: row.product.media[0]?.url ?? null,
      variantId: row.variant.id,
      variantSku: row.variant.sku,
      variantName: row.variant.name,
      variantAttributes: row.variant.attributes,
      unitPrice: row.variant.price,
      quantity: row.quantity,
      stock: row.variant.stock,
      lineTotal: row.variant.price * row.quantity,
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

  private async resolvePurchaseSelection(productId: string, variantId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!product || product.status !== ProductStatus.active) {
      throw new NotFoundException('Product not found');
    }

    const variant = variantId
      ? product.variants.find((item) => item.id === variantId)
      : product.variants.find((item) => item.isDefault) ?? product.variants[0];

    if (!variant) {
      throw new BadRequestException('Product has no active variants');
    }

    return { product, variant };
  }

  private async resolveCartLine(userId: string, productId: string, variantId?: string) {
    const rows = await this.prisma.cartItem.findMany({
      where: {
        userId,
        productId,
      },
      select: {
        id: true,
        variantId: true,
      },
    });

    if (!rows.length) {
      throw new NotFoundException('Item not found in cart');
    }

    if (variantId) {
      const matched = rows.find((row) => row.variantId === variantId);
      if (!matched) {
        throw new NotFoundException('Item not found in cart');
      }

      return matched;
    }

    if (rows.length > 1) {
      throw new BadRequestException('variantId is required for products with multiple cart lines');
    }

    return rows[0];
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
