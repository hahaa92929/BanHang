import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { generateToken } from '../../common/security';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { CreateWishlistShareDto } from './dto/create-wishlist-share.dto';

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
  ) {}

  async list(userId: string) {
    return this.listByUser(userId, { includeAlerts: true });
  }

  async getCurrentShare(userId: string) {
    const share = await this.prisma.wishlistShare.findUnique({
      where: { userId },
    });

    if (!share || !share.isActive || this.isExpired(share.expiresAt)) {
      return {
        share: null,
      };
    }

    return {
      share: this.formatShare(share),
    };
  }

  async createShare(userId: string, payload: CreateWishlistShareDto = {}) {
    const existing = await this.prisma.wishlistShare.findUnique({
      where: { userId },
    });
    const shouldRotate = !existing || !existing.isActive || this.isExpired(existing.expiresAt);
    const share = existing
      ? await this.prisma.wishlistShare.update({
          where: { userId },
          data: {
            token: shouldRotate ? generateToken(24) : existing.token,
            title: payload.title ?? existing.title,
            isActive: true,
            expiresAt:
              payload.expiresInDays === undefined
                ? shouldRotate
                  ? null
                  : existing.expiresAt
                : this.resolveExpiresAt(payload.expiresInDays),
            lastViewedAt: shouldRotate ? null : existing.lastViewedAt,
          },
        })
      : await this.prisma.wishlistShare.create({
          data: {
            userId,
            token: generateToken(24),
            title: payload.title,
            expiresAt: this.resolveExpiresAt(payload.expiresInDays) ?? null,
          },
        });

    return {
      share: this.formatShare(share),
    };
  }

  async regenerateShare(userId: string, payload: CreateWishlistShareDto = {}) {
    const existing = await this.prisma.wishlistShare.findUnique({
      where: { userId },
    });
    const share = existing
      ? await this.prisma.wishlistShare.update({
          where: { userId },
          data: {
            token: generateToken(24),
            title: payload.title ?? existing.title,
            isActive: true,
            expiresAt:
              payload.expiresInDays === undefined
                ? existing.expiresAt
                : this.resolveExpiresAt(payload.expiresInDays),
            lastViewedAt: null,
          },
        })
      : await this.prisma.wishlistShare.create({
          data: {
            userId,
            token: generateToken(24),
            title: payload.title,
            expiresAt: this.resolveExpiresAt(payload.expiresInDays) ?? null,
          },
        });

    return {
      share: this.formatShare(share),
    };
  }

  async getSharedWishlist(token: string) {
    const share = await this.prisma.wishlistShare.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!share || !share.isActive || this.isExpired(share.expiresAt)) {
      throw new NotFoundException('Wishlist share not found');
    }

    const updatedShare = await this.prisma.wishlistShare.update({
      where: { id: share.id },
      data: {
        lastViewedAt: new Date(),
      },
    });
    const wishlist = await this.listByUser(share.userId, { includeAlerts: false });

    return {
      share: this.formatShare(updatedShare),
      owner: share.user,
      total: wishlist.total,
      data: wishlist.data,
    };
  }

  private async listByUser(userId: string, options: { includeAlerts: boolean }) {
    const data = await this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          include: {
            category: true,
            brand: true,
            media: {
              orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
              take: 1,
            },
          },
        },
      },
    });

    const alerts =
      options.includeAlerts && data.length
        ? await this.prisma.priceAlert.findMany({
            where: {
              userId,
              isActive: true,
              productId: {
                in: data.map((item) => item.productId),
              },
            },
            select: {
              productId: true,
              targetPrice: true,
              lastNotifiedPrice: true,
              createdAt: true,
              updatedAt: true,
            },
          })
        : [];
    const alertMap = new Map(alerts.map((alert) => [alert.productId, alert]));

    return {
      total: data.length,
      data: data.map((item) => {
        const base = {
          id: item.id,
          createdAt: item.createdAt,
          product: item.product,
        };

        if (!options.includeAlerts) {
          return base;
        }

        return {
          ...base,
          priceAlert: alertMap.get(item.productId) ?? null,
        };
      }),
    };
  }

  async addItem(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.status !== ProductStatus.active) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.wishlistItem.upsert({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
      create: {
        userId,
        productId,
      },
      update: {},
    });

    return this.list(userId);
  }

  async removeItem(userId: string, productId: string) {
    await this.prisma.wishlistItem.deleteMany({
      where: {
        userId,
        productId,
      },
    });

    return this.list(userId);
  }

  async moveToCart(userId: string, productId: string) {
    const existing = await this.prisma.wishlistItem.findFirst({
      where: {
        userId,
        productId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Wishlist item not found');
    }

    const cart = await this.cartService.addItem(userId, productId, 1);
    const wishlist = await this.removeItem(userId, productId);

    return {
      success: true,
      movedProductId: productId,
      cart,
      wishlist,
    };
  }

  private resolveExpiresAt(expiresInDays?: number) {
    if (expiresInDays === undefined) {
      return undefined;
    }

    return new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  }

  private isExpired(expiresAt: Date | null) {
    return Boolean(expiresAt && expiresAt.getTime() <= Date.now());
  }

  private formatShare(share: {
    id: string;
    token: string;
    title: string | null;
    isActive: boolean;
    expiresAt: Date | null;
    lastViewedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: share.id,
      token: share.token,
      title: share.title,
      isActive: share.isActive,
      expiresAt: share.expiresAt,
      lastViewedAt: share.lastViewedAt,
      createdAt: share.createdAt,
      updatedAt: share.updatedAt,
      sharePath: `/api/v1/wishlist/shared/${share.token}`,
    };
  }
}
