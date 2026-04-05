import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { generateTotpCode, hashPassword } from '../../common/security';
import { AuthService } from './auth.service';

process.env.NODE_ENV ??= 'test';
process.env.JWT_SECRET ??= 'test-jwt-secret-12345678901234567890';
process.env.TOKEN_HASH_SECRET ??= 'test-token-hash-secret-12345678901234567890';

type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string | null;
  role: UserRole;
  emailVerifiedAt: Date | null;
  twoFactorSecret?: string | null;
  twoFactorEnabledAt?: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SocialAccountRecord = {
  id: string;
  userId: string;
  provider: 'google' | 'facebook' | 'apple' | 'zalo';
  providerUserId: string;
  email?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ApiKeyRecord = {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  permissions: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SessionRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  expiresAt: Date;
  lastUsedAt?: Date | null;
  createdAt: Date;
};

type TokenRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
};

type ProductRecord = {
  id: string;
  stock: number;
  status: 'active' | 'archived';
};

type ProductVariantRecord = {
  id: string;
  productId: string;
  stock: number;
  isActive: boolean;
};

type CartItemRecord = {
  id: string;
  userId: string;
  productId: string;
  variantId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
};

type CartCouponRecord = {
  userId: string;
  couponId: string;
  appliedAt: Date;
};

type WishlistItemRecord = {
  id: string;
  userId: string;
  productId: string;
  createdAt: Date;
};

type AddressRecord = {
  id: string;
  userId: string;
  fullName: string;
};

type NotificationRecord = {
  id: string;
  userId: string;
  title: string;
  type?: string;
  content?: string;
};

type OrderRecord = {
  id: string;
  userId: string;
  orderNumber: string;
};

type ReservationRecord = {
  id: string;
  userId: string;
  status: 'active' | 'consumed' | 'canceled' | 'expired';
};

