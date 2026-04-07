import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { ContentService } from './content.service';

function createContentMock() {
  const now = new Date('2026-04-07T10:00:00.000Z');
  const products = [
    {
      id: 'p-1',
      slug: 'iphone-15',
      name: 'iPhone 15',
      price: 19_990_000,
      media: [{ id: 'm-1', url: 'https://example.com/iphone.jpg', isPrimary: true, sortOrder: 0 }],
    },
    {
      id: 'p-2',
      slug: 'macbook-air-m3',
      name: 'MacBook Air M3',
      price: 27_990_000,
      media: [{ id: 'm-2', url: 'https://example.com/macbook.jpg', isPrimary: true, sortOrder: 0 }],
    },
  ];
  const pages = [
    {
      id: 'pg-1',
      slug: 'about',
      title: 'About BanHang',
      excerpt: 'About page',
      content: 'About content',
      metaTitle: 'About',
      metaDescription: 'About desc',
      isPublished: true,
      publishedAt: new Date('2026-04-01T00:00:00.000Z'),
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    },
    {
      id: 'pg-2',
      slug: 'faq',
      title: 'FAQ',
      excerpt: 'FAQ page',
      content: 'FAQ content',
      metaTitle: 'FAQ',
      metaDescription: 'FAQ desc',
      isPublished: false,
      publishedAt: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    },
  ];
  const posts = [
    {
      id: 'bp-1',
      slug: 'iphone-15-buying-guide',
      title: 'iPhone 15 buying guide',
      excerpt: 'Buying guide',
      content: 'Guide content',
      coverImageUrl: 'https://example.com/blog-1.jpg',
      tags: ['iphone', 'guide'],
      readTimeMinutes: 6,
      relatedProductIds: ['p-1'],
      isPublished: true,
      publishedAt: new Date('2026-04-03T00:00:00.000Z'),
      createdAt: new Date('2026-04-03T00:00:00.000Z'),
      updatedAt: new Date('2026-04-03T00:00:00.000Z'),
    },
    {
      id: 'bp-2',
      slug: 'draft-post',
      title: 'Draft Post',
      excerpt: 'Draft',
      content: 'Draft content',
      coverImageUrl: null,
      tags: ['draft'],
      readTimeMinutes: 4,
      relatedProductIds: [],
      isPublished: false,
      publishedAt: null,
      createdAt: new Date('2026-04-05T00:00:00.000Z'),
      updatedAt: new Date('2026-04-05T00:00:00.000Z'),
    },
  ];
  const promotions = [
    {
      id: 'pm-1',
      key: 'home-hero',
      name: 'Home Hero',
      kind: 'banner',
      placement: 'home_hero',
      title: 'Hero',
      subtitle: 'Main banner',
      content: 'Content',
      imageUrl: 'https://example.com/hero.jpg',
      videoUrl: null,
      linkUrl: '/hero',
      couponCode: null,
      discountPercent: null,
      startsAt: new Date('2026-04-05T00:00:00.000Z'),
      expiresAt: new Date('2026-04-10T00:00:00.000Z'),
      priority: 100,
      isActive: true,
      metadata: { badge: 'Hot' },
      createdAt: new Date('2026-04-05T00:00:00.000Z'),
      updatedAt: new Date('2026-04-05T00:00:00.000Z'),
    },
    {
      id: 'pm-2',
      key: 'future-flash',
      name: 'Future Flash',
      kind: 'flash_sale',
      placement: 'home_flash_sale',
      title: 'Future Flash',
      subtitle: null,
      content: 'Future',
      imageUrl: null,
      videoUrl: null,
      linkUrl: '/flash',
      couponCode: 'SAVE10',
      discountPercent: 10,
      startsAt: new Date('2026-04-10T00:00:00.000Z'),
      expiresAt: new Date('2026-04-12T00:00:00.000Z'),
      priority: 90,
      isActive: true,
      metadata: {},
      createdAt: new Date('2026-04-05T00:00:00.000Z'),
      updatedAt: new Date('2026-04-05T00:00:00.000Z'),
    },
  ];
  const newsletterSubscribers = [
    {
      id: 'ns-1',
      email: 'customer@banhang.local',
      fullName: 'Customer Demo',
      source: 'seed',
      status: 'active',
      confirmationTokenHash: null,
      confirmationSentAt: null,
      confirmedAt: new Date('2026-04-01T00:00:00.000Z'),
      unsubscribedAt: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    },
  ];
  const users = [{ id: 'u-1', email: 'customer@banhang.local' }];
  const notificationPreferences: Array<{ userId: string; marketingOptIn: boolean }> = [];

  function matchesText(value: string | null | undefined, contains?: string) {
    return !contains || (value ?? '').toLowerCase().includes(contains.toLowerCase());
  }

  function matchesPublishedAt(value: Date | null, clause: Record<string, unknown>) {
    if (clause.publishedAt === null) {
      return value === null;
    }
    const lte = (clause.publishedAt as { lte?: Date } | undefined)?.lte;
    return Boolean(lte && value && value <= lte);
  }

  const prisma = {
    contentPage: {
      findMany: async (args: { where?: Record<string, unknown> }) =>
        pages.filter((page) => {
          if (args.where?.isPublished !== undefined && page.isPublished !== args.where.isPublished) {
            return false;
          }
          const andClauses = (args.where?.AND as Array<Record<string, unknown>> | undefined) ?? [];
          return andClauses.every((clause) => {
            if (!Array.isArray(clause.OR)) {
              return true;
            }
            return clause.OR.some((entry) => {
              const typed = entry as Record<string, unknown>;
              return (
                matchesPublishedAt(page.publishedAt, typed) ||
                matchesText(page.title, (typed.title as { contains?: string } | undefined)?.contains) ||
                matchesText(page.excerpt, (typed.excerpt as { contains?: string } | undefined)?.contains) ||
                matchesText(page.content, (typed.content as { contains?: string } | undefined)?.contains)
              );
            });
          });
        }),
      findFirst: async (args: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
        const match =
          pages.find((page) => {
            if (args.where.slug && page.slug !== args.where.slug) {
              return false;
            }
            if (args.where.isPublished !== undefined && page.isPublished !== args.where.isPublished) {
              return false;
            }
            if ((args.where.NOT as { id?: string } | undefined)?.id === page.id) {
              return false;
            }
            if (Array.isArray(args.where.OR)) {
              return args.where.OR.some((entry) => matchesPublishedAt(page.publishedAt, entry as Record<string, unknown>));
            }
            return true;
          }) ?? null;

        return match ? (args.select ? { id: match.id } : match) : null;
      },
      findUnique: async (args: { where: { id: string } }) =>
        pages.find((page) => page.id === args.where.id) ?? null,
      create: async (args: { data: Record<string, unknown> }) => {
        const created = {
          id: `pg-${pages.length + 1}`,
          createdAt: now,
          updatedAt: now,
          publishedAt: null,
          excerpt: null,
          metaTitle: null,
          metaDescription: null,
          ...args.data,
        };
        pages.push(created as never);
        return created;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const index = pages.findIndex((page) => page.id === args.where.id);
        const updated = { ...pages[index]!, ...args.data, updatedAt: now };
        pages[index] = updated as never;
        return updated;
      },
    },
    blogPost: {
      findMany: async (args: { where?: Record<string, unknown> }) =>
        posts.filter((post) => {
          if (args.where?.isPublished !== undefined && post.isPublished !== args.where.isPublished) {
            return false;
          }
          const andClauses = (args.where?.AND as Array<Record<string, unknown>> | undefined) ?? [];
          return andClauses.every((clause) => {
            if ((clause.tags as { has?: string } | undefined)?.has) {
              return post.tags.includes((clause.tags as { has: string }).has);
            }
            if (!Array.isArray(clause.OR)) {
              return true;
            }
            return clause.OR.some((entry) => {
              const typed = entry as Record<string, unknown>;
              return (
                matchesPublishedAt(post.publishedAt, typed) ||
                matchesText(post.title, (typed.title as { contains?: string } | undefined)?.contains) ||
                matchesText(post.excerpt, (typed.excerpt as { contains?: string } | undefined)?.contains) ||
                matchesText(post.content, (typed.content as { contains?: string } | undefined)?.contains)
              );
            });
          });
        }),
      findFirst: async (args: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
        const match =
          posts.find((post) => {
            if (args.where.slug && post.slug !== args.where.slug) {
              return false;
            }
            if (args.where.isPublished !== undefined && post.isPublished !== args.where.isPublished) {
              return false;
            }
            if ((args.where.NOT as { id?: string } | undefined)?.id === post.id) {
              return false;
            }
            if (Array.isArray(args.where.OR)) {
              return args.where.OR.some((entry) => matchesPublishedAt(post.publishedAt, entry as Record<string, unknown>));
            }
            return true;
          }) ?? null;

        return match ? (args.select ? { id: match.id } : match) : null;
      },
      findUnique: async (args: { where: { id: string } }) =>
        posts.find((post) => post.id === args.where.id) ?? null,
      create: async (args: { data: Record<string, unknown> }) => {
        const created = {
          id: `bp-${posts.length + 1}`,
          createdAt: now,
          updatedAt: now,
          excerpt: null,
          coverImageUrl: null,
          tags: [],
          relatedProductIds: [],
          publishedAt: null,
          readTimeMinutes: 3,
          ...args.data,
        };
        posts.push(created as never);
        return created;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const index = posts.findIndex((post) => post.id === args.where.id);
        const updated = { ...posts[index]!, ...args.data, updatedAt: now };
        posts[index] = updated as never;
        return updated;
      },
    },
    promotionCampaign: {
      findMany: async (args: { where?: Record<string, unknown> }) =>
        promotions.filter((promotion) => {
          if (args.where?.kind && promotion.kind !== args.where.kind) {
            return false;
          }
          if (args.where?.placement && promotion.placement !== args.where.placement) {
            return false;
          }
          return true;
        }),
      findFirst: async (args: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
        const match =
          promotions.find((promotion) => {
            if (args.where.key && promotion.key !== args.where.key) {
              return false;
            }
            if ((args.where.NOT as { id?: string } | undefined)?.id === promotion.id) {
              return false;
            }
            return true;
          }) ?? null;

        return match ? (args.select ? { id: match.id } : match) : null;
      },
      findUnique: async (args: { where: { id: string } }) =>
        promotions.find((promotion) => promotion.id === args.where.id) ?? null,
      create: async (args: { data: Record<string, unknown> }) => {
        const created = {
          id: `pm-${promotions.length + 1}`,
          createdAt: now,
          updatedAt: now,
          subtitle: null,
          content: null,
          imageUrl: null,
          videoUrl: null,
          linkUrl: null,
          couponCode: null,
          discountPercent: null,
          expiresAt: null,
          metadata: null,
          priority: 0,
          isActive: true,
          ...args.data,
        };
        promotions.push(created as never);
        return created;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const index = promotions.findIndex((promotion) => promotion.id === args.where.id);
        const updated = { ...promotions[index]!, ...args.data, updatedAt: now };
        promotions[index] = updated as never;
        return updated;
      },
    },
    newsletterSubscriber: {
      findUnique: async (args: { where: { email: string } }) =>
        newsletterSubscribers.find((item) => item.email === args.where.email) ?? null,
      findFirst: async (args: { where: Record<string, unknown> }) =>
        newsletterSubscribers.find((item) => {
          if (args.where.confirmationTokenHash && item.confirmationTokenHash !== args.where.confirmationTokenHash) {
            return false;
          }
          if (args.where.status && item.status !== args.where.status) {
            return false;
          }
          return true;
        }) ?? null,
      create: async (args: { data: Record<string, unknown> }) => {
        const created = {
          id: `ns-${newsletterSubscribers.length + 1}`,
          createdAt: now,
          updatedAt: now,
          fullName: null,
          source: null,
          confirmationTokenHash: null,
          confirmationSentAt: null,
          confirmedAt: null,
          unsubscribedAt: null,
          ...args.data,
        };
        newsletterSubscribers.push(created as never);
        return created;
      },
      update: async (args: { where: { id?: string; email?: string }; data: Record<string, unknown> }) => {
        const index = newsletterSubscribers.findIndex(
          (item) => item.id === args.where.id || item.email === args.where.email,
        );
        const updated = { ...newsletterSubscribers[index]!, ...args.data, updatedAt: now };
        newsletterSubscribers[index] = updated as never;
        return updated;
      },
      updateMany: async (args: { where: { email: string }; data: Record<string, unknown> }) => {
        let count = 0;
        for (let index = 0; index < newsletterSubscribers.length; index += 1) {
          if (newsletterSubscribers[index]!.email !== args.where.email) {
            continue;
          }
          newsletterSubscribers[index] = {
            ...newsletterSubscribers[index]!,
            ...args.data,
            updatedAt: now,
          } as never;
          count += 1;
        }
        return { count };
      },
    },
    user: {
      findUnique: async (args: { where: { email: string }; select?: { id: true } }) => {
        const match = users.find((user) => user.email === args.where.email) ?? null;
        return match && args.select ? { id: match.id } : match;
      },
    },
    notificationPreference: {
      upsert: async (args: {
        where: { userId: string };
        create: { userId: string; marketingOptIn: boolean };
        update: { marketingOptIn: boolean };
      }) => {
        const existing = notificationPreferences.find((item) => item.userId === args.where.userId);
        if (existing) {
          existing.marketingOptIn = args.update.marketingOptIn;
          return existing;
        }
        notificationPreferences.push({
          userId: args.create.userId,
          marketingOptIn: args.create.marketingOptIn,
        });
        return notificationPreferences.at(-1)!;
      },
    },
    product: {
      findMany: async (args: { where?: { id?: { in?: string[] } } }) =>
        products.filter((product) => args.where?.id?.in?.includes(product.id) ?? true),
    },
  };

  return { prisma, newsletterSubscribers, notificationPreferences };
}

