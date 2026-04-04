import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async checkStock(sku: string) {
    const product = await this.prisma.product.findUnique({
      where: { sku },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      stock: product.stock,
    };
  }

  async adjust(productId: string, quantity: number, actorId: string, note?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        stock: {
          increment: quantity,
        },
      },
    });

    await this.prisma.inventoryMovement.create({
      data: {
        productId,
        actorId,
        type: 'adjustment',
        quantity,
        note: note ?? 'Manual inventory adjustment',
      },
    });

    return updated;
  }

  async movements() {
    return {
      data: await this.prisma.inventoryMovement.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
            },
          },
          warehouse: true,
        },
      }),
    };
  }

  async lowStock() {
    return {
      data: await this.prisma.product.findMany({
        where: {
          stock: {
            lte: 5,
          },
          status: 'active',
        },
        orderBy: { stock: 'asc' },
      }),
    };
  }
}
