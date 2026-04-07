import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

function createProductsMock() {
  const users = [
    { id: 'u-reviewer', fullName: 'Reviewer Demo' },
    { id: 'u-admin', fullName: 'Admin Demo' },
    { id: 'u-pending', fullName: 'Pending Demo' },
  ];
  const categories = [
    {
      id: 'c-root',
      name: 'Electronics',
      slug: 'electronics',
      description: null,
      parentId: null,
      sortOrder: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'c-phones',
      name: 'Phones',
      slug: 'phones',
      description: null,
      parentId: 'c-root',
      sortOrder: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const brands = [
    {
      id: 'b-apple',
      name: 'Apple',
      slug: 'apple',
      description: null,
      logoUrl: null,
      website: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const products = [
    {
      id: 'p-1',
      sku: 'SKU-1',
      slug: 'iphone-15',
      name: 'iPhone 15',
      description: 'Demo product',
      price: 20_000_000,
      stock: 10,
      rating: 4.8,
      tags: ['featured'],
      status: 'active',
      isFeatured: true,
      metaTitle: null,
      metaDescription: null,
      totalReviews: 0,
      totalSold: 12,
      createdAt: new Date(),
      updatedAt: new Date(),
      categoryId: 'c-phones',
      brandId: 'b-apple',
    },
  ];
  const productMedia = [
    {
      id: 'pm-1',
      productId: 'p-1',
      url: 'https://cdn.example.com/p-1.jpg',
      type: 'image',
      altText: 'Primary photo',
      isPrimary: true,
      sortOrder: 0,
      createdAt: new Date(),
    },
  ];
  const warehouses = [
    {
      id: 'w-main',
      code: 'MAIN',
      name: 'Main Warehouse',
      city: null,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const variants = [
    {
      id: 'pv-1',
      productId: 'p-1',
      sku: 'SKU-1-BLACK',
      name: 'Black 128GB',
      attributes: { color: 'Black', storage: '128GB' },
      price: 20_000_000,
      stock: 10,
      isDefault: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const inventoryLevels = [
    {
      id: 'il-1',
      productId: 'p-1',
      variantId: 'pv-1',
      warehouseId: 'w-main',
      available: 10,
      reserved: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const reviews = [
    {
      id: 'r-1',
      userId: 'u-admin',
      productId: 'p-1',
      rating: 4,
      title: 'Existing review',
      content: 'Existing admin review for listing tests.',
      mediaUrls: [],
      isVerifiedPurchase: false,
      status: 'published',
      helpfulCount: 3,
      adminReply: null,
      adminReplyAt: null,
      createdAt: new Date('2026-04-01T10:00:00.000Z'),
      updatedAt: new Date('2026-04-01T10:00:00.000Z'),
    },
  ];
  const reviewHelpfulVotes: Array<{
    id: string;
    userId: string;
    reviewId: string;
    createdAt: Date;
  }> = [];
  const productQuestions = [
    {
      id: 'q-1',
      userId: 'u-reviewer',
      productId: 'p-1',
      question: 'May nay co ho tro eSIM khong?',
      answer: 'Co, may ho tro 1 nano SIM va eSIM.',
      status: 'published',
      upvoteCount: 2,
      answeredAt: new Date('2026-04-02T10:00:00.000Z'),
      answeredById: 'u-admin',
      createdAt: new Date('2026-04-02T09:00:00.000Z'),
      updatedAt: new Date('2026-04-02T10:00:00.000Z'),
    },
  ];
  const productQuestionUpvotes: Array<{
    id: string;
    userId: string;
    questionId: string;
    createdAt: Date;
  }> = [];
  const productPriceHistory = [
    {
      id: 'ph-1',
      productId: 'p-1',
      price: 21_000_000,
      previousPrice: null,
      source: 'seed',
      changedAt: new Date('2026-03-30T10:00:00.000Z'),
    },
    {
      id: 'ph-2',
      productId: 'p-1',
      price: 20_000_000,
      previousPrice: 21_000_000,
      source: 'admin_update',
      changedAt: new Date('2026-04-01T10:00:00.000Z'),
    },
  ];
  const priceAlerts = [
    {
      id: 'pa-1',
      userId: 'u-reviewer',
      productId: 'p-1',
      targetPrice: 19_500_000,
      isActive: true,
      lastNotifiedPrice: null,
      createdAt: new Date('2026-04-01T09:00:00.000Z'),
      updatedAt: new Date('2026-04-01T09:00:00.000Z'),
    },
  ];
  const notifications: Array<{
    id: string;
    userId: string;
    type: string;
    title: string;
    content: string;
    data?: Record<string, unknown>;
    createdAt: Date;
  }> = [];
  let lastFindManyArgs: Record<string, unknown> | null = null;

  function findUser(userId: string) {
    return users.find((user) => user.id === userId) ?? { id: userId, fullName: 'Unknown User' };
  }

  function materializeVariant(variant: (typeof variants)[number]) {
    return {
      ...variant,
      inventoryLevels: inventoryLevels
        .filter((level) => level.variantId === variant.id)
        .map((level) => ({
          ...level,
          warehouse: warehouses.find((warehouse) => warehouse.id === level.warehouseId)!,
        })),
    };
  }

  function materializeProduct(product: (typeof products)[number]) {
    return {
      ...product,
      category: categories.find((category) => category.id === product.categoryId) ?? null,
      brand: brands.find((brand) => brand.id === product.brandId) ?? null,
      media: productMedia
        .filter((item) => item.productId === product.id)
        .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary) || left.sortOrder - right.sortOrder),
      variants: variants
        .filter((variant) => variant.productId === product.id)
        .sort((left, right) => Number(right.isDefault) - Number(left.isDefault))
        .map((variant) => materializeVariant(variant)),
    };
  }

  function filterReviews(where?: Record<string, unknown>) {
    return reviews.filter((review) => {
      if (!where) {
        return true;
      }

      if (typeof where.productId === 'string' && review.productId !== where.productId) {
        return false;
      }

      if (typeof where.status === 'string' && review.status !== where.status) {
        return false;
      }

      if (typeof where.rating === 'number' && review.rating !== where.rating) {
        return false;
      }

      if (typeof where.isVerifiedPurchase === 'boolean' && review.isVerifiedPurchase !== where.isVerifiedPurchase) {
        return false;
      }

      if (
        where.mediaUrls &&
        typeof where.mediaUrls === 'object' &&
        'isEmpty' in where.mediaUrls &&
        (where.mediaUrls as { isEmpty?: boolean }).isEmpty === false &&
        review.mediaUrls.length === 0
      ) {
        return false;
      }

      if (
        where.userId_productId &&
        typeof where.userId_productId === 'object' &&
        'userId' in where.userId_productId &&
        'productId' in where.userId_productId
      ) {
        const compound = where.userId_productId as { userId: string; productId: string };
        return review.userId === compound.userId && review.productId === compound.productId;
      }

      if (typeof where.id === 'string' && review.id !== where.id) {
        return false;
      }

      return true;
    });
  }

  function filterQuestions(where?: Record<string, unknown>) {
    return productQuestions.filter((question) => {
      if (!where) {
        return true;
      }

      if (typeof where.productId === 'string' && question.productId !== where.productId) {
        return false;
      }

      if (typeof where.status === 'string' && question.status !== where.status) {
        return false;
      }

      if (typeof where.id === 'string' && question.id !== where.id) {
        return false;
      }

      if (where.answer && typeof where.answer === 'object') {
        if ('not' in where.answer && (where.answer as { not?: null }).not === null && question.answer === null) {
          return false;
        }
      }

      if (where.answer === null && question.answer !== null) {
        return false;
      }

      if (where.OR && Array.isArray(where.OR)) {
        const matched = where.OR.some((clause) => {
          if (
            clause &&
            typeof clause === 'object' &&
            'question' in clause &&
            clause.question &&
            typeof clause.question === 'object' &&
            'contains' in clause.question &&
            typeof clause.question.contains === 'string'
          ) {
            return question.question.toLowerCase().includes(clause.question.contains.toLowerCase());
          }

          if (
            clause &&
            typeof clause === 'object' &&
            'answer' in clause &&
            clause.answer &&
            typeof clause.answer === 'object' &&
            'contains' in clause.answer &&
            typeof clause.answer.contains === 'string'
          ) {
            return (question.answer ?? '').toLowerCase().includes(clause.answer.contains.toLowerCase());
          }

          return false;
        });

        if (!matched) {
          return false;
        }
      }

      return true;
    });
  }

  const tx = {
    product: {
      count: async () => products.length,
      findMany: async (args?: Record<string, unknown>) => {
        lastFindManyArgs = args ?? null;
        return products.map((product) => materializeProduct(product));
      },
      findFirst: async (args: { where: { OR: Array<{ id?: string; slug?: string }> } }) => {
        const product =
          products.find((item) =>
            args.where.OR.some((condition) => item.id === condition.id || item.slug === condition.slug),
          ) ?? null;
        return product ? materializeProduct(product) : null;
      },
      findUnique: async (args: {
        where: { id: string };
        select?: Record<string, unknown>;
      }) => {
        const product = products.find((item) => item.id === args.where.id) ?? null;
        if (!product) {
          return null;
        }

        if (args.select) {
          return Object.fromEntries(
            Object.entries(args.select)
              .filter(([, value]) => Boolean(value))
              .map(([key, value]) => {
                if (key === 'variants' && typeof value === 'object') {
                  return [
                    key,
                    variants
                      .filter((variant) => variant.productId === product.id && variant.isActive)
                      .map((variant) => ({ id: variant.id })),
                  ];
                }

                return [key, (product as Record<string, unknown>)[key]];
              }),
          );
        }

        return materializeProduct(product);
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const product = {
          id: 'p-new',
          createdAt: new Date(),
          updatedAt: new Date(),
          rating: 0,
          totalReviews: 0,
          totalSold: 0,
          tags: [],
          status: 'active',
          isFeatured: false,
          metaTitle: null,
          metaDescription: null,
          categoryId: null,
          brandId: null,
          ...args.data,
        } as (typeof products)[number];
        products.push(product);
        return materializeProduct(product);
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const product = products.find((item) => item.id === args.where.id);
        if (!product) {
          throw new Error('product not found');
        }
        Object.assign(product, args.data, { updatedAt: new Date() });
        return materializeProduct(product);
      },
    },
    productVariant: {
      create: async (args: { data: Record<string, unknown> }) => {
        const variant = {
          id: `pv-${variants.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          attributes: null,
          stock: 0,
          isDefault: false,
          isActive: true,
          ...args.data,
        } as (typeof variants)[number];
        variants.push(variant);
        return materializeVariant(variant);
      },
      deleteMany: async (args: { where: { productId: string } }) => {
        const before = variants.length;
        for (let index = variants.length - 1; index >= 0; index -= 1) {
          if (variants[index].productId === args.where.productId) {
            variants.splice(index, 1);
          }
        }
        return { count: before - variants.length };
      },
    },
    inventoryLevel: {
      create: async (args: { data: Record<string, unknown> }) => {
        const level = {
          id: `il-${inventoryLevels.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          reserved: 0,
          ...args.data,
        } as (typeof inventoryLevels)[number];
        inventoryLevels.push(level);
        return level;
      },
      deleteMany: async (args: { where: { productId: string } }) => {
        const before = inventoryLevels.length;
        for (let index = inventoryLevels.length - 1; index >= 0; index -= 1) {
          if (inventoryLevels[index].productId === args.where.productId) {
            inventoryLevels.splice(index, 1);
          }
        }
        return { count: before - inventoryLevels.length };
      },
    },
    warehouse: {
      findFirst: async () => warehouses.find((warehouse) => warehouse.isDefault) ?? null,
      findUnique: async (args: { where: { code: string } }) =>
        warehouses.find((warehouse) => warehouse.code === args.where.code) ?? null,
      create: async (args: { data: Record<string, unknown> }) => {
        const warehouse = {
          id: `w-${warehouses.length + 1}`,
          city: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.data,
        } as (typeof warehouses)[number];
        warehouses.push(warehouse);
        return warehouse;
      },
    },
    category: {
      findMany: async () => categories,
      findFirst: async (args: { where: { slug: { equals: string } } }) =>
        categories.find((category) => category.slug === args.where.slug.equals) ?? null,
      create: async (args: { data: Record<string, unknown> }) => ({
        id: 'c-new',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        ...args.data,
      }),
    },
    brand: {
      findMany: async () => brands,
      findFirst: async (args: { where: { slug: { equals: string } } }) =>
        brands.find((brand) => brand.slug === args.where.slug.equals) ?? null,
      create: async (args: { data: Record<string, unknown> }) => ({
        id: 'b-new',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        ...args.data,
      }),
    },
    productMedia: {
      updateMany: async () => ({ count: 1 }),
      create: async (args: { data: Record<string, unknown> }) => {
        const media = {
          id: `pm-${productMedia.length + 1}`,
          createdAt: new Date(),
          ...args.data,
        };
        productMedia.push(media as never);
        return media;
      },
    },
    review: {
      count: async (args?: { where?: Record<string, unknown> }) =>
        filterReviews(args?.where).length,
      findMany: async (args?: {
        where?: Record<string, unknown>;
        select?: Record<string, boolean>;
        include?: Record<string, unknown>;
      }) => {
        const filtered = filterReviews(args?.where).map((review) => ({
          ...review,
          user: {
            id: findUser(review.userId).id,
            fullName: findUser(review.userId).fullName,
          },
        }));

        if (args?.select) {
          return filtered.map((review) =>
            Object.fromEntries(
              Object.entries(args.select!)
                .filter(([, value]) => Boolean(value))
                .map(([key]) => [key, (review as Record<string, unknown>)[key]]),
            ),
          );
        }

        return filtered;
      },
      findUnique: async (args: { where: { userId_productId: { userId: string; productId: string } } }) =>
        filterReviews({ userId_productId: args.where.userId_productId })[0] ?? null,
      create: async (args: {
        data: Record<string, unknown>;
        include?: { user?: { select: { id: true; fullName: true } } };
      }) => {
        const review = {
          id: `r-${reviews.length + 1}`,
          helpfulCount: 0,
          adminReply: null,
          adminReplyAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.data,
        };
        reviews.push(review);
        return args.include?.user
          ? {
              ...review,
              user: findUser(review.userId as string),
            }
          : review;
      },
      findFirst: async (args: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
        const review =
          filterReviews({
            id: args.where.id,
            productId: args.where.productId,
            status: args.where.status,
          })[0] ?? null;

        if (!review) {
          return null;
        }

        if (args.select) {
          return Object.fromEntries(
            Object.entries(args.select)
              .filter(([, value]) => Boolean(value))
              .map(([key]) => [key, (review as Record<string, unknown>)[key]]),
          );
        }

        return review;
      },
      update: async (args: {
        where: { id: string };
        data: Record<string, unknown>;
        select?: Record<string, boolean>;
        include?: { user?: { select: { id: true; fullName: true } } };
      }) => {
        const review = reviews.find((item) => item.id === args.where.id);
        if (!review) {
          throw new Error('review not found');
        }
        const nextData = { ...args.data };
        delete nextData.helpfulCount;
        Object.assign(review, nextData, { updatedAt: new Date() });
        if (
          args.data.helpfulCount &&
          typeof args.data.helpfulCount === 'object' &&
          'increment' in args.data.helpfulCount
        ) {
          review.helpfulCount += Number((args.data.helpfulCount as { increment: number }).increment);
        }
        if (args.select) {
          return Object.fromEntries(
            Object.entries(args.select)
              .filter(([, value]) => Boolean(value))
              .map(([key]) => [key, (review as Record<string, unknown>)[key]]),
          );
        }
        return args.include?.user
          ? {
              ...review,
              user: findUser(review.userId),
            }
          : review;
      },
    },
    reviewHelpfulVote: {
      findUnique: async (args: { where: { userId_reviewId: { userId: string; reviewId: string } } }) =>
        reviewHelpfulVotes.find(
          (vote) =>
            vote.userId === args.where.userId_reviewId.userId &&
            vote.reviewId === args.where.userId_reviewId.reviewId,
        ) ?? null,
      create: async (args: { data: { userId: string; reviewId: string } }) => {
        const vote = {
          id: `rhv-${reviewHelpfulVotes.length + 1}`,
          createdAt: new Date(),
          ...args.data,
        };
        reviewHelpfulVotes.push(vote);
        return vote;
      },
    },
    productQuestion: {
      count: async (args?: { where?: Record<string, unknown> }) => filterQuestions(args?.where).length,
      findMany: async (args?: {
        where?: Record<string, unknown>;
        include?: Record<string, unknown>;
        orderBy?: Array<Record<string, 'asc' | 'desc'>>;
        skip?: number;
        take?: number;
      }) => {
        let rows = filterQuestions(args?.where).map((question) => ({
          ...question,
          user: {
            id: findUser(question.userId).id,
            fullName: findUser(question.userId).fullName,
          },
          answeredBy: question.answeredById
            ? {
                id: findUser(question.answeredById).id,
                fullName: findUser(question.answeredById).fullName,
              }
            : null,
        }));

        const orderBy = args?.orderBy ?? [];
        rows.sort((left, right) => {
          for (const order of orderBy) {
            if (order.upvoteCount) {
              const diff =
                order.upvoteCount === 'asc'
                  ? left.upvoteCount - right.upvoteCount
                  : right.upvoteCount - left.upvoteCount;
              if (diff !== 0) {
                return diff;
              }
            }
            if (order.answeredAt) {
              const leftValue = (left.answeredAt ?? left.createdAt).getTime();
              const rightValue = (right.answeredAt ?? right.createdAt).getTime();
              const diff =
                order.answeredAt === 'asc' ? leftValue - rightValue : rightValue - leftValue;
              if (diff !== 0) {
                return diff;
              }
            }
            if (order.createdAt) {
              const diff =
                order.createdAt === 'asc'
                  ? left.createdAt.getTime() - right.createdAt.getTime()
                  : right.createdAt.getTime() - left.createdAt.getTime();
              if (diff !== 0) {
                return diff;
              }
            }
          }
          return 0;
        });

        if (args?.skip) {
          rows = rows.slice(args.skip);
        }
        if (args?.take) {
          rows = rows.slice(0, args.take);
        }

        return rows;
      },
      create: async (args: {
        data: Record<string, unknown>;
        include?: { user?: { select: { id: true; fullName: true } }; answeredBy?: { select: { id: true; fullName: true } } };
      }) => {
        const question = {
          id: `q-${productQuestions.length + 1}`,
          answer: null,
          status: 'published',
          upvoteCount: 0,
          answeredAt: null,
          answeredById: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.data,
        };
        productQuestions.push(question as never);
        return {
          ...question,
          user: args.include?.user ? findUser(question.userId as string) : undefined,
          answeredBy:
            args.include?.answeredBy && question.answeredById ? findUser(question.answeredById as string) : null,
        };
      },
      findFirst: async (args: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
        const question =
          filterQuestions({
            id: args.where.id,
            productId: args.where.productId,
            status: args.where.status,
          })[0] ?? null;

        if (!question) {
          return null;
        }

        if (args.select) {
          return Object.fromEntries(
            Object.entries(args.select)
              .filter(([, value]) => Boolean(value))
              .map(([key]) => [key, (question as Record<string, unknown>)[key]]),
          );
        }

        return question;
      },
      update: async (args: {
        where: { id: string };
        data: Record<string, unknown>;
        select?: Record<string, boolean>;
        include?: { user?: { select: { id: true; fullName: true } }; answeredBy?: { select: { id: true; fullName: true } } };
      }) => {
        const question = productQuestions.find((item) => item.id === args.where.id);
        if (!question) {
          throw new Error('question not found');
        }
        const nextData = { ...args.data };
        delete nextData.upvoteCount;
        Object.assign(question, nextData, { updatedAt: new Date() });
        if (
          args.data.upvoteCount &&
          typeof args.data.upvoteCount === 'object' &&
          'increment' in args.data.upvoteCount
        ) {
          question.upvoteCount += Number((args.data.upvoteCount as { increment: number }).increment);
        }
        if (args.select) {
          return Object.fromEntries(
            Object.entries(args.select)
              .filter(([, value]) => Boolean(value))
              .map(([key]) => [key, (question as Record<string, unknown>)[key]]),
          );
        }
        return {
          ...question,
          user: args.include?.user ? findUser(question.userId) : undefined,
          answeredBy:
            args.include?.answeredBy && question.answeredById ? findUser(question.answeredById) : null,
        };
      },
    },
    productQuestionUpvote: {
      findUnique: async (args: { where: { userId_questionId: { userId: string; questionId: string } } }) =>
        productQuestionUpvotes.find(
          (vote) =>
            vote.userId === args.where.userId_questionId.userId &&
            vote.questionId === args.where.userId_questionId.questionId,
        ) ?? null,
      create: async (args: { data: { userId: string; questionId: string } }) => {
        const vote = {
          id: `pqu-${productQuestionUpvotes.length + 1}`,
          createdAt: new Date(),
          ...args.data,
        };
        productQuestionUpvotes.push(vote);
        return vote;
      },
    },
    productPriceHistory: {
      findMany: async (args?: {
        where?: { productId?: string; changedAt?: { gte: Date } };
        orderBy?: { changedAt: 'asc' | 'desc' };
        take?: number;
      }) => {
        let rows = [...productPriceHistory];
        if (args?.where?.productId) {
          rows = rows.filter((item) => item.productId === args.where.productId);
        }
        if (args?.where?.changedAt?.gte) {
          rows = rows.filter((item) => item.changedAt >= args.where!.changedAt!.gte);
        }
        rows.sort((left, right) =>
          args?.orderBy?.changedAt === 'asc'
            ? left.changedAt.getTime() - right.changedAt.getTime()
            : right.changedAt.getTime() - left.changedAt.getTime(),
        );
        if (args?.take) {
          rows = rows.slice(0, args.take);
        }
        return rows;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        const row = {
          id: `ph-${productPriceHistory.length + 1}`,
          changedAt: new Date(),
          previousPrice: null,
          source: null,
          ...args.data,
        };
        productPriceHistory.push(row as never);
        return row;
      },
    },
    priceAlert: {
      findMany: async (args?: {
        where?: {
          productId?: string;
          isActive?: boolean;
        };
        select?: Record<string, boolean>;
      }) => {
        let rows = [...priceAlerts];
        if (args?.where?.productId) {
          rows = rows.filter((item) => item.productId === args.where.productId);
        }
        if (typeof args?.where?.isActive === 'boolean') {
          rows = rows.filter((item) => item.isActive === args.where.isActive);
        }
        if (args?.select) {
          return rows.map((row) =>
            Object.fromEntries(
              Object.entries(args.select!)
                .filter(([, value]) => Boolean(value))
                .map(([key]) => [key, (row as Record<string, unknown>)[key]]),
            ),
          );
        }
        return rows;
      },
      upsert: async (args: {
        where: { userId_productId: { userId: string; productId: string } };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
        select?: Record<string, boolean>;
      }) => {
        let row =
          priceAlerts.find(
            (item) =>
              item.userId === args.where.userId_productId.userId &&
              item.productId === args.where.userId_productId.productId,
          ) ?? null;
        if (!row) {
          row = {
            id: `pa-${priceAlerts.length + 1}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            targetPrice: null,
            isActive: true,
            lastNotifiedPrice: null,
            ...args.create,
          } as (typeof priceAlerts)[number];
          priceAlerts.push(row);
        } else {
          Object.assign(row, args.update, { updatedAt: new Date() });
        }
        if (!args.select) {
          return row;
        }
        return Object.fromEntries(
          Object.entries(args.select)
            .filter(([, value]) => Boolean(value))
            .map(([key]) => [key, (row as Record<string, unknown>)[key]]),
        );
      },
      updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0;
        for (const alert of priceAlerts) {
          if (typeof args.where.userId === 'string' && alert.userId !== args.where.userId) {
            continue;
          }
          if (typeof args.where.productId === 'string' && alert.productId !== args.where.productId) {
            continue;
          }
          if (
            args.where.id &&
            typeof args.where.id === 'object' &&
            'in' in args.where.id &&
            Array.isArray(args.where.id.in) &&
            !args.where.id.in.includes(alert.id)
          ) {
            continue;
          }
          Object.assign(alert, args.data, { updatedAt: new Date() });
          count += 1;
        }
        return { count };
      },
    },
    notification: {
      create: async (args: { data: Record<string, unknown> }) => {
        const row = {
          id: `n-${notifications.length + 1}`,
          createdAt: new Date(),
          ...args.data,
        } as (typeof notifications)[number];
        notifications.push(row);
        return row;
      },
    },
    order: {
      count: async (args?: { where?: { userId?: string } }) => (args?.where?.userId === 'u-pending' ? 0 : 1),
    },
  };

  const prisma = {
    ...tx,
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
  };

  return {
    prisma,
    getLastFindManyArgs: () => lastFindManyArgs,
    reviews,
    reviewHelpfulVotes,
    productQuestions,
    productQuestionUpvotes,
    productPriceHistory,
    priceAlerts,
    notifications,
    products,
    variants,
    inventoryLevels,
  };
}

test('products.findAll returns catalog data with categories and brands', async () => {
  const { prisma } = createProductsMock();
  const service = new ProductsService(prisma as never);

  const result = await service.findAll({
    q: 'iphone',
    category: 'phones',
    brand: 'apple',
    featured: true,
    page: 1,
    limit: 12,
  });

  assert.equal(result.total, 1);
  assert.equal(result.data.length, 1);
  assert.equal(result.categories.length, 1);
  assert.equal(result.brands.length, 1);
  assert.equal(result.data[0].slug, 'iphone-15');
});

test('products.createProduct resolves category and brand slugs', async () => {
  const { prisma, productPriceHistory } = createProductsMock();
  const service = new ProductsService(prisma as never);

  const created = await service.createProduct({
    sku: 'SKU-NEW',
    name: 'MacBook Pro',
    description: 'Laptop product used for admin create flow.',
    price: 32_000_000,
    stock: 7,
    categorySlug: 'phones',
    brandSlug: 'apple',
    variants: [
      {
        sku: 'SKU-NEW-SILVER',
        name: 'Silver 14"',
        price: 32_000_000,
        warehouseStocks: [{ warehouseCode: 'HN', quantity: 3 }],
      },
      {
        sku: 'SKU-NEW-BLACK',
        name: 'Space Black 14"',
        price: 33_000_000,
        isDefault: true,
        warehouseStocks: [{ warehouseCode: 'HCM', quantity: 4 }],
      },
    ],
  });

  assert.equal(created.sku, 'SKU-NEW');
  assert.equal(created.category.id, 'c-phones');
  assert.equal(created.brand.id, 'b-apple');
  assert.equal(created.variants.length, 2);
  assert.equal(created.stock, 7);
  assert.equal(created.price, 33_000_000);
  assert.equal(created.variants[0].isDefault, true);
  assert.equal(created.variants[0].inventoryLevels[0].warehouse.code, 'HCM');
  assert.equal(productPriceHistory.at(-1)?.price, 33_000_000);
  assert.equal(productPriceHistory.at(-1)?.source, 'create');
});

test('products.findOne throws NotFoundException for missing product', async () => {
  const { prisma } = createProductsMock();
  const service = new ProductsService(prisma as never);

  await assert.rejects(
    async () => service.findOne('missing-product'),
    (error: unknown) => error instanceof NotFoundException,
  );
});

test('products.category and brand management build trees and create records', async () => {
  const { prisma } = createProductsMock();
  const service = new ProductsService(prisma as never);

  const categories = await service.listCategories();
  const createdCategory = await service.createCategory({
    name: 'Wearables',
  });
  const createdBrand = await service.createBrand({
    name: 'Sony',
    website: 'https://sony.example.com',
  });

  assert.equal(categories.length, 1);
  assert.equal(categories[0].name, 'Electronics');
  assert.equal(categories[0].children.length, 1);
  assert.equal(createdCategory.name, 'Wearables');
  assert.ok(createdCategory.slug.startsWith('wearables-'));
  assert.equal(createdBrand.name, 'Sony');
  assert.ok(createdBrand.slug.startsWith('sony-'));
});

test('products.update archive import export and addMedia cover admin catalog workflows', async () => {
  const { prisma } = createProductsMock();
  const service = new ProductsService(prisma as never);

  const updated = await service.updateProduct('p-1', {
    name: 'iPhone 15 Pro',
    price: 25_000_000,
    brandSlug: 'apple',
    categorySlug: 'phones',
    variants: [
      {
        sku: 'SKU-1-BLUE',
        name: 'Blue 256GB',
        price: 25_000_000,
        isDefault: true,
        warehouseStocks: [{ warehouseCode: 'MAIN', quantity: 6 }],
      },
      {
        sku: 'SKU-1-NATURAL',
        name: 'Natural 256GB',
        price: 26_000_000,
        warehouseStocks: [{ warehouseCode: 'DN', quantity: 2 }],
      },
    ],
  });
  const archived = await service.archiveProduct('p-1');
  const imported = await service.importProducts({
    items: [
      {
        sku: 'SKU-2',
        name: 'Galaxy Buds',
        description: 'Wireless earbuds for import coverage.',
        price: 3_000_000,
        stock: 11,
        brandSlug: 'apple',
      },
    ],
  });
  const exported = await service.exportProducts();
  const media = await service.addMedia('p-1', {
    url: 'https://cdn.example.com/iphone-15.jpg',
    altText: 'Front photo',
    isPrimary: true,
  });

  assert.equal(updated.name, 'iPhone 15 Pro');
  assert.equal(updated.variants.length, 2);
  assert.equal(updated.stock, 8);
  assert.equal(archived.status, 'archived');
  assert.equal(imported.count, 1);
  assert.equal(imported.data[0].sku, 'SKU-2');
  assert.equal(exported.filename, 'products-export.csv');
  assert.match(exported.content, /id,sku,slug,name,status,price,stock,category,brand,featured/);
  assert.equal(media.productId, 'p-1');
  assert.equal(media.type, 'image');
});

test('products.priceHistory and price alerts track drops and notify subscribed users', async () => {
  const { prisma, productPriceHistory, notifications, priceAlerts } = createProductsMock();
  const service = new ProductsService(prisma as never);

  const before = await service.listPriceHistory('iphone-15', {
    days: 30,
    limit: 10,
  });
  const alert = await service.setPriceAlert('u-admin', 'iphone-15', {
    targetPrice: 19_000_000,
  });
  const updated = await service.updateProduct('p-1', {
    price: 19_000_000,
    variants: [
      {
        sku: 'SKU-1-BLACK',
        name: 'Black 128GB',
        isDefault: true,
        price: 19_000_000,
        warehouseStocks: [{ warehouseCode: 'MAIN', quantity: 10 }],
      },
    ],
  });
  const after = await service.listPriceHistory('iphone-15', {
    limit: 10,
  });
  const removed = await service.removePriceAlert('u-admin', 'iphone-15');

  assert.equal(before.totalChanges, 2);
  assert.equal(before.lowestPrice, 20_000_000);
  assert.equal(alert.alert.targetPrice, 19_000_000);
  assert.equal(updated.price, 19_000_000);
  assert.equal(after.currentPrice, 19_000_000);
  assert.equal(after.totalChanges, 3);
  assert.equal(after.data[0]?.previousPrice, 20_000_000);
  assert.equal(productPriceHistory.at(-1)?.price, 19_000_000);
  assert.equal(notifications.length, 2);
  assert.equal(priceAlerts.find((item) => item.userId === 'u-reviewer')?.lastNotifiedPrice, 19_000_000);
  assert.equal(priceAlerts.find((item) => item.userId === 'u-admin')?.lastNotifiedPrice, 19_000_000);
  assert.deepEqual(removed, { success: true, productId: 'p-1' });
  assert.equal(priceAlerts.find((item) => item.userId === 'u-admin')?.isActive, false);
});

test('products reject invalid category brand and missing product references', async () => {
  const { prisma } = createProductsMock();
  const service = new ProductsService(prisma as never);

  await assert.rejects(
    async () =>
      service.createProduct({
        sku: 'SKU-ERR',
        name: 'Broken Product',
        description: 'This should fail because category does not exist.',
        price: 1,
        stock: 1,
        categorySlug: 'missing-category',
      }),
    (error: unknown) => error instanceof NotFoundException,
  );

  await assert.rejects(
    async () =>
      service.updateProduct('p-1', {
        brandSlug: 'missing-brand',
      }),
    (error: unknown) => error instanceof NotFoundException,
  );

  await assert.rejects(
    async () =>
      service.addMedia('missing-product', {
        url: 'https://cdn.example.com/missing.jpg',
      }),
    (error: unknown) => error instanceof NotFoundException,
  );
});

test('products.findAll covers price stock and sort branches and createProduct supports uncategorized items', async () => {
  const { prisma, getLastFindManyArgs } = createProductsMock();
  const service = new ProductsService(prisma as never);

  await service.findAll({
    minPrice: 10_000_000,
    maxPrice: 25_000_000,
    inStock: true,
    featured: true,
    sort: 'price_desc',
    page: 1,
    limit: 10,
  });
  const priceDescArgs = getLastFindManyArgs() as { orderBy: Array<Record<string, string>>; where: Record<string, unknown> };

  await service.findAll({
    sort: 'rating_desc',
    page: 1,
    limit: 10,
  });
  const ratingArgs = getLastFindManyArgs() as { orderBy: Array<Record<string, string>> };

  await service.findAll({
    sort: 'featured',
    page: 1,
    limit: 10,
  });
  const featuredArgs = getLastFindManyArgs() as { orderBy: Array<Record<string, string>> };

  const uncategorized = await service.createProduct({
    sku: 'SKU-NOBRAND',
    name: 'Plain Product',
    description: 'Created without category or brand to cover optional relation branches.',
    price: 99_000,
    stock: 3,
  });

  assert.equal((priceDescArgs.where.price as { gte: number; lte: number }).gte, 10_000_000);
  assert.equal((priceDescArgs.where.price as { gte: number; lte: number }).lte, 25_000_000);
  assert.deepEqual(priceDescArgs.orderBy, [{ price: 'desc' }]);
  assert.deepEqual(ratingArgs.orderBy, [{ rating: 'desc' }, { createdAt: 'desc' }]);
  assert.deepEqual(featuredArgs.orderBy, [{ isFeatured: 'desc' }, { createdAt: 'desc' }]);
  assert.equal(uncategorized.category, null);
  assert.equal(uncategorized.brand, null);
  assert.equal(uncategorized.variants.length, 1);
  assert.equal(uncategorized.variants[0].isDefault, true);
});

test('products reject invalid variant definitions', async () => {
  const { prisma } = createProductsMock();
  const service = new ProductsService(prisma as never);

  await assert.rejects(
    async () =>
      service.createProduct({
        sku: 'SKU-DUP',
        name: 'Variant Fail',
        description: 'Should fail because duplicate variant SKU is provided.',
        price: 10_000,
        stock: 2,
        variants: [
          { sku: 'SKU-DUP-1', name: 'A', stock: 1 },
          { sku: 'SKU-DUP-1', name: 'B', stock: 1 },
        ],
      }),
    (error: unknown) => error instanceof BadRequestException,
  );

  await assert.rejects(
    async () =>
      service.createProduct({
        sku: 'SKU-DEFAULT',
        name: 'Variant Fail',
        description: 'Should fail because more than one default variant exists.',
        price: 10_000,
        stock: 2,
        variants: [
          { sku: 'SKU-DEFAULT-1', name: 'A', stock: 1, isDefault: true },
          { sku: 'SKU-DEFAULT-2', name: 'B', stock: 1, isDefault: true },
        ],
      }),
    (error: unknown) => error instanceof BadRequestException,
  );

  await assert.rejects(
    async () =>
      service.updateProduct('p-1', {
        stock: 99,
      }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === 'Use variants payload when updating stock or price for variant-backed products',
  );
});

test('products.listReviews createReview helpful vote and replyReview cover review workflows', async () => {
  const { prisma, reviews, products, reviewHelpfulVotes } = createProductsMock();
  const service = new ProductsService(prisma as never);

  const before = await service.listReviews('iphone-15', {
    sort: 'helpful',
    page: 1,
    limit: 10,
  });
  const created = await service.createReview('u-reviewer', 'iphone-15', {
    rating: 5,
    title: 'Rat hai long',
    content: 'San pham dung on dinh va giao hang nhanh hon mong doi.',
    mediaUrls: ['https://cdn.example.com/review.jpg'],
  });
  const helpful = await service.markReviewHelpful('u-admin', 'iphone-15', created.id);
  const helpfulAgain = await service.markReviewHelpful('u-admin', 'iphone-15', created.id);
  const replied = await service.replyReview('iphone-15', created.id, 'Cam on ban da danh gia.');
  const after = await service.listReviews('iphone-15', {
    rating: 5,
    sort: 'rating_desc',
    verifiedOnly: true,
    withMedia: true,
    page: 1,
    limit: 10,
  });

  assert.equal(before.summary.totalReviews, 1);
  assert.equal(created.isVerifiedPurchase, true);
  assert.equal(created.status, 'published');
  assert.equal(reviews.length, 2);
  assert.equal(products[0].totalReviews, 2);
  assert.equal(products[0].rating, 4.5);
  assert.equal(helpful.applied, true);
  assert.equal(helpful.helpfulCount, 1);
  assert.equal(helpfulAgain.applied, false);
  assert.equal(reviewHelpfulVotes.length, 1);
  assert.equal(replied.adminReply, 'Cam on ban da danh gia.');
  assert.equal(after.total, 1);
  assert.equal(after.summary.averageRating, 4.5);
  assert.equal(after.summary.ratingBreakdown['5'], 1);
});

test('products.review moderation handles pending reviews and guard rails', async () => {
  const { prisma, products, reviewHelpfulVotes } = createProductsMock();
  const service = new ProductsService(prisma as never);

  const pending = await service.createReview('u-pending', 'iphone-15', {
    rating: 5,
    content: 'Can admin review this feedback before publishing.',
  });
  const moderation = await service.listModerationReviews('iphone-15', {
    status: 'pending',
    page: 1,
    limit: 10,
  });
  const published = await service.moderateReview('iphone-15', pending.id, {
    status: 'published',
    adminReply: 'Da duyet review.',
  });

  assert.equal(pending.status, 'pending');
  assert.equal(moderation.total, 1);
  assert.equal(moderation.summary.statusBreakdown.pending, 1);
  assert.equal(published.status, 'published');
  assert.equal(published.adminReply, 'Da duyet review.');
  assert.equal(products[0].totalReviews, 2);
  assert.equal(products[0].rating, 4.5);

  await assert.rejects(
    async () => service.markReviewHelpful('u-pending', 'iphone-15', pending.id),
    (error: unknown) => error instanceof BadRequestException,
  );

  const helpful = await service.markReviewHelpful('u-reviewer', 'iphone-15', pending.id);
  assert.equal(helpful.applied, true);
  assert.equal(reviewHelpfulVotes.length, 1);
});

test('products.review workflows reject duplicates and missing references', async () => {
  const { prisma } = createProductsMock();
  const service = new ProductsService(prisma as never);

  await assert.rejects(
    async () =>
      service.createReview('u-admin', 'iphone-15', {
        rating: 4,
        content: 'Duplicate review should fail.',
      }),
    (error: unknown) => error instanceof BadRequestException,
  );

  await assert.rejects(
    async () => service.replyReview('iphone-15', 'missing-review', 'Reply'),
    (error: unknown) => error instanceof NotFoundException,
  );

  await assert.rejects(
    async () =>
      service.moderateReview('iphone-15', 'missing-review', {
        status: 'rejected',
      }),
    (error: unknown) => error instanceof NotFoundException,
  );

  await assert.rejects(
    async () => service.listReviews('missing-product', {}),
    (error: unknown) => error instanceof NotFoundException,
  );

  await assert.rejects(
    async () => service.markReviewHelpful('u-reviewer', 'iphone-15', 'missing-review'),
    (error: unknown) => error instanceof NotFoundException,
  );

  await assert.rejects(
    async () => service.setPriceAlert('u-reviewer', 'missing-product', { targetPrice: 1 }),
    (error: unknown) => error instanceof NotFoundException,
  );
});

test('products.questions list create upvote and answer cover product q-and-a flows', async () => {
  const { prisma, productQuestions, productQuestionUpvotes } = createProductsMock();
  const service = new ProductsService(prisma as never);

  const before = await service.listQuestions('iphone-15', {
    sort: 'helpful',
    page: 1,
    limit: 10,
  });
  const created = await service.createQuestion('u-pending', 'iphone-15', {
    question: 'May nay co khang nuoc de di mua ben ngoai khong?',
  });
  const upvoted = await service.upvoteQuestion('u-admin', 'iphone-15', created.id);
  const upvotedAgain = await service.upvoteQuestion('u-admin', 'iphone-15', created.id);
  const answered = await service.answerQuestion(
    'u-admin',
    'iphone-15',
    created.id,
    'Co, may dat chuan IP68 cho nhu cau dung hang ngay.',
  );
  const after = await service.listQuestions('iphone-15', {
    q: 'ip68',
    answeredOnly: true,
    sort: 'answered',
    page: 1,
    limit: 10,
  });

  assert.equal(before.total, 1);
  assert.equal(before.summary.answeredCount, 1);
  assert.equal(created.answer, null);
  assert.equal(created.status, 'published');
  assert.equal(upvoted.applied, true);
  assert.equal(upvoted.upvoteCount, 1);
  assert.equal(upvotedAgain.applied, false);
  assert.equal(answered.answer, 'Co, may dat chuan IP68 cho nhu cau dung hang ngay.');
  assert.equal(answered.answeredBy?.id, 'u-admin');
  assert.equal(productQuestions.length, 2);
  assert.equal(productQuestionUpvotes.length, 1);
  assert.equal(after.total, 1);
  assert.equal(after.data[0]?.id, created.id);
  assert.equal(after.summary.answeredCount, 2);
});

test('products.question workflows reject self-upvote and missing references', async () => {
  const { prisma } = createProductsMock();
  const service = new ProductsService(prisma as never);

  await assert.rejects(
    async () => service.upvoteQuestion('u-reviewer', 'iphone-15', 'q-1'),
    (error: unknown) => error instanceof BadRequestException,
  );

  await assert.rejects(
    async () => service.upvoteQuestion('u-admin', 'iphone-15', 'missing-question'),
    (error: unknown) => error instanceof NotFoundException,
  );

  await assert.rejects(
    async () => service.answerQuestion('u-admin', 'iphone-15', 'missing-question', 'Reply'),
    (error: unknown) => error instanceof NotFoundException,
  );

  await assert.rejects(
    async () => service.listQuestions('missing-product', {}),
    (error: unknown) => error instanceof NotFoundException,
  );
});
