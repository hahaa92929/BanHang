import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus, ReviewStatus } from '@prisma/client';
import { generateId } from '../../common/security';
import { slugify } from '../../common/slug';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AddProductMediaDto } from './dto/add-product-media.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ImportProductsDto } from './dto/import-products.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { QueryPriceHistoryDto } from './dto/query-price-history.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { QueryQuestionsDto } from './dto/query-questions.dto';
import { QueryReviewsDto } from './dto/query-reviews.dto';
import { ProductVariantDto } from './dto/product-variant.dto';
import { SetPriceAlertDto } from './dto/set-price-alert.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  private readonly defaultWarehouseCode = 'MAIN';

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryProductsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.active,
    };

    if (query.q) {
      const keyword = query.q.trim();
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { sku: { contains: keyword, mode: 'insensitive' } },
      ];
    }

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

    if (query.featured) {
      where.isFeatured = true;
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput[] = [{ createdAt: 'desc' }];

    switch (query.sort) {
      case 'price_asc':
        orderBy = [{ price: 'asc' }];
        break;
      case 'price_desc':
        orderBy = [{ price: 'desc' }];
        break;
      case 'rating_desc':
        orderBy = [{ rating: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'featured':
        orderBy = [{ isFeatured: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'newest':
      default:
        orderBy = [{ createdAt: 'desc' }];
        break;
    }

    const total = await this.prisma.product.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * limit;

    const [data, categories, brands] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: this.productInclude(),
      }),
      this.listCategories(),
      this.listBrands(),
    ]);

    return {
      total,
      page: safePage,
      limit,
      totalPages,
      categories,
      brands,
      data,
    };
  }

  async listCategories() {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    type CategoryTreeItem = (typeof rows)[number] & { children: CategoryTreeItem[] };
    const nodes: CategoryTreeItem[] = rows.map((row) => ({ ...row, children: [] }));
    const byId = new Map<string, CategoryTreeItem>(nodes.map((row) => [row.id, row]));
    const roots: CategoryTreeItem[] = [];

    for (const node of nodes) {
      if (node.parentId) {
        const parent = byId.get(node.parentId);
        if (parent) {
          parent.children.push(node);
          continue;
        }
      }

      roots.push(node);
    }

    return roots;
  }

  async createCategory(payload: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        name: payload.name,
        slug: payload.slug || this.createSlug(payload.name, 'cat'),
        description: payload.description,
        parentId: payload.parentId,
        sortOrder: payload.sortOrder ?? 0,
      },
    });
  }

  async listBrands() {
    return this.prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createBrand(payload: CreateBrandDto) {
    return this.prisma.brand.create({
      data: {
        name: payload.name,
        slug: payload.slug || this.createSlug(payload.name, 'brand'),
        description: payload.description,
        logoUrl: payload.logoUrl,
        website: payload.website,
      },
    });
  }

  async findOne(idOrSlug: string) {
    const product = await this.findProductByReference(idOrSlug);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async listReviews(idOrSlug: string, query: QueryReviewsDto) {
    const product = await this.findRequiredProductByReference(idOrSlug);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.ReviewWhereInput = {
      productId: product.id,
      status: ReviewStatus.published,
    };

    if (typeof query.rating === 'number') {
      where.rating = query.rating;
    }

    if (query.verifiedOnly) {
      where.isVerifiedPurchase = true;
    }

    if (query.withMedia) {
      where.mediaUrls = { isEmpty: false };
    }

    const total = await this.prisma.review.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * limit;
    const orderBy = this.resolveReviewOrderBy(query.sort);

    const [data, publishedRatings] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      }),
      this.prisma.review.findMany({
        where: {
          productId: product.id,
          status: ReviewStatus.published,
        },
        select: {
          rating: true,
        },
      }),
    ]);

    const ratingBreakdown = [5, 4, 3, 2, 1].reduce<Record<string, number>>((acc, rating) => {
      acc[rating.toString()] = 0;
      return acc;
    }, {});

    for (const row of publishedRatings) {
      ratingBreakdown[row.rating.toString()] =
        (ratingBreakdown[row.rating.toString()] ?? 0) + 1;
    }

    const totalPublished = publishedRatings.length;
    const averageRating = totalPublished
      ? Number(
          (
            publishedRatings.reduce((sum, row) => sum + row.rating, 0) / totalPublished
          ).toFixed(1),
        )
      : 0;

    return {
      productId: product.id,
      total,
      page: safePage,
      limit,
      totalPages,
      summary: {
        averageRating,
        totalReviews: totalPublished,
        ratingBreakdown,
      },
      data,
    };
  }

  async listModerationReviews(idOrSlug: string, query: QueryReviewsDto) {
    const product = await this.findRequiredProductByReference(idOrSlug);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.ReviewWhereInput = {
      productId: product.id,
    };

    if (query.status) {
      where.status = query.status as ReviewStatus;
    }

    if (typeof query.rating === 'number') {
      where.rating = query.rating;
    }

    if (query.verifiedOnly) {
      where.isVerifiedPurchase = true;
    }

    if (query.withMedia) {
      where.mediaUrls = { isEmpty: false };
    }

    const total = await this.prisma.review.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * limit;
    const orderBy = this.resolveReviewOrderBy(query.sort);

    const [data, allStatuses] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      }),
      this.prisma.review.findMany({
        where: {
          productId: product.id,
        },
        select: {
          status: true,
        },
      }),
    ]);

    const statusBreakdown = {
      pending: 0,
      published: 0,
      rejected: 0,
    };

    for (const row of allStatuses) {
      statusBreakdown[row.status] += 1;
    }

    return {
      productId: product.id,
      total,
      page: safePage,
      limit,
      totalPages,
      summary: {
        statusBreakdown,
      },
      data,
    };
  }

  async createReview(userId: string, idOrSlug: string, payload: CreateReviewDto) {
    const product = await this.findRequiredProductByReference(idOrSlug);

    if (product.status !== ProductStatus.active) {
      throw new NotFoundException('Product not found');
    }

    const existing = await this.prisma.review.findUnique({
      where: {
        userId_productId: {
          userId,
          productId: product.id,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Review already exists for this product');
    }

    const verifiedPurchases = await this.prisma.order.count({
      where: {
        userId,
        status: {
          in: ['confirmed', 'shipping', 'completed'],
        },
        items: {
          some: {
            productId: product.id,
          },
        },
      },
    });

    const review = await this.prisma.review.create({
      data: {
        userId,
        productId: product.id,
        rating: payload.rating,
        title: payload.title,
        content: payload.content,
        mediaUrls: payload.mediaUrls ?? [],
        isVerifiedPurchase: verifiedPurchases > 0,
        status: verifiedPurchases > 0 ? ReviewStatus.published : ReviewStatus.pending,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    await this.refreshReviewStats(product.id);
    return review;
  }

  async markReviewHelpful(userId: string, idOrSlug: string, reviewId: string) {
    const product = await this.findRequiredProductByReference(idOrSlug);

    const review = await this.prisma.review.findFirst({
      where: {
        id: reviewId,
        productId: product.id,
        status: ReviewStatus.published,
      },
      select: {
        id: true,
        userId: true,
        helpfulCount: true,
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId === userId) {
      throw new BadRequestException('Cannot mark your own review as helpful');
    }

    const existingVote = await this.prisma.reviewHelpfulVote.findUnique({
      where: {
        userId_reviewId: {
          userId,
          reviewId: review.id,
        },
      },
    });

    if (existingVote) {
      return {
        success: true,
        applied: false,
        helpfulCount: review.helpfulCount,
      };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.reviewHelpfulVote.create({
        data: {
          userId,
          reviewId: review.id,
        },
      });

      return tx.review.update({
        where: { id: review.id },
        data: {
          helpfulCount: {
            increment: 1,
          },
        },
        select: {
          helpfulCount: true,
        },
      });
    });

    return {
      success: true,
      applied: true,
      helpfulCount: updated.helpfulCount,
    };
  }

  async replyReview(idOrSlug: string, reviewId: string, content: string) {
    const product = await this.findRequiredProductByReference(idOrSlug);

    const review = await this.prisma.review.findFirst({
      where: {
        id: reviewId,
        productId: product.id,
      },
      select: {
        id: true,
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return this.prisma.review.update({
      where: { id: review.id },
      data: {
        adminReply: content,
        adminReplyAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });
  }

  async moderateReview(idOrSlug: string, reviewId: string, payload: ModerateReviewDto) {
    const product = await this.findRequiredProductByReference(idOrSlug);

    const existing = await this.prisma.review.findFirst({
      where: {
        id: reviewId,
        productId: product.id,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Review not found');
    }

    const updated = await this.prisma.review.update({
      where: { id: existing.id },
      data: {
        status: payload.status as ReviewStatus,
        ...(payload.adminReply
          ? {
              adminReply: payload.adminReply,
              adminReplyAt: new Date(),
            }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (existing.status !== payload.status) {
      await this.refreshReviewStats(product.id);
    }

    return updated;
  }

  async listQuestions(idOrSlug: string, query: QueryQuestionsDto) {
    const product = await this.findRequiredProductByReference(idOrSlug);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const keyword = query.q?.trim();
    const where: Prisma.ProductQuestionWhereInput = {
      productId: product.id,
      status: 'published',
      ...(query.answeredOnly ? { answer: { not: null } } : {}),
      ...(query.unansweredOnly ? { answer: null } : {}),
      ...(keyword
        ? {
            OR: [
              { question: { contains: keyword, mode: 'insensitive' } },
              { answer: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const total = await this.prisma.productQuestion.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * limit;
    const orderBy = this.resolveQuestionOrderBy(query.sort);

    const [data, answeredCount] = await Promise.all([
      this.prisma.productQuestion.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
          answeredBy: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      }),
      this.prisma.productQuestion.count({
        where: {
          productId: product.id,
          status: 'published',
          answer: { not: null },
        },
      }),
    ]);

    return {
      productId: product.id,
      total,
      page: safePage,
      limit,
      totalPages,
      summary: {
        answeredCount,
        unansweredCount: Math.max(0, total - answeredCount),
      },
      data,
    };
  }

  async listPriceHistory(idOrSlug: string, query: QueryPriceHistoryDto = {}) {
    const product = await this.findRequiredProductByReference(idOrSlug);
    const limit = query.limit ?? 30;
    const changedAt =
      query.days !== undefined
        ? {
            gte: new Date(Date.now() - query.days * 24 * 60 * 60 * 1000),
          }
        : undefined;

    const data = await this.prisma.productPriceHistory.findMany({
      where: {
        productId: product.id,
        ...(changedAt ? { changedAt } : {}),
      },
      orderBy: { changedAt: 'desc' },
      take: limit,
    });

    const prices = data.length ? data.map((item) => item.price) : [product.price];

    return {
      productId: product.id,
      currentPrice: product.price,
      totalChanges: data.length,
      lowestPrice: Math.min(...prices),
      highestPrice: Math.max(...prices),
      data: data.map((item) => ({
        id: item.id,
        price: item.price,
        previousPrice: item.previousPrice,
        source: item.source,
        changedAt: item.changedAt,
        changeAmount: item.previousPrice === null || item.previousPrice === undefined ? null : item.price - item.previousPrice,
      })),
    };
  }

  async createQuestion(userId: string, idOrSlug: string, payload: CreateQuestionDto) {
    const product = await this.findRequiredProductByReference(idOrSlug);

    if (product.status !== ProductStatus.active) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.productQuestion.create({
      data: {
        userId,
        productId: product.id,
        question: payload.question,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
        answeredBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });
  }

  async upvoteQuestion(userId: string, idOrSlug: string, questionId: string) {
    const product = await this.findRequiredProductByReference(idOrSlug);

    const question = await this.prisma.productQuestion.findFirst({
      where: {
        id: questionId,
        productId: product.id,
        status: 'published',
      },
      select: {
        id: true,
        userId: true,
        upvoteCount: true,
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    if (question.userId === userId) {
      throw new BadRequestException('Cannot upvote your own question');
    }

    const existingVote = await this.prisma.productQuestionUpvote.findUnique({
      where: {
        userId_questionId: {
          userId,
          questionId: question.id,
        },
      },
    });

    if (existingVote) {
      return {
        success: true,
        applied: false,
        upvoteCount: question.upvoteCount,
      };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.productQuestionUpvote.create({
        data: {
          userId,
          questionId: question.id,
        },
      });

      return tx.productQuestion.update({
        where: { id: question.id },
        data: {
          upvoteCount: {
            increment: 1,
          },
        },
        select: {
          upvoteCount: true,
        },
      });
    });

    return {
      success: true,
      applied: true,
      upvoteCount: updated.upvoteCount,
    };
  }

  async answerQuestion(actorId: string, idOrSlug: string, questionId: string, answer: string) {
    const product = await this.findRequiredProductByReference(idOrSlug);

    const question = await this.prisma.productQuestion.findFirst({
      where: {
        id: questionId,
        productId: product.id,
      },
      select: {
        id: true,
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return this.prisma.productQuestion.update({
      where: { id: question.id },
      data: {
        answer,
        answeredAt: new Date(),
        answeredById: actorId,
        status: 'published',
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
        answeredBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });
  }

  async setPriceAlert(userId: string, idOrSlug: string, payload: SetPriceAlertDto) {
    const product = await this.findRequiredProductByReference(idOrSlug);

    if (product.status !== ProductStatus.active) {
      throw new NotFoundException('Product not found');
    }

    const alert = await this.prisma.priceAlert.upsert({
      where: {
        userId_productId: {
          userId,
          productId: product.id,
        },
      },
      create: {
        userId,
        productId: product.id,
        targetPrice: payload.targetPrice ?? null,
        isActive: true,
      },
      update: {
        targetPrice: payload.targetPrice ?? null,
        isActive: true,
        lastNotifiedPrice: null,
      },
      select: {
        id: true,
        targetPrice: true,
        isActive: true,
        lastNotifiedPrice: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      productId: product.id,
      alert,
    };
  }

  async removePriceAlert(userId: string, idOrSlug: string) {
    const product = await this.findRequiredProductByReference(idOrSlug);

    await this.prisma.priceAlert.updateMany({
      where: {
        userId,
        productId: product.id,
      },
      data: {
        isActive: false,
      },
    });

    return {
      success: true,
      productId: product.id,
    };
  }

  async createProduct(payload: CreateProductDto) {
    const categoryId = await this.resolveCategoryId(payload.categorySlug);
    const brandId = await this.resolveBrandId(payload.brandSlug);
    const normalizedVariants = this.normalizeVariants(
      {
        productSku: payload.sku,
        productName: payload.name,
        price: payload.price,
        stock: payload.stock,
      },
      payload.variants,
    );

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          sku: payload.sku,
          slug: payload.slug || this.createSlug(payload.name, 'prd'),
          name: payload.name,
          description: payload.description,
          price: this.resolveProductPrice(payload.price, normalizedVariants),
          stock: this.sumVariantStock(normalizedVariants),
          categoryId,
          brandId,
          tags: payload.tags ?? [],
          status: payload.status ?? ProductStatus.active,
          isFeatured: payload.isFeatured ?? false,
          metaTitle: payload.metaTitle,
          metaDescription: payload.metaDescription,
        },
      });

      await this.createVariantsInTx(tx, product.id, normalizedVariants);
      await this.recordPriceHistoryInTx(tx, product.id, product.price, null, 'create');

      return tx.product.findUnique({
        where: { id: product.id },
        include: this.productInclude(),
      });
    });
  }

  async updateProduct(id: string, payload: UpdateProductDto) {
    const existing = await this.findExistingProduct(id);

    const categoryId =
      payload.categorySlug === undefined
        ? undefined
        : await this.resolveCategoryId(payload.categorySlug);
    const brandId =
      payload.brandSlug === undefined ? undefined : await this.resolveBrandId(payload.brandSlug);

    return this.prisma.$transaction(async (tx) => {
      let stock = payload.stock;
      let price = payload.price;

      if (payload.variants) {
        const normalizedVariants = this.normalizeVariants(
          {
            productSku: payload.sku ?? existing.sku,
            productName: payload.name ?? existing.name,
            price: payload.price ?? existing.price,
            stock: payload.stock ?? existing.stock,
          },
          payload.variants,
        );

        await tx.inventoryLevel.deleteMany({
          where: { productId: id },
        });
        await tx.productVariant.deleteMany({
          where: { productId: id },
        });
        await this.createVariantsInTx(tx, id, normalizedVariants);

        stock = this.sumVariantStock(normalizedVariants);
        price = this.resolveProductPrice(payload.price ?? existing.price, normalizedVariants);
      } else if (existing.variants.length && (payload.stock !== undefined || payload.price !== undefined)) {
        throw new BadRequestException(
          'Use variants payload when updating stock or price for variant-backed products',
        );
      }

      await tx.product.update({
        where: { id },
        data: {
          sku: payload.sku,
          slug: payload.slug,
          name: payload.name,
          description: payload.description,
          price,
          stock,
          categoryId,
          brandId,
          tags: payload.tags,
          status: payload.status,
          isFeatured: payload.isFeatured,
          metaTitle: payload.metaTitle,
          metaDescription: payload.metaDescription,
        },
      });
      await this.recordPriceHistoryInTx(tx, id, price ?? existing.price, existing.price, 'admin_update');
      await this.notifyPriceDropInTx(
        tx,
        {
          id,
          name: payload.name ?? existing.name,
          price: price ?? existing.price,
        },
        existing.price,
      );

      return tx.product.findUnique({
        where: { id },
        include: this.productInclude(),
      });
    });
  }

  async archiveProduct(id: string) {
    await this.ensureProductExists(id);
    return this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.archived },
    });
  }

  async importProducts(payload: ImportProductsDto) {
    const created = [];

    for (const item of payload.items) {
      created.push(await this.createProduct(item));
    }

    return {
      count: created.length,
      data: created,
    };
  }

  async exportProducts() {
    const products = await this.prisma.product.findMany({
      include: { category: true, brand: true, variants: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] } },
      orderBy: { createdAt: 'desc' },
    });

    const lines = [
      'id,sku,slug,name,status,price,stock,category,brand,featured,variantsCount,variantSkus',
      ...products.map((product) =>
        [
          product.id,
          product.sku,
          product.slug,
          this.escapeCsv(product.name),
          product.status,
          product.price,
          product.stock,
          this.escapeCsv(product.category?.name ?? ''),
          this.escapeCsv(product.brand?.name ?? ''),
          product.isFeatured,
          product.variants.length,
          this.escapeCsv(product.variants.map((variant) => variant.sku).join('|')),
        ].join(','),
      ),
    ];

    return {
      filename: 'products-export.csv',
      content: lines.join('\n'),
    };
  }

  async addMedia(productId: string, payload: AddProductMediaDto) {
    await this.ensureProductExists(productId);

    if (payload.isPrimary) {
      await this.prisma.productMedia.updateMany({
        where: { productId },
        data: { isPrimary: false },
      });
    }

    return this.prisma.productMedia.create({
      data: {
        productId,
        url: payload.url,
        type: payload.type ?? 'image',
        altText: payload.altText,
        isPrimary: payload.isPrimary ?? false,
        sortOrder: payload.sortOrder ?? 0,
      },
    });
  }

  private async ensureProductExists(id: string) {
    const exists = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Product not found');
    }
  }

  private async recordPriceHistoryInTx(
    tx: Prisma.TransactionClient,
    productId: string,
    nextPrice: number,
    previousPrice: number | null,
    source: string,
  ) {
    if (previousPrice !== null && previousPrice === nextPrice) {
      return;
    }

    await tx.productPriceHistory.create({
      data: {
        productId,
        price: nextPrice,
        previousPrice,
        source,
      },
    });
  }

  private async notifyPriceDropInTx(
    tx: Prisma.TransactionClient,
    product: { id: string; name: string; price: number },
    previousPrice: number,
  ) {
    if (product.price >= previousPrice) {
      return;
    }

    const alerts = await tx.priceAlert.findMany({
      where: {
        productId: product.id,
        isActive: true,
      },
      select: {
        id: true,
        userId: true,
        targetPrice: true,
        lastNotifiedPrice: true,
      },
    });

    const eligible = alerts.filter(
      (alert) =>
        (alert.targetPrice === null || product.price <= alert.targetPrice) &&
        (alert.lastNotifiedPrice === null || product.price < alert.lastNotifiedPrice),
    );

    for (const alert of eligible) {
      await tx.notification.create({
        data: {
          userId: alert.userId,
          type: 'promotion',
          title: 'Price dropped',
          content: `${product.name} is now ${product.price} VND.`,
          data: {
            productId: product.id,
            currentPrice: product.price,
            previousPrice,
            targetPrice: alert.targetPrice,
          },
        },
      });
    }

    if (eligible.length) {
      await tx.priceAlert.updateMany({
        where: {
          id: { in: eligible.map((alert) => alert.id) },
        },
        data: {
          lastNotifiedPrice: product.price,
        },
      });
    }
  }

  private async refreshReviewStats(productId: string) {
    const publishedReviews = await this.prisma.review.findMany({
      where: {
        productId,
        status: ReviewStatus.published,
      },
      select: {
        rating: true,
      },
    });

    const totalReviews = publishedReviews.length;
    const rating = totalReviews
      ? Number(
          (
            publishedReviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
          ).toFixed(1),
        )
      : 0;

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        totalReviews,
        rating,
      },
    });
  }

  private resolveReviewOrderBy(sort?: QueryReviewsDto['sort']) {
    let orderBy: Prisma.ReviewOrderByWithRelationInput[] = [{ createdAt: 'desc' }];

    switch (sort) {
      case 'helpful':
        orderBy = [{ helpfulCount: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'rating_desc':
        orderBy = [{ rating: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'recent':
      default:
        orderBy = [{ createdAt: 'desc' }];
        break;
    }

    return orderBy;
  }

  private resolveQuestionOrderBy(sort?: QueryQuestionsDto['sort']) {
    let orderBy: Prisma.ProductQuestionOrderByWithRelationInput[] = [{ createdAt: 'desc' }];

    switch (sort) {
      case 'helpful':
        orderBy = [{ upvoteCount: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'answered':
        orderBy = [{ answeredAt: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'recent':
      default:
        orderBy = [{ createdAt: 'desc' }];
        break;
    }

    return orderBy;
  }

  private async findRequiredProductByReference(idOrSlug: string) {
    const product = await this.findProductByReference(idOrSlug);

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private findProductByReference(idOrSlug: string) {
    return this.prisma.product.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: this.productInclude(),
    });
  }

  private async findExistingProduct(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        sku: true,
        name: true,
        price: true,
        stock: true,
        variants: {
          where: { isActive: true },
          select: {
            id: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private async resolveCategoryId(slug?: string) {
    if (!slug) {
      return undefined;
    }

    const category = await this.prisma.category.findFirst({
      where: { slug: { equals: slug, mode: 'insensitive' } },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category.id;
  }

  private async resolveBrandId(slug?: string) {
    if (!slug) {
      return undefined;
    }

    const brand = await this.prisma.brand.findFirst({
      where: { slug: { equals: slug, mode: 'insensitive' } },
      select: { id: true },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    return brand.id;
  }

  private createSlug(value: string, prefix: string) {
    const base = slugify(value);
    if (base) {
      return `${base}-${generateId(prefix).slice(-8)}`;
    }

    return `${prefix}-${generateId(prefix).slice(-8)}`;
  }

  private escapeCsv(value: string) {
    if (!value.includes(',') && !value.includes('"') && !value.includes('\n')) {
      return value;
    }

    return `"${value.replace(/"/g, '""')}"`;
  }

  private productInclude() {
    return {
      category: true,
      brand: true,
      media: {
        orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }],
      },
      variants: {
        orderBy: [{ isDefault: 'desc' as const }, { createdAt: 'asc' as const }],
        include: {
          inventoryLevels: {
            orderBy: [{ createdAt: 'asc' as const }],
            include: {
              warehouse: true,
            },
          },
        },
      },
    };
  }

  private normalizeVariants(
    base: { productSku: string; productName: string; price: number; stock: number },
    variants?: ProductVariantDto[],
  ) {
    if (!variants?.length) {
      return [
        {
          sku: `${base.productSku}-DEFAULT`,
          name: `${base.productName} Default`,
          attributes: undefined,
          price: base.price,
          stock: base.stock,
          isDefault: true,
          isActive: true,
          warehouseStocks: [
            {
              warehouseCode: this.defaultWarehouseCode,
              quantity: base.stock,
            },
          ],
        },
      ];
    }

    const explicitDefaultCount = variants.filter((variant) => variant.isDefault).length;
    if (explicitDefaultCount > 1) {
      throw new BadRequestException('Only one default variant is allowed');
    }

    const normalized = variants.map((variant, index) => {
      const warehouseStocks = this.normalizeWarehouseStocks(variant);
      const stock = warehouseStocks.reduce((sum, item) => sum + item.quantity, 0);

      return {
        sku: variant.sku,
        name: variant.name,
        attributes: variant.attributes as Prisma.InputJsonValue | undefined,
        price: variant.price ?? base.price,
        stock,
        isDefault: explicitDefaultCount ? Boolean(variant.isDefault) : index === 0,
        isActive: variant.isActive ?? true,
        warehouseStocks,
      };
    });

    const uniqueSkus = new Set<string>();
    for (const variant of normalized) {
      const key = variant.sku.trim().toLowerCase();
      if (uniqueSkus.has(key)) {
        throw new BadRequestException(`Duplicate variant SKU: ${variant.sku}`);
      }
      uniqueSkus.add(key);
    }

    return normalized;
  }

  private normalizeWarehouseStocks(variant: ProductVariantDto) {
    if (!variant.warehouseStocks?.length) {
      return [
        {
          warehouseCode: this.defaultWarehouseCode,
          quantity: variant.stock ?? 0,
        },
      ];
    }

    const merged = new Map<string, number>();
    for (const stock of variant.warehouseStocks) {
      const warehouseCode = this.normalizeWarehouseCode(stock.warehouseCode);
      merged.set(warehouseCode, (merged.get(warehouseCode) ?? 0) + stock.quantity);
    }

    return [...merged.entries()].map(([warehouseCode, quantity]) => ({
      warehouseCode,
      quantity,
    }));
  }

  private normalizeWarehouseCode(warehouseCode?: string) {
    const code = warehouseCode?.trim().toUpperCase();
    return code || this.defaultWarehouseCode;
  }

  private sumVariantStock(
    variants: Array<{
      stock: number;
    }>,
  ) {
    return variants.reduce((sum, variant) => sum + variant.stock, 0);
  }

  private resolveProductPrice(
    fallbackPrice: number,
    variants: Array<{
      price: number;
      isDefault: boolean;
    }>,
  ) {
    return variants.find((variant) => variant.isDefault)?.price ?? fallbackPrice;
  }

  private async createVariantsInTx(
    tx: Prisma.TransactionClient,
    productId: string,
    variants: Array<{
      sku: string;
      name: string;
      attributes?: Prisma.InputJsonValue;
      price: number;
      stock: number;
      isDefault: boolean;
      isActive: boolean;
      warehouseStocks: Array<{ warehouseCode: string; quantity: number }>;
    }>,
  ) {
    for (const variant of variants) {
      const createdVariant = await tx.productVariant.create({
        data: {
          productId,
          sku: variant.sku,
          name: variant.name,
          attributes: variant.attributes,
          price: variant.price,
          stock: variant.stock,
          isDefault: variant.isDefault,
          isActive: variant.isActive,
        },
      });

      for (const warehouseStock of variant.warehouseStocks) {
        const warehouse = await this.resolveWarehouseInTx(tx, warehouseStock.warehouseCode);
        await tx.inventoryLevel.create({
          data: {
            productId,
            variantId: createdVariant.id,
            warehouseId: warehouse.id,
            available: warehouseStock.quantity,
            reserved: 0,
          },
        });
      }
    }
  }

  private async resolveWarehouseInTx(tx: Prisma.TransactionClient, warehouseCode?: string) {
    const normalizedCode = this.normalizeWarehouseCode(warehouseCode);

    if (normalizedCode === this.defaultWarehouseCode) {
      const defaultWarehouse = await tx.warehouse.findFirst({
        where: { isDefault: true },
      });
      if (defaultWarehouse) {
        return defaultWarehouse;
      }
    }

    const existing = await tx.warehouse.findUnique({
      where: { code: normalizedCode },
    });

    if (existing) {
      return existing;
    }

    return tx.warehouse.create({
      data: {
        code: normalizedCode,
        name: normalizedCode === this.defaultWarehouseCode ? 'Main Warehouse' : `${normalizedCode} Warehouse`,
        isDefault: normalizedCode === this.defaultWarehouseCode,
      },
    });
  }
}
