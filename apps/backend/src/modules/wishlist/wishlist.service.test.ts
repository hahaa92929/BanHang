import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { WishlistService } from './wishlist.service';

function createWishlistMock() {
  const users = new Map([
    [
      'u-1',
      {
        id: 'u-1',
        fullName: 'Customer Demo',
      },
    ],
  ]);
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
  const priceAlerts = [
    {
      userId: 'u-1',
      productId: 'p-1',
      targetPrice: 19_500_000,
      lastNotifiedPrice: null,
      createdAt: new Date('2026-04-02T10:00:00.000Z'),
      updatedAt: new Date('2026-04-02T10:00:00.000Z'),
    },
  ];
  const wishlistShares = new Map<
    string,
    {
      id: string;
      userId: string;
      token: string;
      title: string | null;
      isActive: boolean;
      expiresAt: Date | null;
      lastViewedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }
  >();

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
      findFirst: async (args: { where: { userId: string; productId: string }; select?: { id: true } }) => {
        const row = wishlist.get(`${args.where.userId}:${args.where.productId}`) ?? null;
        if (!row) {
          return null;
        }

        if (args.select?.id) {
          return { id: row.id };
        }

        return row;
      },
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
    priceAlert: {
      findMany: async (args: { where: { userId: string; isActive: boolean; productId: { in: string[] } } }) =>
        priceAlerts.filter(
          (alert) =>
            alert.userId === args.where.userId &&
            args.where.isActive &&
            args.where.productId.in.includes(alert.productId),
        ),
    },
    wishlistShare: {
      findUnique: async (args: {
        where: { userId?: string; token?: string; id?: string };
        include?: { user?: { select: { id: true; fullName: true } } };
      }) => {
        let share =
          (args.where.userId ? wishlistShares.get(args.where.userId) : null) ??
          [...wishlistShares.values()].find(
            (item) =>
              (args.where.token && item.token === args.where.token) ||
              (args.where.id && item.id === args.where.id),
          ) ??
          null;

        if (!share) {
          return null;
        }

        if (args.include?.user) {
          return {
            ...share,
            user: users.get(share.userId)!,
          };
        }

        return share;
      },
      create: async (args: {
        data: { userId: string; token: string; title?: string; expiresAt?: Date | null };
      }) => {
        const row = {
          id: `ws-${wishlistShares.size + 1}`,
          userId: args.data.userId,
          token: args.data.token,
          title: args.data.title ?? null,
          isActive: true,
          expiresAt: args.data.expiresAt ?? null,
          lastViewedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        wishlistShares.set(row.userId, row);
        return row;
      },
      update: async (args: {
        where: { userId?: string; id?: string };
        data: Record<string, unknown>;
      }) => {
        const share =
          (args.where.userId ? wishlistShares.get(args.where.userId) : null) ??
          [...wishlistShares.values()].find((item) => args.where.id && item.id === args.where.id);
        if (!share) {
          throw new Error('wishlist share not found');
        }
        Object.assign(share, args.data, { updatedAt: new Date() });
        wishlistShares.set(share.userId, share);
        return share;
      },
    },
  };

  const cartService = {
    addItem: async (userId: string, productId: string, quantity: number) => ({
      userId,
      productId,
      quantity,
      totalItems: quantity,
    }),
  };

  return { prisma, wishlist, wishlistShares, cartService };
}

test('wishlist.list addItem and removeItem manage saved products', async () => {
  const { prisma, wishlist, cartService } = createWishlistMock();
  const service = new WishlistService(prisma as never, cartService as never);

  const listed = await service.list('u-1');
  const afterAdd = await service.addItem('u-1', 'p-1');
  const afterRemove = await service.removeItem('u-1', 'p-1');

  assert.equal(listed.total, 1);
  assert.equal(listed.data[0].product.slug, 'iphone-15');
  assert.equal(listed.data[0].priceAlert?.targetPrice, 19_500_000);
  assert.equal(afterAdd.total, 1);
  assert.equal(afterRemove.total, 0);
  assert.equal(wishlist.size, 0);
});

test('wishlist.addItem rejects missing or inactive products', async () => {
  const { prisma, cartService } = createWishlistMock();
  const service = new WishlistService(prisma as never, cartService as never);

  await assert.rejects(
    async () => service.addItem('u-1', 'missing-product'),
    (error: unknown) => error instanceof NotFoundException,
  );

  await assert.rejects(
    async () => service.addItem('u-1', 'p-2'),
    (error: unknown) => error instanceof NotFoundException,
  );
});

test('wishlist.share create view and regenerate manage public share links', async () => {
  const { prisma, wishlistShares, cartService } = createWishlistMock();
  const service = new WishlistService(prisma as never, cartService as never);

  const currentBefore = await service.getCurrentShare('u-1');
  const created = await service.createShare('u-1', {
    title: 'Tech picks',
    expiresInDays: 7,
  });
  const currentAfter = await service.getCurrentShare('u-1');
  const publicView = await service.getSharedWishlist(created.share.token);
  const regenerated = await service.regenerateShare('u-1', {
    title: 'April picks',
  });

  assert.equal(currentBefore.share, null);
  assert.equal(created.share.title, 'Tech picks');
  assert.match(created.share.sharePath, /\/api\/v1\/wishlist\/shared\//);
  assert.equal(currentAfter.share?.token, created.share.token);
  assert.equal(publicView.owner.fullName, 'Customer Demo');
  assert.equal(publicView.total, 1);
  assert.equal(publicView.data[0].product.slug, 'iphone-15');
  assert.equal('priceAlert' in publicView.data[0], false);
  assert.notEqual(regenerated.share.token, created.share.token);
  assert.equal(regenerated.share.title, 'April picks');
  assert.equal(wishlistShares.get('u-1')?.token, regenerated.share.token);

  await assert.rejects(
    async () => service.getSharedWishlist(created.share.token),
    (error: unknown) => error instanceof NotFoundException,
  );
});

test('wishlist.shared rejects missing or expired share tokens', async () => {
  const { prisma, cartService } = createWishlistMock();
  const service = new WishlistService(prisma as never, cartService as never);

  await assert.rejects(
    async () => service.getSharedWishlist('missing-token'),
    (error: unknown) => error instanceof NotFoundException,
  );

  const share = await service.createShare('u-1', {
    expiresInDays: 1,
  });
  await (prisma as any).wishlistShare.update({
    where: { userId: 'u-1' },
    data: {
      expiresAt: new Date(Date.now() - 60_000),
    },
  });

  await assert.rejects(
    async () => service.getSharedWishlist(share.share.token),
    (error: unknown) => error instanceof NotFoundException,
  );
});

test('wishlist.moveToCart removes the saved item after adding the default product selection into cart', async () => {
  const { prisma, wishlist, cartService } = createWishlistMock();
  const service = new WishlistService(prisma as never, cartService as never);

  const moved = await service.moveToCart('u-1', 'p-1');

  assert.equal(moved.success, true);
  assert.equal(moved.movedProductId, 'p-1');
  assert.equal(moved.cart.productId, 'p-1');
  assert.equal(moved.cart.quantity, 1);
  assert.equal(moved.wishlist.total, 0);
  assert.equal(wishlist.size, 0);

  await assert.rejects(
    async () => service.moveToCart('u-1', 'p-1'),
    (error: unknown) => error instanceof NotFoundException,
  );
});
