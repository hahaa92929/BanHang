import { Injectable, NotFoundException } from '@nestjs/common';
import { generateToken, hashOpaqueToken } from '../../common/security';
import { slugify } from '../../common/slug';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { CreateContentPageDto } from './dto/create-content-page.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { QueryBlogPostsDto } from './dto/query-blog-posts.dto';
import { QueryContentPagesDto } from './dto/query-content-pages.dto';
import { QueryPromotionsDto } from './dto/query-promotions.dto';
import { ConfirmNewsletterDto } from './dto/confirm-newsletter.dto';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import { UpdateContentPageDto } from './dto/update-content-page.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { UnsubscribeNewsletterDto } from './dto/unsubscribe-newsletter.dto';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma as any;
  }

  private get tokenHashSecret() {
    return process.env.TOKEN_HASH_SECRET ?? 'dev-token-hash-secret';
  }

  async listPages(query: QueryContentPagesDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const keyword = query.q?.trim();
    const rows = await this.db.contentPage.findMany({
      where: {
        isPublished: true,
        AND: [
          {
            OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
          },
          ...(keyword
            ? [
                {
                  OR: [
                    { title: { contains: keyword, mode: 'insensitive' } },
                    { excerpt: { contains: keyword, mode: 'insensitive' } },
                    { content: { contains: keyword, mode: 'insensitive' } },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
    });

    return this.paginate(rows, page, limit);
  }

  async page(slug: string) {
    const row = await this.db.contentPage.findFirst({
      where: {
        slug,
        isPublished: true,
        OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
      },
    });

    if (!row) {
      throw new NotFoundException('Content page not found');
    }

    return row;
  }

  async createPage(payload: CreateContentPageDto) {
    const slug = await this.ensureUniqueSlug('page', payload.slug ?? payload.title);

    return this.db.contentPage.create({
      data: {
        slug,
        title: payload.title.trim(),
        excerpt: payload.excerpt?.trim(),
        content: payload.content.trim(),
        metaTitle: payload.metaTitle?.trim(),
        metaDescription: payload.metaDescription?.trim(),
        ...this.resolvePublishFields(payload),
      },
    });
  }

  async updatePage(id: string, payload: UpdateContentPageDto) {
    const current = await this.db.contentPage.findUnique({
      where: { id },
    });

    if (!current) {
      throw new NotFoundException('Content page not found');
    }

    return this.db.contentPage.update({
      where: { id },
      data: {
        title: payload.title?.trim(),
        slug: payload.slug ? await this.ensureUniqueSlug('page', payload.slug, id) : undefined,
        excerpt: payload.excerpt?.trim(),
        content: payload.content?.trim(),
        metaTitle: payload.metaTitle?.trim(),
        metaDescription: payload.metaDescription?.trim(),
        ...this.resolvePublishFields(payload),
      },
    });
  }

  async listBlog(query: QueryBlogPostsDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const keyword = query.q?.trim();
    const tag = query.tag?.trim().toLowerCase();
    const rows = (await this.db.blogPost.findMany({
      where: {
        isPublished: true,
        AND: [
          {
            OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
          },
          ...(tag ? [{ tags: { has: tag } }] : []),
          ...(keyword
            ? [
                {
                  OR: [
                    { title: { contains: keyword, mode: 'insensitive' } },
                    { excerpt: { contains: keyword, mode: 'insensitive' } },
                    { content: { contains: keyword, mode: 'insensitive' } },
                  ],
                },
              ]
            : []),
        ],
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    })) as Array<{ relatedProductIds: string[]; [key: string]: unknown }>;

    const paged = this.paginate(rows, page, limit);

    return {
      ...paged,
      data: await Promise.all(paged.data.map((row) => this.hydrateBlogPost(row))),
    };
  }

  async blog(slug: string) {
    const row = (await this.db.blogPost.findFirst({
      where: {
        slug,
        isPublished: true,
        OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
      },
    })) as { relatedProductIds: string[]; [key: string]: unknown } | null;

    if (!row) {
      throw new NotFoundException('Blog post not found');
    }

    return this.hydrateBlogPost(row);
  }

  async createBlogPost(payload: CreateBlogPostDto) {
    const slug = await this.ensureUniqueSlug('blog', payload.slug ?? payload.title);

    return this.db.blogPost.create({
      data: {
        slug,
        title: payload.title.trim(),
        excerpt: payload.excerpt?.trim(),
        content: payload.content.trim(),
        coverImageUrl: payload.coverImageUrl,
        tags: (payload.tags ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean),
        relatedProductIds: [...new Set((payload.relatedProductIds ?? []).map((item) => item.trim()).filter(Boolean))],
        readTimeMinutes: payload.readTimeMinutes ?? 3,
        ...this.resolvePublishFields(payload),
      },
    });
  }

  async updateBlogPost(id: string, payload: UpdateBlogPostDto) {
    const current = await this.db.blogPost.findUnique({
      where: { id },
    });

    if (!current) {
      throw new NotFoundException('Blog post not found');
    }

    return this.db.blogPost.update({
      where: { id },
      data: {
        title: payload.title?.trim(),
        slug: payload.slug ? await this.ensureUniqueSlug('blog', payload.slug, id) : undefined,
        excerpt: payload.excerpt?.trim(),
        content: payload.content?.trim(),
        coverImageUrl: payload.coverImageUrl,
        tags: payload.tags?.map((item) => item.trim().toLowerCase()).filter(Boolean),
        relatedProductIds: payload.relatedProductIds
          ? [...new Set(payload.relatedProductIds.map((item) => item.trim()).filter(Boolean))]
          : undefined,
        readTimeMinutes: payload.readTimeMinutes,
        ...this.resolvePublishFields(payload),
      },
    });
  }

  async listPromotions(query: QueryPromotionsDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const now = new Date();
    const rows = (await this.db.promotionCampaign.findMany({
      where: {
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.placement ? { placement: query.placement } : {}),
      },
      orderBy: [{ priority: 'desc' }, { startsAt: 'desc' }],
    })) as Array<Record<string, any>>;

    const filtered = rows.filter((row) => {
      if (query.includeInactive) {
        return true;
      }

      if (!row.isActive || row.startsAt > now) {
        return false;
      }

      return !row.expiresAt || row.expiresAt >= now;
    });

    const paged = this.paginate(filtered, page, limit);

    return {
      ...paged,
      data: paged.data.map((row) => ({
        ...row,
        isLive: row.isActive && row.startsAt <= now && (!row.expiresAt || row.expiresAt >= now),
      })),
    };
  }

  async createPromotion(payload: CreatePromotionDto) {
    const key = await this.ensureUniquePromotionKey(payload.key ?? payload.name);

    return this.db.promotionCampaign.create({
      data: {
        key,
        name: payload.name.trim(),
        kind: payload.kind,
        placement: payload.placement,
        title: payload.title.trim(),
        subtitle: payload.subtitle?.trim(),
        content: payload.content?.trim(),
        imageUrl: payload.imageUrl,
        videoUrl: payload.videoUrl,
        linkUrl: payload.linkUrl,
        couponCode: payload.couponCode?.trim().toUpperCase(),
        discountPercent: payload.discountPercent,
        startsAt: payload.startsAt,
        expiresAt: payload.expiresAt,
        priority: payload.priority ?? 0,
        isActive: payload.isActive ?? true,
        metadata: payload.metadata,
      },
    });
  }

  async updatePromotion(id: string, payload: UpdatePromotionDto) {
    const current = await this.db.promotionCampaign.findUnique({
      where: { id },
    });

    if (!current) {
      throw new NotFoundException('Promotion not found');
    }

    return this.db.promotionCampaign.update({
      where: { id },
      data: {
        key: payload.key ? await this.ensureUniquePromotionKey(payload.key, id) : undefined,
        name: payload.name?.trim(),
        kind: payload.kind,
        placement: payload.placement,
        title: payload.title?.trim(),
        subtitle: payload.subtitle?.trim(),
        content: payload.content?.trim(),
        imageUrl: payload.imageUrl,
        videoUrl: payload.videoUrl,
        linkUrl: payload.linkUrl,
        couponCode: payload.couponCode?.trim().toUpperCase(),
        discountPercent: payload.discountPercent,
        startsAt: payload.startsAt,
        expiresAt: payload.expiresAt,
        priority: payload.priority,
        isActive: payload.isActive,
        metadata: payload.metadata,
      },
    });
  }

  async subscribeNewsletter(payload: SubscribeNewsletterDto) {
    const email = payload.email.trim().toLowerCase();
    const token = generateToken(24);
    const tokenHash = hashOpaqueToken(token, this.tokenHashSecret);
    const existing = await this.db.newsletterSubscriber.findUnique({
      where: { email },
    });
    const subscriber = existing
      ? await this.db.newsletterSubscriber.update({
          where: { email },
          data: {
            fullName: payload.fullName?.trim() ?? existing.fullName,
            source: payload.source?.trim() ?? existing.source,
            status: 'pending',
            confirmationTokenHash: tokenHash,
            confirmationSentAt: new Date(),
            confirmedAt: null,
            unsubscribedAt: null,
          },
        })
      : await this.db.newsletterSubscriber.create({
          data: {
            email,
            fullName: payload.fullName?.trim(),
            source: payload.source?.trim(),
            status: 'pending',
            confirmationTokenHash: tokenHash,
            confirmationSentAt: new Date(),
          },
        });

    return {
      success: true,
      status: subscriber.status,
      ...(process.env.NODE_ENV !== 'production'
        ? {
            debug: {
              token,
            },
          }
        : {}),
    };
  }

  async confirmNewsletter(payload: ConfirmNewsletterDto) {
    const subscriber = await this.db.newsletterSubscriber.findFirst({
      where: {
        confirmationTokenHash: hashOpaqueToken(payload.token, this.tokenHashSecret),
        status: 'pending',
      },
    });

    if (!subscriber) {
      throw new NotFoundException('Newsletter confirmation token not found');
    }

    const updated = await this.db.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: {
        status: 'active',
        confirmationTokenHash: null,
        confirmedAt: new Date(),
        unsubscribedAt: null,
      },
    });

    await this.syncMarketingPreference(updated.email, true);

    return {
      success: true,
      status: updated.status,
      confirmedAt: updated.confirmedAt,
    };
  }

  async unsubscribeNewsletter(payload: UnsubscribeNewsletterDto) {
    const email = payload.email.trim().toLowerCase();
    await this.db.newsletterSubscriber.updateMany({
      where: { email },
      data: {
        status: 'unsubscribed',
        confirmationTokenHash: null,
        unsubscribedAt: new Date(),
      },
    });

    await this.syncMarketingPreference(email, false);

    return {
      success: true,
      email,
    };
  }

  private async hydrateBlogPost(row: {
    relatedProductIds: string[];
    [key: string]: unknown;
  }) {
    const relatedProducts = row.relatedProductIds.length
      ? await this.db.product.findMany({
          where: {
            id: {
              in: row.relatedProductIds,
            },
          },
          select: {
            id: true,
            slug: true,
            name: true,
            price: true,
            media: {
              orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
              take: 1,
              select: {
                id: true,
                url: true,
                isPrimary: true,
                sortOrder: true,
              },
            },
          },
        })
      : [];

    return {
      ...row,
      relatedProducts,
    };
  }

  private resolvePublishFields(payload: {
    isPublished?: boolean;
    publishedAt?: Date;
  }): {
    isPublished?: boolean;
    publishedAt?: Date | null;
  } {
    if (payload.isPublished === false) {
      return {
        isPublished: false,
        publishedAt: null,
      };
    }

    if (payload.isPublished === true) {
      return {
        isPublished: true,
        publishedAt: payload.publishedAt ?? new Date(),
      };
    }

    if (payload.publishedAt) {
      return {
        publishedAt: payload.publishedAt,
      };
    }

    return {};
  }

  private paginate<T>(rows: T[], page: number, limit: number) {
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;

    return {
      total,
      page: safePage,
      limit,
      totalPages,
      data: rows.slice(start, start + limit),
    };
  }

  private async ensureUniqueSlug(type: 'page' | 'blog', source: string, excludeId?: string) {
    const base = slugify(source) || `content-${Date.now()}`;
    let candidate = base;
    let index = 2;

    while (true) {
      const existing =
        type === 'page'
          ? await this.db.contentPage.findFirst({
              where: {
                slug: candidate,
                ...(excludeId ? { NOT: { id: excludeId } } : {}),
              },
              select: { id: true },
            })
          : await this.db.blogPost.findFirst({
              where: {
                slug: candidate,
                ...(excludeId ? { NOT: { id: excludeId } } : {}),
              },
              select: { id: true },
            });

      if (!existing) {
        return candidate;
      }

      candidate = `${base}-${index}`;
      index += 1;
    }
  }

  private async ensureUniquePromotionKey(source: string, excludeId?: string) {
    const base = slugify(source) || `promotion-${Date.now()}`;
    let candidate = base;
    let index = 2;

    while (true) {
      const existing = await this.db.promotionCampaign.findFirst({
        where: {
          key: candidate,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }

      candidate = `${base}-${index}`;
      index += 1;
    }
  }

  private async syncMarketingPreference(email: string, enabled: boolean) {
    const user = await this.db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      return;
    }

    await this.db.notificationPreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        marketingOptIn: enabled,
      },
      update: {
        marketingOptIn: enabled,
      },
    });
  }
}
