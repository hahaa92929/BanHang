import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';

function createCartMock() {
  const products = new Map([
    [
      'p-1',
      {
        id: 'p-1',
        sku: 'SKU-1',
        slug: 'iphone-15',
        name: 'iPhone 15',
        price: 20_000_000,
        stock: 14,
        status: 'active',
        media: [{ url: 'https://cdn.example.com/p-1.jpg' }],
      },
    ],
    [
      'p-2',
      {
        id: 'p-2',
        sku: 'SKU-2',
        slug: 'mouse',
        name: 'Mouse',
        price: 300_000,
        stock: 2,
        status: 'active',
        media: [{ url: 'https://cdn.example.com/p-2.jpg' }],
      },
    ],
  ]);
  const variants = new Map([
    [
      'pv-1',
      {
        id: 'pv-1',
        productId: 'p-1',
        sku: 'SKU-1-DEFAULT',
        name: 'Black 128GB',
        price: 20_000_000,
        stock: 10,
        isDefault: true,
        isActive: true,
        attributes: { color: 'Black' },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ],
    [
      'pv-2',
      {
        id: 'pv-2',
        productId: 'p-1',
        sku: 'SKU-1-BLUE',
        name: 'Blue 256GB',
        price: 21_000_000,
        stock: 4,
        isDefault: false,
        isActive: true,
        attributes: { color: 'Blue', storage: '256GB' },
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ],
    [
      'pv-3',
      {
        id: 'pv-3',
        productId: 'p-2',
        sku: 'SKU-2-DEFAULT',
        name: 'Standard',
        price: 300_000,
        stock: 2,
        isDefault: true,
        isActive: true,
        attributes: null,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
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

  const cartItems = new Map<string, { id: string; userId: string; productId: string; variantId: string; quantity: number; createdAt: Date; updatedAt: Date }>();
  const cartCoupons = new Map<string, { userId: string; couponId: string; appliedAt: Date }>();
  const wishlist = new Map<string, { userId: string; productId: string }>();
  let sequence = 1;

  function listProductVariants(productId: string) {
    return [...variants.values()]
      .filter((variant) => variant.productId === productId && variant.isActive)
      .sort((left, right) => Number(right.isDefault) - Number(left.isDefault));
  }

  const prisma = {
    product: {
      findUnique: async (args: { where: { id: string }; include?: { variants?: true | Record<string, unknown> } }) => {
        const product = products.get(args.where.id) ?? null;
        if (!product) {
          return null;
        }

        if (args.include?.variants) {
          return {
            ...product,
            variants: listProductVariants(product.id),
          };
        }

        return product;
      },
    },
    cartItem: {
      findMany: async (args: {
        where: { userId: string; productId?: string };
        include?: { product?: { include?: { media?: true | Record<string, unknown> } }; variant?: true };
        select?: { id?: true; variantId?: true };
      }) => {
        let rows = [...cartItems.values()].filter((item) => item.userId === args.where.userId);

        if (args.where.productId) {
          rows = rows.filter((item) => item.productId === args.where.productId);
        }

        if (args.select) {
          return rows.map((item) => ({
            id: args.select?.id ? item.id : undefined,
            variantId: args.select?.variantId ? item.variantId : undefined,
          }));
        }

        return rows.map((item) => ({
          ...item,
          product: args.include?.product ? products.get(item.productId)! : undefined,
          variant: args.include?.variant ? variants.get(item.variantId)! : undefined,
        }));
      },
      findFirst: async (args: { where: { userId: string; productId: string; variantId: string } }) =>
        [...cartItems.values()].find(
          (item) =>
            item.userId === args.where.userId &&
            item.productId === args.where.productId &&
            item.variantId === args.where.variantId,
        ) ?? null,
      create: async (args: { data: { userId: string; productId: string; variantId: string; quantity: number } }) => {
        const key = `${args.data.userId}:${args.data.productId}:${args.data.variantId}`;
        const row = {
          id: `ci-${sequence++}`,
          userId: args.data.userId,
          productId: args.data.productId,
          variantId: args.data.variantId,
          quantity: args.data.quantity,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        cartItems.set(key, row);
        return row;
      },
      update: async (args: { where: { id: string }; data: { quantity: number } }) => {
        const row = [...cartItems.values()].find((item) => item.id === args.where.id);
        if (!row) throw new Error('cart item not found');
        row.quantity = args.data.quantity;
        row.updatedAt = new Date();
        return row;
      },
      deleteMany: async (args: { where: { userId?: string; productId?: string; variantId?: string; id?: string } }) => {
        let count = 0;
        for (const [key, row] of cartItems.entries()) {
          if (args.where.userId && row.userId !== args.where.userId) continue;
          if (args.where.productId && row.productId !== args.where.productId) continue;
          if (args.where.variantId && row.variantId !== args.where.variantId) continue;
          if (args.where.id && row.id !== args.where.id) continue;
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
  assert.equal(result.items[0].variantSku, 'SKU-1-DEFAULT');
});

test('cart.addItem keeps different variants as separate lines', async () => {
  const { prisma } = createCartMock();
  const service = new CartService(prisma as never);

  await service.addItem('u-1', 'p-1', 1, 'pv-1');
  const result = await service.addItem('u-1', 'p-1', 1, 'pv-2');

  assert.equal(result.items.length, 2);
  assert.equal(result.totalItems, 2);
  assert.equal(result.items.some((item) => item.variantId === 'pv-2'), true);
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

  await service.addItem('u-1', 'p-1', 1, 'pv-2');
  const result = await service.saveForLater('u-1', 'p-1', 'pv-2');

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
