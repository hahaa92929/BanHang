import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreateNotificationBatchDto } from './dto/create-notification-batch.dto';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { DispatchScheduledNotificationsDto } from './dto/dispatch-scheduled-notifications.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { UnsubscribeNotificationsDto } from './dto/unsubscribe-notifications.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: QueryNotificationsDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const now = new Date();
    const where = this.buildVisibleWhere(userId, now, query);

    const total = await this.prisma.notification.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * limit;

    const [unread, data] = await Promise.all([
      this.prisma.notification.count({
        where: {
          AND: [
            this.buildVisibleWhere(userId, now),
            { isRead: false },
          ],
        },
      }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { total, unread, page: safePage, limit, totalPages, data };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: {
        id,
        userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
        openedAt: new Date(),
      },
    });

    return { success: true };
  }

  async trackClick(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: {
        id,
        userId,
      },
      data: {
        clickedAt: new Date(),
      },
    });

    return { success: true };
  }

  async markAllRead(userId: string) {
    const now = new Date();
    await this.prisma.notification.updateMany({
      where: {
        AND: [
          this.buildVisibleWhere(userId, now),
          {
            isRead: false,
          },
        ],
      },
      data: {
        isRead: true,
        readAt: now,
        openedAt: now,
      },
    });

    return { success: true };
  }

  async getPreferences(userId: string) {
    return this.ensurePreferences(userId);
  }

  async updatePreferences(userId: string, payload: UpdateNotificationPreferencesDto) {
    await this.ensurePreferences(userId);
    return this.prisma.notificationPreference.update({
      where: { userId },
      data: payload,
    });
  }

  async unsubscribe(userId: string, payload: UnsubscribeNotificationsDto = {}) {
    await this.ensurePreferences(userId);

    const type = payload.type ?? 'promotion';
    const channel = payload.channel;
    const data: Record<string, boolean> = {};

    this.applyUnsubscribePreference(data, type, channel);

    return this.prisma.notificationPreference.update({
      where: { userId },
      data,
    });
  }

  async listTemplates(channel?: NotificationChannel) {
    return {
      data: await this.prisma.notificationTemplate.findMany({
        where: channel ? { channel } : {},
        orderBy: [{ key: 'asc' }, { channel: 'asc' }],
      }),
    };
  }

  async createTemplate(payload: CreateNotificationTemplateDto) {
    return this.prisma.notificationTemplate.create({
      data: {
        key: payload.key.trim().toLowerCase(),
        channel: payload.channel,
        subjectTemplate: payload.subjectTemplate,
        titleTemplate: payload.titleTemplate,
        contentTemplate: payload.contentTemplate,
        isActive: payload.isActive ?? true,
      },
    });
  }

  async updateTemplate(id: string, payload: UpdateNotificationTemplateDto) {
    const existing = await this.prisma.notificationTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Notification template not found');
    }

    return this.prisma.notificationTemplate.update({
      where: { id },
      data: {
        ...(payload.key !== undefined ? { key: payload.key.trim().toLowerCase() } : {}),
        ...(payload.channel !== undefined ? { channel: payload.channel } : {}),
        ...(payload.subjectTemplate !== undefined ? { subjectTemplate: payload.subjectTemplate } : {}),
        ...(payload.titleTemplate !== undefined ? { titleTemplate: payload.titleTemplate } : {}),
        ...(payload.contentTemplate !== undefined ? { contentTemplate: payload.contentTemplate } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
      },
    });
  }

  async previewTemplate(id: string, data: Record<string, unknown> = {}) {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Notification template not found');
    }

    return {
      id: template.id,
      key: template.key,
      channel: template.channel,
      subject: template.subjectTemplate ? this.renderTemplate(template.subjectTemplate, data) : null,
      title: this.renderTemplate(template.titleTemplate, data),
      content: this.renderTemplate(template.contentTemplate, data),
    };
  }

  async createBatch(payload: CreateNotificationBatchDto) {
    const userIds = [...new Set(payload.userIds.map((userId) => userId.trim()).filter(Boolean))];
    if (!userIds.length) {
      throw new BadRequestException('At least one target user is required');
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true },
    });
    const targetUserIds = users.map((user) => user.id);

    let template:
      | {
          id: string;
          key: string;
          titleTemplate: string;
          contentTemplate: string;
        }
      | null = null;

    if (payload.templateId) {
      template = await this.prisma.notificationTemplate.findUnique({
        where: { id: payload.templateId },
        select: {
          id: true,
          key: true,
          titleTemplate: true,
          contentTemplate: true,
        },
      });

      if (!template) {
        throw new NotFoundException('Notification template not found');
      }
    }

    if (!template && (!payload.title?.trim() || !payload.content?.trim())) {
      throw new BadRequestException('Notification title and content are required');
    }

    const scheduledFor = payload.scheduledFor ? new Date(payload.scheduledFor) : null;
    const now = new Date();
    let created = 0;
    let skipped = 0;

    for (const userId of targetUserIds) {
      const preferences = await this.ensurePreferences(userId);
      if (!this.canDeliver(payload.type, payload.channel, preferences)) {
        skipped += 1;
        continue;
      }

      const rendered = template
        ? {
            title: this.renderTemplate(template.titleTemplate, payload.data ?? {}),
            content: this.renderTemplate(template.contentTemplate, payload.data ?? {}),
            templateKey: template.key,
          }
        : {
            title: payload.title!.trim(),
            content: payload.content!.trim(),
            templateKey: null,
          };

      await this.prisma.notification.create({
        data: {
          userId,
          type: payload.type,
          channel: payload.channel,
          templateKey: rendered.templateKey,
          campaignKey: payload.campaignKey?.trim() || null,
          title: rendered.title,
          content: rendered.content,
          ...(payload.data !== undefined ? { data: payload.data as Prisma.InputJsonValue } : {}),
          scheduledFor,
          deliveredAt: scheduledFor ? null : now,
        },
      });

      created += 1;
    }

    return {
      targeted: targetUserIds.length,
      created,
      skipped,
      scheduledFor,
      campaignKey: payload.campaignKey?.trim() || null,
    };
  }

  async dispatchScheduled(payload: DispatchScheduledNotificationsDto = {}) {
    const now = new Date();
    const limit = payload.limit ?? 100;
    const pending = await this.prisma.notification.findMany({
      where: {
        scheduledFor: { lte: now },
        deliveredAt: null,
      },
      orderBy: { scheduledFor: 'asc' },
      take: limit,
    });

    for (const notification of pending) {
      await this.prisma.notification.updateMany({
        where: { id: notification.id },
        data: {
          deliveredAt: now,
        },
      });
    }

    return {
      processed: pending.length,
      ids: pending.map((notification) => notification.id),
      processedAt: now,
    };
  }

  private buildVisibleWhere(userId: string, now: Date, query?: QueryNotificationsDto): Prisma.NotificationWhereInput {
    const conditions: Prisma.NotificationWhereInput[] = [
      { userId },
      {
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
      },
    ];

    if (query?.type) {
      conditions.push({ type: query.type });
    }

    if (query?.channel) {
      conditions.push({ channel: query.channel });
    }

    if (query?.unreadOnly) {
      conditions.push({ isRead: false });
    }

    return { AND: conditions };
  }

  private async ensurePreferences(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
      },
    });
  }

  private canDeliver(
    type: NotificationType,
    channel: NotificationChannel,
    preferences: {
      orderInApp: boolean;
      orderEmail: boolean;
      promotionInApp: boolean;
      promotionEmail: boolean;
      securityInApp: boolean;
      securityEmail: boolean;
      systemInApp: boolean;
      systemEmail: boolean;
      pushEnabled: boolean;
      smsEnabled: boolean;
      marketingOptIn: boolean;
    },
  ) {
    if (channel === 'push') {
      return preferences.pushEnabled && (type !== 'promotion' || preferences.marketingOptIn);
    }

    if (channel === 'sms') {
      return preferences.smsEnabled && (type !== 'promotion' || preferences.marketingOptIn);
    }

    if (type === 'order') {
      return channel === 'in_app' ? preferences.orderInApp : preferences.orderEmail;
    }

    if (type === 'promotion') {
      if (!preferences.marketingOptIn) {
        return false;
      }

      return channel === 'in_app' ? preferences.promotionInApp : preferences.promotionEmail;
    }

    if (type === 'security') {
      return channel === 'in_app' ? preferences.securityInApp : preferences.securityEmail;
    }

    return channel === 'in_app' ? preferences.systemInApp : preferences.systemEmail;
  }

  private applyUnsubscribePreference(
    data: Record<string, boolean>,
    type: NotificationType,
    channel?: NotificationChannel,
  ) {
    if (!channel || channel === 'push') {
      data.pushEnabled = false;
    }

    if (!channel || channel === 'sms') {
      data.smsEnabled = false;
    }

    if (type === 'promotion') {
      data.marketingOptIn = false;
    }

    if (!channel || channel === 'in_app') {
      data[this.preferenceKey(type, 'in_app')] = false;
    }

    if (!channel || channel === 'email') {
      data[this.preferenceKey(type, 'email')] = false;
    }
  }

  private preferenceKey(type: NotificationType, channel: 'in_app' | 'email') {
    const map: Record<NotificationType, { in_app: string; email: string }> = {
      order: {
        in_app: 'orderInApp',
        email: 'orderEmail',
      },
      promotion: {
        in_app: 'promotionInApp',
        email: 'promotionEmail',
      },
      security: {
        in_app: 'securityInApp',
        email: 'securityEmail',
      },
      system: {
        in_app: 'systemInApp',
        email: 'systemEmail',
      },
    };

    return map[type][channel];
  }

  private renderTemplate(template: string, data: Record<string, unknown>) {
    return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) => {
      const value = this.resolveTemplateValue(data, key);
      return value === undefined || value === null ? '' : String(value);
    });
  }

  private resolveTemplateValue(data: Record<string, unknown>, path: string) {
    return path.split('.').reduce<unknown>((current, segment) => {
      if (current && typeof current === 'object' && segment in (current as Record<string, unknown>)) {
        return (current as Record<string, unknown>)[segment];
      }

      return undefined;
    }, data);
  }
}
