import { Injectable } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { QuerySearchAnalyticsDto } from './dto/query-search-analytics.dto';
import { QuerySearchDto } from './dto/query-search.dto';

type SearchableProduct = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  rating: number;
  totalSold: number;
  createdAt: Date;
  tags: string[];
  brand: { id: string; name: string; slug: string } | null;
  category: { id: string; name: string; slug: string } | null;
  media: Array<{ id: string; url: string; isPrimary: boolean; sortOrder: number }>;
};

@Injectable()
export class SearchService {
  private readonly synonymMap: Record<string, string[]> = {
    'dien thoai': ['smartphone', 'phone', 'mobile'],
    smartphone: ['dien thoai', 'phone', 'mobile'],
    phone: ['dien thoai', 'smartphone', 'mobile'],
    laptop: ['notebook', 'macbook'],
    notebook: ['laptop'],
    'tai nghe': ['headphone', 'earbuds', 'airpods'],
    headphone: ['tai nghe', 'earbuds'],
    airpods: ['tai nghe', 'earbuds'],
    'dong ho': ['smartwatch', 'watch'],
    smartwatch: ['dong ho', 'watch'],
    'may tinh bang': ['tablet', 'ipad'],
    tablet: ['may tinh bang', 'ipad'],
  };

  constructor(private readonly prisma: PrismaService) {}

  async search(query: QuerySearchDto, userId?: string) {
    const startedAt = Date.now();
    const keyword = query.q.trim();
    const normalized = this.normalize(keyword);
    const expandedTerms = this.expandTerms(normalized);
    const tokens = [...new Set(expandedTerms.flatMap((term) => term.split(' ').filter(Boolean)))];
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;

    const where = this.buildSearchWhere(query, expandedTerms, tokens);
    const allRows = (await this.prisma.product.findMany({
      where,
      include: this.productInclude(),
      orderBy: [{ createdAt: 'desc' }],
    })) as SearchableProduct[];

    const scored = allRows
      .map((product) => ({
        product,
        score: this.computeRelevance(product, expandedTerms, tokens),
      }))
      .sort((left, right) => this.compareProducts(left, right, query.sort));

    const total = scored.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    const data = scored.slice(start, start + limit).map((item) => item.product);
    const suggestion = total ? null : await this.buildSuggestion(normalized);
    const facets = this.buildFacets(scored.map((item) => item.product));
    const tookMs = Date.now() - startedAt;

    await this.prisma.searchQueryEvent.create({
      data: {
        userId,
        query: keyword,
        normalizedQuery: normalized,
        expandedTerms,
        resultCount: total,
        source: query.source?.trim() || 'web',
      },
    });

    return {
      query: keyword,
      normalizedQuery: normalized,
      expandedTerms,
      total,
      page: safePage,
      limit,
      totalPages,
      tookMs,
      suggestion,
      facets,
      data,
    };
  }

