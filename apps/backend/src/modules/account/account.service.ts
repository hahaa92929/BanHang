import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ProductStatus, Prisma, UserRole } from '@prisma/client';
import { comparePassword, generateToken, hashPassword } from '../../common/security';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { QueryAccountOrdersDto } from './dto/query-account-orders.dto';
import { RedeemLoyaltyDto } from './dto/redeem-loyalty.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AccountService {
  private readonly loyaltyRedeemRate = 100;
  private readonly loyaltyMinRedeemPoints = 500;
  private readonly loyaltyRedeemStep = 100;
  private readonly loyaltyCouponTtlDays = 30;

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
    return this.buildLoyaltySummary(this.prisma, userId);
  }

  async redeemLoyalty(userId: string, payload: RedeemLoyaltyDto) {
    await this.ensureUser(userId);
    this.assertRedeemPoints(payload.points);

    const loyalty = await this.loyalty(userId);
    if (loyalty.pointsBalance < payload.points) {
      throw new BadRequestException('Not enough loyalty points');
    }

    return this.prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.create({
        data: {
          code: await this.generateLoyaltyCouponCode(tx),
          type: 'fixed',
          value: payload.points * this.loyaltyRedeemRate,
          minOrderAmount: 0,
          usageLimit: 1,
          usedCount: 0,
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + this.loyaltyCouponTtlDays * 24 * 60 * 60 * 1000),
          isActive: true,
        },
      });

      const redemption = await tx.loyaltyRedemption.create({
        data: {
          userId,
          couponId: coupon.id,
          pointsSpent: payload.points,
          discountAmount: coupon.value,
        },
        include: {
          coupon: true,
        },
      });

      await tx.notification.create({
        data: {
          userId,
          type: 'promotion',
          title: 'Loyalty voucher created',
          content: `Coupon ${coupon.code} has been created from your loyalty points.`,
          data: {
            couponId: coupon.id,
            couponCode: coupon.code,
            pointsSpent: payload.points,
            discountAmount: coupon.value,
          },
        },
      });

      const summary = await this.buildLoyaltySummary(tx, userId);
      return {
        success: true,
        redemption: {
          id: redemption.id,
          pointsSpent: redemption.pointsSpent,
          discountAmount: redemption.discountAmount,
          coupon: {
            id: coupon.id,
            code: coupon.code,
            value: coupon.value,
            expiresAt: coupon.expiresAt,
          },
        },
        loyalty: summary,
      };
    });
  }

  async referral(userId: string) {
    const user = await this.ensureUser(userId);
    const referralCode = user.referralCode ?? (await this.assignReferralCode(userId, user.fullName || user.email));
    const data = await this.prisma.referralEvent.findMany({
      where: { referrerId: userId },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        referredUser: {
          select: {
            id: true,
            email: true,
            fullName: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      referralCode,
      referralLink: `${this.referralBaseUrl()}/register?ref=${referralCode}`,
      totalSignups: data.length,
      qualifiedCount: data.filter((item) => item.status === 'qualified' || item.status === 'rewarded').length,
      rewardedCount: data.filter((item) => item.status === 'rewarded').length,
      totalRewardPoints: data.reduce(
        (sum, item) => sum + (item.status === 'rewarded' ? item.rewardPoints : 0),
        0,
      ),
      data: data.map((item) => ({
        id: item.id,
        referralCode: item.referralCode,
        status: item.status,
        rewardPoints: item.rewardPoints,
        qualifiedOrderId: item.qualifiedOrderId,
        qualifiedAt: item.qualifiedAt,
        rewardGrantedAt: item.rewardGrantedAt,
        createdAt: item.createdAt,
        referredUser: item.referredUser,
      })),
    };
  }

  async regenerateReferralCode(userId: string) {
    const user = await this.ensureUser(userId);
    const referralCode = await this.generateUniqueReferralCode(user.fullName || user.email);
    await this.prisma.user.update({
      where: { id: userId },
      data: { referralCode },
    });

    return this.referral(userId);
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
    const [
      addresses,
      orders,
      wishlist,
      reviews,
      notifications,
      preference,
      apiKeys,
      savedPaymentMethods,
      referralEvents,
      loyaltyRedemptions,
    ] = await Promise.all([
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
      this.prisma.savedPaymentMethod.findMany({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          gateway: true,
          method: true,
          label: true,
          brand: true,
          last4: true,
          expiryMonth: true,
          expiryYear: true,
          providerCustomerRef: true,
          isDefault: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.referralEvent.findMany({
        where: {
          OR: [{ referrerId: userId }, { referredUserId: userId }],
        },
        orderBy: [{ createdAt: 'desc' }],
        include: {
          referrer: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          referredUser: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      }),
      this.prisma.loyaltyRedemption.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }],
        include: {
          coupon: {
            select: {
              id: true,
              code: true,
              type: true,
              value: true,
              startsAt: true,
              expiresAt: true,
              isActive: true,
              usedCount: true,
            },
          },
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
      savedPaymentMethods,
      referralEvents,
      loyaltyRedemptions,
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
      await tx.savedPaymentMethod.deleteMany({ where: { userId } });
      await tx.referralEvent.deleteMany({
        where: {
          OR: [{ referrerId: userId }, { referredUserId: userId }],
        },
      });
      const redemptions = await tx.loyaltyRedemption.findMany({
        where: { userId },
        select: { couponId: true },
      });
      await tx.loyaltyRedemption.deleteMany({ where: { userId } });
      if (redemptions.length) {
        await tx.coupon.updateMany({
          where: { id: { in: redemptions.map((item) => item.couponId) } },
          data: { isActive: false },
        });
      }
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
      referralCode: true,
      emailVerifiedAt: true,
      twoFactorEnabledAt: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.UserSelect;
  }

  private async assignReferralCode(userId: string, seed: string) {
    const referralCode = await this.generateUniqueReferralCode(seed);
    await this.prisma.user.update({
      where: { id: userId },
      data: { referralCode },
    });
    return referralCode;
  }

  private async generateUniqueReferralCode(seed: string) {
    const base =
      seed
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '')
        .slice(0, 6) || 'BANHAN';

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = `${base}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const existing = await this.prisma.user.findUnique({
        where: { referralCode: candidate },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    }

    return `${base}${Date.now().toString(36).slice(-6).toUpperCase()}`;
  }

  private referralBaseUrl() {
    const baseUrl = process.env.APP_PUBLIC_URL?.trim();
    return baseUrl && /^https?:\/\//.test(baseUrl) ? baseUrl.replace(/\/+$/, '') : 'https://banhang.local';
  }

  private async buildLoyaltySummary(
    client: PrismaService | Prisma.TransactionClient,
    userId: string,
  ) {
    const [completedOrders, rewardedReferrals, redemptions] = await Promise.all([
      client.order.findMany({
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
      }),
      client.referralEvent.findMany({
        where: {
          referrerId: userId,
          status: 'rewarded',
        },
        orderBy: [{ rewardGrantedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          referredUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      }),
      client.loyaltyRedemption.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }],
        include: {
          coupon: {
            select: {
              id: true,
              code: true,
              expiresAt: true,
              isActive: true,
              usedCount: true,
            },
          },
        },
      }),
    ]);

    const orderHistory = completedOrders.map((order) => {
      const points = Math.max(1, Math.floor(order.total / 1_000));
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        points,
        type: 'earn' as const,
        source: 'order' as const,
        description: `Earned from order ${order.orderNumber}`,
        createdAt: order.completedAt ?? order.createdAt,
      };
    });
    const referralHistory = rewardedReferrals.map((event) => ({
      referralEventId: event.id,
      referredUserId: event.referredUserId,
      referredUserName: event.referredUser.fullName,
      referredUserEmail: event.referredUser.email,
      orderId: event.qualifiedOrderId ?? null,
      points: event.rewardPoints,
      type: 'earn' as const,
      source: 'referral' as const,
      description: `Referral reward from ${event.referredUser.fullName}`,
      createdAt: event.rewardGrantedAt ?? event.createdAt,
    }));
    const redemptionHistory = redemptions.map((redemption) => ({
      redemptionId: redemption.id,
      couponId: redemption.couponId,
      couponCode: redemption.coupon.code,
      points: redemption.pointsSpent,
      discountAmount: redemption.discountAmount,
      type: 'redeem' as const,
      source: 'voucher' as const,
      description: `Redeemed ${redemption.pointsSpent} points for coupon ${redemption.coupon.code}`,
      createdAt: redemption.createdAt,
      couponExpiresAt: redemption.coupon.expiresAt,
      couponActive: redemption.coupon.isActive,
      couponUsed: redemption.coupon.usedCount > 0,
    }));
    const history = [...orderHistory, ...referralHistory, ...redemptionHistory].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );
    const totalEarned = [...orderHistory, ...referralHistory].reduce((sum, item) => sum + item.points, 0);
    const totalRedeemed = redemptionHistory.reduce((sum, item) => sum + item.points, 0);
    const pointsBalance = Math.max(0, totalEarned - totalRedeemed);

    return {
      pointsBalance,
      totalEarned,
      totalRedeemed,
      tier: this.resolveLoyaltyTier(totalEarned),
      history,
      redeemRules: {
        minPoints: this.loyaltyMinRedeemPoints,
        stepPoints: this.loyaltyRedeemStep,
        rate: this.loyaltyRedeemRate,
      },
    };
  }

  private assertRedeemPoints(points: number) {
    if (points < this.loyaltyMinRedeemPoints) {
      throw new BadRequestException(`Minimum redeem points is ${this.loyaltyMinRedeemPoints}`);
    }

    if (points % this.loyaltyRedeemStep !== 0) {
      throw new BadRequestException(`Redeem points must be in increments of ${this.loyaltyRedeemStep}`);
    }
  }

  private async generateLoyaltyCouponCode(client: PrismaService | Prisma.TransactionClient) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = `LOYAL-${generateToken(4).toUpperCase()}`;
      const existing = await client.coupon.findUnique({
        where: { code },
        select: { id: true },
      });

      if (!existing) {
        return code;
      }
    }

    return `LOYAL-${Date.now().toString(36).toUpperCase()}`;
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
