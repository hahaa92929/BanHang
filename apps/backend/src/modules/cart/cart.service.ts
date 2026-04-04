import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string) {
    const rows = await this.prisma.cartItem.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });

    return this.formatCart(rows);
  }

  async addItem(userId: string, productId: string, quantity: number) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });

    if (!product) {
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

    if (nextQuantity > product.stock) {
      throw new BadRequestException('Quantity exceeds stock');
    }

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

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (quantity > product.stock) {
      throw new BadRequestException('Quantity exceeds stock');
    }

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

  async clear(userId: string) {
    await this.prisma.cartItem.deleteMany({
      where: { userId },
    });

    return {
      items: [],
      subtotal: 0,
      totalItems: 0,
    };
  }

  private formatCart(rows: Array<{ quantity: number; product: { id: string; name: string; price: number } }>) {
    const items = rows.map((row) => ({
      productId: row.product.id,
      name: row.product.name,
      unitPrice: row.product.price,
      quantity: row.quantity,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      items,
      subtotal,
      totalItems,
    };
  }
}
