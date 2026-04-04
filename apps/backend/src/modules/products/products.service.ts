import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { generateId } from '../../common/security';
import { slugify } from '../../common/slug';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AddProductMediaDto } from './dto/add-product-media.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ImportProductsDto } from './dto/import-products.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
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
        include: {
          category: true,
          brand: true,
          media: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          },
        },
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
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        category: true,
        brand: true,
        media: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async createProduct(payload: CreateProductDto) {
    const categoryId = await this.resolveCategoryId(payload.categorySlug);
    const brandId = await this.resolveBrandId(payload.brandSlug);

    return this.prisma.product.create({
      data: {
        sku: payload.sku,
        slug: payload.slug || this.createSlug(payload.name, 'prd'),
        name: payload.name,
        description: payload.description,
        price: payload.price,
        stock: payload.stock,
        categoryId,
        brandId,
        tags: payload.tags ?? [],
        status: payload.status ?? ProductStatus.active,
        isFeatured: payload.isFeatured ?? false,
        metaTitle: payload.metaTitle,
        metaDescription: payload.metaDescription,
      },
      include: {
        category: true,
        brand: true,
        media: true,
      },
    });
  }

  async updateProduct(id: string, payload: UpdateProductDto) {
    await this.ensureProductExists(id);

    const categoryId =
      payload.categorySlug === undefined
        ? undefined
        : await this.resolveCategoryId(payload.categorySlug);
    const brandId =
      payload.brandSlug === undefined ? undefined : await this.resolveBrandId(payload.brandSlug);

    return this.prisma.product.update({
      where: { id },
      data: {
        sku: payload.sku,
        slug: payload.slug,
        name: payload.name,
        description: payload.description,
        price: payload.price,
        stock: payload.stock,
        categoryId,
        brandId,
        tags: payload.tags,
        status: payload.status,
        isFeatured: payload.isFeatured,
        metaTitle: payload.metaTitle,
        metaDescription: payload.metaDescription,
      },
      include: {
        category: true,
        brand: true,
        media: true,
      },
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
      include: { category: true, brand: true },
      orderBy: { createdAt: 'desc' },
    });

    const lines = [
      'id,sku,slug,name,status,price,stock,category,brand,featured',
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
}