function createAuthMock() {
  const users = new Map<string, UserRecord>();
  const usersByEmail = new Map<string, UserRecord>();
  const sessions = new Map<string, SessionRecord>();
  const passwordResetTokens = new Map<string, TokenRecord>();
  const emailVerificationTokens = new Map<string, TokenRecord>();
  const socialAccounts = new Map<string, SocialAccountRecord>();
  const apiKeys = new Map<string, ApiKeyRecord>();
  const products = new Map<string, ProductRecord>([
    ['p-1', { id: 'p-1', stock: 5, status: 'active' }],
    ['p-2', { id: 'p-2', stock: 10, status: 'active' }],
  ]);
  const productVariants = new Map<string, ProductVariantRecord>([
    ['pv-1', { id: 'pv-1', productId: 'p-1', stock: 5, isActive: true }],
    ['pv-2', { id: 'pv-2', productId: 'p-2', stock: 10, isActive: true }],
  ]);
  const cartItems = new Map<string, CartItemRecord>();
  const cartCoupons = new Map<string, CartCouponRecord>();
  const wishlistItems = new Map<string, WishlistItemRecord>();
  const addresses = new Map<string, AddressRecord>();
  const notifications = new Map<string, NotificationRecord>();
  const orders = new Map<string, OrderRecord>();
  const reservations = new Map<string, ReservationRecord>();
  let sequence = 1;

  function addUser(user: Partial<UserRecord> & Pick<UserRecord, 'id' | 'email' | 'passwordHash' | 'fullName' | 'role'>) {
    const record: UserRecord = {
      phone: user.phone ?? null,
      emailVerifiedAt: user.emailVerifiedAt ?? null,
      twoFactorSecret: user.twoFactorSecret ?? null,
      twoFactorEnabledAt: user.twoFactorEnabledAt ?? null,
      failedLoginAttempts: user.failedLoginAttempts ?? 0,
      lockedUntil: user.lockedUntil ?? null,
      lastLoginAt: user.lastLoginAt ?? null,
      createdAt: user.createdAt ?? new Date(),
      updatedAt: user.updatedAt ?? new Date(),
      ...user,
    };

    users.set(record.id, record);
    usersByEmail.set(record.email, record);
    return record;
  }

  const tx = {
    user: {
      findUnique: async (args: { where: { email?: string; id?: string } }) => {
        if (args.where.id) {
          return users.get(args.where.id) ?? null;
        }

        if (args.where.email) {
          return usersByEmail.get(args.where.email) ?? null;
        }

        return null;
      },
      create: async (args: {
        data: {
          email: string;
          passwordHash: string;
          fullName: string;
          phone?: string | null;
          role: UserRole;
          emailVerifiedAt?: Date | null;
        };
      }) => {
        const user = addUser({
          id: `u-${sequence++}`,
          email: args.data.email,
          passwordHash: args.data.passwordHash,
          fullName: args.data.fullName,
          phone: args.data.phone ?? null,
          role: args.data.role,
          emailVerifiedAt: args.data.emailVerifiedAt ?? null,
        });
        return user;
      },
      update: async (args: { where: { id: string }; data: Partial<UserRecord> }) => {
        const user = users.get(args.where.id);
        if (!user) throw new Error('user not found');
        const updated = { ...user, ...args.data, updatedAt: new Date() };
        users.set(user.id, updated);
        usersByEmail.set(updated.email, updated);
        return updated;
      },
    },
    notification: {
      create: async (args: { data: { userId: string; title: string; type?: string; content?: string } }) => {
        const record: NotificationRecord = {
          id: `n-${sequence++}`,
          ...args.data,
        };
        notifications.set(record.id, record);
        return record;
      },
      updateMany: async (args: { where: { userId: string }; data: { userId: string } }) => {
        let count = 0;
        for (const [id, notification] of notifications.entries()) {
          if (notification.userId !== args.where.userId) {
            continue;
          }

          notifications.set(id, { ...notification, userId: args.data.userId });
          count += 1;
        }

        return { count };
      },
    },
    socialAccount: {
      create: async (args: {
        data: {
          userId: string;
          provider: SocialAccountRecord['provider'];
          providerUserId: string;
          email?: string;
        };
      }) => {
        const record: SocialAccountRecord = {
          id: `sa-${sequence++}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.data,
        };
        socialAccounts.set(`${record.provider}:${record.providerUserId}`, record);
        return record;
      },
    },
    apiKey: {
      create: async (args: {
        data: {
          userId: string;
          name: string;
          keyPrefix: string;
          keyHash: string;
          permissions: string[];
          expiresAt?: Date | null;
        };
      }) => {
        const record: ApiKeyRecord = {
          id: `ak-${sequence++}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastUsedAt: null,
          revokedAt: null,
          expiresAt: args.data.expiresAt ?? null,
          ...args.data,
        };
        apiKeys.set(record.id, record);
        return record;
      },
      update: async (args: { where: { id: string }; data: Partial<ApiKeyRecord> }) => {
        const apiKey = apiKeys.get(args.where.id);
        if (!apiKey) throw new Error('api key not found');
        const updated = { ...apiKey, ...args.data, updatedAt: new Date() };
        apiKeys.set(apiKey.id, updated);
        return updated;
      },
      updateMany: async (args: {
        where: { id?: string; userId?: string; revokedAt?: null };
        data: Partial<ApiKeyRecord>;
      }) => {
        let count = 0;
        for (const [id, apiKey] of apiKeys.entries()) {
          const byId = args.where.id ? apiKey.id === args.where.id : true;
          const byUser = args.where.userId ? apiKey.userId === args.where.userId : true;
          const byRevokedAt = args.where.revokedAt === null ? apiKey.revokedAt === null : true;
          if (byId && byUser && byRevokedAt) {
            apiKeys.set(id, { ...apiKey, ...args.data, updatedAt: new Date() });
            count += 1;
          }
        }
        return { count };
      },
    },
    emailVerificationToken: {
      create: async (args: { data: Omit<TokenRecord, 'id' | 'createdAt' | 'consumedAt'> }) => {
        const token: TokenRecord = {
          id: `evt-${sequence++}`,
          createdAt: new Date(),
          consumedAt: null,
          ...args.data,
        };
        emailVerificationTokens.set(token.id, token);
        return token;
      },
      update: async (args: { where: { id: string }; data: Partial<TokenRecord> }) => {
        const token = emailVerificationTokens.get(args.where.id);
        if (!token) throw new Error('token not found');
        const updated = { ...token, ...args.data };
        emailVerificationTokens.set(token.id, updated);
        return updated;
      },
      deleteMany: async (args: { where: { expiresAt?: { lt: Date } } }) => {
        let count = 0;
        for (const [id, token] of emailVerificationTokens.entries()) {
          if (args.where.expiresAt?.lt && token.expiresAt < args.where.expiresAt.lt) {
            emailVerificationTokens.delete(id);
            count += 1;
          }
        }
        return { count };
      },
      findUnique: async (args: { where: { tokenHash: string } }) =>
        [...emailVerificationTokens.values()].find((item) => item.tokenHash === args.where.tokenHash) ??
        null,
    },
    passwordResetToken: {
      create: async (args: { data: Omit<TokenRecord, 'id' | 'createdAt' | 'consumedAt'> }) => {
        const token: TokenRecord = {
          id: `prt-${sequence++}`,
          createdAt: new Date(),
          consumedAt: null,
          ...args.data,
        };
        passwordResetTokens.set(token.id, token);
        return token;
      },
      update: async (args: { where: { id: string }; data: Partial<TokenRecord> }) => {
        const token = passwordResetTokens.get(args.where.id);
        if (!token) throw new Error('token not found');
        const updated = { ...token, ...args.data };
        passwordResetTokens.set(token.id, updated);
        return updated;
      },
      deleteMany: async (args: { where: { expiresAt?: { lt: Date }; userId?: string } }) => {
        let count = 0;
        for (const [id, token] of passwordResetTokens.entries()) {
          const expired = args.where.expiresAt?.lt ? token.expiresAt < args.where.expiresAt.lt : true;
          const byUser = args.where.userId ? token.userId === args.where.userId : true;
          if (expired && byUser) {
            passwordResetTokens.delete(id);
            count += 1;
          }
        }
        return { count };
      },
      findUnique: async (args: { where: { tokenHash: string } }) =>
        [...passwordResetTokens.values()].find((item) => item.tokenHash === args.where.tokenHash) ??
        null,
    },
    refreshSession: {
      create: async (args: { data: Omit<SessionRecord, 'id' | 'createdAt'> }) => {
        const session: SessionRecord = {
          id: `s-${sequence++}`,
          createdAt: new Date(),
          ...args.data,
        };
        sessions.set(session.id, session);
        return session;
      },
      findUnique: async (args: { where: { tokenHash: string } }) =>
        [...sessions.values()].find((item) => item.tokenHash === args.where.tokenHash) ?? null,
      findMany: async (args: { where: { userId: string } }) =>
        [...sessions.values()]
          .filter((item) => item.userId === args.where.userId)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
      delete: async (args: { where: { id: string } }) => {
        const session = sessions.get(args.where.id);
        if (!session) throw new Error('session not found');
        sessions.delete(args.where.id);
        return session;
      },
      deleteMany: async (args: { where: { id?: string; userId?: string; tokenHash?: string; expiresAt?: { lt: Date } } }) => {
        let count = 0;
        for (const [id, session] of sessions.entries()) {
          const byId = args.where.id ? session.id === args.where.id : true;
          const byUser = args.where.userId ? session.userId === args.where.userId : true;
          const byHash = args.where.tokenHash ? session.tokenHash === args.where.tokenHash : true;
          const byExpiry = args.where.expiresAt?.lt ? session.expiresAt < args.where.expiresAt.lt : true;
          if (byId && byUser && byHash && byExpiry) {
            sessions.delete(id);
            count += 1;
          }
        }
        return { count };
      },
    },
    cartItem: {
      findMany: async (args: {
        where: { userId: string };
        include?: {
          product?: { select: { stock: true; status: true } };
          variant?: { select: { stock: true; isActive: true } };
        };
      }) =>
        [...cartItems.values()]
          .filter((item) => item.userId === args.where.userId)
          .map((item) =>
            ({
              ...item,
              product: args.include?.product ? products.get(item.productId)! : undefined,
              variant: args.include?.variant ? productVariants.get(item.variantId)! : undefined,
            }),
          ),
      findFirst: async (args: { where: { userId: string; productId: string; variantId: string } }) =>
        [...cartItems.values()].find(
          (item) =>
            item.userId === args.where.userId &&
            item.productId === args.where.productId &&
            item.variantId === args.where.variantId,
        ) ?? null,
      create: async (args: { data: { userId: string; productId: string; variantId: string; quantity: number } }) => {
        const record: CartItemRecord = {
          id: `ci-${sequence++}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.data,
        };
        cartItems.set(record.id, record);
        return record;
      },
      update: async (args: { where: { id: string }; data: Partial<CartItemRecord> }) => {
        const item = cartItems.get(args.where.id);
        if (!item) throw new Error('cart item not found');
        const updated = { ...item, ...args.data, updatedAt: new Date() };
        cartItems.set(item.id, updated);
        return updated;
      },
      deleteMany: async (args: { where: { userId: string } }) => {
        let count = 0;
        for (const [id, item] of cartItems.entries()) {
          if (item.userId === args.where.userId) {
            cartItems.delete(id);
            count += 1;
          }
        }
        return { count };
      },
    },
    cartCoupon: {
      findUnique: async (args: { where: { userId: string } }) => cartCoupons.get(args.where.userId) ?? null,
      upsert: async (args: {
        where: { userId: string };
        create: { userId: string; couponId: string };
        update: { couponId: string; appliedAt: Date };
      }) => {
        const current = cartCoupons.get(args.where.userId);
        const record: CartCouponRecord = current
          ? { ...current, ...args.update }
          : { userId: args.create.userId, couponId: args.create.couponId, appliedAt: new Date() };
        cartCoupons.set(args.where.userId, record);
        return record;
      },
      deleteMany: async (args: { where: { userId: string } }) => {
        const existed = cartCoupons.delete(args.where.userId);
        return { count: existed ? 1 : 0 };
      },
    },
    wishlistItem: {
      findMany: async (args: { where: { userId: string } }) =>
        [...wishlistItems.values()].filter((item) => item.userId === args.where.userId),
      upsert: async (args: {
        where: { userId_productId: { userId: string; productId: string } };
        create: { userId: string; productId: string };
        update: Record<string, never>;
      }) => {
        const existing =
          [...wishlistItems.values()].find(
            (item) =>
              item.userId === args.where.userId_productId.userId &&
              item.productId === args.where.userId_productId.productId,
          ) ?? null;

        if (existing) {
          return existing;
        }

        const record: WishlistItemRecord = {
          id: `wi-${sequence++}`,
          createdAt: new Date(),
          ...args.create,
        };
        wishlistItems.set(record.id, record);
        return record;
      },
      deleteMany: async (args: { where: { userId: string } }) => {
        let count = 0;
        for (const [id, item] of wishlistItems.entries()) {
          if (item.userId === args.where.userId) {
            wishlistItems.delete(id);
            count += 1;
          }
        }
        return { count };
      },
    },
    address: {
      updateMany: async (args: { where: { userId: string }; data: { userId: string } }) => {
        let count = 0;
        for (const [id, address] of addresses.entries()) {
          if (address.userId === args.where.userId) {
            addresses.set(id, { ...address, userId: args.data.userId });
            count += 1;
          }
        }
        return { count };
      },
    },
    order: {
      updateMany: async (args: { where: { userId: string }; data: { userId: string } }) => {
        let count = 0;
        for (const [id, order] of orders.entries()) {
          if (order.userId === args.where.userId) {
            orders.set(id, { ...order, userId: args.data.userId });
            count += 1;
          }
        }
        return { count };
      },
    },
    inventoryReservation: {
      updateMany: async (args: { where: { userId: string }; data: { userId: string } }) => {
        let count = 0;
        for (const [id, reservation] of reservations.entries()) {
          if (reservation.userId === args.where.userId) {
            reservations.set(id, { ...reservation, userId: args.data.userId });
            count += 1;
          }
        }
        return { count };
      },
    },
  };

  const prisma = {
    user: {
      findUnique: async (args: { where: { email?: string; id?: string }; select?: { id: true } }) => {
        const user = args.where.id
          ? users.get(args.where.id) ?? null
          : args.where.email
            ? usersByEmail.get(args.where.email) ?? null
            : null;

        if (!user) return null;
        if (args.select?.id) return { id: user.id };
        return user;
      },
      create: tx.user.create,
      update: tx.user.update,
    },
    refreshSession: tx.refreshSession,
    passwordResetToken: tx.passwordResetToken,
    emailVerificationToken: tx.emailVerificationToken,
    cartItem: tx.cartItem,
    cartCoupon: tx.cartCoupon,
    wishlistItem: tx.wishlistItem,
    address: tx.address,
    notification: tx.notification,
    order: tx.order,
    inventoryReservation: tx.inventoryReservation,
    apiKey: {
      findMany: async (args: { where: { userId: string }; orderBy?: { createdAt: 'desc' | 'asc' } }) =>
        [...apiKeys.values()]
          .filter((item) => item.userId === args.where.userId)
          .sort((left, right) =>
            args.orderBy?.createdAt === 'asc'
              ? left.createdAt.getTime() - right.createdAt.getTime()
              : right.createdAt.getTime() - left.createdAt.getTime(),
          ),
      findUnique: async (args: {
        where: { keyHash?: string; id?: string };
        include?: { user: true };
      }) => {
        const apiKey = args.where.id
          ? apiKeys.get(args.where.id) ?? null
          : args.where.keyHash
            ? [...apiKeys.values()].find((item) => item.keyHash === args.where.keyHash) ?? null
            : null;

        if (!apiKey) {
          return null;
        }

        if (args.include?.user) {
          return {
            ...apiKey,
            user: users.get(apiKey.userId)!,
          };
        }

        return apiKey;
      },
      create: tx.apiKey.create,
      update: tx.apiKey.update,
      updateMany: tx.apiKey.updateMany,
    },
    socialAccount: {
      findUnique: async (args: {
        where: { provider_providerUserId: { provider: SocialAccountRecord['provider']; providerUserId: string } };
        include?: { user: true };
      }) => {
        const account =
          socialAccounts.get(
            `${args.where.provider_providerUserId.provider}:${args.where.provider_providerUserId.providerUserId}`,
          ) ?? null;

        if (!account) {
          return null;
        }

        if (args.include?.user) {
          return {
            ...account,
            user: users.get(account.userId)!,
          };
        }

        return account;
      },
    },
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
  };

  return {
    prisma,
    users,
    sessions,
    passwordResetTokens,
    emailVerificationTokens,
    socialAccounts,
    apiKeys,
    cartItems,
    cartCoupons,
    wishlistItems,
    addresses,
    notifications,
    orders,
    reservations,
    addUser,
  };
}

test('auth.register creates hashed customer account and returns verification debug token', async () => {
  const mock = createAuthMock();
  const service = new AuthService(mock.prisma as never);

  const result = await service.register('USER@Example.com', 'hello1234', 'User Demo', '0900000000');

  assert.equal(result.user.email, 'user@example.com');
  assert.equal(result.user.role, 'customer');
  assert.ok(result.debug?.verificationToken);
  assert.ok(result.csrfToken);

  const storedUser = [...mock.users.values()].find((user) => user.email === 'user@example.com');
  assert.ok(storedUser);
  assert.notEqual(storedUser?.passwordHash, 'hello1234');
  assert.equal(mock.sessions.size, 1);
  assert.equal(mock.emailVerificationTokens.size, 1);
});

test('auth.createGuestSession creates a guest user and returns tokens', async () => {
  const mock = createAuthMock();
  const service = new AuthService(mock.prisma as never);

  const result = await service.createGuestSession({ userAgent: 'guest-browser', ipAddress: '127.0.0.50' });

  assert.equal(result.user.role, 'guest');
  assert.match(result.user.email, /^guest\+.+@guest\.banhang\.local$/);
  assert.equal(result.csrfToken, service.createCsrfToken(result.refreshToken));
  assert.equal(mock.sessions.size, 1);

  const storedUser = mock.users.get(result.user.id);
  assert.ok(storedUser);
  assert.equal(storedUser?.role, 'guest');
  assert.ok(storedUser?.emailVerifiedAt instanceof Date);
});

test('auth.login merges guest context into an existing account', async () => {
  const mock = createAuthMock();
  mock.addUser({
    id: 'u-customer',
    email: 'user@example.com',
    passwordHash: await hashPassword('hello1234'),
    fullName: 'User Demo',
    role: 'customer',
  });
  mock.cartItems.set('ci-target', {
    id: 'ci-target',
    userId: 'u-customer',
    productId: 'p-1',
    variantId: 'pv-1',
    quantity: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const service = new AuthService(mock.prisma as never);
  const guest = await service.createGuestSession({ userAgent: 'guest', ipAddress: '127.0.0.10' });
  mock.cartItems.set('ci-guest', {
    id: 'ci-guest',
    userId: guest.user.id,
    productId: 'p-1',
    variantId: 'pv-1',
    quantity: 4,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  mock.cartCoupons.set(guest.user.id, {
    userId: guest.user.id,
    couponId: 'coupon-1',
    appliedAt: new Date(),
  });
  mock.wishlistItems.set('wi-guest', {
    id: 'wi-guest',
    userId: guest.user.id,
    productId: 'p-2',
    createdAt: new Date(),
  });
  mock.addresses.set('addr-guest', {
    id: 'addr-guest',
    userId: guest.user.id,
    fullName: 'Guest Address',
  });
  mock.notifications.set('notif-guest', {
    id: 'notif-guest',
    userId: guest.user.id,
    title: 'Guest notice',
  });
  mock.orders.set('ord-guest', {
    id: 'ord-guest',
    userId: guest.user.id,
    orderNumber: 'ORD-GUEST',
  });
  mock.reservations.set('res-guest', {
    id: 'res-guest',
    userId: guest.user.id,
    status: 'active',
  });

  const result = await service.login(
    'user@example.com',
    'hello1234',
    undefined,
    { userAgent: 'browser', ipAddress: '127.0.0.11' },
    guest.accessToken,
  );

  assert.equal(result.user.id, 'u-customer');
  assert.equal(mock.cartCoupons.get('u-customer')?.couponId, 'coupon-1');
  assert.equal(mock.cartCoupons.has(guest.user.id), false);
  assert.equal(mock.orders.get('ord-guest')?.userId, 'u-customer');
  assert.equal(mock.reservations.get('res-guest')?.userId, 'u-customer');
  assert.equal(mock.addresses.get('addr-guest')?.userId, 'u-customer');
  assert.equal(mock.notifications.get('notif-guest')?.userId, 'u-customer');
  assert.equal(
    [...mock.wishlistItems.values()].some((item) => item.userId === 'u-customer' && item.productId === 'p-2'),
    true,
  );
  assert.equal([...mock.sessions.values()].some((session) => session.userId === guest.user.id), false);

  const mergedCartItem = [...mock.cartItems.values()].find(
    (item) => item.userId === 'u-customer' && item.productId === 'p-1',
  );
  assert.ok(mergedCartItem);
  assert.equal(mergedCartItem?.quantity, 5);
  assert.equal([...mock.cartItems.values()].some((item) => item.userId === guest.user.id), false);
});

test('auth.register merges guest context into a new account', async () => {
  const mock = createAuthMock();
  const service = new AuthService(mock.prisma as never);
  const guest = await service.createGuestSession();

  mock.cartItems.set('ci-guest', {
    id: 'ci-guest',
    userId: guest.user.id,
    productId: 'p-2',
    variantId: 'pv-2',
    quantity: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  mock.orders.set('ord-guest', {
    id: 'ord-guest',
    userId: guest.user.id,
    orderNumber: 'ORD-GUEST-2',
  });

  const result = await service.register(
    'merged@example.com',
    'hello1234',
    'Merged User',
    undefined,
    { userAgent: 'browser', ipAddress: '127.0.0.20' },
    guest.accessToken,
  );

  assert.equal(result.user.email, 'merged@example.com');
  assert.equal([...mock.cartItems.values()].some((item) => item.userId === result.user.id && item.productId === 'p-2'), true);
  assert.equal(mock.orders.get('ord-guest')?.userId, result.user.id);
  assert.equal([...mock.sessions.values()].some((session) => session.userId === guest.user.id), false);
});

test('auth.login locks account after repeated failed attempts', async () => {
  const mock = createAuthMock();
  mock.addUser({
    id: 'u-1',
    email: 'user@example.com',
    passwordHash: await hashPassword('hello1234'),
    fullName: 'User Demo',
    role: 'customer',
  });

  const service = new AuthService(mock.prisma as never);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(
      async () => service.login('user@example.com', 'wrong-password'),
      (error: unknown) => error instanceof UnauthorizedException || error instanceof ForbiddenException,
    );
  }

  await assert.rejects(
    async () => service.login('user@example.com', 'hello1234'),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test('auth.refresh rotates refresh token and invalidates old session', async () => {
  const mock = createAuthMock();
  mock.addUser({
    id: 'u-1',
    email: 'user@example.com',
    passwordHash: await hashPassword('hello1234'),
    fullName: 'User Demo',
    role: 'customer',
  });

  const service = new AuthService(mock.prisma as never);
  const firstLogin = await service.login('user@example.com', 'hello1234');

  const refreshed = await service.refresh(firstLogin.refreshToken);

  assert.ok(refreshed.refreshToken.length > 40);
  assert.notEqual(refreshed.refreshToken, firstLogin.refreshToken);
  assert.notEqual(refreshed.csrfToken, firstLogin.csrfToken);
  assert.equal(mock.sessions.size, 1);
});

test('auth.refresh and logout enforce csrf when cookie mode is used', async () => {
  const mock = createAuthMock();
  mock.addUser({
    id: 'u-1',
    email: 'user@example.com',
    passwordHash: await hashPassword('hello1234'),
    fullName: 'User Demo',
    role: 'customer',
  });

  const service = new AuthService(mock.prisma as never);
  const firstLogin = await service.login('user@example.com', 'hello1234');

  await assert.rejects(
    async () => service.refresh(firstLogin.refreshToken, {}, { requireCsrf: true }),
    (error: unknown) => error instanceof UnauthorizedException,
  );

  await assert.rejects(
    async () =>
      service.refresh(firstLogin.refreshToken, {}, { requireCsrf: true, csrfToken: 'invalid-csrf-token' }),
    (error: unknown) => error instanceof UnauthorizedException,
  );

  const refreshed = await service.refresh(firstLogin.refreshToken, {}, {
    requireCsrf: true,
    csrfToken: firstLogin.csrfToken,
  });

  assert.ok(refreshed.accessToken);

  await assert.rejects(
    async () => service.logout(refreshed.refreshToken, 'u-1', { requireCsrf: true }),
    (error: unknown) => error instanceof UnauthorizedException,
  );

  const loggedOut = await service.logout(refreshed.refreshToken, 'u-1', {
    requireCsrf: true,
    csrfToken: refreshed.csrfToken,
  });

  assert.equal(loggedOut.success, true);
  assert.equal(mock.sessions.size, 0);
});

test('auth.forgotPassword and resetPassword rotate credentials and clear sessions', async () => {
  const mock = createAuthMock();
  mock.addUser({
    id: 'u-1',
    email: 'user@example.com',
    passwordHash: await hashPassword('hello1234'),
    fullName: 'User Demo',
    role: 'customer',
  });

  const service = new AuthService(mock.prisma as never);
  await service.login('user@example.com', 'hello1234');
  const forgot = await service.forgotPassword('user@example.com');

  assert.ok(forgot.debug?.resetToken);
  await service.resetPassword(forgot.debug!.resetToken, 'new-password-1234');

  await assert.rejects(
    async () => service.login('user@example.com', 'hello1234'),
    (error: unknown) => error instanceof UnauthorizedException,
  );

  const relogin = await service.login('user@example.com', 'new-password-1234');
  assert.ok(relogin.accessToken.length > 20);
  assert.equal(mock.sessions.size, 1);
});

test('auth.verifyEmail marks email as verified', async () => {
  const mock = createAuthMock();
  const service = new AuthService(mock.prisma as never);
  const result = await service.register('verify@example.com', 'hello1234', 'Verify Demo');

  await service.verifyEmail(result.debug!.verificationToken);

  const storedUser = [...mock.users.values()].find((user) => user.email === 'verify@example.com');
  assert.ok(storedUser?.emailVerifiedAt instanceof Date);
});

test('auth.requestEmailVerification issues a new token and handles verified or missing users', async () => {
  const mock = createAuthMock();
  mock.addUser({
    id: 'u-1',
    email: 'pending@example.com',
    passwordHash: await hashPassword('hello1234'),
    fullName: 'Pending User',
    role: 'customer',
  });
  mock.addUser({
    id: 'u-2',
    email: 'verified@example.com',
    passwordHash: await hashPassword('hello1234'),
    fullName: 'Verified User',
    role: 'customer',
    emailVerifiedAt: new Date(),
  });

  const service = new AuthService(mock.prisma as never);
  const issued = await service.requestEmailVerification('u-1');
  const alreadyVerified = await service.requestEmailVerification('u-2');

  assert.ok(issued.debug?.verificationToken);
  assert.equal(alreadyVerified.alreadyVerified, true);
  assert.equal(mock.emailVerificationTokens.size, 1);

  await assert.rejects(
    async () => service.requestEmailVerification('missing-user'),
    (error: unknown) => error instanceof UnauthorizedException,
  );
});

test('auth.session management and token verification work as expected', async () => {
  const mock = createAuthMock();
  mock.addUser({
    id: 'u-1',
    email: 'user@example.com',
    passwordHash: await hashPassword('hello1234'),
    fullName: 'User Demo',
    role: 'customer',
  });

  const service = new AuthService(mock.prisma as never);
  await service.login('user@example.com', 'hello1234', undefined, { userAgent: 'agent-1', ipAddress: '127.0.0.1' });
  await service.login('user@example.com', 'hello1234', undefined, { userAgent: 'agent-2', ipAddress: '127.0.0.2' });

  const sessions = await service.listSessions('u-1');
  assert.equal(sessions.data.length, 2);
  assert.equal(sessions.data[0].userAgent, 'agent-2');

  const revoked = await service.revokeSession(sessions.data[0].id, 'u-1');
  assert.equal(revoked.success, true);
  assert.equal(mock.sessions.size, 1);

  await service.logout(undefined, 'u-1');
  assert.equal(mock.sessions.size, 0);

  const validLogin = await service.login('user@example.com', 'hello1234');
  const payload = service.verifyAccessToken(validLogin.accessToken);
  assert.equal(payload.sub, 'u-1');

  const malformedToken = jwt.sign(
    { sub: 'u-1' },
    'test-jwt-secret-12345678901234567890',
    { expiresIn: 3600 },
  );

  await assert.rejects(
    async () => service.verifyEmail('invalid-token'),
    (error: unknown) => error instanceof UnauthorizedException,
  );

  assert.throws(
    () => service.verifyAccessToken(malformedToken),
    (error: unknown) => error instanceof UnauthorizedException,
  );
});

test('auth.socialLogin links existing users or creates new accounts', async () => {
  const mock = createAuthMock();
  mock.addUser({
    id: 'u-1',
    email: 'existing@example.com',
    passwordHash: await hashPassword('hello1234'),
    fullName: 'Existing User',
    role: 'customer',
  });

  const service = new AuthService(mock.prisma as never);
  const linked = await service.socialLogin(
    'google',
    'google-user-1',
    'existing@example.com',
    'Existing User',
  );
  const created = await service.socialLogin(
    'apple',
    'apple-user-1',
    'new-social@example.com',
    'New Social User',
  );

  assert.equal(linked.user.email, 'existing@example.com');
  assert.equal(linked.provider, 'google');
  assert.equal(created.user.email, 'new-social@example.com');
  assert.equal(created.isNewAccount, true);
  assert.equal(mock.socialAccounts.size, 2);
});

test('auth.2fa enable verify and login enforcement work', async () => {
  const mock = createAuthMock();
  mock.addUser({
    id: 'u-1',
    email: 'user@example.com',
    passwordHash: await hashPassword('hello1234'),
    fullName: 'User Demo',
    role: 'customer',
  });

  const service = new AuthService(mock.prisma as never);
  const enabled = await service.enableTwoFactor('u-1');
  const code = generateTotpCode(enabled.secret);

  assert.ok(enabled.secret.length > 20);
  assert.ok(enabled.otpauthUrl.includes('otpauth://totp/'));
  assert.ok(enabled.debug?.currentCode);

  const verified = await service.verifyTwoFactor('u-1', code);
  assert.equal(verified.enabled, true);

  await assert.rejects(
    async () => service.login('user@example.com', 'hello1234'),
    (error: unknown) => error instanceof UnauthorizedException,
  );

  const login = await service.login('user@example.com', 'hello1234', generateTotpCode(enabled.secret));
  assert.ok(login.accessToken.length > 20);
});

test('auth.apiKey management creates scoped keys and authenticates them', async () => {
  const mock = createAuthMock();
  mock.addUser({
    id: 'u-1',
    email: 'manager@example.com',
    passwordHash: await hashPassword('hello1234'),
    fullName: 'Manager Demo',
    role: 'manager',
  });

  const service = new AuthService(mock.prisma as never);
  const created = await service.createApiKey('u-1', 'Reporting Bot', ['reporting.read']);
  const listed = await service.listApiKeys('u-1');
  const payload = await service.authenticateApiKey(created.token);

  assert.equal(created.name, 'Reporting Bot');
  assert.equal(created.permissions[0], 'reporting.read');
  assert.equal(listed.data.length, 1);
  assert.equal(payload.authType, 'api_key');
  assert.deepEqual(payload.permissions, ['reporting.read']);
  assert.equal(mock.apiKeys.size, 1);

  await assert.rejects(
    async () => service.createApiKey('u-1', 'Invalid Scope', ['auth.manage']),
    (error: unknown) => error instanceof ForbiddenException,
  );

  const revoked = await service.revokeApiKey(listed.data[0].id, 'u-1');
  assert.equal(revoked.success, true);

  await assert.rejects(
    async () => service.authenticateApiKey(created.token),
    (error: unknown) => error instanceof UnauthorizedException,
  );
});

test('auth supports RS256 access tokens when JWT key pair is configured', async () => {
  const mock = createAuthMock();
  mock.addUser({
    id: 'u-1',
    email: 'rsa@example.com',
    passwordHash: await hashPassword('hello1234'),
    fullName: 'RSA User',
    role: 'customer',
  });

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { format: 'pem', type: 'pkcs1' },
    publicKeyEncoding: { format: 'pem', type: 'pkcs1' },
  });
  const previousPrivate = process.env.JWT_PRIVATE_KEY;
  const previousPublic = process.env.JWT_PUBLIC_KEY;

  process.env.JWT_PRIVATE_KEY = privateKey;
  process.env.JWT_PUBLIC_KEY = publicKey;

  try {
    const service = new AuthService(mock.prisma as never);
    const login = await service.login('rsa@example.com', 'hello1234');
    const payload = service.verifyAccessToken(login.accessToken);

    assert.equal(payload.email, 'rsa@example.com');
  } finally {
    if (previousPrivate === undefined) {
      delete process.env.JWT_PRIVATE_KEY;
    } else {
      process.env.JWT_PRIVATE_KEY = previousPrivate;
    }

    if (previousPublic === undefined) {
      delete process.env.JWT_PUBLIC_KEY;
    } else {
      process.env.JWT_PUBLIC_KEY = previousPublic;
    }
  }
});
