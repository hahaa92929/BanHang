import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StoresService } from './stores.service';

function createStoresMock() {
  const alwaysOpenHours = {
    mon: [{ open: '00:00', close: '23:59' }],
    tue: [{ open: '00:00', close: '23:59' }],
    wed: [{ open: '00:00', close: '23:59' }],
    thu: [{ open: '00:00', close: '23:59' }],
    fri: [{ open: '00:00', close: '23:59' }],
    sat: [{ open: '00:00', close: '23:59' }],
    sun: [{ open: '00:00', close: '23:59' }],
  };

  const stores = [
    {
      id: 's-1',
      slug: 'banhang-district-1',
      name: 'BanHang District 1',
      description: 'Flagship experience store.',
      phone: '02873000001',
      email: 'd1@banhang.local',
      province: 'Ho Chi Minh',
      district: 'Quan 1',
      ward: 'Ben Nghe',
      addressLine: '25 Nguyen Hue',
      country: 'Viet Nam',
      latitude: 10.7744,
      longitude: 106.7033,
      openingHours: alwaysOpenHours,
      services: ['pickup', 'warranty', 'personal_setup'],
      mapsUrl: 'https://maps.google.com/?q=10.7744,106.7033',
      isActive: true,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    },
    {
      id: 's-2',
      slug: 'banhang-thu-duc',
      name: 'BanHang Thu Duc',
      description: 'Pickup hub.',
      phone: '02873000002',
      email: 'thuduc@banhang.local',
      province: 'Ho Chi Minh',
      district: 'Thu Duc',
      ward: 'Linh Tay',
      addressLine: '200 Kha Van Can',
      country: 'Viet Nam',
      latitude: 10.8506,
      longitude: 106.7568,
      openingHours: {},
      services: ['pickup'],
      mapsUrl: 'https://maps.google.com/?q=10.8506,106.7568',
      isActive: true,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    },
    {
      id: 's-3',
      slug: 'banhang-hoan-kiem',
      name: 'BanHang Hoan Kiem',
      description: 'Northern store.',
      phone: '02473000003',
      email: 'hanoi@banhang.local',
      province: 'Ha Noi',
      district: 'Hoan Kiem',
      ward: 'Trang Tien',
      addressLine: '18 Trang Tien',
      country: 'Viet Nam',
      latitude: 21.0245,
      longitude: 105.8561,
      openingHours: alwaysOpenHours,
      services: ['pickup', 'accessory_consulting'],
      mapsUrl: 'https://maps.google.com/?q=21.0245,105.8561',
      isActive: true,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    },
  ];

  const appointments: Array<{
    id: string;
    storeId: string;
    fullName: string;
    phone: string;
    email: string | null;
    service: string | null;
    scheduledFor: Date;
    notes: string | null;
    status: 'requested';
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  function matchesStore(store: (typeof stores)[number], where?: Record<string, unknown>) {
    if (!where) {
      return true;
    }

    if (where.isActive !== undefined && store.isActive !== where.isActive) {
      return false;
    }

    if ((where as { province?: { contains?: string } }).province?.contains) {
      if (
        !store.province
          .toLowerCase()
          .includes((where as { province: { contains: string } }).province.contains.toLowerCase())
      ) {
        return false;
      }
    }

    if ((where as { district?: { contains?: string } }).district?.contains) {
      if (
        !store.district
          .toLowerCase()
          .includes((where as { district: { contains: string } }).district.contains.toLowerCase())
      ) {
        return false;
      }
    }

    if ((where as { services?: { has?: string } }).services?.has) {
      if (
        !store.services.some(
          (service) => service.toLowerCase() === (where as { services: { has: string } }).services.has.toLowerCase(),
        )
      ) {
        return false;
      }
    }

    if (Array.isArray(where.OR)) {
      return where.OR.some((clause) => matchesStore(store, clause as Record<string, unknown>));
    }

    if ((where as { name?: { contains?: string } }).name?.contains) {
      return store.name.toLowerCase().includes((where as { name: { contains: string } }).name.contains.toLowerCase());
    }
    if ((where as { description?: { contains?: string } }).description?.contains) {
      return (store.description ?? '')
        .toLowerCase()
        .includes((where as { description: { contains: string } }).description.contains.toLowerCase());
    }
    if ((where as { addressLine?: { contains?: string } }).addressLine?.contains) {
      return store.addressLine
        .toLowerCase()
        .includes((where as { addressLine: { contains: string } }).addressLine.contains.toLowerCase());
    }

    return true;
  }

  const prisma = {
    storeLocation: {
      findMany: async (args?: { where?: Record<string, unknown> }) =>
        stores.filter((store) => matchesStore(store, args?.where)),
      findFirst: async (args: { where: { OR: Array<{ id?: string; slug?: string }> } }) =>
        stores.find((store) =>
          args.where.OR.some((condition) => condition.id === store.id || condition.slug === store.slug),
        ) ?? null,
    },
    storeAppointment: {
      create: async (args: {
        data: {
          storeId: string;
          fullName: string;
          phone: string;
          email?: string | null;
          service?: string | null;
          scheduledFor: Date;
          notes?: string | null;
        };
        include: { store: true };
      }) => {
        const row = {
          id: `sa-${appointments.length + 1}`,
          status: 'requested' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
          email: null,
          service: null,
          notes: null,
          ...args.data,
        };
        appointments.push(row);
        return {
          ...row,
          store: stores.find((store) => store.id === row.storeId)!,
        };
      },
    },
  };

  return {
    prisma,
    appointments,
  };
}

test('stores.list nearest and detail cover locator discovery flows', async () => {
  const { prisma } = createStoresMock();
  const service = new StoresService(prisma as never);

  const listed = await service.list({
    province: 'Ho Chi Minh',
    service: 'pickup',
    openNow: true,
    page: 1,
    limit: 10,
  });
  const nearest = await service.nearest({
    lat: 10.775,
    lng: 106.703,
    radiusKm: 15,
    limit: 5,
  });
  const detail = await service.detail('banhang-district-1');

  assert.equal(listed.total, 1);
  assert.equal(listed.data[0].slug, 'banhang-district-1');
  assert.equal(listed.data[0].isOpenNow, true);
  assert.equal(nearest.total, 2);
  assert.equal(nearest.data[0].slug, 'banhang-district-1');
  assert.ok(nearest.data[0].distanceKm < nearest.data[1].distanceKm);
  assert.equal(detail.slug, 'banhang-district-1');
  assert.equal(detail.isOpenNow, true);
});

test('stores.createAppointment validates schedule and store availability', async () => {
  const { prisma, appointments } = createStoresMock();
  const service = new StoresService(prisma as never);
  const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
  scheduledFor.setHours(10, 0, 0, 0);

  const created = await service.createAppointment('banhang-district-1', {
    fullName: 'Nguyen Van A',
    phone: '0909000000',
    email: 'a@example.com',
    service: 'pickup',
    scheduledFor,
    notes: 'Muon xem may truc tiep.',
  });

  assert.equal(created.store.slug, 'banhang-district-1');
  assert.equal(created.status, 'requested');
  assert.equal(created.service, 'pickup');
  assert.equal(appointments.length, 1);

  await assert.rejects(
    async () =>
      service.createAppointment('banhang-thu-duc', {
        fullName: 'Nguyen Van B',
        phone: '0909000001',
        scheduledFor,
      }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === 'Store is closed at the requested appointment time',
  );

  await assert.rejects(
    async () =>
      service.createAppointment('missing-store', {
        fullName: 'Nguyen Van C',
        phone: '0909000002',
        scheduledFor,
      }),
    (error: unknown) => error instanceof NotFoundException,
  );

  await assert.rejects(
    async () =>
      service.createAppointment('banhang-district-1', {
        fullName: 'Nguyen Van D',
        phone: '0909000003',
        scheduledFor: new Date(Date.now() - 60_000),
      }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === 'Appointment time must be in the future',
  );
});
