import { PrismaClient, ProductStatus, UserRole } from '@prisma/client';
import { generateToken, hashPassword } from '../src/common/security';
import { slugify } from '../src/common/slug';

const prisma = new PrismaClient();

async function main() {
  const db = prisma as PrismaClient & Record<string, any>;
  await prisma.paymentWebhookEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.storeAppointment.deleteMany();
  await prisma.storeLocation.deleteMany();
  await (prisma as PrismaClient & Record<string, any>).newsletterSubscriber.deleteMany();
  await db.promotionCampaign.deleteMany();
  await db.blogPost.deleteMany();
  await db.contentPage.deleteMany();
  await prisma.orderStatusEvent.deleteMany();
  await (prisma as PrismaClient & Record<string, any>).orderNote.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.priceAlert.deleteMany();
  await prisma.productPriceHistory.deleteMany();
  await prisma.inventoryLevel.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.inventoryReservationItem.deleteMany();
  await prisma.inventoryReservation.deleteMany();
  await prisma.cartCoupon.deleteMany();
  await prisma.productQuestionUpvote.deleteMany();
  await prisma.productQuestion.deleteMany();
  await prisma.review.deleteMany();
  await prisma.compareItem.deleteMany();
  await prisma.wishlistShare.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.cartItem.deleteMany();
  await (prisma as PrismaClient & Record<string, any>).cartReminderEvent.deleteMany();
  await (prisma as PrismaClient & Record<string, any>).pushSubscription.deleteMany();
  await prisma.notification.deleteMany();
  await (prisma as PrismaClient & Record<string, any>).customerNote.deleteMany();
  await (prisma as PrismaClient & Record<string, any>).customerTag.deleteMany();
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

  const commonOpeningHours = {
    mon: [{ open: '08:00', close: '21:00' }],
    tue: [{ open: '08:00', close: '21:00' }],
    wed: [{ open: '08:00', close: '21:00' }],
    thu: [{ open: '08:00', close: '21:00' }],
    fri: [{ open: '08:00', close: '21:00' }],
    sat: [{ open: '08:00', close: '22:00' }],
    sun: [{ open: '09:00', close: '21:00' }],
  };

  await prisma.storeLocation.createMany({
    data: [
      {
        slug: 'banhang-flagship-district-1',
        name: 'BanHang Flagship District 1',
        description: 'Flagship experience store with pickup, setup support, and live demo zones.',
        phone: '02873000001',
        email: 'd1@banhang.local',
        province: 'Ho Chi Minh',
        district: 'Quan 1',
        ward: 'Ben Nghe',
        addressLine: '25 Nguyen Hue',
        latitude: 10.7744,
        longitude: 106.7033,
        openingHours: commonOpeningHours,
        services: ['pickup', 'warranty', 'personal_setup', 'trade_in'],
        mapsUrl: 'https://maps.google.com/?q=10.7744,106.7033',
      },
      {
        slug: 'banhang-thu-duc',
        name: 'BanHang Thu Duc Hub',
        description: 'Eastern city pickup point focused on fast order collection and warranty drop-off.',
        phone: '02873000002',
        email: 'thuduc@banhang.local',
        province: 'Ho Chi Minh',
        district: 'Thu Duc',
        ward: 'Linh Tay',
        addressLine: '200 Kha Van Can',
        latitude: 10.8506,
        longitude: 106.7568,
        openingHours: commonOpeningHours,
        services: ['pickup', 'warranty'],
        mapsUrl: 'https://maps.google.com/?q=10.8506,106.7568',
      },
      {
        slug: 'banhang-hoan-kiem',
        name: 'BanHang Hoan Kiem Store',
        description: 'Northern flagship showroom with in-store consultation and accessory zone.',
        phone: '02473000003',
        email: 'hanoi@banhang.local',
        province: 'Ha Noi',
        district: 'Hoan Kiem',
        ward: 'Trang Tien',
        addressLine: '18 Trang Tien',
        latitude: 21.0245,
        longitude: 105.8561,
        openingHours: commonOpeningHours,
        services: ['pickup', 'personal_setup', 'accessory_consulting'],
        mapsUrl: 'https://maps.google.com/?q=21.0245,105.8561',
      },
    ],
  });

  await db.contentPage.createMany({
    data: [
      {
        slug: 'about',
        title: 'About BanHang',
        excerpt: 'Learn about our mission, service standards, and retail footprint.',
        content:
          'BanHang is a modern electronics retailer focused on curated devices, fast delivery, and expert after-sales support.',
        metaTitle: 'About BanHang',
        metaDescription: 'Company profile, retail philosophy, and customer support commitments.',
        isPublished: true,
        publishedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      },
      {
        slug: 'warranty-policy',
        title: 'Warranty Policy',
        excerpt: 'Transparent warranty terms for devices, accessories, and in-store support.',
        content:
          'Products sold by BanHang are covered by brand-backed warranty terms and in-store diagnostic support.',
        metaTitle: 'BanHang Warranty Policy',
        metaDescription: 'Warranty coverage, exclusions, and service-center support policy.',
        isPublished: true,
        publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  await db.promotionCampaign.createMany({
    data: [
      {
        key: 'home-hero-april-tech-week',
        name: 'April Tech Week Hero',
        kind: 'banner',
        placement: 'home_hero',
        title: 'April Tech Week',
        subtitle: 'Flagship deals, accessory bundles, and fast pickup nationwide.',
        content: 'Discover curated promotions across phones, laptops, and audio.',
        imageUrl: 'https://cdn.example.com/banners/april-tech-week.jpg',
        linkUrl: '/promotions/april-tech-week',
        startsAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        priority: 100,
        isActive: true,
        metadata: {
          badge: 'Hot',
          theme: 'tech-week',
        },
      },
      {
        key: 'home-flash-sale-iphone',
        name: 'iPhone Flash Sale',
        kind: 'flash_sale',
        placement: 'home_flash_sale',
        title: '48h iPhone Flash Sale',
        subtitle: 'Save more on selected iPhone and AirPods bundles.',
        content: 'Limited stock at flagship stores and online checkout.',
        imageUrl: 'https://cdn.example.com/banners/iphone-flash-sale.jpg',
        linkUrl: '/products/iphone-15-128gb-iph15-128-blk',
        couponCode: 'WELCOME10',
        discountPercent: 10,
        startsAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 42 * 60 * 60 * 1000),
        priority: 90,
        isActive: true,
        metadata: {
          remainingStock: 23,
          highlight: 'flash-sale',
        },
      },
    ],
  });

  await (prisma as PrismaClient & Record<string, any>).newsletterSubscriber.create({
    data: {
      email: 'newsletter@banhang.local',
      fullName: 'Newsletter Demo',
      source: 'seed',
      status: 'active',
      confirmedAt: new Date(),
    },
  });

  await (prisma as PrismaClient & Record<string, any>).pushSubscription.create({
    data: {
      userId: customer.id,
      endpoint: 'https://push.example.com/subscriptions/customer-demo',
      p256dh: 'demo-p256dh-key',
      auth: 'demo-auth-secret',
      userAgent: 'Seeded web push subscription',
    },
  });

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

    await prisma.productPriceHistory.create({
      data: {
        productId: product.id,
        price: product.price,
        previousPrice: null,
        source: 'seed',
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

  if (iphone && macbook) {
    await db.blogPost.createMany({
      data: [
        {
          slug: 'iphone-15-vs-galaxy-s24-which-flagship-fits-you',
          title: 'iPhone 15 vs Galaxy S24: Which flagship fits you better?',
          excerpt: 'We compare camera, performance, ecosystem, and day-to-day fit for two leading phones.',
          content:
            'This guide compares Apple and Samsung flagships through battery life, display, performance, and after-sales support.',
          coverImageUrl: 'https://cdn.example.com/blog/iphone-vs-galaxy.jpg',
          tags: ['comparison', 'smartphone', 'apple', 'samsung'],
          readTimeMinutes: 6,
          relatedProductIds: [iphone.id],
          isPublished: true,
          publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        },
        {
          slug: 'macbook-air-m3-office-setup-guide',
          title: 'MacBook Air M3 office setup guide for mobile teams',
          excerpt: 'A practical checklist for accessories, security, and productivity when deploying MacBooks.',
          content:
            'We cover monitor pairing, keyboard and mouse bundles, remote work security, and setup flow for distributed teams.',
          coverImageUrl: 'https://cdn.example.com/blog/macbook-air-m3-guide.jpg',
          tags: ['macbook', 'productivity', 'office'],
          readTimeMinutes: 5,
          relatedProductIds: [macbook.id],
          isPublished: true,
          publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
      ],
    });
  }

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

  await (prisma as PrismaClient & Record<string, any>).customerTag.createMany({
    data: [
      {
        userId: customer.id,
        key: 'vip-watch',
        name: 'VIP Watch',
        color: '#D97706',
      },
      {
        userId: customer.id,
        key: 'newsletter-engaged',
        name: 'Newsletter Engaged',
        color: '#2563EB',
      },
    ],
  });

  await (prisma as PrismaClient & Record<string, any>).customerNote.create({
    data: {
      userId: customer.id,
      authorId: admin.id,
      title: 'High-intent buyer',
      content:
        'Customer often checks flagship products and responds well to newsletter promotions. Consider bundle upsell on next completed order.',
      isPinned: true,
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
    await prisma.priceAlert.create({
      data: {
        userId: customer.id,
        productId: iphone.id,
        targetPrice: 19_500_000,
        isActive: true,
      },
    });

    await prisma.compareItem.createMany({
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

    await prisma.wishlistShare.create({
      data: {
        userId: customer.id,
        token: generateToken(24),
        title: 'Customer Demo picks',
      },
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

    const question = await prisma.productQuestion.create({
      data: {
        userId: customer.id,
        productId: iphone.id,
        question: 'May nay co ho tro eSIM dong thoi voi SIM vat ly khong?',
        answer: 'Co. Ban co the dung 1 nano SIM va eSIM tren phien ban nay.',
        answeredAt: new Date(),
        answeredById: admin.id,
        upvoteCount: 1,
      },
    });

    await prisma.productQuestionUpvote.create({
      data: {
        userId: admin.id,
        questionId: question.id,
      },
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
