import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SearchService } from './search.service';

function createSearchMock() {
  const baseTime = new Date('2026-04-05T10:00:00.000Z').getTime();
  const products = [
    {
      id: 'p-1',
      sku: 'SKU-IPHONE',
      slug: 'iphone-15',
      name: 'iPhone 15',
      description: 'Smartphone flagship with OLED display',
      price: 20_000_000,
      stock: 5,
      rating: 4.8,
      totalSold: 50,
      tags: ['smartphone', 'apple'],
      status: 'active',
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      brand: { id: 'b-1', name: 'Apple', slug: 'apple' },
      category: { id: 'c-1', name: 'Dien thoai', slug: 'dien-thoai' },
      media: [{ id: 'm-1', url: 'https://example.com/iphone.jpg', isPrimary: true, sortOrder: 0 }],
    },
    {
      id: 'p-2',
      sku: 'SKU-AIRPODS',
      slug: 'airpods-pro',
      name: 'AirPods Pro',
      description: 'Wireless earbuds with ANC',
      price: 5_000_000,
      stock: 8,
      rating: 4.7,
      totalSold: 30,
      tags: ['tai nghe', 'earbuds'],
      status: 'active',
      createdAt: new Date('2026-04-02T00:00:00.000Z'),
      brand: { id: 'b-1', name: 'Apple', slug: 'apple' },
      category: { id: 'c-2', name: 'Am thanh', slug: 'am-thanh' },
      media: [{ id: 'm-2', url: 'https://example.com/airpods.jpg', isPrimary: true, sortOrder: 0 }],
    },
    {
      id: 'p-3',
      sku: 'SKU-GALAXY',
      slug: 'galaxy-s24',
      name: 'Galaxy S24',
      description: 'Android phone with great camera',
      price: 18_000_000,
      stock: 0,
      rating: 4.6,
      totalSold: 40,
      tags: ['phone', 'android'],
      status: 'active',
      createdAt: new Date('2026-04-03T00:00:00.000Z'),
      brand: { id: 'b-2', name: 'Samsung', slug: 'samsung' },
      category: { id: 'c-1', name: 'Dien thoai', slug: 'dien-thoai' },
      media: [{ id: 'm-3', url: 'https://example.com/galaxy.jpg', isPrimary: true, sortOrder: 0 }],
    },
  ];
  const categories = [
    { id: 'c-1', name: 'Dien thoai', slug: 'dien-thoai', sortOrder: 1, isActive: true },
    { id: 'c-2', name: 'Am thanh', slug: 'am-thanh', sortOrder: 2, isActive: true },
  ];
  const brands = [
    { id: 'b-1', name: 'Apple', slug: 'apple', isActive: true },
    { id: 'b-2', name: 'Samsung', slug: 'samsung', isActive: true },
  ];
  const searchEvents: Array<{
    id: string;
    userId?: string;
    query: string;
    normalizedQuery: string;
    expandedTerms: string[];
    resultCount: number;
    source: string;
    createdAt: Date;
  }> = [
    {
      id: 'sq-1',
      userId: 'u-1',
      query: 'iphone',
      normalizedQuery: 'iphone',
      expandedTerms: ['iphone'],
      resultCount: 1,
      source: 'web',
      createdAt: new Date(baseTime + 1_000),
    },
    {
      id: 'sq-2',
      query: 'dien thoai',
      normalizedQuery: 'dien thoai',
      expandedTerms: ['dien thoai', 'smartphone'],
      resultCount: 2,
      source: 'web',
      createdAt: new Date(baseTime + 2_000),
    },
    {
      id: 'sq-3',
      query: 'khong ton tai',
      normalizedQuery: 'khong ton tai',
      expandedTerms: ['khong ton tai'],
      resultCount: 0,
      source: 'web',
      createdAt: new Date(baseTime + 3_000),
    },
  ];

  function matchesProduct(product: (typeof products)[number], where?: Record<string, unknown>) {
    if (!where) {
      return true;
    }

    if (where.status && product.status !== where.status) {
      return false;
    }

    if (where.stock && typeof (where.stock as { gt?: number }).gt === 'number' && !(product.stock > (where.stock as { gt: number }).gt)) {
      return false;
    }

    if (where.id && Array.isArray((where.id as { notIn?: string[] }).notIn) && (where.id as { notIn: string[] }).notIn.includes(product.id)) {
      return false;
    }

    if (where.brand && (where.brand as { slug?: { equals: string } }).slug?.equals) {
      if (product.brand?.slug.toLowerCase() !== (where.brand as { slug: { equals: string } }).slug.equals.toLowerCase()) {
        return false;
      }
    }

    if (where.category && (where.category as { slug?: { equals: string } }).slug?.equals) {
      if (product.category?.slug.toLowerCase() !== (where.category as { slug: { equals: string } }).slug.equals.toLowerCase()) {
        return false;
      }
    }

    if (where.price) {
      const price = where.price as { gte?: number; lte?: number };
      if (typeof price.gte === 'number' && product.price < price.gte) {
        return false;
      }
      if (typeof price.lte === 'number' && product.price > price.lte) {
        return false;
      }
    }

    if (Array.isArray(where.OR)) {
      return where.OR.some((clause) => matchesProduct(product, clause as Record<string, unknown>));
    }

    if (typeof (where as { name?: { contains?: string } }).name?.contains === 'string') {
      return product.name.toLowerCase().includes((where as { name: { contains: string } }).name.contains.toLowerCase());
    }
    if (typeof (where as { description?: { contains?: string } }).description?.contains === 'string') {
      return product.description.toLowerCase().includes((where as { description: { contains: string } }).description.contains.toLowerCase());
    }
    if (typeof (where as { sku?: { contains?: string } }).sku?.contains === 'string') {
      return product.sku.toLowerCase().includes((where as { sku: { contains: string } }).sku.contains.toLowerCase());
    }
    if ((where as { tags?: { has?: string } }).tags?.has) {
      return product.tags.some((tag) => tag.toLowerCase() === (where as { tags: { has: string } }).tags.has.toLowerCase());
    }
    if ((where as { brand?: { name?: { contains?: string } } }).brand?.name?.contains) {
      return product.brand?.name.toLowerCase().includes((where as { brand: { name: { contains: string } } }).brand.name.contains.toLowerCase()) ?? false;
    }
    if ((where as { category?: { name?: { contains?: string } } }).category?.name?.contains) {
      return product.category?.name.toLowerCase().includes((where as { category: { name: { contains: string } } }).category.name.contains.toLowerCase()) ?? false;
    }

    return true;
  }

  const prisma = {
    product: {
      findMany: async (args: { where?: Record<string, unknown>; take?: number; select?: Record<string, boolean>; include?: Record<string, unknown>; orderBy?: Array<Record<string, 'asc' | 'desc'>> }) => {
        let rows = products.filter((product) => matchesProduct(product, args.where));
        rows = rows.sort((left, right) => right.totalSold - left.totalSold || right.createdAt.getTime() - left.createdAt.getTime());
        if (args.take) {
          rows = rows.slice(0, args.take);
        }
        if (args.select) {
          return rows.map((row) => {
            const selected: Record<string, unknown> = {};
            for (const [key, enabled] of Object.entries(args.select!)) {
              if (enabled) {
                selected[key] = (row as Record<string, unknown>)[key];
              }
            }
            return selected;
          });
        }
        return rows;
      },
    },
    category: {
      findMany: async (args: { where?: Record<string, unknown>; take?: number }) => {
        let rows = [...categories];
        if (args.where && (args.where as { name?: { contains?: string } }).name?.contains) {
          rows = rows.filter((item) =>
            item.name.toLowerCase().includes((args.where as { name: { contains: string } }).name.contains.toLowerCase()),
          );
        }
        if (args.take) {
          rows = rows.slice(0, args.take);
        }
        return rows;
      },
    },
    brand: {
      findMany: async (args: { where?: Record<string, unknown>; take?: number }) => {
        let rows = [...brands];
        if (args.where && (args.where as { name?: { contains?: string } }).name?.contains) {
          rows = rows.filter((item) =>
            item.name.toLowerCase().includes((args.where as { name: { contains: string } }).name.contains.toLowerCase()),
          );
        }
        if (args.take) {
          rows = rows.slice(0, args.take);
        }
        return rows;
      },
    },
    searchQueryEvent: {
      create: async (args: { data: Record<string, unknown> }) => {
        searchEvents.push({
          id: `sq-${searchEvents.length + 1}`,
          createdAt: new Date(baseTime + (searchEvents.length + 1) * 1_000),
          userId: args.data.userId as string | undefined,
          query: args.data.query as string,
          normalizedQuery: args.data.normalizedQuery as string,
          expandedTerms: args.data.expandedTerms as string[],
          resultCount: args.data.resultCount as number,
          source: args.data.source as string,
        });
        return searchEvents.at(-1)!;
      },
      findMany: async (args: {
        where?: { userId?: string };
        orderBy?: { createdAt: 'asc' | 'desc' };
        take?: number;
        select?: Record<string, boolean>;
      }) => {
        let rows = [...searchEvents];
        if (args.where?.userId) {
          rows = rows.filter((item) => item.userId === args.where!.userId);
        }

        rows.sort((left, right) =>
          args.orderBy?.createdAt === 'asc'
            ? left.createdAt.getTime() - right.createdAt.getTime()
            : right.createdAt.getTime() - left.createdAt.getTime(),
        );

        if (args.take) {
          rows = rows.slice(0, args.take);
        }

        if (args.select) {
          return rows.map((row) => {
            const selected: Record<string, unknown> = {};
            for (const [key, enabled] of Object.entries(args.select!)) {
              if (enabled) {
                selected[key] = (row as Record<string, unknown>)[key];
              }
            }
            return selected;
          });
        }

        return rows;
      },
      deleteMany: async (args: { where?: { userId?: string } }) => {
        const originalLength = searchEvents.length;

        for (let index = searchEvents.length - 1; index >= 0; index -= 1) {
          if (!args.where?.userId || searchEvents[index]?.userId === args.where.userId) {
            searchEvents.splice(index, 1);
          }
        }

        return { count: originalLength - searchEvents.length };
      },
      groupBy: async (args: { by: string[]; where?: Record<string, unknown>; take?: number }) => {
        let rows = [...searchEvents];
        if (args.where?.normalizedQuery && Array.isArray((args.where.normalizedQuery as { in?: string[] }).in)) {
          const accepted = (args.where.normalizedQuery as { in: string[] }).in;
          rows = rows.filter((item) => accepted.includes(item.normalizedQuery));
        }
        if (args.where?.createdAt && (args.where.createdAt as { gte?: Date }).gte) {
          rows = rows.filter((item) => item.createdAt >= (args.where!.createdAt as { gte: Date }).gte);
        }
        if (typeof args.where?.resultCount === 'number') {
          rows = rows.filter((item) => item.resultCount === args.where!.resultCount);
        }

        const grouped = new Map<string, { normalizedQuery: string; count: number; resultTotal: number }>();
        for (const row of rows) {
          const current = grouped.get(row.normalizedQuery) ?? {
            normalizedQuery: row.normalizedQuery,
            count: 0,
            resultTotal: 0,
          };
          current.count += 1;
          current.resultTotal += row.resultCount;
          grouped.set(row.normalizedQuery, current);
        }

        return [...grouped.values()]
          .sort((left, right) => right.count - left.count)
          .slice(0, args.take ?? grouped.size)
          .map((item) => ({
            normalizedQuery: item.normalizedQuery,
            _count: { normalizedQuery: item.count },
            _avg: { resultCount: item.count ? item.resultTotal / item.count : 0 },
          }));
      },
    },
  };

  return {
    prisma,
    searchEvents,
  };
}

