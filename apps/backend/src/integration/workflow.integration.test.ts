import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { hashPassword } from '../common/security';
import { JwtGuard } from '../common/jwt.guard';
import { PermissionsGuard } from '../common/permissions.guard';
import { PrismaService } from '../infra/prisma/prisma.service';
import { AuthController } from '../modules/auth/auth.controller';
import { AuthService } from '../modules/auth/auth.service';
import { CartController } from '../modules/cart/cart.controller';
import { CartService } from '../modules/cart/cart.service';
import { OrdersController } from '../modules/orders/orders.controller';
import { OrdersService } from '../modules/orders/orders.service';
import { PaymentsController } from '../modules/payments/payments.controller';
import { PaymentsService } from '../modules/payments/payments.service';
import { ProductsController } from '../modules/products/products.controller';
import { ProductsService } from '../modules/products/products.service';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-12345678901234567890';
process.env.TOKEN_HASH_SECRET = 'test-token-hash-secret-12345678901234567890';
process.env.PAYMENT_WEBHOOK_SECRET = 'test-payment-webhook-secret-12345678901234567890';
process.env.JWT_ACCESS_TTL_SEC = '3600';
process.env.JWT_REFRESH_TTL_SEC = '604800';

function sign(body: unknown, secret: string) {
  return createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
}

