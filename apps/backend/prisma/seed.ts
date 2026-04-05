import { PrismaClient, ProductStatus, UserRole } from '@prisma/client';
import { hashPassword } from '../src/common/security';
import { slugify } from '../src/common/slug';

const prisma = new PrismaClient();

async function main() {
  await prisma.paymentWebhookEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderStatusEvent.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventoryLevel.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.inventoryReservationItem.deleteMany();
  await prisma.inventoryReservation.deleteMany();
  await prisma.cartCoupon.deleteMany();
  await prisma.review.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.refreshSession.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.socialAccount.deleteMany();
  await prisma.address.deleteMany();
  await prisma.productMedia.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.category.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.user.deleteMany();

  const [adminPasswordHash, customerPasswordHash] = await Promise.all([
    hashPassword('admin12345'),
    hashPassword('customer12345'),
  ]);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@banhang.local',
      passwordHash: adminPasswordHash,
      fullName: 'Admin Demo',
      role: UserRole.admin,
      emailVerifiedAt: new Date(),
    },
  });

  const customer = await prisma.user.create({
    data: {
      email: 'customer@banhang.local',
      passwordHash: customerPasswordHash,
      fullName: 'Customer Demo',
      role: UserRole.customer,
      phone: '0900000000',
      emailVerifiedAt: new Date(),
    },
  });

  const [electronics, phones, laptops, accessories, audio] = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Electronics',
        slug: 'electronics',
        description: 'Main catalog for electronic devices.',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Phones',
        slug: 'phones',
        parentId: undefined,
        description: 'Smartphones and mobile devices.',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Laptops',
        slug: 'laptops',
        description: 'Laptops and notebooks.',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Accessories',
        slug: 'accessories',
        description: 'Keyboards, mice and more.',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Audio',
        slug: 'audio',
        description: 'Audio products and headphones.',
      },
    }),
  ]);

  await prisma.category.update({
    where: { id: phones.id },
    data: { parentId: electronics.id },
  });

  await prisma.category.update({
    where: { id: laptops.id },
    data: { parentId: electronics.id },
  });

  const [apple, samsung, logitech, keychron] = await Promise.all([
    prisma.brand.create({
      data: {
        name: 'Apple',
        slug: 'apple',
        logoUrl: 'https://cdn.example.com/brands/apple.svg',
      },
    }),
    prisma.brand.create({
      data: {
        name: 'Samsung',
        slug: 'samsung',
        logoUrl: 'https://cdn.example.com/brands/samsung.svg',
      },
    }),
    prisma.brand.create({
      data: {
        name: 'Logitech',
        slug: 'logitech',
        logoUrl: 'https://cdn.example.com/brands/logitech.svg',
      },
    }),
    prisma.brand.create({
      data: {
        name: 'Keychron',
        slug: 'keychron',
        logoUrl: 'https://cdn.example.com/brands/keychron.svg',
      },
    }),
  ]);

  const [hcmWarehouse, hnWarehouse] = await Promise.all([
    prisma.warehouse.create({
      data: {
        code: 'HCM-01',
        name: 'Ho Chi Minh Main Warehouse',
        city: 'Ho Chi Minh',
        isDefault: true,
      },
    }),
    prisma.warehouse.create({
      data: {
        code: 'HN-01',
        name: 'Ha Noi Warehouse',
        city: 'Ha Noi',
        isDefault: false,
      },
    }),
  ]);

  const products = [
    {
      sku: 'IPH15-128-BLK',
      name: 'iPhone 15 128GB',
      description: 'A16 Bionic, dual camera, all-day battery life.',
      price: 19_990_000,
      stock: 23,
      rating: 4.8,
      tags: ['flash-sale', 'best-seller'],
      categoryId: phones.id,
      brandId: apple.id,
      isFeatured: true,
      totalSold: 128,
      variants: [
        {
          sku: 'IPH15-128-BLK-A',
          name: 'Black 128GB',
          attributes: { color: 'Black', storage: '128GB' },
          price: 19_990_000,
          isDefault: true,
          stocks: [
            { warehouseId: hcmWarehouse.id, quantity: 15 },
            { warehouseId: hnWarehouse.id, quantity: 8 },
          ],
        },
      ],
    },
    {
      sku: 'SAMS24-256-GRY',
      name: 'Galaxy S24 256GB',
      description: 'AMOLED 120Hz display with Galaxy AI features.',
      price: 18_490_000,
      stock: 15,
      rating: 4.7,
      tags: ['new'],
      categoryId: phones.id,
      brandId: samsung.id,
      isFeatured: true,
      totalSold: 84,
      variants: [
        {
          sku: 'SAMS24-256-GRY-A',
          name: 'Titanium Gray 256GB',
          attributes: { color: 'Gray', storage: '256GB' },
          price: 18_490_000,
          isDefault: true,
          stocks: [
            { warehouseId: hcmWarehouse.id, quantity: 9 },
            { warehouseId: hnWarehouse.id, quantity: 6 },
          ],
        },
      ],
    },
    {
      sku: 'MBA-M3-13-256',
      name: 'MacBook Air M3 13',
      description: 'M3 chip, lightweight design, 18-hour battery life.',
      price: 27_990_000,
      stock: 9,
      rating: 4.9,
      tags: ['premium'],
      categoryId: laptops.id,
      brandId: apple.id,
      isFeatured: true,
      totalSold: 57,
      variants: [
        {
          sku: 'MBA-M3-13-256-SLV',
          name: 'Silver 256GB',
          attributes: { color: 'Silver', storage: '256GB' },
          price: 27_990_000,
          isDefault: true,
          stocks: [
            { warehouseId: hcmWarehouse.id, quantity: 5 },
            { warehouseId: hnWarehouse.id, quantity: 4 },
          ],
        },
      ],
    },
    {
      sku: 'AIRPODS-PRO2',
      name: 'AirPods Pro 2',
      description: 'Adaptive ANC, H2 chip, USB-C charging case.',
      price: 5_790_000,
      stock: 31,
      rating: 4.8,
      tags: ['best-seller'],
      categoryId: audio.id,
      brandId: apple.id,
      totalSold: 143,
      variants: [
        {
          sku: 'AIRPODS-PRO2-USB-C',
          name: 'USB-C Charging Case',
          attributes: { case: 'USB-C' },
          price: 5_790_000,
          isDefault: true,
          stocks: [
            { warehouseId: hcmWarehouse.id, quantity: 20 },
            { warehouseId: hnWarehouse.id, quantity: 11 },
          ],
        },
      ],
    },
    {
      sku: 'LOGI-MX3S',
      name: 'Logitech MX Master 3S',
      description: 'Wireless performance mouse for productivity.',
      price: 2_390_000,
      stock: 42,
      rating: 4.7,
      tags: ['office'],
      categoryId: accessories.id,
      brandId: logitech.id,
      totalSold: 91,
      variants: [
        {
          sku: 'LOGI-MX3S-GRAPHITE',
          name: 'Graphite',
          attributes: { color: 'Graphite' },
          price: 2_390_000,
          isDefault: true,
          stocks: [
            { warehouseId: hcmWarehouse.id, quantity: 26 },
            { warehouseId: hnWarehouse.id, quantity: 16 },
          ],
        },
      ],
    },
    {
      sku: 'KEYCHRON-K2',
      name: 'Keychron K2 Pro',
      description: 'Compact hot-swappable mechanical keyboard.',
      price: 2_890_000,
      stock: 17,
      rating: 4.6,
      tags: ['new'],
      categoryId: accessories.id,
      brandId: keychron.id,
      totalSold: 62,
      variants: [
        {
          sku: 'KEYCHRON-K2-BROWN',
          name: 'Brown Switch',
          attributes: { switch: 'Brown' },
          price: 2_890_000,
          isDefault: true,
          stocks: [
            { warehouseId: hcmWarehouse.id, quantity: 9 },
            { warehouseId: hnWarehouse.id, quantity: 8 },
          ],
        },
      ],
    },
  ];

  for (const item of products) {
    const product = await prisma.product.create({
      data: {
        sku: item.sku,
        slug: `${slugify(item.name)}-${item.sku.toLowerCase()}`,
        name: item.name,
        description: item.description,
        price: item.price,
        stock: item.stock,
        rating: item.rating,
        tags: item.tags,
        categoryId: item.categoryId,
        brandId: item.brandId,
        status: ProductStatus.active,
        isFeatured: item.isFeatured ?? false,
        metaTitle: item.name,
        metaDescription: item.description.slice(0, 120),
        totalSold: item.totalSold,
      },
    });

    await prisma.productMedia.create({
      data: {
        productId: product.id,
        url: `https://cdn.example.com/products/${product.slug}.jpg`,
        type: 'image',
        altText: product.name,
        isPrimary: true,
      },
    });

    for (const variant of item.variants) {
      const stock = variant.stocks.reduce((sum, entry) => sum + entry.quantity, 0);
      const createdVariant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: variant.sku,
          name: variant.name,
          attributes: variant.attributes,
          price: variant.price,
          stock,
          isDefault: variant.isDefault,
        },
      });

      await prisma.inventoryLevel.createMany({
        data: variant.stocks.map((entry) => ({
          productId: product.id,
          variantId: createdVariant.id,
          warehouseId: entry.warehouseId,
          available: entry.quantity,
          reserved: 0,
        })),
      });
    }
  }

  const [iphone, macbook] = await prisma.product.findMany({
    where: {
      sku: {
        in: ['IPH15-128-BLK', 'MBA-M3-13-256'],
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  await prisma.address.create({
    data: {
      userId: customer.id,
      label: 'Home',
      fullName: customer.fullName,
      phone: customer.phone!,
      province: 'Ho Chi Minh',
      district: 'Quan 1',
      ward: 'Ben Nghe',
      addressLine: '123 Nguyen Trai',
      isDefault: true,
    },
  });

  await prisma.coupon.createMany({
    data: [
      {
        code: 'WELCOME10',
        type: 'percent',
        value: 10,
        minOrderAmount: 500_000,
        maxDiscount: 300_000,
        startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
      {
        code: 'FREESHIP',
        type: 'free_shipping',
        value: 100,
        minOrderAmount: 300_000,
        startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    ],
  });

  if (iphone && macbook) {
    await prisma.wishlistItem.createMany({
      data: [
        {
          userId: customer.id,
          productId: iphone.id,
        },
        {
          userId: customer.id,
          productId: macbook.id,
        },
      ],
    });

    await prisma.review.createMany({
      data: [
        {
          userId: customer.id,
          productId: iphone.id,
          rating: 5,
          title: 'Rat dang tien',
          content: 'May on dinh, camera dep, pin du dung ca ngay.',
          mediaUrls: ['https://cdn.example.com/reviews/iphone-15-customer-1.jpg'],
          isVerifiedPurchase: true,
          status: 'published',
        },
        {
          userId: admin.id,
          productId: macbook.id,
          rating: 4,
          title: 'Hieu nang rat tot',
          content: 'May nhe, pin on, phu hop di chuyen va cong viec hang ngay.',
          mediaUrls: [],
          isVerifiedPurchase: false,
          status: 'published',
          adminReply: 'Cam on ban da de lai danh gia.',
          adminReplyAt: new Date(),
        },
      ],
    });
  }

  console.log(`Seed done. Admin id: ${admin.id}. Customer id: ${customer.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
