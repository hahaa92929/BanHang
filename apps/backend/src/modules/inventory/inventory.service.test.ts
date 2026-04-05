import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';

function createInventoryMock() {
  const products = [
    {
      id: 'p-1',
      sku: 'SKU-1',
      name: 'iPhone 15',
      stock: 8,
      status: 'active',
    },
  ];
  const variants = [
    {
      id: 'pv-1',
      productId: 'p-1',
      sku: 'SKU-1-BLACK',
      name: 'Black 128GB',
      price: 20_000_000,
      stock: 5,
      isDefault: true,
      isActive: true,
      attributes: { color: 'Black' },
      createdAt: new Date(),
    },
    {
      id: 'pv-2',
      productId: 'p-1',
      sku: 'SKU-1-BLUE',
      name: 'Blue 128GB',
      price: 20_500_000,
      stock: 3,
      isDefault: false,
      isActive: true,
      attributes: { color: 'Blue' },
      createdAt: new Date(),
    },
  ];
  const warehouses = [
    {
      id: 'w-main',
      code: 'MAIN',
      name: 'Main Warehouse',
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const inventoryLevels = [
    {
      id: 'il-1',
      productId: 'p-1',
      variantId: 'pv-1',
      warehouseId: 'w-main',
      available: 5,
      reserved: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'il-2',
      productId: 'p-1',
      variantId: 'pv-2',
      warehouseId: 'w-main',
      available: 3,
      reserved: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const movements: Array<Record<string, unknown>> = [];

  function materializeVariant(variant: (typeof variants)[number]) {
    return {
      ...variant,
      product: products.find((product) => product.id === variant.productId)!,
      inventoryLevels: inventoryLevels
        .filter((level) => level.variantId === variant.id)
        .map((level) => ({
          ...level,
          warehouse: warehouses.find((warehouse) => warehouse.id === level.warehouseId)!,
        })),
    };
  }

  function materializeProduct(product: (typeof products)[number]) {
    return {
      ...product,
      variants: variants
        .filter((variant) => variant.productId === product.id && variant.isActive)
        .sort((left, right) => Number(right.isDefault) - Number(left.isDefault))
        .map((variant) => materializeVariant(variant)),
    };
  }

  const tx = {
    warehouse: {
      findFirst: async () => warehouses.find((warehouse) => warehouse.isDefault) ?? null,
      findUnique: async (args: { where: { code: string } }) =>
        warehouses.find((warehouse) => warehouse.code === args.where.code) ?? null,
      create: async (args: { data: Record<string, unknown> }) => {
        const warehouse = {
          id: `w-${warehouses.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.data,
        } as (typeof warehouses)[number];
        warehouses.push(warehouse);
        return warehouse;
      },
    },
    inventoryLevel: {
      findUnique: async (args: { where: { variantId_warehouseId: { variantId: string; warehouseId: string } } }) =>
        inventoryLevels.find(
          (level) =>
            level.variantId === args.where.variantId_warehouseId.variantId &&
            level.warehouseId === args.where.variantId_warehouseId.warehouseId,
        ) ?? null,
      update: async (args: {
        where: { variantId_warehouseId: { variantId: string; warehouseId: string } };
        data: { available: { increment: number } };
      }) => {
        const level = inventoryLevels.find(
          (item) =>
            item.variantId === args.where.variantId_warehouseId.variantId &&
            item.warehouseId === args.where.variantId_warehouseId.warehouseId,
        );
        if (!level) {
          throw new Error('inventory level not found');
        }
        level.available += args.data.available.increment;
        level.updatedAt = new Date();
        return level;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const level = {
          id: `il-${inventoryLevels.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.data,
        } as (typeof inventoryLevels)[number];
        inventoryLevels.push(level);
        return level;
      },
    },
    productVariant: {
      update: async (args: { where: { id: string }; data: { stock: { increment: number } } }) => {
        const variant = variants.find((item) => item.id === args.where.id);
        if (!variant) {
          throw new Error('variant not found');
        }
        variant.stock += args.data.stock.increment;
        return variant;
      },
    },
    product: {
      update: async (args: { where: { id: string }; data: { stock: { increment: number } } }) => {
        const product = products.find((item) => item.id === args.where.id);
        if (!product) {
          throw new Error('product not found');
        }
        product.stock += args.data.stock.increment;
        return product;
      },
    },
    inventoryMovement: {
      create: async (args: { data: Record<string, unknown> }) => {
        movements.push(args.data);
        return args.data;
      },
      findMany: async () =>
        movements.map((movement) => ({
          ...movement,
          product: products.find((product) => product.id === movement.productId),
          variant: variants.find((variant) => variant.id === movement.variantId),
          warehouse: warehouses.find((warehouse) => warehouse.id === movement.warehouseId),
        })),
    },
  };

  const prisma = {
    product: {
      findUnique: async (args: { where: { id?: string; sku?: string }; include?: { variants: true } }) => {
        const product = args.where.id
          ? products.find((item) => item.id === args.where.id) ?? null
          : args.where.sku
            ? products.find((item) => item.sku === args.where.sku) ?? null
            : null;
        if (!product) {
          return null;
        }
        return args.include ? materializeProduct(product) : product;
      },
    },
    productVariant: {
      findUnique: async (args: { where: { sku: string }; include?: { product: true; inventoryLevels: true } }) => {
        const variant = variants.find((item) => item.sku === args.where.sku) ?? null;
        if (!variant) {
          return null;
        }
        return args.include ? materializeVariant(variant) : variant;
      },
      findMany: async (args?: { where?: { stock?: { lte?: number }; isActive?: boolean }; orderBy?: { stock?: 'asc' | 'desc' } }) => {
        let rows = [...variants];

        if (typeof args?.where?.stock?.lte === 'number') {
          rows = rows.filter((variant) => variant.stock <= args.where!.stock!.lte!);
        }

        if (typeof args?.where?.isActive === 'boolean') {
          rows = rows.filter((variant) => variant.isActive === args.where!.isActive);
        }

        if (args?.orderBy?.stock === 'asc') {
          rows.sort((left, right) => left.stock - right.stock);
        } else if (args?.orderBy?.stock === 'desc') {
          rows.sort((left, right) => right.stock - left.stock);
        }

        return rows.map((variant) => materializeVariant(variant));
      },
    },
    inventoryMovement: tx.inventoryMovement,
    warehouse: tx.warehouse,
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
  };

  return {
    prisma,
    products,
    variants,
    warehouses,
    inventoryLevels,
    movements,
  };
}

test('inventory.checkStock returns product variants and warehouse breakdown', async () => {
  const mock = createInventoryMock();
  const service = new InventoryService(mock.prisma as never);

  const productStock = await service.checkStock('SKU-1');
  const variantStock = await service.checkStock('SKU-1-BLACK');

  assert.equal(productStock.stock, 8);
  assert.equal(productStock.variants.length, 2);
  assert.equal(productStock.variants[0].warehouses[0].code, 'MAIN');
  assert.equal(variantStock.variant.sku, 'SKU-1-BLACK');
  assert.equal(variantStock.variant.warehouses[0].available, 5);
});

test('inventory.adjust updates variant and warehouse stock', async () => {
  const mock = createInventoryMock();
  const service = new InventoryService(mock.prisma as never);

  const adjusted = await service.adjust('p-1', 2, 'u-admin', 'Restock', 'pv-2', 'HN');

  assert.equal(adjusted.variant.sku, 'SKU-1-BLUE');
  assert.equal(mock.products[0].stock, 10);
  assert.equal(mock.variants.find((variant) => variant.id === 'pv-2')?.stock, 5);
  assert.equal(mock.inventoryLevels.find((level) => level.variantId === 'pv-2' && level.warehouseId !== 'w-main')?.available, 2);
  assert.equal(mock.warehouses.some((warehouse) => warehouse.code === 'HN'), true);
  assert.equal(mock.movements.length, 1);
});

test('inventory.transfer moves available stock between warehouses without changing aggregate stock', async () => {
  const mock = createInventoryMock();
  const service = new InventoryService(mock.prisma as never);

  await service.adjust('p-1', 2, 'u-admin', 'Seed HN stock', 'pv-1', 'HN');
  const transferred = await service.transfer('p-1', 2, 'u-admin', 'MAIN', 'HN', 'Rebalance', 'pv-1');

  assert.equal(transferred.variant.sku, 'SKU-1-BLACK');
  assert.equal(mock.products[0].stock, 10);
  assert.equal(mock.variants.find((variant) => variant.id === 'pv-1')?.stock, 7);
  assert.equal(
    mock.inventoryLevels.find((level) => level.variantId === 'pv-1' && level.warehouseId === 'w-main')?.available,
    3,
  );
  assert.equal(
    mock.inventoryLevels.find((level) => level.variantId === 'pv-1' && level.warehouseId !== 'w-main')?.available,
    4,
  );
  assert.equal(mock.movements.filter((movement) => movement.type === 'transfer').length, 2);
});

test('inventory.lowStock and negative adjustment validation work', async () => {
  const mock = createInventoryMock();
  const service = new InventoryService(mock.prisma as never);

  const lowStock = await service.lowStock();
  assert.equal(lowStock.data[0].sku, 'SKU-1-BLUE');

  await assert.rejects(
    async () => service.adjust('p-1', -6, 'u-admin', 'Invalid', 'pv-1', 'MAIN'),
    (error: unknown) => error instanceof BadRequestException,
  );

  await assert.rejects(
    async () => service.transfer('p-1', 1, 'u-admin', 'MAIN', 'MAIN', 'Invalid transfer', 'pv-1'),
    (error: unknown) => error instanceof BadRequestException,
  );

  await assert.rejects(
    async () => service.transfer('p-1', 99, 'u-admin', 'MAIN', 'HN', 'Invalid transfer', 'pv-1'),
    (error: unknown) => error instanceof BadRequestException,
  );

  await assert.rejects(
    async () => service.checkStock('UNKNOWN-SKU'),
    (error: unknown) => error instanceof NotFoundException,
  );
});
