import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CompareService } from './compare.service';

function createCompareMock() {
  const products = [
    {
      id: 'p-1',
      name: 'iPhone 15',
      status: 'active',
      price: 20_000_000,
      rating: 4.8,
      stock: 12,
      tags: ['featured', 'apple'],
      brand: { id: 'b-1', name: 'Apple' },
      category: { id: 'c-1', name: 'Phones' },
      media: [{ id: 'pm-1', url: 'https://cdn.example.com/iphone.jpg', isPrimary: true, sortOrder: 0 }],
      variants: [{ id: 'pv-1', sku: 'IPH15-BLK', name: 'Black', price: 20_000_000, stock: 12 }],
    },
    {
      id: 'p-2',
      name: 'Galaxy S24',
      status: 'active',
      price: 18_000_000,
      rating: 4.7,
      stock: 8,
      tags: ['featured', 'android'],
      brand: { id: 'b-2', name: 'Samsung' },
      category: { id: 'c-1', name: 'Phones' },
      media: [{ id: 'pm-2', url: 'https://cdn.example.com/galaxy.jpg', isPrimary: true, sortOrder: 0 }],
      variants: [{ id: 'pv-2', sku: 'S24-GRY', name: 'Gray', price: 18_000_000, stock: 8 }],
    },
    {
      id: 'p-3',
      name: 'AirPods Pro 2',
      status: 'active',
      price: 5_500_000,
      rating: 4.9,
      stock: 20,
      tags: ['audio'],
      brand: { id: 'b-1', name: 'Apple' },
      category: { id: 'c-2', name: 'Audio' },
      media: [{ id: 'pm-3', url: 'https://cdn.example.com/airpods.jpg', isPrimary: true, sortOrder: 0 }],
      variants: [{ id: 'pv-3', sku: 'AIRPODS', name: 'Default', price: 5_500_000, stock: 20 }],
    },
    {
      id: 'p-4',
      name: 'MacBook Air',
      status: 'active',
      price: 28_000_000,
      rating: 4.9,
      stock: 5,
      tags: ['laptop'],
      brand: { id: 'b-1', name: 'Apple' },
      category: { id: 'c-3', name: 'Laptops' },
      media: [{ id: 'pm-4', url: 'https://cdn.example.com/mba.jpg', isPrimary: true, sortOrder: 0 }],
      variants: [{ id: 'pv-4', sku: 'MBA', name: 'Default', price: 28_000_000, stock: 5 }],
    },
    {
      id: 'p-5',
      name: 'Archived Product',
      status: 'archived',
      price: 1,
      rating: 0,
      stock: 0,
      tags: [],
      brand: null,
      category: null,
      media: [],
      variants: [],
    },
    {
      id: 'p-6',
      name: 'Sony WH-1000XM5',
      status: 'active',
      price: 8_000_000,
      rating: 4.8,
      stock: 7,
      tags: ['audio'],
      brand: { id: 'b-3', name: 'Sony' },
      category: { id: 'c-2', name: 'Audio' },
      media: [{ id: 'pm-6', url: 'https://cdn.example.com/sony.jpg', isPrimary: true, sortOrder: 0 }],
      variants: [{ id: 'pv-6', sku: 'SONY-XM5', name: 'Default', price: 8_000_000, stock: 7 }],
    },
  ];

  const compareItems = [
    {
      id: 'cmp-1',
      userId: 'u-1',
      productId: 'p-1',
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
    },
    {
      id: 'cmp-2',
      userId: 'u-1',
      productId: 'p-2',
      createdAt: new Date('2026-04-02T00:00:00.000Z'),
    },
  ];

  const prisma = {
    compareItem: {
      findMany: async (args: { where: { userId: string } }) =>
        compareItems
          .filter((item) => item.userId === args.where.userId)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
          .map((item) => ({
            ...item,
            product: products.find((product) => product.id === item.productId)!,
          })),
      findUnique: async (args: { where: { userId_productId: { userId: string; productId: string } }; select?: { id: true } }) => {
        const item =
          compareItems.find(
            (row) =>
              row.userId === args.where.userId_productId.userId &&
              row.productId === args.where.userId_productId.productId,
          ) ?? null;
        if (!item || !args.select) {
          return item;
        }
        return { id: item.id };
      },
      count: async (args: { where: { userId: string } }) =>
        compareItems.filter((item) => item.userId === args.where.userId).length,
      upsert: async (args: {
        where: { userId_productId: { userId: string; productId: string } };
        create: { userId: string; productId: string };
      }) => {
        const existing = compareItems.find(
          (item) =>
            item.userId === args.where.userId_productId.userId &&
            item.productId === args.where.userId_productId.productId,
        );
        if (existing) {
          return existing;
        }
        const created = {
          id: `cmp-${compareItems.length + 1}`,
          createdAt: new Date(),
          ...args.create,
        };
        compareItems.push(created);
        return created;
      },
      deleteMany: async (args: { where: { userId: string; productId?: string } }) => {
        const before = compareItems.length;
        for (let index = compareItems.length - 1; index >= 0; index -= 1) {
          const item = compareItems[index];
          if (
            item.userId === args.where.userId &&
            (args.where.productId === undefined || item.productId === args.where.productId)
          ) {
            compareItems.splice(index, 1);
          }
        }
        return { count: before - compareItems.length };
      },
    },
    product: {
      findUnique: async (args: { where: { id: string }; select?: { id: true; status: true } }) => {
        const product = products.find((item) => item.id === args.where.id) ?? null;
        if (!product || !args.select) {
          return product;
        }
        return {
          id: product.id,
          status: product.status,
        };
      },
    },
  };

  return {
    prisma,
    compareItems,
  };
}

test('compare.list add remove and clear manage compare products', async () => {
  const mock = createCompareMock();
  const service = new CompareService(mock.prisma as never);

  const before = await service.list('u-1');
  const added = await service.addItem('u-1', 'p-3');
  const removed = await service.removeItem('u-1', 'p-1');
  const cleared = await service.clear('u-1');

  assert.equal(before.total, 2);
  assert.deepEqual(before.differingFields.sort(), ['brand', 'price', 'rating', 'stock', 'tags', 'variants']);
  assert.equal(added.total, 3);
  assert.equal(added.maxItems, 4);
  assert.equal(removed.total, 2);
  assert.equal(cleared.total, 0);
  assert.equal(mock.compareItems.length, 0);
});

test('compare.addItem rejects archived products and compare overflow', async () => {
  const mock = createCompareMock();
  const service = new CompareService(mock.prisma as never);

  await service.addItem('u-1', 'p-3');
  await service.addItem('u-1', 'p-4');

  await assert.rejects(
    async () => service.addItem('u-1', 'p-5'),
    (error: unknown) => error instanceof NotFoundException,
  );

  await assert.rejects(
    async () => service.addItem('u-1', 'p-999'),
    (error: unknown) => error instanceof NotFoundException,
  );

  await assert.rejects(
    async () => service.addItem('u-1', 'p-6'),
    (error: unknown) => error instanceof BadRequestException,
  );
});
