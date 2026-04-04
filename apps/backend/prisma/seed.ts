import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/common/security';

const prisma = new PrismaClient();

async function main() {
  await prisma.paymentWebhookEvent.deleteMany();
  await prisma.orderStatusEvent.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventoryReservationItem.deleteMany();
  await prisma.inventoryReservation.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.refreshSession.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: 'admin@banhang.local',
      passwordHash: hashPassword('admin123'),
      fullName: 'Admin Demo',
      role: 'admin',
    },
  });

  await prisma.user.create({
    data: {
      email: 'customer@banhang.local',
      passwordHash: hashPassword('customer123'),
      fullName: 'Customer Demo',
      role: 'customer',
    },
  });

  await prisma.product.createMany({
    data: [
      {
        sku: 'IPH15-128-BLK',
        name: 'iPhone 15 128GB',
        category: 'Dien thoai',
        description: 'A16 Bionic, camera kep, pin ca ngay.',
        price: 19990000,
        stock: 23,
        rating: 4.8,
        tags: ['flash-sale', 'best-seller'],
      },
      {
        sku: 'SAMS24-256-GRY',
        name: 'Galaxy S24 256GB',
        category: 'Dien thoai',
        description: 'AMOLED 120Hz, Galaxy AI.',
        price: 18490000,
        stock: 15,
        rating: 4.7,
        tags: ['new'],
      },
      {
        sku: 'MBA-M3-13-256',
        name: 'MacBook Air M3 13',
        category: 'Laptop',
        description: 'M3 chip, nhe, pin 18h.',
        price: 27990000,
        stock: 9,
        rating: 4.9,
        tags: ['premium'],
      },
      {
        sku: 'AIRPODS-PRO2',
        name: 'AirPods Pro 2',
        category: 'Am thanh',
        description: 'ANC thich ung, chip H2, case USB-C.',
        price: 5790000,
        stock: 31,
        rating: 4.8,
        tags: ['best-seller'],
      },
      {
        sku: 'LOGI-MX3S',
        name: 'Logitech MX Master 3S',
        category: 'Phu kien',
        description: 'Mouse khong day cho dan van phong.',
        price: 2390000,
        stock: 42,
        rating: 4.7,
        tags: ['office'],
      },
      {
        sku: 'KEYCHRON-K2',
        name: 'Keychron K2 Pro',
        category: 'Phu kien',
        description: 'Ban phim co hot-swap, layout gon.',
        price: 2890000,
        stock: 17,
        rating: 4.6,
        tags: ['new'],
      },
    ],
  });

  console.log(`Seed done. Admin id: ${admin.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
