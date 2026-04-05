import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ProductStatus, Prisma, UserRole } from '@prisma/client';
import { comparePassword, generateToken, hashPassword } from '../../common/security';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { QueryAccountOrdersDto } from './dto/query-account-orders.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(userId: string) {
    await this.ensureUser(userId);

    const [wishlistIds, totalOrders, recentOrders, unreadNotifications, wishlistCount] =
      await Promise.all([
        this.prisma.wishlistItem.findMany({
          where: { userId },
          select: { productId: true },
        }),
        this.prisma.order.count({ where: { userId } }),
        this.prisma.order.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            shippingStatus: true,
            total: true,
            createdAt: true,
          },
        }),
        this.prisma.notification.count({
          where: {
            userId,
            isRead: false,
          },
        }),
        this.prisma.wishlistItem.count({ where: { userId } }),
      ]);

    const suggestions = await this.prisma.product.findMany({
      where: {
        status: ProductStatus.active,
        stock: { gt: 0 },
        ...(wishlistIds.length
          ? {
              id: {
                notIn: wishlistIds.map((item) => item.productId),
              },
            }
          : {}),
      },
      orderBy: [{ totalSold: 'desc' }, { createdAt: 'desc' }],
      take: 4,
      include: {
        brand: true,
        category: true,
        media: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          take: 1,
        },
      },
    });

    return {
      totalOrders,
      wishlistCount,
      unreadNotifications,
      recentOrders,
      suggestions,
    };
  }

  async listOrders(userId: string, query: QueryAccountOrdersDto = {}) {
    await this.ensureUser(userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const keyword = query.q?.trim();
    const where: Prisma.OrderWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
      ...(keyword
        ? {
            OR: [
              { orderNumber: { contains: keyword, mode: 'insensitive' } },
              { trackingCode: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          items: true,
          payments: {
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      data,
    };
  }

  async reorder(userId: string, orderId: string) {
    await this.ensureUser(userId);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          userId,
        },
        include: {
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const skippedItems: Array<{
        productId: string;
        variantId: string | null;
        name: string;
        reason: string;
      }> = [];
      let addedItems = 0;

      for (const item of order.items) {
        const product = item.product;
        if (product.status !== ProductStatus.active) {
          skippedItems.push({
            productId: item.productId,
            variantId: item.variantId,
            name: item.name,
            reason: 'Product is no longer active',
          });
          continue;
        }

        const variant =
          item.variant ??
          (await tx.productVariant.findFirst({
            where: {
              productId: item.productId,
              isActive: true,
            },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          }));

        if (!variant) {
          skippedItems.push({
            productId: item.productId,
            variantId: item.variantId,
            name: item.name,
            reason: 'No active variant available',
          });
          continue;
        }

        const existing = await tx.cartItem.findFirst({
          where: {
            userId,
            productId: item.productId,
            variantId: variant.id,
          },
        });
        const nextQuantity = (existing?.quantity ?? 0) + item.quantity;

        if (variant.stock < nextQuantity) {
          skippedItems.push({
            productId: item.productId,
            variantId: variant.id,
            name: item.name,
            reason: 'Stock is not enough',
          });
          continue;
        }

        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: nextQuantity },
          });
        } else {
          await tx.cartItem.create({
            data: {
              userId,
              productId: item.productId,
              variantId: variant.id,
              quantity: item.quantity,
            },
          });
        }

        addedItems += item.quantity;
      }

      const cartRows = await tx.cartItem.findMany({
        where: { userId },
        select: { quantity: true },
      });

      return {
        success: addedItems > 0,
        addedItems,
        skippedItems,
        cartTotalItems: cartRows.reduce((sum, row) => sum + row.quantity, 0),
      };
    });
  }

  async loyalty(userId: string) {
    await this.ensureUser(userId);

    const completedOrders = await this.prisma.order.findMany({
      where: {
        userId,
        status: 'completed',
      },
      orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        orderNumber: true,
        total: true,
        completedAt: true,
        createdAt: true,
      },
    });

    const history = completedOrders.map((order) => {
      const points = Math.max(1, Math.floor(order.total / 1_000));
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        points,
        type: 'earn' as const,
        description: `Earned from order ${order.orderNumber}`,
        createdAt: order.completedAt ?? order.createdAt,
      };
    });
    const totalEarned = history.reduce((sum, item) => sum + item.points, 0);

    return {
      pointsBalance: totalEarned,
      totalEarned,
      totalRedeemed: 0,
      tier: this.resolveLoyaltyTier(totalEarned),
      history,
    };
  }

  async profile(userId: string) {
    return this.ensureUser(userId);
  }

  async updateProfile(userId: string, payload: UpdateProfileDto) {
    await this.ensureUser(userId);

    return this.prisma.user.update({
      where: { id: userId },
      data: payload,
      select: this.profileSelect(),
    });
  }

  async listAddresses(userId: string) {
    await this.ensureUser(userId);
    return this.listAddressesInClient(this.prisma, userId);
  }

  async createAddress(userId: string, payload: CreateAddressDto) {
    await this.ensureUser(userId);

    return this.prisma.$transaction(async (tx) => {
      const existingDefault = await tx.address.findFirst({
        where: {
          userId,
          isDefault: true,
        },
      });
      const shouldSetDefault = payload.isDefault ?? !existingDefault;

      if (shouldSetDefault) {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      await tx.address.create({
        data: {
          userId,
          label: payload.label,
          fullName: payload.fullName,
          phone: payload.phone,
          province: payload.province,
          district: payload.district,
          ward: payload.ward,
          addressLine: payload.addressLine,
          country: payload.country ?? 'Viet Nam',
          isDefault: shouldSetDefault,
        },
      });

      return this.listAddressesInClient(tx, userId);
    });
  }

  async updateAddress(userId: string, id: string, payload: UpdateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({
        where: {
          id,
          userId,
        },
      });

      if (!existing) {
        throw new NotFoundException('Address not found');
      }

      if (payload.isDefault) {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      await tx.address.update({
        where: { id },
        data: {
          ...(payload.label !== undefined ? { label: payload.label } : {}),
          ...(payload.fullName !== undefined ? { fullName: payload.fullName } : {}),
          ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
          ...(payload.province !== undefined ? { province: payload.province } : {}),
          ...(payload.district !== undefined ? { district: payload.district } : {}),
          ...(payload.ward !== undefined ? { ward: payload.ward } : {}),
          ...(payload.addressLine !== undefined ? { addressLine: payload.addressLine } : {}),
          ...(payload.country !== undefined ? { country: payload.country } : {}),
          ...(payload.isDefault !== undefined ? { isDefault: payload.isDefault } : {}),
        },
      });

      return this.listAddressesInClient(tx, userId);
    });
  }

  async setDefaultAddress(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({
        where: {
          id,
          userId,
        },
      });

      if (!existing) {
        throw new NotFoundException('Address not found');
      }

      await tx.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      await tx.address.update({
        where: { id },
        data: { isDefault: true },
      });

      return this.listAddressesInClient(tx, userId);
    });
  }

  async deleteAddress(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({
        where: {
          id,
          userId,
        },
      });

      if (!existing) {
        throw new NotFoundException('Address not found');
      }

      await tx.address.delete({
        where: { id },
      });

      if (existing.isDefault) {
        const fallback = await tx.address.findFirst({
          where: { userId },
          orderBy: [{ createdAt: 'desc' }],
        });

        if (fallback) {
          await tx.address.update({
            where: { id: fallback.id },
            data: { isDefault: true },
          });
        }
      }

      return this.listAddressesInClient(tx, userId);
    });
  }

  async exportData(userId: string) {
    const profile = await this.ensureUser(userId);
    const [addresses, orders, wishlist, reviews, notifications, preference, apiKeys] = await Promise.all([
      this.prisma.address.findMany({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          payments: true,
          history: {
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.wishlistItem.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            include: {
              brand: true,
              category: true,
            },
          },
        },
      }),
      this.prisma.review.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          product: true,
        },
      }),
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.notificationPreference.findUnique({
        where: { userId },
      }),
      this.prisma.apiKey.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          permissions: true,
          lastUsedAt: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      exportedAt: new Date(),
      profile,
      addresses,
      orders,
      wishlist,
      reviews,
      notifications,
      notificationPreference: preference,
      apiKeys,
    };
  }

  async deleteAccount(userId: string, payload: DeleteAccountDto) {
    const user = await this.findUserWithPassword(userId);

    if (user.role === UserRole.guest) {
      throw new BadRequestException('Guest account cannot be deleted');
    }

    const passwordMatches = await comparePassword(payload.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Password is incorrect');
    }

    const anonymizedAt = new Date();
    const replacementPasswordHash = await hashPassword(generateToken(24));

    return this.prisma.$transaction(async (tx) => {
      await tx.cartCoupon.deleteMany({ where: { userId } });
      await tx.cartItem.deleteMany({ where: { userId } });
      await tx.address.deleteMany({ where: { userId } });
      await tx.wishlistItem.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.notificationPreference.deleteMany({ where: { userId } });
      await tx.refreshSession.deleteMany({ where: { userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.emailVerificationToken.deleteMany({ where: { userId } });
      await tx.socialAccount.deleteMany({ where: { userId } });
      await tx.apiKey.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: anonymizedAt },
      });

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted+${userId}@deleted.local`,
          passwordHash: replacementPasswordHash,
          fullName: 'Deleted User',
          phone: null,
          emailVerifiedAt: null,
          twoFactorSecret: null,
          twoFactorEnabledAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: null,
          role: UserRole.customer,
        },
        select: this.profileSelect(),
      });

      return {
        success: true,
        anonymizedAt,
        reason: payload.reason ?? null,
        user: updatedUser,
      };
    });
  }

  private async ensureUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.profileSelect(),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async findUserWithPassword(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async listAddressesInClient(
    client: PrismaService | Prisma.TransactionClient,
    userId: string,
  ) {
    const data = await client.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      total: data.length,
      data,
    };
  }

  private profileSelect() {
    return {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      emailVerifiedAt: true,
      twoFactorEnabledAt: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.UserSelect;
  }

  private resolveLoyaltyTier(points: number) {
    if (points >= 10_000) {
      return 'Platinum';
    }

    if (points >= 5_000) {
      return 'Gold';
    }

    if (points >= 1_000) {
      return 'Silver';
    }

    return 'Bronze';
  }
}
