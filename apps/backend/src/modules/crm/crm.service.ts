import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { slugify } from '../../common/slug';
import { CreateCustomerNoteDto } from './dto/create-customer-note.dto';
import { CreateCustomerTagDto } from './dto/create-customer-tag.dto';
import { QueryCrmCustomersDto } from './dto/query-crm-customers.dto';

type CrmSegment = 'vip' | 'new' | 'at_risk' | 'inactive' | 'active';

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  async listCustomers(query: QueryCrmCustomersDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const data = await this.loadCustomers(query);

    return {
      total: data.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(data.length / limit)),
      data: data.slice((page - 1) * limit, page * limit),
    };
  }

  async exportCustomers(query: QueryCrmCustomersDto = {}) {
    const data = await this.loadCustomers(query);

    return {
      exportedAt: new Date(),
      total: data.length,
      filters: {
        q: query.q?.trim() || null,
        segment: query.segment ?? null,
        tag: query.tag?.trim() || null,
        role: query.role ?? null,
      },
      data,
    };
  }

  async detail(userId: string) {
    const user = await this.db.user.findFirst({
      where: {
        id: userId,
        role: { in: ['customer', 'guest'] },
      },
      include: {
        orders: {
          orderBy: [{ createdAt: 'desc' }],
          take: 10,
          include: {
            items: true,
            payments: {
              orderBy: [{ createdAt: 'desc' }],
              take: 1,
            },
          },
        },
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        },
        wishlistItems: {
          orderBy: [{ createdAt: 'desc' }],
          take: 10,
          include: {
            product: {
              select: {
                id: true,
                slug: true,
                name: true,
                price: true,
                media: {
                  orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                  take: 1,
                },
              },
            },
          },
        },
        customerTags: {
          orderBy: [{ createdAt: 'asc' }],
        },
        customerNotes: {
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
          include: {
            author: {
              select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
              },
            },
          },
        },
        referralEvents: {
          orderBy: [{ createdAt: 'desc' }],
          include: {
            referredUser: {
              select: {
                id: true,
                email: true,
                fullName: true,
                createdAt: true,
              },
            },
          },
        },
        loyaltyRedemptions: {
          orderBy: [{ createdAt: 'desc' }],
          include: {
            coupon: {
              select: {
                id: true,
                code: true,
                value: true,
                expiresAt: true,
                isActive: true,
              },
            },
          },
        },
        notificationPreference: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Customer not found');
    }

    const summary = this.toCustomerSummary(user);

    return {
      ...summary,
      addresses: user.addresses,
      orders: user.orders,
      wishlist: user.wishlistItems,
      tags: user.customerTags,
      notes: user.customerNotes,
      referralEvents: user.referralEvents,
      loyaltyRedemptions: user.loyaltyRedemptions,
      notificationPreference: user.notificationPreference,
    };
  }

  async addNote(authorId: string, userId: string, payload: CreateCustomerNoteDto) {
    await this.ensureCustomer(userId);

    return this.db.customerNote.create({
      data: {
        userId,
        authorId,
        title: payload.title?.trim() || null,
        content: payload.content.trim(),
        isPinned: payload.isPinned ?? false,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
    });
  }

  async deleteNote(userId: string, noteId: string) {
    const note = await this.db.customerNote.findFirst({
      where: {
        id: noteId,
        userId,
      },
    });

    if (!note) {
      throw new NotFoundException('Customer note not found');
    }

    await this.db.customerNote.delete({
      where: { id: noteId },
    });

    return {
      success: true,
      deletedId: noteId,
    };
  }

  async addTag(userId: string, payload: CreateCustomerTagDto) {
    await this.ensureCustomer(userId);

    const key = this.toTagKey(payload.name);
    if (!key) {
      throw new BadRequestException('Tag name is invalid');
    }

    const existing = await this.db.customerTag.findFirst({
      where: {
        userId,
        key,
      },
    });

    if (existing) {
      return existing;
    }

    return this.db.customerTag.create({
      data: {
        userId,
        key,
        name: payload.name.trim(),
        color: payload.color ?? null,
      },
    });
  }

  async removeTag(userId: string, tagId: string) {
    const tag = await this.db.customerTag.findFirst({
      where: {
        id: tagId,
        userId,
      },
    });

    if (!tag) {
      throw new NotFoundException('Customer tag not found');
    }

    await this.db.customerTag.delete({
      where: { id: tagId },
    });

    return {
      success: true,
      deletedId: tagId,
    };
  }

  private async loadCustomers(query: QueryCrmCustomersDto) {
    const keyword = query.q?.trim();
    const tagKey = query.tag?.trim() ? this.toTagKey(query.tag) : undefined;
    const users = await this.db.user.findMany({
      where: {
        role: query.role ? query.role : { in: ['customer', 'guest'] },
        ...(keyword
          ? {
              OR: [
                { email: { contains: keyword, mode: 'insensitive' } },
                { fullName: { contains: keyword, mode: 'insensitive' } },
                { phone: { contains: keyword, mode: 'insensitive' } },
                { referralCode: { contains: keyword, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(tagKey
          ? {
              customerTags: {
                some: { key: tagKey },
              },
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        orders: {
          orderBy: [{ createdAt: 'desc' }],
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
            completedAt: true,
          },
        },
        customerTags: {
          orderBy: [{ createdAt: 'asc' }],
        },
        customerNotes: {
          select: { id: true },
        },
        referralEvents: {
          select: {
            rewardPoints: true,
            status: true,
          },
        },
        loyaltyRedemptions: {
          select: {
            pointsSpent: true,
          },
        },
      },
    });

    const data = users.map((user: any) => this.toCustomerSummary(user));
    return query.segment ? data.filter((entry: any) => entry.segment === query.segment) : data;
  }

  private async ensureCustomer(userId: string) {
    const user = await this.db.user.findFirst({
      where: {
        id: userId,
        role: { in: ['customer', 'guest'] },
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Customer not found');
    }

    return user;
  }

  private toCustomerSummary(user: any) {
    const completedOrders = user.orders.filter((order: any) => order.status === 'completed');
    const totalSpent = completedOrders.reduce((sum: number, order: any) => sum + order.total, 0);
    const lastOrderAt = completedOrders
      .map((order: any) => order.completedAt ?? order.createdAt)
      .sort((left: Date, right: Date) => right.getTime() - left.getTime())[0] ?? null;
    const earnedFromOrders = completedOrders.reduce(
      (sum: number, order: any) => sum + Math.max(1, Math.floor(order.total / 1_000)),
      0,
    );
    const earnedFromReferrals = user.referralEvents.reduce(
      (sum: number, event: any) => sum + (event.status === 'rewarded' ? event.rewardPoints : 0),
      0,
    );
    const redeemedPoints = user.loyaltyRedemptions.reduce(
      (sum: number, redemption: any) => sum + redemption.pointsSpent,
      0,
    );
    const loyaltyPointsBalance = Math.max(0, earnedFromOrders + earnedFromReferrals - redeemedPoints);
    const lifetimePoints = earnedFromOrders + earnedFromReferrals;
    const completedOrderCount = completedOrders.length;
    const segment = this.resolveSegment({
      createdAt: user.createdAt,
      completedOrderCount,
      totalSpent,
      lastOrderAt,
    });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      referralCode: user.referralCode,
      emailVerifiedAt: user.emailVerifiedAt ?? null,
      lastLoginAt: user.lastLoginAt ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      orderCount: user.orders.length,
      completedOrderCount,
      totalSpent,
      averageOrderValue: completedOrderCount ? Math.round(totalSpent / completedOrderCount) : 0,
      lastOrderAt,
      loyaltyPointsBalance,
      loyaltyTier: this.resolveLoyaltyTier(lifetimePoints),
      segment,
      tags: user.customerTags,
      noteCount: user.customerNotes.length,
    };
  }

  private resolveSegment(input: {
    createdAt: Date;
    completedOrderCount: number;
    totalSpent: number;
    lastOrderAt: Date | null;
  }): CrmSegment {
    const now = Date.now();
    const createdDaysAgo = Math.floor((now - input.createdAt.getTime()) / 86_400_000);
    const lastOrderDaysAgo = input.lastOrderAt
      ? Math.floor((now - input.lastOrderAt.getTime()) / 86_400_000)
      : null;

    if (input.completedOrderCount >= 5 || input.totalSpent >= 50_000_000) {
      return 'vip';
    }

    if (createdDaysAgo <= 30 && input.completedOrderCount <= 1) {
      return 'new';
    }

    if (lastOrderDaysAgo === null) {
      return createdDaysAgo > 30 ? 'inactive' : 'new';
    }

    if (lastOrderDaysAgo > 90) {
      return 'inactive';
    }

    if (lastOrderDaysAgo > 30) {
      return 'at_risk';
    }

    return 'active';
  }

  private resolveLoyaltyTier(points: number) {
    if (points >= 10_000) {
      return 'Platinum';
    }

    if (points >= 5_000) {
      return 'Gold';
    }

    if (points >= 1_000) {
      return 'Silver';
    }

    return 'Bronze';
  }

  private toTagKey(value: string) {
    return slugify(value).trim();
  }
}
