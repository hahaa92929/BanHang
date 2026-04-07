import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AccountService } from './account.service';

function createAccountMock() {
  const now = new Date('2026-04-05T10:00:00.000Z');
  const users = [
    {
      id: 'u-1',
      email: 'customer@example.com',
      passwordHash: '$2b$12$5C8ORuDwWx.TWYJBr0GzDeP/MvVVTzRFvsAHoVrvO6P9xdWfmt3ZW',
      fullName: 'Nguyen Van A',
      phone: '0909123456',
      role: 'customer',
      referralCode: 'REFA123',
      emailVerifiedAt: new Date('2026-04-01T00:00:00.000Z'),
      twoFactorEnabledAt: null,
      lastLoginAt: new Date('2026-04-05T08:00:00.000Z'),
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: now,
    },
    {
      id: 'u-2',
      email: 'friend@example.com',
      passwordHash: '$2b$12$5C8ORuDwWx.TWYJBr0GzDeP/MvVVTzRFvsAHoVrvO6P9xdWfmt3ZW',
      fullName: 'Tran Thi B',
      phone: null,
      role: 'customer',
      referralCode: 'FRIEND1',
      emailVerifiedAt: new Date('2026-04-02T00:00:00.000Z'),
      twoFactorEnabledAt: null,
      lastLoginAt: null,
      createdAt: new Date('2026-04-02T00:00:00.000Z'),
      updatedAt: now,
    },
  ];
  const addresses = [
    {
      id: 'addr-1',
      userId: 'u-1',
      label: 'Home',
      fullName: 'Nguyen Van A',
      phone: '0909123456',
      province: 'Ho Chi Minh',
      district: 'District 1',
      ward: 'Ben Nghe',
      addressLine: '123 Nguyen Hue',
      country: 'Viet Nam',
      isDefault: true,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    },
    {
      id: 'addr-2',
      userId: 'u-1',
      label: 'Office',
      fullName: 'Nguyen Van A',
      phone: '0909123456',
      province: 'Ho Chi Minh',
      district: 'District 3',
      ward: 'Vo Thi Sau',
      addressLine: '99 Cach Mang Thang 8',
      country: 'Viet Nam',
      isDefault: false,
      createdAt: new Date('2026-04-02T00:00:00.000Z'),
      updatedAt: new Date('2026-04-02T00:00:00.000Z'),
    },
  ];
  const orders = [
    {
      id: 'ord-1',
      userId: 'u-1',
      orderNumber: 'ORD-1',
      status: 'completed',
      paymentStatus: 'paid',
      shippingStatus: 'delivered',
      trackingCode: 'TRK-1',
      total: 1_500_000,
      completedAt: new Date('2026-04-05T00:00:00.000Z'),
      createdAt: new Date('2026-04-04T00:00:00.000Z'),
      items: [{ id: 'oi-1', productId: 'p-1', variantId: 'pv-1', name: 'iPhone 15', quantity: 1 }],
      payments: [{ id: 'pay-1', status: 'paid' }],
      history: [{ id: 'hist-1', toStatus: 'completed', createdAt: new Date('2026-04-05T00:00:00.000Z') }],
    },
    {
      id: 'ord-2',
      userId: 'u-1',
      orderNumber: 'ORD-2',
      status: 'shipping',
      paymentStatus: 'authorized',
      shippingStatus: 'in_transit',
      trackingCode: 'TRK-2',
      total: 300_000,
      completedAt: null,
      createdAt: new Date('2026-04-03T00:00:00.000Z'),
      items: [{ id: 'oi-2', productId: 'p-2', variantId: 'pv-2', name: 'AirPods Pro', quantity: 1 }],
      payments: [],
      history: [],
    },
  ];
  const wishlistItems = [
    { id: 'w-1', userId: 'u-1', productId: 'p-1', createdAt: now },
  ];
  const cartItems = [
    { id: 'ci-1', userId: 'u-1', productId: 'p-1', variantId: 'pv-1', quantity: 1 },
  ];
  const cartCoupons = [
    { userId: 'u-1', couponId: 'coupon-1' },
  ];
  const notifications = [
    { id: 'n-1', userId: 'u-1', isRead: false, createdAt: now },
    { id: 'n-2', userId: 'u-1', isRead: true, createdAt: now },
  ];
  const products = [
    {
      id: 'p-1',
      sku: 'SKU-1',
      name: 'iPhone 15',
      status: 'active',
      stock: 3,
      totalSold: 10,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      brand: { id: 'b-1', name: 'Apple' },
      category: { id: 'c-1', name: 'Phones' },
      media: [{ id: 'm-1', url: 'https://example.com/p1.jpg', isPrimary: true, sortOrder: 0 }],
    },
    {
      id: 'p-2',
      sku: 'SKU-2',
      name: 'AirPods Pro',
      status: 'active',
      stock: 6,
      totalSold: 20,
      createdAt: new Date('2026-04-02T00:00:00.000Z'),
      brand: { id: 'b-1', name: 'Apple' },
      category: { id: 'c-2', name: 'Audio' },
      media: [{ id: 'm-2', url: 'https://example.com/p2.jpg', isPrimary: true, sortOrder: 0 }],
    },
  ];
  const productVariants = [
    {
      id: 'pv-1',
      productId: 'p-1',
      sku: 'SKU-1-BLACK',
      name: 'Black 128GB',
      stock: 5,
      isActive: true,
      isDefault: true,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
    },
    {
      id: 'pv-2',
      productId: 'p-2',
      sku: 'SKU-2-WHITE',
      name: 'White',
      stock: 6,
      isActive: true,
      isDefault: true,
      createdAt: new Date('2026-04-02T00:00:00.000Z'),
    },
  ];
  const reviews = [
    { id: 'r-1', userId: 'u-1', rating: 5, comment: 'Great', createdAt: now, product: { id: 'p-1', name: 'iPhone 15' } },
  ];
  let notificationPreference: {
    id: string;
    userId: string;
    marketingOptIn: boolean;
  } | null = {
    id: 'pref-1',
    userId: 'u-1',
    marketingOptIn: true,
  };
  const apiKeys = [
    {
      id: 'key-1',
      userId: 'u-1',
      name: 'Reporting Key',
      permissions: ['reporting.read'],
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      createdAt: now,
    },
  ];
  const savedPaymentMethods = [
    {
      id: 'spm-1',
      userId: 'u-1',
      gateway: 'stripe',
      method: 'stripe',
      label: 'Visa ending 4242',
      brand: 'Visa',
      last4: '4242',
      expiryMonth: 12,
      expiryYear: 2030,
      providerCustomerRef: 'cus_demo',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const coupons = [
    {
      id: 'coupon-loyal-1',
      code: 'LOYAL-OLD',
      type: 'fixed',
      value: 50_000,
      minOrderAmount: 0,
      maxDiscount: null,
      usageLimit: 1,
      usedCount: 0,
      startsAt: new Date('2026-04-01T00:00:00.000Z'),
      expiresAt: new Date('2026-05-01T00:00:00.000Z'),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const loyaltyRedemptions = [
    {
      id: 'lr-1',
      userId: 'u-1',
      couponId: 'coupon-loyal-1',
      pointsSpent: 500,
      discountAmount: 50_000,
      createdAt: new Date('2026-04-05T06:00:00.000Z'),
    },
  ];
  const referralEvents = [
    {
      id: 'ref-1',
      referrerId: 'u-1',
      referredUserId: 'u-2',
      referralCode: 'REFA123',
      status: 'rewarded',
      rewardPoints: 200,
      qualifiedOrderId: 'ord-1',
      qualifiedAt: new Date('2026-04-05T01:00:00.000Z'),
      rewardGrantedAt: new Date('2026-04-05T01:00:00.000Z'),
      createdAt: new Date('2026-04-02T00:00:00.000Z'),
      updatedAt: new Date('2026-04-05T01:00:00.000Z'),
    },
  ];
  const refreshSessions = [
    { id: 'sess-1', userId: 'u-1' },
  ];
  const passwordResetTokens = [
    { id: 'prt-1', userId: 'u-1' },
  ];
  const emailVerificationTokens = [
    { id: 'evt-1', userId: 'u-1' },
  ];
  const socialAccounts = [
    { id: 'sa-1', userId: 'u-1', provider: 'google' },
  ];

  function findUser(id: string) {
    return users.find((user) => user.id === id) ?? null;
  }

  function selectFields<T extends Record<string, unknown>>(row: T, select?: Record<string, boolean>) {
    if (!select) {
      return row;
    }

    const selected: Record<string, unknown> = {};
    for (const [key, enabled] of Object.entries(select)) {
      if (enabled) {
        selected[key] = row[key];
      }
    }
    return selected;
  }

  function sortAddresses() {
    return [...addresses].sort(
      (left, right) =>
        Number(right.isDefault) - Number(left.isDefault) ||
        right.createdAt.getTime() - left.createdAt.getTime(),
    );
  }

  const deleteManyByUser =
    <T extends { userId: string }>(rows: T[]) =>
    async (args: { where: { userId: string } }) => {
      const originalLength = rows.length;
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (rows[index]?.userId === args.where.userId) {
          rows.splice(index, 1);
        }
      }
      return { count: originalLength - rows.length };
    };

  const addressDelegate = {
    findMany: async (args: {
      where: { userId: string };
      orderBy?: Array<{ isDefault?: 'asc' | 'desc'; createdAt?: 'asc' | 'desc' }>;
    }) => sortAddresses().filter((address) => address.userId === args.where.userId),
    findFirst: async (args: {
      where: { userId?: string; id?: string; isDefault?: boolean };
      orderBy?: Array<{ createdAt?: 'asc' | 'desc' }>;
    }) => {
      let rows = [...addresses];
      if (args.where.userId) {
        rows = rows.filter((address) => address.userId === args.where.userId);
      }
      if (args.where.id) {
        rows = rows.filter((address) => address.id === args.where.id);
      }
      if (typeof args.where.isDefault === 'boolean') {
        rows = rows.filter((address) => address.isDefault === args.where.isDefault);
      }
      if (args.orderBy?.[0]?.createdAt === 'desc') {
        rows.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
      }
      return rows[0] ?? null;
    },
    updateMany: async (args: { where: { userId: string }; data: { isDefault: boolean } }) => {
      for (const address of addresses.filter((item) => item.userId === args.where.userId)) {
        address.isDefault = args.data.isDefault;
      }
      return { count: addresses.length };
    },
    create: async (args: { data: Record<string, unknown> }) => {
      const created = {
        id: `addr-${addresses.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data,
      } as (typeof addresses)[number];
      addresses.push(created);
      return created;
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const address = addresses.find((item) => item.id === args.where.id);
      if (!address) {
        throw new Error('address not found');
      }
      Object.assign(address, args.data, { updatedAt: new Date() });
      return address;
    },
    delete: async (args: { where: { id: string } }) => {
      const index = addresses.findIndex((item) => item.id === args.where.id);
      if (index === -1) {
        throw new Error('address not found');
      }
      const [deleted] = addresses.splice(index, 1);
      return deleted;
    },
    deleteMany: deleteManyByUser(addresses),
  };

  const userDelegate = {
    findUnique: async (args: {
      where: { id?: string; referralCode?: string };
      select?: Record<string, boolean>;
    }) => {
      const user = args.where.id
        ? findUser(args.where.id)
        : args.where.referralCode
          ? users.find((item) => item.referralCode === args.where.referralCode) ?? null
          : null;
      return user ? selectFields(user, args.select) : null;
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown>; select?: Record<string, boolean> }) => {
      const user = findUser(args.where.id);
      if (!user) {
        throw new Error('user not found');
      }
      Object.assign(user, args.data, { updatedAt: new Date() });
      return selectFields(user, args.select);
    },
  };

  function hydrateOrder(order: (typeof orders)[number], include?: Record<string, unknown>) {
    if (!include?.items) {
      return order;
    }

    return {
      ...order,
      items: order.items.map((item) => ({
        ...item,
        ...(include.items && typeof include.items === 'object' && (include.items as { include?: Record<string, unknown> }).include?.product
          ? { product: products.find((product) => product.id === item.productId) }
          : {}),
        ...(include.items && typeof include.items === 'object' && (include.items as { include?: Record<string, unknown> }).include?.variant
          ? { variant: productVariants.find((variant) => variant.id === item.variantId) ?? null }
          : {}),
      })),
    };
  }

  function matchesOrder(
    order: (typeof orders)[number],
    where: {
      userId: string;
      status?: string;
      OR?: Array<{ orderNumber?: { contains?: string }; trackingCode?: { contains?: string } }>;
      id?: string;
    },
  ) {
    if (order.userId !== where.userId) {
      return false;
    }

    if (where.id && order.id !== where.id) {
      return false;
    }

    if (where.status && order.status !== where.status) {
      return false;
    }

    if (where.OR?.length) {
      return where.OR.some((clause) => {
        if (clause.orderNumber?.contains) {
          return order.orderNumber.toLowerCase().includes(clause.orderNumber.contains.toLowerCase());
        }
        if (clause.trackingCode?.contains) {
          return (order.trackingCode ?? '').toLowerCase().includes(clause.trackingCode.contains.toLowerCase());
        }
        return false;
      });
    }

    return true;
  }

  const prisma = {
    user: userDelegate,
    address: addressDelegate,
    order: {
      count: async (args: {
        where: {
          userId: string;
          status?: string;
          OR?: Array<{ orderNumber?: { contains?: string }; trackingCode?: { contains?: string } }>;
        };
      }) => orders.filter((order) => matchesOrder(order, args.where)).length,
      findMany: async (args: {
        where: {
          userId: string;
          status?: string;
          OR?: Array<{ orderNumber?: { contains?: string }; trackingCode?: { contains?: string } }>;
        };
        skip?: number;
        take?: number;
        select?: Record<string, boolean>;
        include?: Record<string, unknown>;
        orderBy?: { createdAt?: 'asc' | 'desc'; completedAt?: 'asc' | 'desc' } | Array<{ createdAt?: 'asc' | 'desc'; completedAt?: 'asc' | 'desc' }>;
      }) => {
        let rows = [...orders].filter((order) => matchesOrder(order, args.where));
        const orderBy = Array.isArray(args.orderBy) ? args.orderBy : args.orderBy ? [args.orderBy] : [];
        rows.sort((left, right) => {
          for (const item of orderBy) {
            if (item.completedAt) {
              const leftValue = (left.completedAt ?? left.createdAt).getTime();
              const rightValue = (right.completedAt ?? right.createdAt).getTime();
              const diff =
                item.completedAt === 'asc' ? leftValue - rightValue : rightValue - leftValue;
              if (diff !== 0) {
                return diff;
              }
            }
            if (item.createdAt) {
              const diff =
                item.createdAt === 'asc'
                  ? left.createdAt.getTime() - right.createdAt.getTime()
                  : right.createdAt.getTime() - left.createdAt.getTime();
              if (diff !== 0) {
                return diff;
              }
            }
          }
          return 0;
        });
        if (args.skip) {
          rows = rows.slice(args.skip);
        }
        if (args.take) {
          rows = rows.slice(0, args.take);
        }
        if (args.select) {
          return rows.map((row) => selectFields(row, args.select));
        }
        return rows.map((row) => hydrateOrder(row, args.include));
      },
      findFirst: async (args: {
        where: {
          userId: string;
          id?: string;
          status?: string;
          OR?: Array<{ orderNumber?: { contains?: string }; trackingCode?: { contains?: string } }>;
        };
        include?: Record<string, unknown>;
      }) => {
        const row = orders.find((order) => matchesOrder(order, args.where)) ?? null;
        return row ? hydrateOrder(row, args.include) : null;
      },
    },
    wishlistItem: {
      findMany: async (args: { where: { userId: string }; select?: { productId: true }; include?: Record<string, unknown>; orderBy?: { createdAt: 'desc' | 'asc' } }) =>
        wishlistItems
          .filter((item) => item.userId === args.where.userId)
          .map((item) =>
            args.select
              ? { productId: item.productId }
              : {
                  ...item,
                  product: products.find((product) => product.id === item.productId),
                },
          ),
      count: async (args: { where: { userId: string } }) =>
        wishlistItems.filter((item) => item.userId === args.where.userId).length,
      deleteMany: deleteManyByUser(wishlistItems),
    },
    cartItem: {
      findFirst: async (args: { where: { userId: string; productId: string; variantId: string } }) =>
        cartItems.find(
          (item) =>
            item.userId === args.where.userId &&
            item.productId === args.where.productId &&
            item.variantId === args.where.variantId,
        ) ?? null,
      findMany: async (args: { where: { userId: string }; select?: { quantity: true } }) => {
        const rows = cartItems.filter((item) => item.userId === args.where.userId);
        return args.select ? rows.map((item) => ({ quantity: item.quantity })) : rows;
      },
      create: async (args: { data: { userId: string; productId: string; variantId: string; quantity: number } }) => {
        const created = {
          id: `ci-${cartItems.length + 1}`,
          ...args.data,
        };
        cartItems.push(created);
        return created;
      },
      update: async (args: { where: { id: string }; data: { quantity: number } }) => {
        const item = cartItems.find((row) => row.id === args.where.id);
        if (!item) {
          throw new Error('cart item not found');
        }
        item.quantity = args.data.quantity;
        return item;
      },
      deleteMany: deleteManyByUser(cartItems),
    },
    cartCoupon: {
      deleteMany: deleteManyByUser(cartCoupons),
    },
    notification: {
      count: async (args: { where: { userId: string; isRead?: boolean } }) =>
        notifications.filter(
          (item) => item.userId === args.where.userId && (args.where.isRead === undefined || item.isRead === args.where.isRead),
        ).length,
      findMany: async (args: { where: { userId: string }; orderBy: { createdAt: 'asc' | 'desc' }; take?: number }) => {
        let rows = notifications.filter((item) => item.userId === args.where.userId);
        rows.sort((left, right) =>
          args.orderBy.createdAt === 'asc'
            ? left.createdAt.getTime() - right.createdAt.getTime()
            : right.createdAt.getTime() - left.createdAt.getTime(),
        );
        if (args.take) {
          rows = rows.slice(0, args.take);
        }
        return rows;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const created = {
          id: `n-${notifications.length + 1}`,
          isRead: false,
          createdAt: new Date(),
          ...args.data,
        };
        notifications.push(created as never);
        return created;
      },
      deleteMany: deleteManyByUser(notifications),
    },
    product: {
      findMany: async (args: { where: { status: string; stock: { gt: number }; id?: { notIn: string[] } }; take: number }) =>
        [...products]
          .filter(
            (product) =>
              product.status === args.where.status &&
              product.stock > args.where.stock.gt &&
              !(args.where.id?.notIn ?? []).includes(product.id),
          )
          .sort((left, right) => right.totalSold - left.totalSold || right.createdAt.getTime() - left.createdAt.getTime())
          .slice(0, args.take),
    },
    productVariant: {
      findFirst: async (args: {
        where: { productId: string; isActive: boolean };
        orderBy?: Array<{ isDefault?: 'asc' | 'desc'; createdAt?: 'asc' | 'desc' }>;
      }) =>
        [...productVariants]
          .filter((variant) => variant.productId === args.where.productId && variant.isActive === args.where.isActive)
          .sort(
            (left, right) =>
              Number(right.isDefault) - Number(left.isDefault) ||
              left.createdAt.getTime() - right.createdAt.getTime(),
          )[0] ?? null,
    },
    review: {
      findMany: async (args: { where: { userId: string } }) =>
        reviews.filter((review) => review.userId === args.where.userId),
    },
    notificationPreference: {
      findUnique: async (args: { where: { userId: string } }) =>
        notificationPreference && args.where.userId === notificationPreference.userId ? notificationPreference : null,
      deleteMany: async (args: { where: { userId: string } }) => {
        const shouldDelete = notificationPreference?.userId === args.where.userId;
        notificationPreference = shouldDelete ? null : notificationPreference;
        return { count: shouldDelete ? 1 : 0 };
      },
    },
    apiKey: {
      findMany: async (args: { where: { userId: string } }) =>
        apiKeys.filter((key) => key.userId === args.where.userId),
      updateMany: async (args: { where: { userId: string; revokedAt: null }; data: { revokedAt: Date } }) => {
        let count = 0;
        for (const key of apiKeys) {
          if (key.userId === args.where.userId && key.revokedAt === args.where.revokedAt) {
            key.revokedAt = args.data.revokedAt;
            count += 1;
          }
        }
        return { count };
      },
    },
    coupon: {
      findUnique: async (args: { where: { code?: string; id?: string }; select?: Record<string, boolean> }) => {
        const coupon = args.where.id
          ? coupons.find((item) => item.id === args.where.id) ?? null
          : args.where.code
            ? coupons.find((item) => item.code === args.where.code) ?? null
            : null;
        return coupon && args.select ? selectFields(coupon, args.select) : coupon;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const created = {
          id: `coupon-${coupons.length + 1}`,
          maxDiscount: null,
          usedCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.data,
        };
        coupons.push(created as never);
        return created;
      },
      updateMany: async (args: { where: { id: { in: string[] } }; data: { isActive: boolean } }) => {
        let count = 0;
        for (const coupon of coupons) {
          if (args.where.id.in.includes(coupon.id)) {
            Object.assign(coupon, args.data, { updatedAt: new Date() });
            count += 1;
          }
        }
        return { count };
      },
    },
    loyaltyRedemption: {
      findMany: async (args: {
        where: { userId: string };
        orderBy?: Array<{ createdAt?: 'asc' | 'desc' }>;
        include?: { coupon?: { select: Record<string, boolean> } };
      }) => {
        const rows = [...loyaltyRedemptions]
          .filter((item) => item.userId === args.where.userId)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

        return rows.map((row) => ({
          ...row,
          ...(args.include?.coupon
            ? {
                coupon: selectFields(
                  coupons.find((coupon) => coupon.id === row.couponId)!,
                  args.include.coupon.select,
                ),
              }
            : {}),
        }));
      },
      create: async (args: { data: Record<string, unknown>; include?: { coupon?: true } }) => {
        const created = {
          id: `lr-${loyaltyRedemptions.length + 1}`,
          createdAt: new Date(),
          ...args.data,
        };
        loyaltyRedemptions.push(created as never);
        return args.include?.coupon
          ? {
              ...created,
              coupon: coupons.find((coupon) => coupon.id === created.couponId)!,
            }
          : created;
      },
      deleteMany: deleteManyByUser(loyaltyRedemptions),
    },
    savedPaymentMethod: {
      findMany: async (args: {
        where: { userId: string };
        orderBy?: Array<{ isDefault?: 'asc' | 'desc'; createdAt?: 'asc' | 'desc' }>;
        select?: Record<string, boolean>;
      }) => {
        const rows = [...savedPaymentMethods]
          .filter((item) => item.userId === args.where.userId)
          .sort(
            (left, right) =>
              Number(right.isDefault) - Number(left.isDefault) ||
              right.createdAt.getTime() - left.createdAt.getTime(),
          );

        if (args.select) {
          return rows.map((row) => selectFields(row, args.select));
        }

        return rows;
      },
      deleteMany: deleteManyByUser(savedPaymentMethods),
    },
    referralEvent: {
      findMany: async (args: {
        where: {
          referrerId?: string;
          status?: string;
          OR?: Array<{ referrerId?: string; referredUserId?: string }>;
        };
        orderBy?: Array<
          { createdAt?: 'asc' | 'desc'; rewardGrantedAt?: 'asc' | 'desc' }
        >;
        include?: { referrer?: { select: Record<string, boolean> }; referredUser?: { select: Record<string, boolean> } };
      }) => {
        let rows = [...referralEvents];
        if (args.where.referrerId) {
          rows = rows.filter((item) => item.referrerId === args.where.referrerId);
        }
        if (args.where.status) {
          rows = rows.filter((item) => item.status === args.where.status);
        }
        if (args.where.OR?.length) {
          rows = rows.filter((item) =>
            args.where.OR!.some(
              (clause) =>
                (clause.referrerId ? item.referrerId === clause.referrerId : false) ||
                (clause.referredUserId ? item.referredUserId === clause.referredUserId : false),
            ),
          );
        }

        const orderBy = args.orderBy ?? [];
        rows.sort((left, right) => {
          for (const order of orderBy) {
            if (order.rewardGrantedAt) {
              const leftValue = (left.rewardGrantedAt ?? left.createdAt).getTime();
              const rightValue = (right.rewardGrantedAt ?? right.createdAt).getTime();
              const diff =
                order.rewardGrantedAt === 'asc' ? leftValue - rightValue : rightValue - leftValue;
              if (diff !== 0) {
                return diff;
              }
            }
            if (order.createdAt) {
              const diff =
                order.createdAt === 'asc'
                  ? left.createdAt.getTime() - right.createdAt.getTime()
                  : right.createdAt.getTime() - left.createdAt.getTime();
              if (diff !== 0) {
                return diff;
              }
            }
          }
          return 0;
        });

        return rows.map((row) => ({
          ...row,
          ...(args.include?.referrer
            ? { referrer: selectFields(findUser(row.referrerId)!, args.include.referrer.select) }
            : {}),
          ...(args.include?.referredUser
            ? { referredUser: selectFields(findUser(row.referredUserId)!, args.include.referredUser.select) }
            : {}),
        }));
      },
      deleteMany: async (args: { where: { OR: Array<{ referrerId?: string; referredUserId?: string }> } }) => {
        const originalLength = referralEvents.length;
        for (let index = referralEvents.length - 1; index >= 0; index -= 1) {
          const item = referralEvents[index];
          if (
            args.where.OR.some(
              (clause) =>
                (clause.referrerId && item?.referrerId === clause.referrerId) ||
                (clause.referredUserId && item?.referredUserId === clause.referredUserId),
            )
          ) {
            referralEvents.splice(index, 1);
          }
        }
        return { count: originalLength - referralEvents.length };
      },
    },
    refreshSession: {
      deleteMany: deleteManyByUser(refreshSessions),
    },
    passwordResetToken: {
      deleteMany: deleteManyByUser(passwordResetTokens),
    },
    emailVerificationToken: {
      deleteMany: deleteManyByUser(emailVerificationTokens),
    },
    socialAccount: {
      deleteMany: deleteManyByUser(socialAccounts),
    },
    $transaction: async <T>(callback: (tx: any) => Promise<T>) =>
      callback({
        user: userDelegate,
        address: addressDelegate,
        order: prisma.order,
        wishlistItem: { deleteMany: deleteManyByUser(wishlistItems) },
        cartItem: prisma.cartItem,
        cartCoupon: { deleteMany: deleteManyByUser(cartCoupons) },
        notification: prisma.notification,
        notificationPreference: {
          deleteMany: async (args: { where: { userId: string } }) => {
            const shouldDelete = notificationPreference?.userId === args.where.userId;
            notificationPreference = shouldDelete ? null : notificationPreference;
            return { count: shouldDelete ? 1 : 0 };
          },
        },
        coupon: prisma.coupon,
        loyaltyRedemption: prisma.loyaltyRedemption,
        refreshSession: { deleteMany: deleteManyByUser(refreshSessions) },
        passwordResetToken: { deleteMany: deleteManyByUser(passwordResetTokens) },
        emailVerificationToken: { deleteMany: deleteManyByUser(emailVerificationTokens) },
        socialAccount: { deleteMany: deleteManyByUser(socialAccounts) },
        savedPaymentMethod: { deleteMany: deleteManyByUser(savedPaymentMethods) },
        referralEvent: prisma.referralEvent,
        productVariant: prisma.productVariant,
        apiKey: {
          updateMany: async (args: { where: { userId: string; revokedAt: null }; data: { revokedAt: Date } }) => {
            let count = 0;
            for (const key of apiKeys) {
              if (key.userId === args.where.userId && key.revokedAt === args.where.revokedAt) {
                key.revokedAt = args.data.revokedAt;
                count += 1;
              }
            }
            return { count };
          },
        },
      }),
  };

  return {
    prisma,
    users,
    addresses,
    wishlistItems,
    cartItems,
    cartCoupons,
    notifications,
    apiKeys,
    coupons,
    loyaltyRedemptions,
    savedPaymentMethods,
    referralEvents,
    refreshSessions,
    passwordResetTokens,
    emailVerificationTokens,
    socialAccounts,
    getNotificationPreference: () => notificationPreference,
  };
}

test('account.dashboard profile update and export aggregate customer data', async () => {
  const mock = createAccountMock();
  const service = new AccountService(mock.prisma as never);

  const dashboard = await service.dashboard('u-1');
  const profile = await service.profile('u-1');
  const updated = await service.updateProfile('u-1', {
    fullName: 'Nguyen Van B',
    phone: '0988000000',
  });
  const exported = await service.exportData('u-1');

  assert.equal(dashboard.totalOrders, 2);
  assert.equal(dashboard.wishlistCount, 1);
  assert.equal(dashboard.unreadNotifications, 1);
  assert.equal(dashboard.recentOrders.length, 2);
  assert.equal(dashboard.suggestions[0].id, 'p-2');
  assert.equal(profile.email, 'customer@example.com');
  assert.equal(updated.fullName, 'Nguyen Van B');
  assert.equal(updated.phone, '0988000000');
  assert.equal(exported.profile.id, 'u-1');
  assert.equal(exported.profile.referralCode, 'REFA123');
  assert.equal(exported.addresses.length, 2);
  assert.equal(exported.orders.length, 2);
  assert.equal(exported.wishlist.length, 1);
  assert.equal(exported.reviews.length, 1);
  assert.equal(exported.notifications.length, 2);
  assert.equal(exported.apiKeys.length, 1);
  assert.equal(exported.savedPaymentMethods.length, 1);
  assert.equal(exported.referralEvents.length, 1);
  assert.equal(exported.loyaltyRedemptions.length, 1);

  await assert.rejects(
    async () => service.profile('missing-user'),
    (error: unknown) => error instanceof NotFoundException,
  );
});

test('account.address CRUD keeps a single default address and reassigns fallback on delete', async () => {
  const mock = createAccountMock();
  const service = new AccountService(mock.prisma as never);

  const created = await service.createAddress('u-1', {
    label: 'Parents',
    fullName: 'Nguyen Van A',
    phone: '0909000000',
    province: 'Dong Nai',
    district: 'Bien Hoa',
    ward: 'Tan Hiep',
    addressLine: '12 Le Duan',
    isDefault: true,
  });
  const updated = await service.updateAddress('u-1', 'addr-2', {
    district: 'District 7',
    isDefault: true,
  });
  const setDefault = await service.setDefaultAddress('u-1', 'addr-1');
  const deleted = await service.deleteAddress('u-1', 'addr-1');

  assert.equal(created.total, 3);
  assert.equal(created.data[0].label, 'Parents');
  assert.equal(updated.data[0].id, 'addr-2');
  assert.equal(setDefault.data[0].id, 'addr-1');
  assert.equal(deleted.total, 2);
  assert.equal(deleted.data[0].isDefault, true);
  assert.equal(deleted.data[0].id !== 'addr-1', true);

  await assert.rejects(
    async () => service.updateAddress('u-1', 'missing-address', { label: 'Missing' }),
    (error: unknown) => error instanceof NotFoundException,
  );
});

test('account.orders loyalty and reorder cover customer self-service flows', async () => {
  const mock = createAccountMock();
  const service = new AccountService(mock.prisma as never);

  const orders = await service.listOrders('u-1', {
    status: 'completed',
    q: 'ORD',
    page: 1,
    limit: 5,
  });
  const loyalty = await service.loyalty('u-1');
  const reorder = await service.reorder('u-1', 'ord-1');

  assert.equal(orders.total, 1);
  assert.equal(orders.data[0]?.orderNumber, 'ORD-1');
  assert.equal(loyalty.pointsBalance, 1200);
  assert.equal(loyalty.totalEarned, 1700);
  assert.equal(loyalty.totalRedeemed, 500);
  assert.equal(loyalty.tier, 'Silver');
  assert.equal(loyalty.history.some((item) => item.source === 'referral' && item.points === 200), true);
  assert.equal(loyalty.history.some((item) => item.source === 'voucher' && item.points === 500), true);
  assert.equal(reorder.success, true);
  assert.equal(reorder.addedItems, 1);
  assert.equal(reorder.skippedItems.length, 0);
  assert.equal(reorder.cartTotalItems, 2);
  assert.equal(mock.cartItems.find((item) => item.variantId === 'pv-1')?.quantity, 2);
});

test('account.referral exposes referral link stats and supports code regeneration', async () => {
  const mock = createAccountMock();
  const service = new AccountService(mock.prisma as never);

  const referral = await service.referral('u-1');
  const regenerated = await service.regenerateReferralCode('u-1');

  assert.equal(referral.referralCode, 'REFA123');
  assert.equal(referral.totalSignups, 1);
  assert.equal(referral.rewardedCount, 1);
  assert.equal(referral.totalRewardPoints, 200);
  assert.match(referral.referralLink, /\/register\?ref=REFA123$/);
  assert.equal(regenerated.referralCode === 'REFA123', false);
  assert.equal(mock.users.find((user) => user.id === 'u-1')?.referralCode, regenerated.referralCode);
});

test('account.redeemLoyalty creates a single-use coupon from available points', async () => {
  const mock = createAccountMock();
  const service = new AccountService(mock.prisma as never);

  const redeemed = await service.redeemLoyalty('u-1', { points: 500 });

  assert.equal(redeemed.success, true);
  assert.equal(redeemed.redemption.pointsSpent, 500);
  assert.equal(redeemed.redemption.discountAmount, 50_000);
  assert.match(redeemed.redemption.coupon.code, /^LOYAL-/);
  assert.equal(redeemed.loyalty.pointsBalance, 700);
  assert.equal(mock.loyaltyRedemptions.length, 2);
  assert.equal(mock.coupons.length, 2);
  assert.equal(
    mock.notifications.some((item) => item.userId === 'u-1' && (item as any).title === 'Loyalty voucher created'),
    true,
  );

  await assert.rejects(
    async () => service.redeemLoyalty('u-1', { points: 400 }),
    (error: unknown) => error instanceof BadRequestException,
  );
});

test('account.deleteAccount anonymizes user and clears personal side data', async () => {
  const mock = createAccountMock();
  const service = new AccountService(mock.prisma as never);

  const result = await service.deleteAccount('u-1', {
    password: 'secret123',
    reason: 'privacy_request',
  });

  assert.equal(result.success, true);
  assert.equal(result.reason, 'privacy_request');
  assert.equal(result.user.email, 'deleted+u-1@deleted.local');
  assert.equal(result.user.fullName, 'Deleted User');
  assert.equal(result.user.phone, null);
  assert.equal(mock.users[0]?.passwordHash === '$2b$12$5C8ORuDwWx.TWYJBr0GzDeP/MvVVTzRFvsAHoVrvO6P9xdWfmt3ZW', false);
  assert.equal(mock.addresses.length, 0);
  assert.equal(mock.wishlistItems.length, 0);
  assert.equal(mock.cartItems.length, 0);
  assert.equal(mock.cartCoupons.length, 0);
  assert.equal(mock.notifications.length, 0);
  assert.equal(mock.savedPaymentMethods.length, 0);
  assert.equal(mock.referralEvents.length, 0);
  assert.equal(mock.loyaltyRedemptions.length, 0);
  assert.equal(mock.coupons[0]?.isActive, false);
  assert.equal(mock.refreshSessions.length, 0);
  assert.equal(mock.passwordResetTokens.length, 0);
  assert.equal(mock.emailVerificationTokens.length, 0);
  assert.equal(mock.socialAccounts.length, 0);
  assert.equal(mock.getNotificationPreference(), null);
  assert.equal(mock.apiKeys[0]?.revokedAt instanceof Date, true);

  await assert.rejects(
    async () => service.deleteAccount('u-1', { password: 'wrong-password' }),
    (error: unknown) => error instanceof UnauthorizedException,
  );
});
