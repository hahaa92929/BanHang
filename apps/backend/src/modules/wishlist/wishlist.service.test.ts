import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { WishlistService } from './wishlist.service';

function createWishlistMock() {
  const products = new Map([
    [
      'p-1',
      {
        id: 'p-1',
        slug: 'iphone-15',
        name: 'iPhone 15',
        price: 20_000_000,
        stock: 8,
        status: 'active',
        category: { id: 'c-1', name: 'Phones' },
        brand: { id: 'b-1', name: 'Apple' },
        media: [{ url: 'https://cdn.example.com/p-1.jpg' }],
      },
    ],
    [
      'p-2',
      {
        id: 'p-2',
        slug: 'galaxy-s24',
        name: 'Galaxy S24',
        price: 18_000_000,
        stock: 0,
        status: 'archived',
        category: { id: 'c-1', name: 'Phones' },
        brand: { id: 'b-2', name: 'Samsung' },
        media: [{ url: 'https://cdn.example.com/p-2.jpg' }],
      },
    ],
  ]);
  const wishlist = new Map<string, { id: string; userId: string; productId: string; createdAt: Date }>([
    [
      'u-1:p-1',
      {
        id: 'w-1',
        userId: 'u-1',
        productId: 'p-1',
        createdAt: new Date('2026-04-01T10:00:00.000Z'),
      },
    ],
  ]);

  const prisma = {
    product: {
      findUnique: async (args: { where: { id: string } }) => products.get(args.where.id) ?? null,
    },
    wishlistItem: {
      findMany: async (args: { where: { userId: string } }) =>
        [...wishlist.values()]
          .filter((item) => item.userId === args.where.userId)
          .map((item) => ({
            ...item,
            product: products.get(item.productId),
          })),
      upsert: async (args: {
        where: { userId_productId: { userId: string; productId: string } };
        create: { userId: string; productId: string };
      }) => {
        const key = `${args.where.userId_productId.userId}:${args.where.userId_productId.productId}`;
        if (!wishlist.has(key)) {
          wishlist.set(key, {
            id: `w-${wishlist.size + 1}`,
            userId: args.create.userId,
            productId: args.create.productId,
            createdAt: new Date(),
          });
        }
        return wishlist.get(key);
      },
      deleteMany: async (args: { where: { userId: string; productId: string } }) => {
        wishlist.delete(`${args.where.userId}:${args.where.productId}`);
        return { count: 1 };
      },
    },
  };

  return { prisma, wishlist };
}

test('wishlist.list addItem and removeItem manage saved products', async () => {
  const { prisma, wishlist } = createWishlistMock();
  const service = new WishlistService(prisma as never);

  const listed = await service.list('u-1');
  const afterAdd = await service.addItem('u-1', 'p-1');
  const afterRemove = await service.removeItem('u-1', 'p-1');

  assert.equal(listed.total, 1);
  assert.equal(listed.data[0].product.slug, 'iphone-15');
  assert.equal(afterAdd.total, 1);
  assert.equal(afterRemove.total, 0);
  assert.equal(wishlist.size, 0);
});

test('wishlist.addItem rejects missing or inactive products', async () => {
  const { prisma } = createWishlistMock();
  const service = new WishlistService(prisma as never);

  await assert.rejects(
    async () => service.addItem('u-1', 'missing-product'),
    (error: unknown) => error instanceof NotFoundException,
  );

  await assert.rejects(
    async () => service.addItem('u-1', 'p-2'),
    (error: unknown) => error instanceof NotFoundException,
  );
});
