import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

function createProductsMock() {
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
      category: categories[0],
      brand: brands[0],
      media: [{ url: 'https://cdn.example.com/p-1.jpg', isPrimary: true, sortOrder: 0 }],
    },
  ];
  let lastFindManyArgs: Record<string, unknown> | null = null;

  const prisma = {
    product: {
      count: async () => products.length,
      findMany: async (args?: Record<string, unknown>) => {
        lastFindManyArgs = args ?? null;
        return products;
      },
      findFirst: async (args: { where: { OR: Array<{ id?: string; slug?: string }> } }) =>
        products.find((product) =>
          args.where.OR.some((condition) => product.id === condition.id || product.slug === condition.slug),
        ) ?? null,
      findUnique: async (args: { where: { id: string } }) =>
        products.find((product) => product.id === args.where.id) ?? null,
      create: async (args: { data: Record<string, unknown> }) => ({
        id: 'p-new',
        createdAt: new Date(),
        updatedAt: new Date(),
        rating: 0,
        totalReviews: 0,
        totalSold: 0,
        category: categories.find((category) => category.id === args.data.categoryId) ?? null,
        brand: brands.find((brand) => brand.id === args.data.brandId) ?? null,
        media: [],
        ...args.data,
      }),
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
        ...products[0],
        ...args.data,
      }),
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
      create: async (args: { data: Record<string, unknown> }) => ({
        id: 'pm-1',
        createdAt: new Date(),
        ...args.data,
      }),
    },
  };

  return { prisma, getLastFindManyArgs: () => lastFindManyArgs };
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
  const { prisma } = createProductsMock();
  const service = new ProductsService(prisma as never);

  const created = await service.createProduct({
    sku: 'SKU-NEW',
    name: 'MacBook Pro',
    description: 'Laptop product used for admin create flow.',
    price: 32_000_000,
    stock: 7,
    categorySlug: 'phones',
    brandSlug: 'apple',
  });

  assert.equal(created.sku, 'SKU-NEW');
  assert.equal(created.category.id, 'c-phones');
  assert.equal(created.brand.id, 'b-apple');
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
  assert.equal(archived.status, 'archived');
  assert.equal(imported.count, 1);
  assert.equal(imported.data[0].sku, 'SKU-2');
  assert.equal(exported.filename, 'products-export.csv');
  assert.match(exported.content, /id,sku,slug,name,status,price,stock,category,brand,featured/);
  assert.equal(media.productId, 'p-1');
  assert.equal(media.type, 'image');
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
});