  async suggestions(keyword: string, limit = 8) {
    const normalized = this.normalize(keyword);
    const expandedTerms = this.expandTerms(normalized);
    const contains = keyword.trim();
    const queryLimit = Math.max(1, Math.min(limit, 20));

    const [products, categories, brands, popularQueries] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          status: ProductStatus.active,
          OR: [
            { name: { contains, mode: 'insensitive' } },
            { sku: { contains, mode: 'insensitive' } },
          ],
        },
        take: queryLimit,
        orderBy: [{ totalSold: 'desc' }, { createdAt: 'desc' }],
        include: {
          media: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            take: 1,
          },
        },
      }),
      this.prisma.category.findMany({
        where: {
          isActive: true,
          name: { contains, mode: 'insensitive' },
        },
        take: queryLimit,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.brand.findMany({
        where: {
          isActive: true,
          name: { contains, mode: 'insensitive' },
        },
        take: queryLimit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.searchQueryEvent.groupBy({
        by: ['normalizedQuery'],
        where: {
          normalizedQuery: { in: expandedTerms },
        },
        _count: { normalizedQuery: true },
        orderBy: {
          _count: {
            normalizedQuery: 'desc',
          },
        },
        take: queryLimit,
      }),
    ]);

    return {
      query: keyword,
      products,
      categories,
      brands,
      queries: popularQueries.map((item) => item.normalizedQuery),
    };
  }

  async recent(userId: string, limit = 10) {
    const queryLimit = Math.max(1, Math.min(limit, 20));
    const rows = await this.prisma.searchQueryEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: queryLimit * 5,
      select: {
        query: true,
        normalizedQuery: true,
        resultCount: true,
        source: true,
        createdAt: true,
      },
    });

    const seen = new Set<string>();
    const data: Array<{
      query: string;
      normalizedQuery: string;
      resultCount: number;
      source: string;
      createdAt: Date;
    }> = [];

    for (const row of rows) {
      if (seen.has(row.normalizedQuery)) {
        continue;
      }

      seen.add(row.normalizedQuery);
      data.push(row);

      if (data.length >= queryLimit) {
        break;
      }
    }

    return {
      total: data.length,
      data,
    };
  }

  async clearRecent(userId: string) {
    const deleted = await this.prisma.searchQueryEvent.deleteMany({
      where: { userId },
    });

    return {
      deletedCount: deleted.count,
    };
  }

  async trending(limit = 10, days = 7) {
    const since = this.daysAgo(days);

    const [queries, fallbackProducts] = await Promise.all([
      this.prisma.searchQueryEvent.groupBy({
        by: ['normalizedQuery'],
        where: {
          createdAt: { gte: since },
        },
        _count: { normalizedQuery: true },
        _avg: { resultCount: true },
        orderBy: {
          _count: {
            normalizedQuery: 'desc',
          },
        },
        take: limit,
      }),
      this.prisma.product.findMany({
        where: {
          status: ProductStatus.active,
          stock: { gt: 0 },
        },
        orderBy: [{ totalSold: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        select: {
          name: true,
          slug: true,
          totalSold: true,
        },
      }),
    ]);

    if (queries.length) {
      return {
        days,
        data: queries.map((item) => ({
          query: item.normalizedQuery,
          searchCount: item._count.normalizedQuery,
          averageResultCount: Number((item._avg.resultCount ?? 0).toFixed(2)),
        })),
      };
    }

    return {
      days,
      data: fallbackProducts.map((item) => ({
        query: this.normalize(item.name),
        searchCount: item.totalSold,
        averageResultCount: 1,
      })),
    };
  }

  async analytics(query: QuerySearchAnalyticsDto = {}) {
    const limit = query.limit ?? 10;
    const since = this.daysAgo(query.days ?? 30);

    const [popularQueries, zeroResultQueries] = await Promise.all([
      this.prisma.searchQueryEvent.groupBy({
        by: ['normalizedQuery'],
        where: {
          createdAt: { gte: since },
        },
        _count: { normalizedQuery: true },
        _avg: { resultCount: true },
        orderBy: {
          _count: {
            normalizedQuery: 'desc',
          },
        },
        take: limit,
      }),
      this.prisma.searchQueryEvent.groupBy({
        by: ['normalizedQuery'],
        where: {
          createdAt: { gte: since },
          resultCount: 0,
        },
        _count: { normalizedQuery: true },
        orderBy: {
          _count: {
            normalizedQuery: 'desc',
          },
        },
        take: limit,
      }),
    ]);

    if (query.zeroOnly) {
      return {
        days: query.days ?? 30,
        zeroResultQueries: zeroResultQueries.map((item) => ({
          query: item.normalizedQuery,
          count: item._count.normalizedQuery,
        })),
      };
    }

    return {
      days: query.days ?? 30,
      popularQueries: popularQueries.map((item) => ({
        query: item.normalizedQuery,
        count: item._count.normalizedQuery,
        averageResultCount: Number((item._avg.resultCount ?? 0).toFixed(2)),
      })),
      zeroResultQueries: zeroResultQueries.map((item) => ({
        query: item.normalizedQuery,
        count: item._count.normalizedQuery,
      })),
    };
  }

  private buildSearchWhere(
    query: QuerySearchDto,
    expandedTerms: string[],
    tokens: string[],
  ): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.active,
    };

    const clauses: Prisma.ProductWhereInput[] = [];
    for (const term of expandedTerms) {
      clauses.push(
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
      );
    }

    for (const token of tokens) {
      clauses.push(
        { tags: { has: token } },
        { brand: { name: { contains: token, mode: 'insensitive' } } },
        { category: { name: { contains: token, mode: 'insensitive' } } },
      );
    }

    where.OR = clauses;

    if (query.category) {
      where.category = {
        slug: { equals: query.category, mode: 'insensitive' },
      };
    }

    if (query.brand) {
      where.brand = {
        slug: { equals: query.brand, mode: 'insensitive' },
      };
    }

    if (typeof query.minPrice === 'number' || typeof query.maxPrice === 'number') {
      where.price = {};
      if (typeof query.minPrice === 'number') {
        where.price.gte = query.minPrice;
      }
      if (typeof query.maxPrice === 'number') {
        where.price.lte = query.maxPrice;
      }
    }

    if (query.inStock) {
      where.stock = { gt: 0 };
    }

    return where;
  }

  private computeRelevance(product: SearchableProduct, expandedTerms: string[], tokens: string[]) {
    const haystacks = {
      name: this.normalize(product.name),
      description: this.normalize(product.description),
      sku: this.normalize(product.sku),
      brand: this.normalize(product.brand?.name ?? ''),
      category: this.normalize(product.category?.name ?? ''),
      tags: product.tags.map((tag) => this.normalize(tag)),
    };

    let score = 0;

    for (const term of expandedTerms) {
      if (haystacks.name === term) {
        score += 120;
      } else if (haystacks.name.includes(term)) {
        score += 80;
      }

      if (haystacks.sku.includes(term)) {
        score += 70;
      }

      if (haystacks.brand.includes(term)) {
        score += 30;
      }

      if (haystacks.category.includes(term)) {
        score += 25;
      }

      if (haystacks.description.includes(term)) {
        score += 15;
      }
    }

    for (const token of tokens) {
      if (haystacks.tags.includes(token)) {
        score += 18;
      }
    }

    score += Math.min(product.totalSold, 500) / 10;
    score += Math.min(product.rating, 5) * 2;
    if (product.stock > 0) {
      score += 5;
    }

    return Number(score.toFixed(2));
  }

  private compareProducts(
    left: { product: SearchableProduct; score: number },
    right: { product: SearchableProduct; score: number },
    sort?: QuerySearchDto['sort'],
  ) {
    switch (sort) {
      case 'price_asc':
        return left.product.price - right.product.price || right.score - left.score;
      case 'price_desc':
        return right.product.price - left.product.price || right.score - left.score;
      case 'rating_desc':
        return right.product.rating - left.product.rating || right.score - left.score;
      case 'newest':
        return right.product.createdAt.getTime() - left.product.createdAt.getTime() || right.score - left.score;
      case 'relevance':
      default:
        return (
          right.score - left.score ||
          right.product.totalSold - left.product.totalSold ||
          right.product.createdAt.getTime() - left.product.createdAt.getTime()
        );
    }
  }

  private async buildSuggestion(normalizedQuery: string) {
    const [products, categories, brands] = await Promise.all([
      this.prisma.product.findMany({
        where: { status: ProductStatus.active },
        take: 50,
        select: { name: true, slug: true },
        orderBy: [{ totalSold: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.category.findMany({
        where: { isActive: true },
        take: 25,
        select: { name: true, slug: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.brand.findMany({
        where: { isActive: true },
        take: 25,
        select: { name: true, slug: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const candidates = [
      ...products.map((item) => ({ type: 'product', label: item.name, slug: item.slug })),
      ...categories.map((item) => ({ type: 'category', label: item.name, slug: item.slug })),
      ...brands.map((item) => ({ type: 'brand', label: item.name, slug: item.slug })),
    ];

    let best:
      | {
          type: string;
          label: string;
          slug: string;
          alias: string;
          distance: number;
        }
      | undefined;

    for (const candidate of candidates) {
      for (const alias of this.buildCandidateAliases(candidate.label)) {
        const distance = this.levenshtein(normalizedQuery, alias);
        if (!best || distance < best.distance || (distance === best.distance && alias.length < best.alias.length)) {
          best = { ...candidate, alias, distance };
        }
      }
    }

    if (!best || best.distance > Math.max(3, Math.floor(normalizedQuery.length / 2))) {
      return null;
    }

    return {
      text: best.label,
      type: best.type,
      slug: best.slug,
    };
  }

  private buildCandidateAliases(label: string) {
    const normalized = this.normalize(label);
    const tokens = normalized.split(' ').filter(Boolean);
    const aliases = new Set<string>([normalized]);

    if (tokens.length > 1) {
      aliases.add(tokens.filter((token) => !/^\d+$/.test(token)).join(' ').trim());
      aliases.add(tokens.slice(0, 2).join(' '));
    }

    for (const token of tokens) {
      if (token.length >= 3 && !/^\d+$/.test(token)) {
        aliases.add(token);
      }
    }

    return [...aliases].filter(Boolean);
  }

  private buildFacets(products: SearchableProduct[]) {
    const categories = new Map<string, { slug: string; name: string; count: number }>();
    const brands = new Map<string, { slug: string; name: string; count: number }>();

    for (const product of products) {
      if (product.category) {
        const key = product.category.slug;
        const current = categories.get(key) ?? {
          slug: product.category.slug,
          name: product.category.name,
          count: 0,
        };
        current.count += 1;
        categories.set(key, current);
      }

      if (product.brand) {
        const key = product.brand.slug;
        const current = brands.get(key) ?? {
          slug: product.brand.slug,
          name: product.brand.name,
          count: 0,
        };
        current.count += 1;
        brands.set(key, current);
      }
    }

    return {
      categories: [...categories.values()].sort((left, right) => right.count - left.count),
      brands: [...brands.values()].sort((left, right) => right.count - left.count),
      price: {
        min: products.length ? Math.min(...products.map((item) => item.price)) : 0,
        max: products.length ? Math.max(...products.map((item) => item.price)) : 0,
      },
    };
  }

  private expandTerms(normalizedQuery: string) {
    const terms = new Set<string>([normalizedQuery]);
    for (const token of normalizedQuery.split(' ').filter(Boolean)) {
      terms.add(token);
    }

    const direct = this.synonymMap[normalizedQuery] ?? [];
    for (const synonym of direct) {
      terms.add(synonym);
      for (const token of synonym.split(' ').filter(Boolean)) {
        terms.add(token);
      }
    }

    for (const token of normalizedQuery.split(' ').filter(Boolean)) {
      for (const synonym of this.synonymMap[token] ?? []) {
        terms.add(synonym);
      }
    }

    return [...terms].filter(Boolean);
  }

  private normalize(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private daysAgo(days: number) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }

  private levenshtein(left: string, right: string) {
    if (!left) {
      return right.length;
    }
    if (!right) {
      return left.length;
    }

    const matrix = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0));

    for (let i = 0; i <= left.length; i += 1) {
      matrix[i]![0] = i;
    }
    for (let j = 0; j <= right.length; j += 1) {
      matrix[0]![j] = j;
    }

    for (let i = 1; i <= left.length; i += 1) {
      for (let j = 1; j <= right.length; j += 1) {
        const cost = left[i - 1] === right[j - 1] ? 0 : 1;
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j - 1]! + cost,
        );
      }
    }

    return matrix[left.length]![right.length]!;
  }

  private productInclude() {
    return {
      category: true,
      brand: true,
      media: {
        orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
        take: 1,
      },
    };
  }
}
