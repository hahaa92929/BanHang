import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class InventoryService {
  private readonly defaultWarehouseCode = 'MAIN';

  constructor(private readonly prisma: PrismaService) {}

  async checkStock(sku: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { sku },
      include: {
        product: true,
        inventoryLevels: {
          orderBy: [{ createdAt: 'asc' }],
          include: {
            warehouse: true,
          },
        },
      },
    });

    if (variant) {
      return this.toVariantStockResponse(variant, variant.product);
    }

    const product = await this.prisma.product.findUnique({
      where: { sku },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          include: {
            inventoryLevels: {
              orderBy: [{ createdAt: 'asc' }],
              include: {
                warehouse: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      stock: product.stock,
      variants: product.variants.map((item) => this.toVariantSummary(item)),
    };
  }

  async adjust(
    productId: string,
    quantity: number,
    actorId: string,
    note?: string,
    variantId?: string,
    warehouseCode?: string,
  ) {
    const { product, targetVariant } = await this.resolveProductVariant(productId, variantId);

    return this.prisma.$transaction(async (tx) => {
      const warehouse = await this.resolveWarehouseInTx(tx, warehouseCode);
      const inventoryLevel = await tx.inventoryLevel.findUnique({
        where: {
          variantId_warehouseId: {
            variantId: targetVariant.id,
            warehouseId: warehouse.id,
          },
        },
      });

      const currentAvailable = inventoryLevel?.available ?? 0;
      if (currentAvailable + quantity < 0) {
        throw new BadRequestException('Inventory adjustment would make stock negative');
      }

      if (inventoryLevel) {
        await tx.inventoryLevel.update({
          where: {
            variantId_warehouseId: {
              variantId: targetVariant.id,
              warehouseId: warehouse.id,
            },
          },
          data: {
            available: {
              increment: quantity,
            },
          },
        });
      } else {
        await tx.inventoryLevel.create({
          data: {
            productId,
            variantId: targetVariant.id,
            warehouseId: warehouse.id,
            available: quantity,
            reserved: 0,
          },
        });
      }

      await tx.productVariant.update({
        where: { id: targetVariant.id },
        data: {
          stock: {
            increment: quantity,
          },
        },
      });

      await tx.product.update({
        where: { id: productId },
        data: {
          stock: {
            increment: quantity,
          },
        },
      });

      await tx.inventoryMovement.create({
        data: {
          productId,
          variantId: targetVariant.id,
          warehouseId: warehouse.id,
          actorId,
          type: 'adjustment',
          quantity,
          note: note ?? 'Manual inventory adjustment',
        },
      });

      return this.checkStock(targetVariant.sku);
    });
  }

  async transfer(
    productId: string,
    quantity: number,
    actorId: string,
    fromWarehouseCode: string,
    toWarehouseCode: string,
    note?: string,
    variantId?: string,
  ) {
    if (quantity <= 0) {
      throw new BadRequestException('Transfer quantity must be greater than zero');
    }

    const fromCode = fromWarehouseCode.trim().toUpperCase();
    const toCode = toWarehouseCode.trim().toUpperCase();
    if (fromCode === toCode) {
      throw new BadRequestException('Transfer warehouses must be different');
    }

    const { targetVariant } = await this.resolveProductVariant(productId, variantId);

    return this.prisma.$transaction(async (tx) => {
      const [sourceWarehouse, destinationWarehouse] = await Promise.all([
        this.resolveWarehouseInTx(tx, fromCode),
        this.resolveWarehouseInTx(tx, toCode),
      ]);

      const sourceLevel = await tx.inventoryLevel.findUnique({
        where: {
          variantId_warehouseId: {
            variantId: targetVariant.id,
            warehouseId: sourceWarehouse.id,
          },
        },
      });

      if (!sourceLevel || sourceLevel.available < quantity) {
        throw new BadRequestException('Source warehouse does not have enough available stock');
      }

      const destinationLevel = await tx.inventoryLevel.findUnique({
        where: {
          variantId_warehouseId: {
            variantId: targetVariant.id,
            warehouseId: destinationWarehouse.id,
          },
        },
      });

      await tx.inventoryLevel.update({
        where: {
          variantId_warehouseId: {
            variantId: targetVariant.id,
            warehouseId: sourceWarehouse.id,
          },
        },
        data: {
          available: {
            increment: -quantity,
          },
        },
      });

      if (destinationLevel) {
        await tx.inventoryLevel.update({
          where: {
            variantId_warehouseId: {
              variantId: targetVariant.id,
              warehouseId: destinationWarehouse.id,
            },
          },
          data: {
            available: {
              increment: quantity,
            },
          },
        });
      } else {
        await tx.inventoryLevel.create({
          data: {
            productId,
            variantId: targetVariant.id,
            warehouseId: destinationWarehouse.id,
            available: quantity,
            reserved: 0,
          },
        });
      }

      const transferNote = note ?? `Transfer ${sourceWarehouse.code} -> ${destinationWarehouse.code}`;
      await tx.inventoryMovement.create({
        data: {
          productId,
          variantId: targetVariant.id,
          warehouseId: sourceWarehouse.id,
          actorId,
          type: 'transfer',
          quantity: -quantity,
          note: transferNote,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          productId,
          variantId: targetVariant.id,
          warehouseId: destinationWarehouse.id,
          actorId,
          type: 'transfer',
          quantity,
          note: transferNote,
        },
      });

      return this.checkStock(targetVariant.sku);
    });
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
          variant: {
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
      data: await this.prisma.productVariant.findMany({
        where: {
          stock: {
            lte: 5,
          },
          isActive: true,
        },
        orderBy: { stock: 'asc' },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              status: true,
            },
          },
          inventoryLevels: {
            orderBy: [{ createdAt: 'asc' }],
            include: {
              warehouse: true,
            },
          },
        },
      }),
    };
  }

  private toVariantStockResponse(
    variant: {
      id: string;
      sku: string;
      name: string;
      stock: number;
      price: number;
      isDefault: boolean;
      attributes: unknown;
      inventoryLevels: Array<{
        available: number;
        reserved: number;
        warehouse: {
          id: string;
          code: string;
          name: string;
        };
      }>;
    },
    product: {
      id: string;
      sku: string;
      name: string;
      stock: number;
    },
  ) {
    return {
      productId: product.id,
      productSku: product.sku,
      productName: product.name,
      productStock: product.stock,
      variant: this.toVariantSummary(variant),
    };
  }

  private toVariantSummary(variant: {
    id: string;
    sku: string;
    name: string;
    stock: number;
    price: number;
    isDefault: boolean;
    attributes: unknown;
    inventoryLevels: Array<{
      available: number;
      reserved: number;
      warehouse: {
        id: string;
        code: string;
        name: string;
      };
    }>;
  }) {
    return {
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      price: variant.price,
      stock: variant.stock,
      isDefault: variant.isDefault,
      attributes: variant.attributes,
      warehouses: variant.inventoryLevels.map((level) => ({
        id: level.warehouse.id,
        code: level.warehouse.code,
        name: level.warehouse.name,
        available: level.available,
        reserved: level.reserved,
      })),
    };
  }

  private async resolveWarehouseInTx(
    tx: Pick<PrismaService, 'warehouse'>,
    warehouseCode?: string,
  ) {
    const normalizedCode = warehouseCode?.trim().toUpperCase() || this.defaultWarehouseCode;

    if (normalizedCode === this.defaultWarehouseCode) {
      const defaultWarehouse = await tx.warehouse.findFirst({
        where: { isDefault: true },
      });
      if (defaultWarehouse) {
        return defaultWarehouse;
      }
    }

    const existing = await tx.warehouse.findUnique({
      where: { code: normalizedCode },
    });
    if (existing) {
      return existing;
    }

    return tx.warehouse.create({
      data: {
        code: normalizedCode,
        name: normalizedCode === this.defaultWarehouseCode ? 'Main Warehouse' : `${normalizedCode} Warehouse`,
        isDefault: normalizedCode === this.defaultWarehouseCode,
      },
    });
  }

  private async resolveProductVariant(productId: string, variantId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const targetVariant = variantId
      ? product.variants.find((variant) => variant.id === variantId)
      : product.variants.find((variant) => variant.isDefault) ?? product.variants[0];

    if (!targetVariant) {
      throw new NotFoundException('Product variant not found');
    }

    return { product, targetVariant };
  }
}
