import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

function createProductsMock() {
  const calls: {
    countWhere?: unknown;
    findManyArgs: unknown[];
  } = {
    findManyArgs: [],
  };

  const prisma = {
    product: {
      count: async (args: { where: unknown }) => {
        calls.countWhere = args.where;
        return 23;
      },
      findMany: async (args: Record<string, unknown>) => {
        calls.findManyArgs.push(args);

        if (args.distinct) {
          return [{ category: 'Laptop' }, { category: 'Dien thoai' }];
        }

        return [
          {
            id: 'p-1',
            sku: 'SKU-1',
            name: 'Laptop Test',
            category: 'Laptop',
            description: 'Demo',
            price: 2000,
            stock: 10,
            rating: 4.7,
            tags: [],
            createdAt: new Date(),
          },
        ];
      },
      findUnique: async (args: { where: { id: string } }) => {
        if (args.where.id === 'missing') return null;
        return {
          id: args.where.id,
          sku: 'SKU-1',
          name: 'Laptop Test',
          category: 'Laptop',
          description: 'Demo',
          price: 2000,
          stock: 10,
          rating: 4.7,
          tags: [],
          createdAt: new Date(),
        };
      },
    },
  };

  return { prisma, calls };
}

test('products.findAll maps query filters, sorting and paging', async () => {
  const { prisma, calls } = createProductsMock();
  const service = new ProductsService(prisma as never);

  const result = await service.findAll({
    q: 'Laptop',
    category: 'Laptop',
    minPrice: 1000,
    maxPrice: 5000,
    inStock: true,
    sort: 'price_desc',
    page: 2,
    limit: 5,
  });

  assert.equal(result.total, 23);
  assert.equal(result.page, 2);
  assert.equal(result.limit, 5);
  assert.equal(result.totalPages, 5);
  assert.equal(result.data.length, 1);
  assert.deepEqual(result.categories, ['Laptop', 'Dien thoai']);

  const productQuery = calls.findManyArgs[0] as { orderBy: unknown; skip: number; take: number; where: unknown };
  assert.deepEqual(productQuery.orderBy, { price: 'desc' });
  assert.equal(productQuery.skip, 5);
  assert.equal(productQuery.take, 5);

  const where = productQuery.where as {
    OR: unknown[];
    category: unknown;
    price: { gte: number; lte: number };
    stock: { gt: number };
  };
  assert.equal(Array.isArray(where.OR), true);
  assert.deepEqual(where.category, { equals: 'Laptop', mode: 'insensitive' });
  assert.equal(where.price.gte, 1000);
  assert.equal(where.price.lte, 5000);
  assert.deepEqual(where.stock, { gt: 0 });
});

test('products.findAll clamps page to totalPages when page is too large', async () => {
  const { prisma } = createProductsMock();
  const service = new ProductsService(prisma as never);

  const result = await service.findAll({
    page: 999,
    limit: 10,
    sort: 'newest',
  });

  assert.equal(result.totalPages, 3);
  assert.equal(result.page, 3);
});

test('products.listCategories returns category strings', async () => {
  const { prisma } = createProductsMock();
  const service = new ProductsService(prisma as never);

  const categories = await service.listCategories();
  assert.deepEqual(categories, ['Laptop', 'Dien thoai']);
});

test('products.findOne throws NotFoundException for missing product', async () => {
  const { prisma } = createProductsMock();
  const service = new ProductsService(prisma as never);

  await assert.rejects(
    async () => service.findOne('missing'),
    (error: unknown) => error instanceof NotFoundException,
  );
});
