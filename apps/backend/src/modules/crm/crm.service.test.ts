import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { CrmService } from './crm.service';

function createCrmMock() {
  const users = [
    {
      id: 'u-vip',
      email: 'vip@banhang.local',
      fullName: 'VIP Customer',
      phone: '0909000001',
      role: 'customer',
      referralCode: 'VIP999',
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      lastLoginAt: new Date('2026-04-06T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-06T00:00:00.000Z'),
      orders: [
        {
          id: 'ord-1',
          orderNumber: 'ORD0001',
          total: 30_000_000,
          status: 'completed',
          paymentStatus: 'paid',
          createdAt: new Date('2026-03-10T00:00:00.000Z'),
          completedAt: new Date('2026-03-12T00:00:00.000Z'),
          items: [],
          payments: [{ id: 'pay-1', amount: 30_000_000 }],
        },
        {
          id: 'ord-2',
          orderNumber: 'ORD0002',
          total: 25_000_000,
          status: 'completed',
          paymentStatus: 'paid',
          createdAt: new Date('2026-02-10T00:00:00.000Z'),
          completedAt: new Date('2026-02-12T00:00:00.000Z'),
          items: [],
          payments: [{ id: 'pay-2', amount: 25_000_000 }],
        },
      ],
      addresses: [{ id: 'addr-1', isDefault: true }],
      wishlistItems: [
        {
          id: 'wl-1',
          product: {
            id: 'p-1',
            slug: 'iphone-15',
            name: 'iPhone 15',
            price: 19_990_000,
            media: [{ id: 'm-1', url: 'https://example.com/iphone.jpg' }],
          },
        },
      ],
      customerTags: [
        {
          id: 'ct-1',
          userId: 'u-vip',
          key: 'vip-watch',
          name: 'VIP Watch',
          color: '#D97706',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        },
      ],
      customerNotes: [
        {
          id: 'cn-1',
          userId: 'u-vip',
          authorId: 'u-admin',
          title: 'Priority support',
          content: 'Frequent flagship buyer.',
          isPinned: true,
          createdAt: new Date('2026-04-02T00:00:00.000Z'),
          updatedAt: new Date('2026-04-02T00:00:00.000Z'),
          author: {
            id: 'u-admin',
            email: 'admin@banhang.local',
            fullName: 'Admin Demo',
            role: 'admin',
          },
        },
      ],
      referralEvents: [
        {
          id: 'ref-1',
          rewardPoints: 200,
          status: 'rewarded',
          createdAt: new Date('2026-03-15T00:00:00.000Z'),
          referredUser: {
            id: 'u-friend',
            email: 'friend@banhang.local',
            fullName: 'Friend Demo',
            createdAt: new Date('2026-03-10T00:00:00.000Z'),
          },
        },
      ],
      loyaltyRedemptions: [
        {
          id: 'lr-1',
          pointsSpent: 500,
          createdAt: new Date('2026-03-20T00:00:00.000Z'),
          coupon: {
            id: 'cp-1',
            code: 'LOYAL-ABC',
            value: 50_000,
            expiresAt: new Date('2026-05-01T00:00:00.000Z'),
            isActive: true,
          },
        },
      ],
      notificationPreference: { userId: 'u-vip', marketingOptIn: true },
    },
    {
      id: 'u-new',
      email: 'new@banhang.local',
      fullName: 'New Customer',
      phone: '0909000002',
      role: 'customer',
      referralCode: 'NEW001',
      emailVerifiedAt: null,
      lastLoginAt: null,
      createdAt: new Date(Date.now() - 7 * 86_400_000),
      updatedAt: new Date(Date.now() - 7 * 86_400_000),
      orders: [],
      addresses: [],
      wishlistItems: [],
      customerTags: [],
      customerNotes: [],
      referralEvents: [],
      loyaltyRedemptions: [],
      notificationPreference: null,
    },
    {
      id: 'u-inactive',
      email: 'inactive@banhang.local',
      fullName: 'Inactive Customer',
      phone: '0909000003',
      role: 'customer',
      referralCode: 'INA001',
      emailVerifiedAt: new Date('2025-01-01T00:00:00.000Z'),
      lastLoginAt: new Date('2025-10-01T00:00:00.000Z'),
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      orders: [
        {
          id: 'ord-3',
          orderNumber: 'ORD0003',
          total: 1_200_000,
          status: 'completed',
          paymentStatus: 'paid',
          createdAt: new Date('2025-10-01T00:00:00.000Z'),
          completedAt: new Date('2025-10-02T00:00:00.000Z'),
          items: [],
          payments: [],
        },
      ],
      addresses: [],
      wishlistItems: [],
      customerTags: [],
      customerNotes: [],
      referralEvents: [],
      loyaltyRedemptions: [],
      notificationPreference: null,
    },
  ];

  const customerTags = users.flatMap((user) => user.customerTags);
  const customerNotes = users.flatMap((user) => user.customerNotes);

  function matchesRole(user: (typeof users)[number], roleClause: unknown) {
    if (!roleClause) {
      return true;
    }

    if (typeof roleClause === 'string') {
      return user.role === roleClause;
    }

    const values = (roleClause as { in?: string[] }).in;
    return values ? values.includes(user.role) : true;
  }

  function matchesKeyword(user: (typeof users)[number], where: Record<string, unknown>) {
    if (!Array.isArray(where.OR)) {
      return true;
    }

    return where.OR.some((entry) => {
      const clause = entry as Record<string, { contains?: string }>;
      return [user.email, user.fullName, user.phone ?? '', user.referralCode ?? ''].some((value) =>
        value.toLowerCase().includes((Object.values(clause)[0]?.contains ?? '').toLowerCase()),
      );
    });
  }

  const prisma = {
    user: {
      findMany: async (args: { where?: Record<string, unknown> }) =>
        users.filter((user) => {
          if (args.where && !matchesRole(user, args.where.role)) {
            return false;
          }
          if (args.where && !matchesKeyword(user, args.where)) {
            return false;
          }
          const tagKey = (args.where?.customerTags as { some?: { key?: string } } | undefined)?.some?.key;
          if (tagKey && !user.customerTags.some((tag) => tag.key === tagKey)) {
            return false;
          }
          return true;
        }),
      findFirst: async (args: { where: Record<string, unknown> }) =>
        users.find((user) => {
          if (args.where.id && user.id !== args.where.id) {
            return false;
          }
          if (!matchesRole(user, args.where.role)) {
            return false;
          }
          return true;
        }) ?? null,
    },
    customerTag: {
      findFirst: async (args: { where: { id?: string; userId?: string; key?: string } }) =>
        customerTags.find(
          (tag) =>
            (args.where.id === undefined || tag.id === args.where.id) &&
            (args.where.userId === undefined || tag.userId === args.where.userId) &&
            (args.where.key === undefined || tag.key === args.where.key),
        ) ?? null,
      create: async (args: { data: Record<string, unknown> }) => {
        const created = {
          id: `ct-${customerTags.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.data,
        };
        customerTags.push(created as never);
        const user = users.find((entry) => entry.id === created.userId)!;
        user.customerTags.push(created as never);
        return created;
      },
      delete: async (args: { where: { id: string } }) => {
        const index = customerTags.findIndex((tag) => tag.id === args.where.id);
        const [deleted] = customerTags.splice(index, 1);
        const user = users.find((entry) => entry.id === deleted!.userId)!;
        user.customerTags = user.customerTags.filter((tag) => tag.id !== deleted!.id);
        return deleted;
      },
    },
    customerNote: {
      findFirst: async (args: { where: { id?: string; userId?: string } }) =>
        customerNotes.find(
          (note) =>
            (args.where.id === undefined || note.id === args.where.id) &&
            (args.where.userId === undefined || note.userId === args.where.userId),
        ) ?? null,
      create: async (args: { data: Record<string, unknown>; include?: Record<string, unknown> }) => {
        const created = {
          id: `cn-${customerNotes.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.data,
          author: {
            id: 'u-admin',
            email: 'admin@banhang.local',
            fullName: 'Admin Demo',
            role: 'admin',
          },
        };
        customerNotes.push(created as never);
        const user = users.find((entry) => entry.id === created.userId)!;
        user.customerNotes.unshift(created as never);
        return created;
      },
      delete: async (args: { where: { id: string } }) => {
        const index = customerNotes.findIndex((note) => note.id === args.where.id);
        const [deleted] = customerNotes.splice(index, 1);
        const user = users.find((entry) => entry.id === deleted!.userId)!;
        user.customerNotes = user.customerNotes.filter((note) => note.id !== deleted!.id);
        return deleted;
      },
    },
  };

  return { prisma };
}

test('crm.listCustomers segments customers and filters by segment and tag', async () => {
  const { prisma } = createCrmMock();
  const service = new CrmService(prisma as never);

  const all = await service.listCustomers({ page: 1, limit: 10 });
  const vip = await service.listCustomers({ segment: 'vip', page: 1, limit: 10 });
  const tagged = await service.listCustomers({ tag: 'VIP Watch', page: 1, limit: 10 });

  assert.equal(all.total, 3);
  assert.equal(vip.total, 1);
  assert.equal(vip.data[0]?.segment, 'vip');
  assert.equal(vip.data[0]?.loyaltyTier, 'Platinum');
  assert.equal(tagged.total, 1);
  assert.equal(tagged.data[0]?.id, 'u-vip');
});

test('crm.detail returns customer profile with notes tags orders and wishlist', async () => {
  const { prisma } = createCrmMock();
  const service = new CrmService(prisma as never);

  const detail = await service.detail('u-vip');

  assert.equal(detail.id, 'u-vip');
  assert.equal(detail.orderCount, 2);
  assert.equal(detail.totalSpent, 55_000_000);
  assert.equal(detail.tags.length, 1);
  assert.equal(detail.notes.length, 1);
  assert.equal(detail.wishlist.length, 1);
  assert.equal(detail.segment, 'vip');

  await assert.rejects(
    async () => service.detail('missing-customer'),
    (error: unknown) => error instanceof NotFoundException,
  );
});

test('crm.addNote addTag removeTag and deleteNote manage customer annotations', async () => {
  const { prisma } = createCrmMock();
  const service = new CrmService(prisma as never);

  const note = await service.addNote('u-admin', 'u-new', {
    title: 'Follow up',
    content: 'Check if the customer needs onboarding help.',
    isPinned: true,
  });
  const tag = await service.addTag('u-new', {
    name: 'New Lead',
    color: '#22C55E',
  });
  const deletedTag = await service.removeTag('u-new', tag.id);
  const deletedNote = await service.deleteNote('u-new', note.id);

  assert.equal(note.isPinned, true);
  assert.equal(tag.key, 'new-lead');
  assert.deepEqual(deletedTag, { success: true, deletedId: tag.id });
  assert.deepEqual(deletedNote, { success: true, deletedId: note.id });
});
