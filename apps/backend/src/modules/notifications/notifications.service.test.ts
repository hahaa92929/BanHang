import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

function createNotificationsMock() {
  const now = new Date('2026-04-05T10:00:00.000Z');
  const notifications = [
    {
      id: 'n-1',
      userId: 'u-1',
      type: 'order',
      channel: 'in_app',
      templateKey: 'order.shipped',
      campaignKey: null,
      title: 'Order shipped',
      content: 'Your order is on the way.',
      data: null,
      isRead: false,
      scheduledFor: null,
      deliveredAt: new Date('2026-04-01T10:00:00.000Z'),
      openedAt: null,
      clickedAt: null,
      readAt: null,
      createdAt: new Date('2026-04-01T10:00:00.000Z'),
    },
    {
      id: 'n-2',
      userId: 'u-1',
      type: 'promotion',
      channel: 'email',
      templateKey: 'price.drop',
      campaignKey: null,
      title: 'Price drop',
      content: 'A saved product has a new price.',
      data: null,
      isRead: true,
      scheduledFor: null,
      deliveredAt: new Date('2026-04-02T10:00:00.000Z'),
      openedAt: new Date('2026-04-02T10:30:00.000Z'),
      clickedAt: null,
      readAt: new Date('2026-04-02T10:30:00.000Z'),
      createdAt: new Date('2026-04-02T10:00:00.000Z'),
    },
    {
      id: 'n-3',
      userId: 'u-2',
      type: 'security',
      channel: 'in_app',
      templateKey: 'security.login',
      campaignKey: null,
      title: 'New login',
      content: 'New sign-in detected.',
      data: null,
      isRead: false,
      scheduledFor: null,
      deliveredAt: new Date('2026-04-03T10:00:00.000Z'),
      openedAt: null,
      clickedAt: null,
      readAt: null,
      createdAt: new Date('2026-04-03T10:00:00.000Z'),
    },
    {
      id: 'n-4',
      userId: 'u-1',
      type: 'promotion',
      channel: 'email',
      templateKey: 'campaign.future',
      campaignKey: 'future-campaign',
      title: 'Future sale',
      content: 'This should stay hidden until dispatch.',
      data: null,
      isRead: false,
      scheduledFor: new Date('2026-04-07T10:00:00.000Z'),
      deliveredAt: null,
      openedAt: null,
      clickedAt: null,
      readAt: null,
      createdAt: new Date('2026-04-05T09:00:00.000Z'),
    },
  ];
  const preferences = new Map<string, Record<string, unknown>>();
  const users = [{ id: 'u-1' }, { id: 'u-2' }];
  const templates = [
    {
      id: 'tpl-1',
      key: 'order.shipped',
      channel: 'email',
      subjectTemplate: 'Order {{order.number}} shipped',
      titleTemplate: 'Hi {{customer.name}}',
      contentTemplate: 'Tracking code: {{order.trackingCode}}',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  function compareValue(actual: unknown, condition: unknown) {
    if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
      const operator = condition as Record<string, unknown>;

      if ('in' in operator && Array.isArray(operator.in)) {
        return operator.in.includes(actual);
      }

      if ('lte' in operator) {
        return actual instanceof Date && actual <= (operator.lte as Date);
      }

      if ('not' in operator) {
        return actual !== operator.not;
      }

      return false;
    }

    return actual === condition;
  }

  function matchesWhere(item: Record<string, unknown>, where?: Record<string, unknown>): boolean {
    if (!where) {
      return true;
    }

    if (Array.isArray(where.AND)) {
      return where.AND.every((clause) => matchesWhere(item, clause as Record<string, unknown>));
    }

    if (Array.isArray(where.OR)) {
      return where.OR.some((clause) => matchesWhere(item, clause as Record<string, unknown>));
    }

    return Object.entries(where).every(([key, condition]) => {
      if (key === 'AND' || key === 'OR') {
        return true;
      }

      return compareValue(item[key], condition);
    });
  }

  function filterNotifications(where?: Record<string, unknown>) {
    return notifications.filter((item) => matchesWhere(item as Record<string, unknown>, where));
  }

  const prisma = {
    notification: {
      count: async (args?: { where?: Record<string, unknown> }) => filterNotifications(args?.where).length,
      findMany: async (args?: {
        where?: Record<string, unknown>;
        orderBy?: { createdAt?: 'desc' | 'asc'; scheduledFor?: 'desc' | 'asc' };
        skip?: number;
        take?: number;
      }) => {
        const rows = filterNotifications(args?.where).sort((left, right) => {
          if (args?.orderBy?.scheduledFor) {
            const leftTime = left.scheduledFor instanceof Date ? left.scheduledFor.getTime() : 0;
            const rightTime = right.scheduledFor instanceof Date ? right.scheduledFor.getTime() : 0;
            return args.orderBy.scheduledFor === 'asc' ? leftTime - rightTime : rightTime - leftTime;
          }

          return args?.orderBy?.createdAt === 'asc'
            ? left.createdAt.getTime() - right.createdAt.getTime()
            : right.createdAt.getTime() - left.createdAt.getTime();
        });

        return rows.slice(args?.skip ?? 0, (args?.skip ?? 0) + (args?.take ?? rows.length));
      },
      updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0;
        for (const item of filterNotifications(args.where)) {
          Object.assign(item, args.data);
          count += 1;
        }
        return { count };
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const created = {
          id: `n-${notifications.length + 1}`,
          isRead: false,
          openedAt: null,
          clickedAt: null,
          readAt: null,
          createdAt: new Date(),
          ...args.data,
        };
        notifications.push(created as never);
        return created;
      },
    },
    notificationPreference: {
      upsert: async (args: {
        where: { userId: string };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }) => {
        const existing = preferences.get(args.where.userId);
        if (existing) {
          Object.assign(existing, args.update);
          return existing;
        }

        const created = {
          id: `pref-${preferences.size + 1}`,
          orderInApp: true,
          orderEmail: true,
          promotionInApp: true,
          promotionEmail: false,
          securityInApp: true,
          securityEmail: true,
          systemInApp: true,
          systemEmail: false,
          pushEnabled: false,
          smsEnabled: false,
          marketingOptIn: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.create,
        };
        preferences.set(args.where.userId, created);
        return created;
      },
      update: async (args: { where: { userId: string }; data: Record<string, unknown> }) => {
        const existing = preferences.get(args.where.userId);
        if (!existing) {
          throw new Error('preference not found');
        }
        Object.assign(existing, args.data, { updatedAt: new Date() });
        return existing;
      },
    },
    notificationTemplate: {
      findMany: async (args?: { where?: { channel?: string } }) =>
        templates
          .filter((template) => (args?.where?.channel ? template.channel === args.where.channel : true))
          .sort((left, right) => left.key.localeCompare(right.key) || left.channel.localeCompare(right.channel)),
      create: async (args: { data: Record<string, unknown> }) => {
        const created = {
          id: `tpl-${templates.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.data,
        };
        templates.push(created as never);
        return created;
      },
      findUnique: async (args: { where: { id: string }; select?: Record<string, boolean> }) => {
        const template = templates.find((item) => item.id === args.where.id) ?? null;
        if (!template || !args.select) {
          return template;
        }

        const selected: Record<string, unknown> = {};
        for (const [key, enabled] of Object.entries(args.select)) {
          if (enabled) {
            selected[key] = (template as Record<string, unknown>)[key];
          }
        }
        return selected;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = templates.find((template) => template.id === args.where.id);
        if (!existing) {
          throw new Error('template not found');
        }
        Object.assign(existing, args.data, { updatedAt: new Date() });
        return existing;
      },
    },
    user: {
      findMany: async (args: { where: { id: { in: string[] } }; select: { id: true } }) =>
        users.filter((user) => args.where.id.in.includes(user.id)).map((user) => ({ id: user.id })),
    },
  };

  return { prisma, notifications, preferences, templates, now };
}

test('notifications.list markRead trackClick and markAllRead cover user inbox flows', async () => {
  const mock = createNotificationsMock();
  const service = new NotificationsService(mock.prisma as never);

  const listed = await service.list('u-1', { unreadOnly: true, page: 1, limit: 10 });
  const read = await service.markRead('u-1', 'n-1');
  const clicked = await service.trackClick('u-1', 'n-1');
  const allRead = await service.markAllRead('u-1');

  assert.equal(listed.total, 1);
  assert.equal(listed.unread, 1);
  assert.equal(listed.data[0].id, 'n-1');
  assert.equal(read.success, true);
  assert.equal(clicked.success, true);
  assert.equal(allRead.success, true);
  assert.ok(mock.notifications.find((item) => item.id === 'n-1')?.openedAt instanceof Date);
  assert.ok(mock.notifications.find((item) => item.id === 'n-1')?.clickedAt instanceof Date);
  assert.equal(mock.notifications.filter((item) => item.userId === 'u-1' && item.isRead).length, 2);
  assert.equal(mock.notifications.find((item) => item.id === 'n-4')?.isRead, false);
});

test('notifications.preferences templates batch dispatch and unsubscribe cover admin workflows', async () => {
  const mock = createNotificationsMock();
  const service = new NotificationsService(mock.prisma as never);

  const preferences = await service.getPreferences('u-1');
  const updatedPreferences = await service.updatePreferences('u-1', {
    promotionEmail: true,
    marketingOptIn: true,
    pushEnabled: true,
  });
  const createdTemplate = await service.createTemplate({
    key: ' price.drop ',
    channel: 'push',
    titleTemplate: 'Gia moi cho {{product.name}}',
    contentTemplate: 'Chi con {{product.stock}} san pham',
    isActive: true,
  });
  const listedTemplates = await service.listTemplates();
  const updatedTemplate = await service.updateTemplate(createdTemplate.id, {
    titleTemplate: 'Gia giam manh cho {{product.name}}',
  });
  const preview = await service.previewTemplate('tpl-1', {
    customer: { name: 'Nguyen Van A' },
    order: { number: 'ORD-100', trackingCode: 'TRACK-123' },
  });
  const batch = await service.createBatch({
    userIds: ['u-1', 'u-2', 'missing-user'],
    type: 'promotion',
    channel: 'email',
    title: 'Weekend sale',
    content: 'Giam gia 20%',
    campaignKey: 'spring-sale',
    scheduledFor: '2026-04-06T08:00:00.000Z',
  });
  const invisibleBeforeDispatch = await service.list('u-1', {});
  const scheduled = mock.notifications.find((item) => item.campaignKey === 'spring-sale');
  if (scheduled) {
    scheduled.scheduledFor = new Date('2026-04-04T08:00:00.000Z');
  }
  const dispatched = await service.dispatchScheduled({ limit: 10 });

  assert.equal(preferences.orderInApp, true);
  assert.equal(updatedPreferences.promotionEmail, true);
  assert.equal(updatedPreferences.marketingOptIn, true);
  assert.equal(createdTemplate.key, 'price.drop');
  assert.equal(listedTemplates.data.length, 2);
  assert.equal(updatedTemplate.titleTemplate, 'Gia giam manh cho {{product.name}}');
  assert.equal(preview.subject, 'Order ORD-100 shipped');
  assert.equal(preview.title, 'Hi Nguyen Van A');
  assert.equal(preview.content, 'Tracking code: TRACK-123');
  assert.equal(batch.targeted, 2);
  assert.equal(batch.created, 1);
  assert.equal(batch.skipped, 1);
  assert.equal(invisibleBeforeDispatch.total, 2);
  assert.equal(dispatched.processed, 1);
  assert.equal(mock.notifications.find((item) => item.campaignKey === 'spring-sale')?.deliveredAt instanceof Date, true);

  const unsubscribed = await service.unsubscribe('u-1', {
    type: 'promotion',
    channel: 'email',
  });
  assert.equal(unsubscribed.promotionEmail, false);
  assert.equal(unsubscribed.marketingOptIn, false);

  await assert.rejects(
    async () => service.updateTemplate('missing-template', { isActive: false }),
    (error: unknown) => error instanceof NotFoundException,
  );

  await assert.rejects(
    async () => service.previewTemplate('missing-template', {}),
    (error: unknown) => error instanceof NotFoundException,
  );
});
