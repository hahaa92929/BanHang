import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';

function createCartMock() {
  const products = new Map([
    [
      'p-1',
      {
        id: 'p-1',
        slug: 'iphone-15',
        name: 'iPhone 15',
        price: 20_000_000,
        stock: 10,
        status: 'active',
        media: [{ url: 'https://cdn.example.com/p-1.jpg' }],
      },
    ],
    [
      'p-2',
      {
        id: 'p-2',
        slug: 'mouse',
        name: 'Mouse',
        price: 300_000,
        stock: 2,
        status: 'active',
        media: [{ url: 'https://cdn.example.com/p-2.jpg' }],
      },
    ],
  ]);

  const coupons = new Map([
    [
      'WELCOME10',
      {
        id: 'cp-1',
        code: 'WELCOME10',
        type: 'percent',
        value: 10,
        minOrderAmount: 500_000,
        maxDiscount: 300_000,
        usageLimit: null,
        usedCount: 0,
        startsAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 60_000),
        isActive: true,
      },
    ],
  ]);

  const cartItems = new Map<string, { id: string; userId: string; productId: string; quantity: number; createdAt: Date }>();
  const cartCoupons = new Map<string, { userId: string; couponId: string; appliedAt: Date }>();
  const wishlist = new Map<string, { userId: string; productId: string }>();
  let sequence = 1;

  const prisma = {
    product: {
      findUnique: async (args: { where: { id: string } }) => products.get(args.where.id) ?? null,
    },
    cartItem: {
      findMany: async (args: { where: { userId: string } }) =>
        [...cartItems.values()]
          .filter((item) => item.userId === args.where.userId)
          .map((item) => ({
            ...item,
            product: products.get(item.productId)!,
          })),
      findUnique: async (args: { where: { userId_productId: { userId: string; productId: string } } }) =>
        cartItems.get(`${args.where.userId_productId.userId}:${args.where.userId_productId.productId}`) ?? null,
      create: async (args: { data: { userId: string; productId: string; quantity: number } }) => {
        const key = `${args.data.userId}:${args.data.productId}`;
        const row = {
          id: `ci-${sequence++}`,
          userId: args.data.userId,
          productId: args.data.productId,
          quantity: args.data.quantity,
          createdAt: new Date(),
        };
        cartItems.set(key, row);
        return row;
      },
      update: async (args: { where: { id: string }; data: { quantity: number } }) => {
        const row = [...cartItems.values()].find((item) => item.id === args.where.id);
        if (!row) throw new Error('cart item not found');
        row.quantity = args.data.quantity;
        return row;
      },
      deleteMany: async (args: { where: { userId: string; productId?: string } }) => {
        let count = 0;
        for (const [key, row] of cartItems.entries()) {
          if (row.userId !== args.where.userId) continue;
          if (args.where.productId && row.productId !== args.where.productId) continue;
          cartItems.delete(key);
          count += 1;
        }
        return { count };
      },
    },
    coupon: {
      findFirst: async (args: { where: { code: { equals: string } } }) =>
        coupons.get(args.where.code.equals.toUpperCase()) ?? null,
    },
    cartCoupon: {
      findUnique: async (args: { where: { userId: string }; include?: { coupon: true } }) => {
        const row = cartCoupons.get(args.where.userId) ?? null;
        if (!row) return null;
        return args.include?.coupon ? { ...row, coupon: coupons.get('WELCOME10')! } : row;
      },
      upsert: async (args: { where: { userId: string }; create: { userId: string; couponId: string }; update: { couponId: string; appliedAt: Date } }) => {
        const row = {
          userId: args.where.userId,
          couponId: args.update.couponId,
          appliedAt: args.update.appliedAt,
        };
        cartCoupons.set(args.where.userId, row);
        return row;
      },
      deleteMany: async (args: { where: { userId: string } }) => {
        const existed = cartCoupons.delete(args.where.userId);
        return { count: existed ? 1 : 0 };
      },
    },
    wishlistItem: {
      upsert: async (args: { where: { userId_productId: { userId: string; productId: string } }; create: { userId: string; productId: string } }) => {
        wishlist.set(
          `${args.where.userId_productId.userId}:${args.where.userId_productId.productId}`,
          args.create,
        );
        return args.create;
      },
    },
    $transaction: async <T>(callback: (tx: { cartItem: typeof prisma.cartItem; wishlistItem: typeof prisma.wishlistItem }) => Promise<T>) =>
      callback({
        cartItem: prisma.cartItem,
        wishlistItem: prisma.wishlistItem,
      }),
  };

  return { prisma, cartItems, cartCoupons, wishlist };
}