async function createWorkflowMock() {
  const [adminPasswordHash, customerPasswordHash] = await Promise.all([
    hashPassword('admin12345'),
    hashPassword('customer12345'),
  ]);

  const state = {
    users: new Map<string, any>([
      [
        'u-admin',
        {
          id: 'u-admin',
          email: 'admin@banhang.local',
          passwordHash: adminPasswordHash,
          fullName: 'Admin Demo',
          phone: null,
          role: 'admin',
          emailVerifiedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      [
        'u-customer',
        {
          id: 'u-customer',
          email: 'customer@banhang.local',
          passwordHash: customerPasswordHash,
          fullName: 'Customer Demo',
          phone: '0900000000',
          role: 'customer',
          emailVerifiedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    ]),
    sessions: new Map<string, any>(),
    product: {
      id: 'p-1',
      sku: 'SKU-1',
      slug: 'iphone-15',
      name: 'iPhone 15',
      description: 'Demo product',
      price: 20_000_000,
      stock: 8,
      rating: 4.8,
      tags: ['featured'],
      status: 'active' as const,
      isFeatured: true,
      metaTitle: null,
      metaDescription: null,
      totalReviews: 0,
      totalSold: 10,
      categoryId: 'c-1',
      brandId: 'b-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    productVariant: {
      id: 'pv-1',
      productId: 'p-1',
      sku: 'SKU-1-BLACK',
      name: 'Black 128GB',
      price: 20_000_000,
      stock: 8,
      isDefault: true,
      isActive: true,
      attributes: { color: 'Black' },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    category: {
      id: 'c-1',
      name: 'Phones',
      slug: 'phones',
      description: null,
      parentId: null,
      sortOrder: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    brand: {
      id: 'b-1',
      name: 'Apple',
      slug: 'apple',
      description: null,
      logoUrl: null,
      website: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    productMedia: [
      {
        id: 'pm-1',
        productId: 'p-1',
        url: 'https://cdn.example.com/p-1.jpg',
        type: 'image',
        altText: 'iPhone 15',
        isPrimary: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    warehouses: [
      {
        id: 'w-main',
        code: 'MAIN',
        name: 'Main Warehouse',
        isDefault: true,
      },
    ],
    inventoryLevels: [
      {
        id: 'il-1',
        productId: 'p-1',
        variantId: 'pv-1',
        warehouseId: 'w-main',
        available: 8,
        reserved: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    cartItems: [] as any[],
    cartCoupons: new Map<string, any>(),
    wishlistItems: [] as any[],
    addresses: [] as any[],
    reservations: new Map<string, any>(),
    reservationItems: [] as any[],
    reservationAllocations: [] as any[],
    orders: new Map<string, any>(),
    orderItems: [] as any[],
    orderEvents: [] as any[],
    payments: new Map<string, any>(),
    paymentEvents: new Map<string, any>(),
    notifications: [] as any[],
    movements: [] as any[],
    seq: 1,
  };

  function userByEmail(email: string) {
    return [...state.users.values()].find((user) => user.email === email) ?? null;
  }

  function materializeReservation(reservation: any) {
    return {
      ...reservation,
      items: state.reservationItems
        .filter((item) => item.reservationId === reservation.id)
        .map((item) => ({
          ...item,
          product: materializeProduct(),
          variant: item.variantId === state.productVariant.id ? { ...state.productVariant } : null,
          allocations: state.reservationAllocations
            .filter((allocation) => allocation.reservationItemId === item.id)
            .map((allocation) => ({
              ...allocation,
              warehouse: state.warehouses.find((warehouse) => warehouse.id === allocation.warehouseId)!,
            })),
        })),
    };
  }

  function materializeProduct() {
    return {
      ...state.product,
      variants: [{ ...state.productVariant }],
      category: state.category,
      brand: state.brand,
      media: [...state.productMedia].sort((left, right) => {
        if (left.isPrimary === right.isPrimary) {
          return left.sortOrder - right.sortOrder;
        }
        return left.isPrimary ? -1 : 1;
      }),
    };
  }

  function materializeOrder(order: any, include?: Record<string, unknown>) {
    return {
      ...order,
      items: include?.items
        ? state.orderItems
            .filter((item) => item.orderId === order.id)
            .map((item) => ({
              ...item,
              product: materializeProduct(),
              variant: item.variantId === state.productVariant.id ? { ...state.productVariant } : null,
            }))
        : undefined,
      history: include?.history
        ? state.orderEvents
            .filter((item) => item.orderId === order.id)
            .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        : undefined,
      reservation:
        include?.reservation && order.reservationId
          ? materializeReservation(state.reservations.get(order.reservationId))
          : null,
      payments: include?.payments
        ? [...state.payments.values()].filter((item) => item.orderId === order.id)
        : undefined,
      coupon: null,
    };
  }

  const tx = {
    user: {
      findUnique: async ({ where }: { where: { email?: string; id?: string } }) =>
        where.id ? state.users.get(where.id) ?? null : where.email ? userByEmail(where.email) : null,
      create: async ({ data }: { data: any }) => {
        const user = {
          id: `u-${state.seq++}`,
          phone: null,
          emailVerifiedAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        state.users.set(user.id, user);
        return user;
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const user = state.users.get(where.id);
        if (!user) {
          throw new Error('user not found');
        }
        const updated = { ...user, ...data, updatedAt: new Date() };
        state.users.set(where.id, updated);
        return updated;
      },
    },
    notification: {
      create: async ({ data }: { data: any }) => {
        const notification = {
          id: `notif-${state.seq++}`,
          ...data,
        };
        state.notifications.push(notification);
        return notification;
      },
      updateMany: async ({ where, data }: { where: { userId: string }; data: { userId: string } }) => {
        let count = 0;
        state.notifications = state.notifications.map((notification) => {
          if (notification.userId !== where.userId) {
            return notification;
          }

          count += 1;
          return {
            ...notification,
            userId: data.userId,
          };
        });
        return { count };
      },
    },
    emailVerificationToken: {
      create: async ({ data }: { data: any }) => ({
        id: `evt-${state.seq++}`,
        createdAt: new Date(),
        consumedAt: null,
        ...data,
      }),
    },
    refreshSession: {
      create: async ({ data }: { data: any }) => {
        const session = {
          id: `sess-${state.seq++}`,
          createdAt: new Date(),
          ...data,
        };
        state.sessions.set(session.id, session);
        return session;
      },
      deleteMany: async ({ where }: { where: { userId?: string; tokenHash?: string; expiresAt?: { lt: Date } } }) => {
        let count = 0;
        for (const [id, session] of state.sessions.entries()) {
          const byUser = where.userId ? session.userId === where.userId : true;
          const byHash = where.tokenHash ? session.tokenHash === where.tokenHash : true;
          const byExpiry = where.expiresAt?.lt ? session.expiresAt < where.expiresAt.lt : true;
          if (byUser && byHash && byExpiry) {
            state.sessions.delete(id);
            count += 1;
          }
        }
        return { count };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const session = state.sessions.get(where.id);
        if (!session) {
          throw new Error('session not found');
        }
        state.sessions.delete(where.id);
        return session;
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        [...state.sessions.values()].find((session) => session.tokenHash === where.tokenHash) ?? null,
      findMany: async ({ where }: { where: { userId: string } }) =>
        [...state.sessions.values()].filter((session) => session.userId === where.userId),
    },
    inventoryReservation: {
      findMany: async ({ where }: { where: { status: string; expiresAt: { lt: Date } } }) =>
        [...state.reservations.values()]
          .filter((item) => item.status === where.status && item.expiresAt < where.expiresAt.lt)
          .map((item) => ({ id: item.id })),
      findFirst: async ({ where, include }: { where: { userId: string; status: string; expiresAt: { gt: Date } }; include?: any }) => {
        const reservation =
          [...state.reservations.values()].find(
            (item) =>
              item.userId === where.userId &&
              item.status === where.status &&
              item.expiresAt > where.expiresAt.gt,
          ) ?? null;
        if (!reservation) {
          return null;
        }
        return include ? materializeReservation(reservation) : reservation;
      },
      findUnique: async ({ where, include }: { where: { id: string }; include?: any }) => {
        const reservation = state.reservations.get(where.id) ?? null;
        if (!reservation) {
          return null;
        }
        return include ? materializeReservation(reservation) : reservation;
      },
      create: async ({ data }: { data: any }) => {
        const reservation = {
          id: `res-${state.seq++}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          consumedAt: null,
          canceledAt: null,
          expiredAt: null,
          ...data,
        };
        state.reservations.set(reservation.id, reservation);
        return reservation;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; status: string } | { userId: string };
        data: any;
      }) => {
        if ('id' in where) {
          const reservation = state.reservations.get(where.id);
          if (!reservation || reservation.status !== where.status) {
            return { count: 0 };
          }
          state.reservations.set(where.id, { ...reservation, ...data, updatedAt: new Date() });
          return { count: 1 };
        }

        let count = 0;
        for (const [id, reservation] of state.reservations.entries()) {
          if (reservation.userId !== where.userId) {
            continue;
          }
          state.reservations.set(id, { ...reservation, ...data, updatedAt: new Date() });
          count += 1;
        }
        return { count };
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const reservation = state.reservations.get(where.id);
        if (!reservation) {
          throw new Error('reservation not found');
        }
        const updated = { ...reservation, ...data, updatedAt: new Date() };
        state.reservations.set(where.id, updated);
        return updated;
      },
    },
    inventoryReservationItem: {
      create: async ({ data }: { data: any }) => {
        const item = {
          id: `ri-${state.seq++}`,
          ...data,
        };
        state.reservationItems.push(item);
        return item;
      },
      createMany: async ({ data }: { data: any[] }) => {
        state.reservationItems.push(...data.map((item) => ({ id: `ri-${state.seq++}`, ...item })));
        return { count: data.length };
      },
    },
    inventoryReservationAllocation: {
      createMany: async ({ data }: { data: any[] }) => {
        state.reservationAllocations.push(...data.map((item) => ({ id: `ra-${state.seq++}`, ...item })));
        return { count: data.length };
      },
    },
    inventoryLevel: {
      findMany: async ({ where, include }: { where: { productId: string; variantId: string; available: { gt: number } }; include?: { warehouse?: true } }) =>
        state.inventoryLevels
          .filter(
            (level) =>
              level.productId === where.productId &&
              level.variantId === where.variantId &&
              level.available > where.available.gt,
          )
          .map((level) => ({
            ...level,
            warehouse: include?.warehouse ? state.warehouses.find((warehouse) => warehouse.id === level.warehouseId) : undefined,
          })),
      update: async ({ where, data }: { where: { variantId_warehouseId: { variantId: string; warehouseId: string } }; data: any }) => {
        const level = state.inventoryLevels.find(
          (item) =>
            item.variantId === where.variantId_warehouseId.variantId &&
            item.warehouseId === where.variantId_warehouseId.warehouseId,
        );
        if (!level) {
          throw new Error('inventory level not found');
        }
        if (data.available?.decrement) {
          level.available -= data.available.decrement;
        }
        if (data.available?.increment) {
          level.available += data.available.increment;
        }
        if (data.reserved?.increment) {
          level.reserved += data.reserved.increment;
        }
        if (data.reserved?.decrement) {
          level.reserved -= data.reserved.decrement;
        }
        level.updatedAt = new Date();
        return level;
      },
    },
    cartItem: {
      findMany: async ({
        where,
        include,
        select,
      }: {
        where: { userId: string; productId?: string };
        include?: { product?: true; variant?: true };
        select?: { id?: true; variantId?: true };
      }) => {
        let rows = state.cartItems.filter((item) => item.userId === where.userId);
        if (where.productId) {
          rows = rows.filter((item) => item.productId === where.productId);
        }

        if (select) {
          return rows.map((item) => ({
            id: select.id ? item.id : undefined,
            variantId: select.variantId ? item.variantId : undefined,
          }));
        }

        return rows.map((item) => ({
          ...item,
          product: include?.product ? materializeProduct() : undefined,
          variant: include?.variant && item.variantId === state.productVariant.id ? { ...state.productVariant } : undefined,
        }));
      },
      findFirst: async ({ where }: { where: { userId: string; productId: string; variantId: string } }) =>
        state.cartItems.find(
          (item) =>
            item.userId === where.userId &&
            item.productId === where.productId &&
            item.variantId === where.variantId,
        ) ?? null,
      create: async ({ data }: { data: any }) => {
        const item = {
          id: `ci-${state.seq++}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        state.cartItems.push(item);
        return item;
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const item = state.cartItems.find((row) => row.id === where.id);
        if (!item) {
          throw new Error('cart item not found');
        }
        Object.assign(item, data, { updatedAt: new Date() });
        return item;
      },
      deleteMany: async ({ where }: { where: { userId?: string; productId?: string; variantId?: string } }) => {
        const before = state.cartItems.length;
        state.cartItems = state.cartItems.filter((item) => {
          if (where.userId && item.userId !== where.userId) {
            return true;
          }
          if (where.productId && item.productId !== where.productId) {
            return true;
          }
          if (where.variantId && item.variantId !== where.variantId) {
            return true;
          }
          return false;
        });
        return { count: before - state.cartItems.length };
      },
    },
    product: {
      findUnique: async ({ where, include }: { where: { id: string }; include?: { variants?: true | Record<string, unknown> } }) =>
        state.product.id === where.id
          ? include?.variants
            ? materializeProduct()
            : state.product
          : null,
      findMany: async () => [materializeProduct()],
      findFirst: async ({ where }: { where: { OR: Array<{ id?: string; slug?: string }> } }) =>
        where.OR.some((entry) => entry.id === state.product.id || entry.slug === state.product.slug)
          ? materializeProduct()
          : null,
      count: async () => 1,
      updateMany: async ({ where, data }: { where: { id: string; stock: { gte: number } }; data: { stock: { decrement: number } } }) => {
        if (state.product.id !== where.id || state.product.stock < where.stock.gte) {
          return { count: 0 };
        }
        state.product.stock -= data.stock.decrement;
        return { count: 1 };
      },
      update: async ({ data }: { where: { id: string }; data: any }) => {
        if (data.stock?.increment) {
          state.product.stock += data.stock.increment;
        } else {
          Object.assign(state.product, data, { updatedAt: new Date() });
        }
        return state.product;
      },
    },
    productVariant: {
      updateMany: async ({ where, data }: { where: { id: string; stock: { gte: number } }; data: { stock: { decrement: number } } }) => {
        if (state.productVariant.id !== where.id || state.productVariant.stock < where.stock.gte) {
          return { count: 0 };
        }
        state.productVariant.stock -= data.stock.decrement;
        return { count: 1 };
      },
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        if (state.productVariant.id !== where.id) {
          throw new Error('variant not found');
        }
        if (data.stock?.increment) {
          state.productVariant.stock += data.stock.increment;
        } else {
          Object.assign(state.productVariant, data, { updatedAt: new Date() });
        }
        return state.productVariant;
      },
    },
    category: {
      findMany: async () => [state.category],
    },
    brand: {
      findMany: async () => [state.brand],
    },
    inventoryMovement: {
      create: async ({ data }: { data: any }) => {
        state.movements.push(data);
        return data;
      },
    },
    cartCoupon: {
      findUnique: async ({ where }: { where: { userId: string } }) => state.cartCoupons.get(where.userId) ?? null,
      upsert: async ({ where, create, update }: { where: { userId: string }; create: any; update: any }) => {
        const existing = state.cartCoupons.get(where.userId);
        const next = existing
          ? { ...existing, ...update }
          : { userId: create.userId, couponId: create.couponId, appliedAt: new Date() };
        state.cartCoupons.set(where.userId, next);
        return next;
      },
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        const existed = state.cartCoupons.delete(where.userId);
        return { count: existed ? 1 : 0 };
      },
      delete: async () => ({ userId: 'u-customer' }),
    },
    address: {
      findFirst: async () => null,
      create: async ({ data }: { data: any }) => {
        const address = {
          id: `addr-${state.seq++}`,
          ...data,
        };
        state.addresses.push(address);
        return address;
      },
      updateMany: async ({ where, data }: { where: { userId: string }; data: { userId: string } }) => {
        let count = 0;
        state.addresses = state.addresses.map((address) => {
          if (address.userId !== where.userId) {
            return address;
          }

          count += 1;
          return {
            ...address,
            userId: data.userId,
          };
        });
        return { count };
      },
    },
    order: {
      create: async ({ data }: { data: any }) => {
        const order = {
          id: `ord-${state.seq++}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          confirmedAt: null,
          shippedAt: null,
          deliveredAt: null,
          completedAt: null,
          canceledAt: null,
          returnedAt: null,
          ...data,
        };
        state.orders.set(order.id, order);
        return order;
      },
      findUnique: async ({ where, include }: { where: { id: string }; include?: any }) => {
        const order = state.orders.get(where.id) ?? null;
        if (!order) {
          return null;
        }
        return include ? materializeOrder(order, include) : order;
      },
      update: async ({ where, data, select }: { where: { id: string }; data: any; select?: any }) => {
        const order = state.orders.get(where.id);
        if (!order) {
          throw new Error('order not found');
        }
        const updated = { ...order, ...data, updatedAt: new Date() };
        state.orders.set(where.id, updated);
        return select ? { id: updated.id, paymentStatus: updated.paymentStatus } : updated;
      },
      count: async ({ where }: { where?: { userId?: string } }) =>
        where?.userId
          ? [...state.orders.values()].filter((order) => order.userId === where.userId).length
          : state.orders.size,
      findMany: async ({ where, include }: { where?: { userId?: string }; include?: any }) =>
        [...state.orders.values()]
          .filter((order) => (where?.userId ? order.userId === where.userId : true))
          .map((order) => materializeOrder(order, include)),
      updateMany: async ({ where, data }: { where: { userId: string }; data: { userId: string } }) => {
        let count = 0;
        for (const [id, order] of state.orders.entries()) {
          if (order.userId !== where.userId) {
            continue;
          }
          state.orders.set(id, { ...order, userId: data.userId, updatedAt: new Date() });
          count += 1;
        }
        return { count };
      },
    },
    orderItem: {
      createMany: async ({ data }: { data: any[] }) => {
        state.orderItems.push(...data.map((item) => ({ id: `oi-${state.seq++}`, ...item })));
        return { count: data.length };
      },
    },
    orderStatusEvent: {
      create: async ({ data }: { data: any }) => {
        const event = { id: `oe-${state.seq++}`, createdAt: new Date(), ...data };
        state.orderEvents.push(event);
        return event;
      },
    },
    payment: {
      create: async ({ data }: { data: any }) => {
        const payment = {
          id: `pay-${state.seq++}`,
          transactionId: null,
          metadata: null,
          refundedAmount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        state.payments.set(payment.id, payment);
        return payment;
      },
      findUnique: async ({ where, include }: { where: { id: string }; include?: any }) => {
        const payment = state.payments.get(where.id) ?? null;
        if (!payment) {
          return null;
        }
        return include?.order ? { ...payment, order: state.orders.get(payment.orderId) } : payment;
      },
      findFirst: async ({ where }: { where: { orderId: string } }) =>
        [...state.payments.values()].find((payment) => payment.orderId === where.orderId) ?? null,
      update: async ({ where, data, select }: { where: { id: string }; data: any; select?: any }) => {
        const payment = state.payments.get(where.id);
        if (!payment) {
          throw new Error('payment not found');
        }
        const updated = { ...payment, ...data, updatedAt: new Date() };
        state.payments.set(where.id, updated);
        return select ? { id: updated.id, status: updated.status } : updated;
      },
      updateMany: async ({ where, data }: { where: { orderId: string }; data: any }) => {
        let count = 0;
        for (const [id, payment] of state.payments.entries()) {
          if (payment.orderId !== where.orderId) {
            continue;
          }
          state.payments.set(id, { ...payment, ...data, updatedAt: new Date() });
          count += 1;
        }
        return { count };
      },
    },
    coupon: {
      update: async () => ({ count: 1 }),
    },
    wishlistItem: {
      findMany: async ({ where }: { where: { userId: string } }) =>
        state.wishlistItems.filter((item) => item.userId === where.userId),
      upsert: async ({ where, create }: { where: { userId_productId: { userId: string; productId: string } }; create: any }) => {
        const existing = state.wishlistItems.find(
          (item) =>
            item.userId === where.userId_productId.userId &&
            item.productId === where.userId_productId.productId,
        );
        if (existing) {
          return existing;
        }
        const item = {
          id: `wish-${state.seq++}`,
          createdAt: new Date(),
          ...create,
        };
        state.wishlistItems.push(item);
        return item;
      },
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        const before = state.wishlistItems.length;
        state.wishlistItems = state.wishlistItems.filter((item) => item.userId !== where.userId);
        return { count: before - state.wishlistItems.length };
      },
    },
    paymentWebhookEvent: {
      create: async ({ data }: { data: any }) => {
        state.paymentEvents.set(data.eventId, data);
        return data;
      },
    },
  };

  const prisma = {
    user: {
      findUnique: async ({ where, select }: { where: { email?: string; id?: string }; select?: { id: true } }) => {
        const user = where.id ? state.users.get(where.id) ?? null : where.email ? userByEmail(where.email) : null;
        if (!user) {
          return null;
        }
        return select?.id ? { id: user.id } : user;
      },
      create: tx.user.create,
      update: tx.user.update,
    },
    refreshSession: tx.refreshSession,
    emailVerificationToken: tx.emailVerificationToken,
    product: tx.product,
    productVariant: tx.productVariant,
    category: tx.category,
    brand: tx.brand,
    cartItem: tx.cartItem,
    cartCoupon: tx.cartCoupon,
    coupon: {
      findFirst: async () => null,
    },
    wishlistItem: tx.wishlistItem,
    inventoryReservation: tx.inventoryReservation,
    inventoryReservationItem: tx.inventoryReservationItem,
    inventoryMovement: tx.inventoryMovement,
    address: tx.address,
    notification: tx.notification,
    order: tx.order,
    orderItem: tx.orderItem,
    orderStatusEvent: tx.orderStatusEvent,
    payment: tx.payment,
    paymentWebhookEvent: {
      findUnique: async ({ where }: { where: { eventId: string } }) => state.paymentEvents.get(where.eventId) ?? null,
    },
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
  };

  return { prisma, state };
}

async function createTestApp() {
  const mock = await createWorkflowMock();
  const moduleRef = await Test.createTestingModule({
    controllers: [
      AuthController,
      ProductsController,
      CartController,
      OrdersController,
      PaymentsController,
    ],
    providers: [
      Reflector,
      JwtGuard,
      PermissionsGuard,
      AuthService,
      ProductsService,
      CartService,
      OrdersService,
      PaymentsService,
      {
        provide: PrismaService,
        useValue: mock.prisma,
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();

  return { app, state: mock.state };
}

function checkoutPayload(reservationId: string, paymentMethod: 'cod' | 'vnpay' = 'cod') {
  return {
    reservationId,
    paymentMethod,
    shippingMethod: 'standard',
    address: {
      receiverName: 'Khach Demo',
      phone: '0900000000',
      province: 'Ho Chi Minh',
      district: 'Quan 1',
      ward: 'Ben Nghe',
      addressLine: '123 Nguyen Trai',
      country: 'Viet Nam',
    },
  };
}

test('workflow http reserve -> checkout -> payment webhook -> complete order', async () => {
  const { app, state } = await createTestApp();
  const server = request(app.getHttpServer());

  try {
    const productsResponse = await server.get('/api/v1/products?limit=1').expect(200);
    assert.equal(productsResponse.body.data.length, 1);
    const productId = productsResponse.body.data[0].id;

    const customerLogin = await server.post('/api/v1/auth/login').send({
      email: 'customer@banhang.local',
      password: 'customer12345',
    }).expect(201);
    const customerToken = customerLogin.body.accessToken as string;

    const adminLogin = await server.post('/api/v1/auth/login').send({
      email: 'admin@banhang.local',
      password: 'admin12345',
    }).expect(201);
    const adminToken = adminLogin.body.accessToken as string;

    await server
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId, quantity: 1 })
      .expect(201);

    const reservationResponse = await server
      .post('/api/v1/orders/reservations')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(201);

    const reservationId = reservationResponse.body.id as string;
    const checkoutResponse = await server
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(checkoutPayload(reservationId, 'vnpay'))
      .expect(201);

    const orderId = checkoutResponse.body.id as string;
    const payment = [...state.payments.values()][0];

    const webhookBody = {
      eventId: 'evt-http-paid-1',
      type: 'payment.captured',
      orderId,
      paymentId: payment.id,
      transactionId: 'txn-http-1',
      payload: { amount: checkoutResponse.body.total },
    };

    await server
      .post('/api/v1/payments/webhook/vnpay')
      .set('x-webhook-signature', sign(webhookBody, process.env.PAYMENT_WEBHOOK_SECRET!))
      .send(webhookBody)
      .expect(201);

    await server
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'confirmed' })
      .expect(200);
    await server
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'shipping' })
      .expect(200);
    const completedResponse = await server
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'completed' })
      .expect(200);

    const ordersResponse = await server
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const trackingResponse = await server
      .get(`/api/v1/orders/${orderId}/tracking`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    assert.equal(completedResponse.body.status, 'completed');
    assert.equal(completedResponse.body.paymentStatus, 'paid');
    assert.equal(ordersResponse.body.total, 1);
    assert.equal(ordersResponse.body.data[0].id, orderId);
    assert.equal(trackingResponse.body.shippingStatus, 'delivered');
    assert.equal(state.payments.get(payment.id)?.status, 'paid');
  } finally {
    await app.close();
  }
});

test('workflow http duplicate webhook remains idempotent', async () => {
  const { app, state } = await createTestApp();
  const server = request(app.getHttpServer());

  try {
    const loginResponse = await server.post('/api/v1/auth/login').send({
      email: 'customer@banhang.local',
      password: 'customer12345',
    }).expect(201);
    const token = loginResponse.body.accessToken as string;

    await server
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: 'p-1', quantity: 1 })
      .expect(201);

    const reservationResponse = await server
      .post('/api/v1/orders/reservations')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const checkoutResponse = await server
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send(checkoutPayload(reservationResponse.body.id, 'vnpay'))
      .expect(201);

    const payment = [...state.payments.values()][0];
    const webhookBody = {
      eventId: 'evt-http-dup',
      type: 'payment.captured',
      orderId: checkoutResponse.body.id,
      paymentId: payment.id,
      payload: { amount: checkoutResponse.body.total },
    };
    const signature = sign(webhookBody, process.env.PAYMENT_WEBHOOK_SECRET!);

    const first = await server
      .post('/api/v1/payments/webhook/vnpay')
      .set('x-webhook-signature', signature)
      .send(webhookBody)
      .expect(201);

    const second = await server
      .post('/api/v1/payments/webhook/vnpay')
      .set('x-webhook-signature', signature)
      .send(webhookBody)
      .expect(201);

    assert.equal(first.body.processed, true);
    assert.equal(second.body.processed, false);
    assert.equal(second.body.reason, 'duplicate_event');
  } finally {
    await app.close();
  }
});

test('workflow http guest session can checkout without registration', async () => {
  const { app, state } = await createTestApp();
  const server = request(app.getHttpServer());

  try {
    const guestSession = await server.post('/api/v1/auth/guest').send({}).expect(201);
    const guestToken = guestSession.body.accessToken as string;

    assert.equal(guestSession.body.user.role, 'guest');
    assert.match(guestSession.body.user.email, /^guest\+.+@guest\.banhang\.local$/);

    await server
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ productId: 'p-1', quantity: 1 })
      .expect(201);

    const reservationResponse = await server
      .post('/api/v1/orders/reservations')
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(201);

    const checkoutResponse = await server
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${guestToken}`)
      .send(checkoutPayload(reservationResponse.body.id, 'cod'))
      .expect(201);

    const ordersResponse = await server
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);

    const trackingResponse = await server
      .get(`/api/v1/orders/${checkoutResponse.body.id}/tracking`)
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);

    assert.equal(checkoutResponse.body.userId, guestSession.body.user.id);
    assert.equal(checkoutResponse.body.paymentMethod, 'cod');
    assert.equal(ordersResponse.body.total, 1);
    assert.equal(ordersResponse.body.data[0].userId, guestSession.body.user.id);
    assert.equal(trackingResponse.body.orderId, checkoutResponse.body.id);
    assert.equal(state.notifications.length > 0, true);
  } finally {
    await app.close();
  }
});

test('workflow http register merges guest cart into new account', async () => {
  const { app } = await createTestApp();
  const server = request(app.getHttpServer());

  try {
    const guestSession = await server.post('/api/v1/auth/guest').send({}).expect(201);
    const guestToken = guestSession.body.accessToken as string;

    await server
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ productId: 'p-1', quantity: 2 })
      .expect(201);

    const registerResponse = await server.post('/api/v1/auth/register').send({
      email: 'merged-cart@example.com',
      password: 'hello1234',
      fullName: 'Merged Cart User',
      guestAccessToken: guestToken,
    }).expect(201);
    const userToken = registerResponse.body.accessToken as string;

    const mergedCart = await server
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    const guestCart = await server
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${guestToken}`)
      .expect(200);

    assert.equal(mergedCart.body.totalItems, 2);
    assert.equal(mergedCart.body.items[0].productId, 'p-1');
    assert.equal(guestCart.body.totalItems, 0);
  } finally {
    await app.close();
  }
});