test('content public pages blog and promotions expose only published live records', async () => {
  const mock = createContentMock();
  const service = new ContentService(mock.prisma as never);

  const pages = await service.listPages({ q: 'about', page: 1, limit: 10 });
  const page = await service.page('about');
  const blog = await service.listBlog({ tag: 'iphone', page: 1, limit: 10 });
  const post = await service.blog('iphone-15-buying-guide');
  const promotions = await service.listPromotions({ placement: 'home_hero', page: 1, limit: 10 });

  assert.equal(pages.total, 1);
  assert.equal(page.slug, 'about');
  assert.equal(blog.total, 1);
  assert.equal(blog.data[0].relatedProducts[0].slug, 'iphone-15');
  assert.equal(post.relatedProducts[0].name, 'iPhone 15');
  assert.equal(promotions.total, 1);
  assert.equal(promotions.data[0].isLive, true);

  await assert.rejects(async () => service.page('faq'), (error: unknown) => error instanceof NotFoundException);
  await assert.rejects(
    async () => service.blog('draft-post'),
    (error: unknown) => error instanceof NotFoundException,
  );
});

test('content admin create and update manage cms slugs publish state and promotions', async () => {
  const mock = createContentMock();
  const service = new ContentService(mock.prisma as never);

  const createdPage = await service.createPage({
    title: 'About',
    content: 'A brand new public page with enough content.',
    isPublished: true,
  });
  const updatedPage = await service.updatePage('pg-1', {
    slug: 'about-company',
    title: 'About Company',
  });
  const createdPost = await service.createBlogPost({
    title: 'iPhone 15 buying guide',
    content: 'Another public guide with enough content to publish.',
    tags: ['iphone', 'tips'],
    relatedProductIds: ['p-1'],
    isPublished: true,
  });
  const updatedPost = await service.updateBlogPost('bp-1', {
    title: 'iPhone 15 buying guide updated',
    tags: ['iphone', 'guide', 'updated'],
  });
  const createdPromotion = await service.createPromotion({
    name: 'Home Hero',
    kind: 'banner',
    placement: 'home_popup',
    title: 'Popup deal',
    startsAt: new Date('2026-04-07T00:00:00.000Z'),
    priority: 10,
  });
  const updatedPromotion = await service.updatePromotion('pm-1', {
    key: 'home-hero-special',
    title: 'Hero updated',
    isActive: false,
  });

  assert.equal(createdPage.slug, 'about-2');
  assert.equal(createdPage.isPublished, true);
  assert.equal(updatedPage.slug, 'about-company');
  assert.equal(createdPost.slug, 'iphone-15-buying-guide-2');
  assert.deepEqual(updatedPost.tags, ['iphone', 'guide', 'updated']);
  assert.equal(createdPromotion.key, 'home-hero-2');
  assert.equal(updatedPromotion.key, 'home-hero-special');
  assert.equal(updatedPromotion.isActive, false);
});

test('content newsletter subscribe confirm and unsubscribe manage double opt-in state', async () => {
  const mock = createContentMock();
  const service = new ContentService(mock.prisma as never);

  const subscribed = await service.subscribeNewsletter({
    email: 'new-subscriber@example.com',
    fullName: 'New Subscriber',
    source: 'homepage',
  });
  const token = subscribed.debug?.token;

  assert.equal(subscribed.success, true);
  assert.equal(subscribed.status, 'pending');
  assert.equal(typeof token, 'string');
  assert.equal(mock.newsletterSubscribers.length, 2);

  const confirmed = await service.confirmNewsletter({ token });

  assert.equal(confirmed.success, true);
  assert.equal(confirmed.status, 'active');

  await service.unsubscribeNewsletter({ email: 'customer@banhang.local' });

  assert.equal(mock.newsletterSubscribers[0]?.status, 'unsubscribed');
  assert.equal(mock.notificationPreferences[0]?.marketingOptIn, false);

  await assert.rejects(
    async () => service.confirmNewsletter({ token: 'missing-token-1234567890' }),
    (error: unknown) => error instanceof NotFoundException,
  );
});