test('cart.addItem merges quantities and computes totals', async () => {
  const { prisma } = createCartMock();
  const service = new CartService(prisma as never);

  await service.addItem('u-1', 'p-1', 1);
  const result = await service.addItem('u-1', 'p-1', 2);

  assert.equal(result.totalItems, 3);
  assert.equal(result.items[0].lineTotal, 60_000_000);
});

test('cart.applyCoupon stores coupon and discounts total', async () => {
  const { prisma, cartCoupons } = createCartMock();
  const service = new CartService(prisma as never);

  await service.addItem('u-1', 'p-1', 1);
  const result = await service.applyCoupon('u-1', 'WELCOME10');

  assert.equal(cartCoupons.size, 1);
  assert.equal(result.discountAmount, 300_000);
});

test('cart.applyCoupon rejects invalid subtotal', async () => {
  const { prisma } = createCartMock();
  const service = new CartService(prisma as never);

  await service.addItem('u-1', 'p-2', 1);

  await assert.rejects(
    async () => service.applyCoupon('u-1', 'WELCOME10'),
    (error: unknown) => error instanceof BadRequestException,
  );
});

test('cart.saveForLater removes line from cart and stores wishlist item', async () => {
  const { prisma, wishlist } = createCartMock();
  const service = new CartService(prisma as never);

  await service.addItem('u-1', 'p-1', 1);
  const result = await service.saveForLater('u-1', 'p-1');

  assert.equal(result.items.length, 0);
  assert.equal(wishlist.size, 1);
});

test('cart.private validators and discount calculator cover stock and coupon branches', async () => {
  const { prisma } = createCartMock();
  const service = new CartService(prisma as never);

  assert.throws(
    () => (service as any).assertStock(2, 3),
    (error: unknown) => error instanceof BadRequestException,
  );

  const fixedDiscount = (service as any).calculateDiscount(
    {
      type: 'fixed',
      value: 150_000,
      maxDiscount: null,
    },
    100_000,
  );
  const percentDiscount = (service as any).calculateDiscount(
    {
      type: 'percent',
      value: 10,
      maxDiscount: 15_000,
    },
    200_000,
  );
  const shippingDiscount = (service as any).calculateDiscount(
    {
      type: 'free_shipping',
      value: 0,
      maxDiscount: null,
    },
    200_000,
  );

  assert.equal(fixedDiscount, 100_000);
  assert.equal(percentDiscount, 15_000);
  assert.equal(shippingDiscount, 0);

  await assert.rejects(
    async () =>
      (service as any).assertCouponValid(
        {
          startsAt: new Date(Date.now() + 60_000),
          expiresAt: new Date(Date.now() + 120_000),
          usageLimit: null,
          usedCount: 0,
          minOrderAmount: 0,
        },
        1_000_000,
      ),
    (error: unknown) => error instanceof BadRequestException,
  );

  await assert.rejects(
    async () =>
      (service as any).assertCouponValid(
        {
          startsAt: new Date(Date.now() - 60_000),
          expiresAt: new Date(Date.now() + 120_000),
          usageLimit: 1,
          usedCount: 1,
          minOrderAmount: 0,
        },
        1_000_000,
      ),
    (error: unknown) => error instanceof BadRequestException,
  );
});
