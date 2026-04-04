import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartService } from './cart.service';

type ProductRecord = { id: string; name: string; price: number; stock: number };
type CartRow = { id: string; userId: string; productId: string; quantity: number; createdAt: Date };

function createCartMock() {
  const products = new Map<string, ProductRecord>([
    ['p-1', { id: 'p-1', name: 'Laptop', price: 2000, stock: 10 }],
    ['p-2', { id: 'p-2', name: 'Mouse', price: 300, stock: 2 }],
  ]);

  const cartRows = new Map<string, CartRow>();
  let idCounter = 1;

  const prisma = {
    product: {
      findUnique: async (args: { where: { id: string } }) => products.get(args.where.id) ?? null,
    },
    cartItem: {
      findMany: async (args: { where: { userId: string } }) => {
        const rows = [...cartRows.values()].filter((row) => row.userId === args.where.userId);
        return rows.map((row) => ({
          ...row,
          product: products.get(row.productId)!,
        }));
      },
      findUnique: async (args: { where: { userId_productId: { userId: string; productId: string } } }) => {
        const key = `${args.where.userId_productId.userId}:${args.where.userId_productId.productId}`;
        return cartRows.get(key) ?? null;
      },
      create: async (args: { data: { userId: string; productId: string; quantity: number } }) => {
        const key = `${args.data.userId}:${args.data.productId}`;
        const row: CartRow = {
          id: `ci-${idCounter++}`,
          userId: args.data.userId,
          productId: args.data.productId,
          quantity: args.data.quantity,
          createdAt: new Date(),
        };
        cartRows.set(key, row);
        return row;
      },
      update: async (args: { where: { id: string }; data: { quantity: number } }) => {
        const row = [...cartRows.values()].find((item) => item.id === args.where.id);
        if (!row) throw new Error('not found');
        row.quantity = args.data.quantity;
        return row;
      },
      deleteMany: async (args: { where: { userId: string; productId?: string } }) => {
        let count = 0;
        for (const [key, row] of cartRows.entries()) {
          if (row.userId !== args.where.userId) continue;
          if (args.where.productId && row.productId !== args.where.productId) continue;
          cartRows.delete(key);
          count += 1;
        }
        return { count };
      },
    },
  };

  return { prisma, cartRows };
}

test('cart.addItem creates cart line when item does not exist', async () => {
  const { prisma } = createCartMock();
  const service = new CartService(prisma as never);

  const result = await service.addItem('u-1', 'p-1', 2);

  assert.equal(result.totalItems, 2);
  assert.equal(result.subtotal, 4000);
  assert.equal(result.items.length, 1);
});

test('cart.addItem increments quantity when item already exists', async () => {
  const { prisma } = createCartMock();
  const service = new CartService(prisma as never);

  await service.addItem('u-1', 'p-1', 2);
  const result = await service.addItem('u-1', 'p-1', 3);

  assert.equal(result.items[0].quantity, 5);
  assert.equal(result.subtotal, 10000);
});

test('cart.addItem throws BadRequestException when quantity exceeds stock', async () => {
  const { prisma } = createCartMock();
  const service = new CartService(prisma as never);

  await assert.rejects(
    async () => service.addItem('u-1', 'p-2', 5),
    (error: unknown) => error instanceof BadRequestException,
  );
});

test('cart.setQuantity updates item quantity', async () => {
  const { prisma } = createCartMock();
  const service = new CartService(prisma as never);

  await service.addItem('u-1', 'p-1', 1);
  const result = await service.setQuantity('u-1', 'p-1', 4);

  assert.equal(result.items[0].quantity, 4);
  assert.equal(result.subtotal, 8000);
});

test('cart.setQuantity throws NotFoundException when line item missing', async () => {
  const { prisma } = createCartMock();
  const service = new CartService(prisma as never);

  await assert.rejects(
    async () => service.setQuantity('u-1', 'p-1', 2),
    (error: unknown) => error instanceof NotFoundException,
  );
});

test('cart.removeItem removes one product line', async () => {
  const { prisma } = createCartMock();
  const service = new CartService(prisma as never);

  await service.addItem('u-1', 'p-1', 1);
  await service.addItem('u-1', 'p-2', 1);

  const result = await service.removeItem('u-1', 'p-2');

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].productId, 'p-1');
});

test('cart.clear removes all lines and returns empty summary', async () => {
  const { prisma } = createCartMock();
  const service = new CartService(prisma as never);

  await service.addItem('u-1', 'p-1', 1);
  const result = await service.clear('u-1');

  assert.deepEqual(result, { items: [], subtotal: 0, totalItems: 0 });
});
