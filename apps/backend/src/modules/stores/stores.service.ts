import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StoreLocation } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreateStoreAppointmentDto } from './dto/create-store-appointment.dto';
import { QueryNearestStoresDto } from './dto/query-nearest-stores.dto';
import { QueryStoresDto } from './dto/query-stores.dto';

type OpeningHours = Partial<
  Record<string, Array<{ open: string; close: string }>>
>;

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryStoresDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const keyword = query.q?.trim();
    const where: Prisma.StoreLocationWhereInput = {
      isActive: true,
      ...(query.province
        ? {
            province: {
              contains: query.province.trim(),
              mode: 'insensitive',
            },
          }
        : {}),
      ...(query.district
        ? {
            district: {
              contains: query.district.trim(),
              mode: 'insensitive',
            },
          }
        : {}),
      ...(query.service
        ? {
            services: {
              has: query.service.trim().toLowerCase(),
            },
          }
        : {}),
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword, mode: 'insensitive' } },
              { description: { contains: keyword, mode: 'insensitive' } },
              { addressLine: { contains: keyword, mode: 'insensitive' } },
              { district: { contains: keyword, mode: 'insensitive' } },
              { province: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.storeLocation.findMany({
      where,
      orderBy: [{ province: 'asc' }, { district: 'asc' }, { name: 'asc' }],
    });
    const now = new Date();
    const filtered = query.openNow ? rows.filter((store) => this.isStoreOpenAt(store, now)) : rows;
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * limit;

    return {
      total,
      page: safePage,
      limit,
      totalPages,
      data: filtered.slice(skip, skip + limit).map((store) => this.serializeStore(store, now)),
    };
  }

  async nearest(query: QueryNearestStoresDto) {
    const limit = query.limit ?? 5;
    const radiusKm = query.radiusKm ?? 25;
    const now = new Date();
    const rows = await this.prisma.storeLocation.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ province: 'asc' }, { district: 'asc' }, { name: 'asc' }],
    });

    const data = rows
      .map((store) => {
        const distanceKm = this.calculateDistanceKm(
          query.lat,
          query.lng,
          store.latitude,
          store.longitude,
        );

        return {
          ...this.serializeStore(store, now),
          distanceKm: Number(distanceKm.toFixed(2)),
        };
      })
      .filter((store) => store.distanceKm <= radiusKm)
      .sort((left, right) => left.distanceKm - right.distanceKm)
      .slice(0, limit);

    return {
      origin: {
        lat: query.lat,
        lng: query.lng,
      },
      radiusKm,
      total: data.length,
      data,
    };
  }

  async detail(idOrSlug: string) {
    const store = await this.findStore(idOrSlug);

    if (!store || !store.isActive) {
      throw new NotFoundException('Store not found');
    }

    return this.serializeStore(store, new Date());
  }

  async createAppointment(idOrSlug: string, payload: CreateStoreAppointmentDto) {
    const store = await this.findStore(idOrSlug);

    if (!store || !store.isActive) {
      throw new NotFoundException('Store not found');
    }

    if (payload.scheduledFor.getTime() <= Date.now()) {
      throw new BadRequestException('Appointment time must be in the future');
    }

    if (!this.isStoreOpenAt(store, payload.scheduledFor)) {
      throw new BadRequestException('Store is closed at the requested appointment time');
    }

    const appointment = await this.prisma.storeAppointment.create({
      data: {
        storeId: store.id,
        fullName: payload.fullName,
        phone: payload.phone,
        email: payload.email,
        service: payload.service?.trim().toLowerCase() || null,
        scheduledFor: payload.scheduledFor,
        notes: payload.notes,
      },
      include: {
        store: true,
      },
    });

    return {
      ...appointment,
      store: this.serializeStore(appointment.store, payload.scheduledFor),
    };
  }

  private async findStore(idOrSlug: string) {
    return this.prisma.storeLocation.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
    });
  }

  private serializeStore(store: StoreLocation, at: Date) {
    return {
      ...store,
      isOpenNow: this.isStoreOpenAt(store, at),
    };
  }

  private isStoreOpenAt(store: Pick<StoreLocation, 'openingHours'>, at: Date) {
    const openingHours = (store.openingHours ?? {}) as OpeningHours;
    const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][at.getDay()];
    const intervals = openingHours[dayKey] ?? [];

    if (!Array.isArray(intervals) || !intervals.length) {
      return false;
    }

    const currentMinutes = at.getHours() * 60 + at.getMinutes();

    return intervals.some((interval) => {
      const openMinutes = this.parseTimeToMinutes(interval.open);
      const closeMinutes = this.parseTimeToMinutes(interval.close);

      if (openMinutes === null || closeMinutes === null) {
        return false;
      }

      return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    });
  }

  private parseTimeToMinutes(value?: string) {
    if (!value || !/^\d{2}:\d{2}$/.test(value)) {
      return null;
    }

    const [hours, minutes] = value.split(':').map((item) => Number(item));

    if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
      return null;
    }

    return hours * 60 + minutes;
  }

  private calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const earthRadiusKm = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKm * c;
  }

  private toRadians(value: number) {
    return (value * Math.PI) / 180;
  }
}