test('search.search returns ranked results logs analytics and exposes facets', async () => {
  const mock = createSearchMock();
  const service = new SearchService(mock.prisma as never);

  const result = await service.search(
    {
      q: 'dien thoai',
      inStock: true,
      sort: 'relevance',
      page: 1,
      limit: 10,
      source: 'search-box',
    },
    'u-1',
  );

  assert.equal(result.total, 1);
  assert.equal(result.data[0].slug, 'iphone-15');
  assert.equal(result.facets.categories[0].slug, 'dien-thoai');
  assert.equal(mock.searchEvents.at(-1)?.normalizedQuery, 'dien thoai');
  assert.equal(mock.searchEvents.at(-1)?.source, 'search-box');
});

test('search.suggestions trending and analytics cover query intelligence endpoints', async () => {
  const mock = createSearchMock();
  const service = new SearchService(mock.prisma as never);

  const suggestions = await service.suggestions('ip', 5);
  const trending = await service.trending(5, 30);
  const analytics = await service.analytics({ limit: 5, days: 30 });
  const zeroOnly = await service.analytics({ limit: 5, days: 30, zeroOnly: true });
  const empty = await service.search({ q: 'ifone', page: 1, limit: 10 });

  assert.equal(suggestions.products[0].slug, 'iphone-15');
  assert.equal(trending.data[0].query, 'iphone');
  assert.equal(analytics.popularQueries[0].count >= 1, true);
  assert.equal(analytics.zeroResultQueries[0].query, 'khong ton tai');
  assert.equal(zeroOnly.zeroResultQueries[0].query, 'khong ton tai');
  assert.equal(empty.total, 0);
  assert.equal(empty.suggestion?.slug, 'iphone-15');
});

test('search.recent and clearRecent expose customer search history', async () => {
  const mock = createSearchMock();
  const service = new SearchService(mock.prisma as never);

  await service.search({ q: 'iphone', page: 1, limit: 10, source: 'search-box' }, 'u-1');
  await service.search({ q: 'airpods', page: 1, limit: 10, source: 'search-box' }, 'u-1');

  const recent = await service.recent('u-1', 5);
  const cleared = await service.clearRecent('u-1');
  const afterClear = await service.recent('u-1', 5);

  assert.equal(recent.total, 2);
  assert.equal(recent.data[0].normalizedQuery, 'airpods');
  assert.equal(recent.data[1].normalizedQuery, 'iphone');
  assert.equal(cleared.deletedCount, 3);
  assert.equal(afterClear.total, 0);
});
