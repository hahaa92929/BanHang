import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKey, AuthProvider, Prisma, User, UserRole } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { ROLE_PERMISSIONS } from '../../common/authz';
import {
  buildOtpAuthUrl,
  comparePassword,
  generateToken,
  generateTotpCode,
  generateTotpSecret,
  hashOpaqueToken,
  hashPassword,
  verifyTotpCode,
} from '../../common/security';
import {
  JwtUserPayload,
  Permission,
  UserRole as DomainUserRole,
} from '../../common/types/domain';
import { AppEnv } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';

type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  private readonly accessSigningKey: string;
  private readonly accessVerifyKey: string;
  private readonly accessSecret: string;
  private readonly jwtAlgorithm: 'HS256' | 'RS256';
  private readonly accessTtlSec: number;
  private readonly refreshTtlSec: number;
  private readonly tokenHashSecret: string;
  private readonly resetPasswordTtlMinutes: number;
  private readonly emailVerificationTtlHours: number;
  private readonly isProduction: boolean;
  private readonly maxFailedLoginAttempts = 5;
  private readonly lockoutMinutes = 15;
  private readonly twoFactorIssuer = 'BanHang';
  private readonly supportedSocialProviders = new Set<AuthProvider>([
    'google',
    'facebook',
    'apple',
    'zalo',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService<AppEnv, true>,
  ) {
    this.isProduction = this.getConfig('NODE_ENV', process.env.NODE_ENV || 'development') === 'production';
    const rawSecret = this.getOptionalConfig('JWT_SECRET') ?? process.env.JWT_SECRET;
    const privateKey = this.normalizeKey(this.getOptionalConfig('JWT_PRIVATE_KEY') ?? process.env.JWT_PRIVATE_KEY);
    const publicKey = this.normalizeKey(this.getOptionalConfig('JWT_PUBLIC_KEY') ?? process.env.JWT_PUBLIC_KEY);

    if (this.isProduction && !(privateKey && publicKey)) {
      throw new Error('JWT RS256 key pair is required in production');
    }

    if (!rawSecret && !(privateKey && publicKey)) {
      throw new Error('JWT secret is required when RS256 keys are not configured');
    }

    this.accessSecret = rawSecret ?? '';
    this.jwtAlgorithm = privateKey && publicKey ? 'RS256' : 'HS256';
    this.accessSigningKey = privateKey ?? this.accessSecret;
    this.accessVerifyKey = publicKey ?? this.accessSecret;
    this.accessTtlSec = this.getConfigNumber('JWT_ACCESS_TTL_SEC', Number(process.env.JWT_ACCESS_TTL_SEC) || 3600);
    this.refreshTtlSec = this.getConfigNumber('JWT_REFRESH_TTL_SEC', Number(process.env.JWT_REFRESH_TTL_SEC) || 604800);
    this.tokenHashSecret = this.getRequiredConfig('TOKEN_HASH_SECRET');
    this.resetPasswordTtlMinutes = this.getConfigNumber(
      'RESET_PASSWORD_TTL_MINUTES',
      Number(process.env.RESET_PASSWORD_TTL_MINUTES) || 30,
    );
    this.emailVerificationTtlHours = this.getConfigNumber(
      'EMAIL_VERIFICATION_TTL_HOURS',
      Number(process.env.EMAIL_VERIFICATION_TTL_HOURS) || 24,
    );
  }

  async createGuestSession(meta: RequestMeta = {}) {
    const guestUser = await this.prisma.user.create({
      data: {
        email: this.generateGuestEmail(),
        passwordHash: await hashPassword(generateToken(24)),
        fullName: 'Guest Customer',
        role: UserRole.guest,
        emailVerifiedAt: new Date(),
      },
    });

    return this.issueTokens(guestUser, meta);
  }

  async login(
    email: string,
    password: string,
    otp?: string,
    meta: RequestMeta = {},
    guestAccessToken?: string,
  ) {
    const guestUserId = this.resolveGuestUserId(guestAccessToken);
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new ForbiddenException('Account temporarily locked');
    }

    const matches = await comparePassword(password, user.passwordHash);
    if (!matches) {
      await this.registerFailedLogin(user);
      throw new UnauthorizedException('Invalid email or password');
    }

    this.assertTwoFactorCode(user, otp);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    if (guestUserId) {
      await this.mergeGuestContext(guestUserId, updatedUser.id);
    }

    return this.issueTokens(updatedUser, meta);
  }

  async socialLogin(
    providerInput: string,
    providerUserId: string,
    email: string,
    fullName?: string,
    phone?: string,
    meta: RequestMeta = {},
    guestAccessToken?: string,
  ) {
    const guestUserId = this.resolveGuestUserId(guestAccessToken);
    const provider = this.parseSocialProvider(providerInput);
    const normalizedEmail = this.normalizeEmail(email);
    const account = await this.prisma.socialAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId,
        },
      },
      include: {
        user: true,
      },
    });

    if (account) {
      if (account.user.lockedUntil && account.user.lockedUntil.getTime() > Date.now()) {
        throw new ForbiddenException('Account temporarily locked');
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: account.userId },
        data: {
          lastLoginAt: new Date(),
          fullName: fullName ?? account.user.fullName,
          phone: phone ?? account.user.phone,
          emailVerifiedAt: account.user.emailVerifiedAt ?? new Date(),
        },
      });

      if (guestUserId) {
        await this.mergeGuestContext(guestUserId, updatedUser.id);
      }

      return {
        ...(await this.issueTokens(updatedUser, meta)),
        provider,
        linkedAccount: true,
      };
    }

    const { user, isNewAccount } = await this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
      });

      const userRecord =
        existingUser ??
        (await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash: await hashPassword(generateToken(24)),
            fullName: fullName || this.deriveSocialFullName(normalizedEmail),
            phone,
            role: UserRole.customer,
            emailVerifiedAt: new Date(),
          },
        }));

      await tx.socialAccount.create({
        data: {
          userId: userRecord.id,
          provider,
          providerUserId,
          email: normalizedEmail,
        },
      });

      if (!existingUser) {
        await tx.notification.create({
          data: {
            userId: userRecord.id,
            type: 'system',
            title: 'Welcome',
            content: `Your ${provider} account has been linked successfully.`,
          },
        });
      }

      return { user: userRecord, isNewAccount: !existingUser };
    });

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new ForbiddenException('Account temporarily locked');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      },
    });

    if (guestUserId) {
      await this.mergeGuestContext(guestUserId, updatedUser.id);
    }

    return {
      ...(await this.issueTokens(updatedUser, meta)),
      provider,
      linkedAccount: true,
      isNewAccount,
    };
  }

  async register(
    email: string,
    password: string,
    fullName: string,
    phone?: string,
    meta: RequestMeta = {},
    guestAccessToken?: string,
  ) {
    const guestUserId = this.resolveGuestUserId(guestAccessToken);
    const normalizedEmail = this.normalizeEmail(email);

    const exists = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (exists) {
      throw new BadRequestException('Email already exists');
    }

    const passwordHash = await hashPassword(password);
    const { user, verificationToken } = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          fullName,
          phone,
          role: UserRole.customer,
        },
      });

      await tx.notification.create({
        data: {
          userId: createdUser.id,
          type: 'system',
          title: 'Welcome',
          content: 'Your account has been created successfully.',
        },
      });

      const token = await this.createEmailVerificationToken(createdUser.id, tx);
      return { user: createdUser, verificationToken: token };
    });

    if (guestUserId) {
      await this.mergeGuestContext(guestUserId, user.id);
    }

    const auth = await this.issueTokens(user, meta);

    return {
      ...auth,
      verificationRequired: true,
      debug: this.exposeDebugToken('verificationToken', verificationToken),
    };
  }

  async refresh(
    refreshToken: string,
    meta: RequestMeta = {},
    options: { requireCsrf?: boolean; csrfToken?: string } = {},
  ) {
    await this.deleteExpiredSessions();
    this.assertRefreshToken(refreshToken, options);

    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
    });

    if (!session || session.expiresAt.getTime() < Date.now()) {
      if (session) {
        await this.prisma.refreshSession.delete({ where: { id: session.id } });
      }

      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      await this.prisma.refreshSession.delete({ where: { id: session.id } });
      throw new UnauthorizedException('User not found');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new ForbiddenException('Account temporarily locked');
    }

    await this.prisma.refreshSession.delete({ where: { id: session.id } });
    return this.issueTokens(user, meta);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.toPublicUser(user);
  }

  async logout(
    refreshToken?: string,
    userId?: string,
    options: { requireCsrf?: boolean; csrfToken?: string } = {},
  ) {
    if (refreshToken) {
      this.assertRefreshToken(refreshToken, options);
      await this.prisma.refreshSession.deleteMany({
        where: {
          tokenHash: this.hashToken(refreshToken),
          ...(userId ? { userId } : {}),
        },
      });

      return { success: true };
    }

    if (userId) {
      await this.prisma.refreshSession.deleteMany({ where: { userId } });
    }

    return { success: true };
  }

  async listSessions(userId: string) {
    const sessions = await this.prisma.refreshSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: sessions.map((session) => ({
        id: session.id,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        expiresAt: session.expiresAt,
      })),
    };
  }

  async revokeSession(sessionId: string, actorUserId: string) {
    const deleted = await this.prisma.refreshSession.deleteMany({
      where: {
        id: sessionId,
        userId: actorUserId,
      },
    });

    return { success: deleted.count > 0 };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
    });

    if (!user) {
      return { success: true };
    }

    await this.deleteExpiredResetTokens();
    const token = await this.createPasswordResetToken(user.id);

    return {
      success: true,
      debug: this.exposeDebugToken('resetToken', token),
    };
  }

  async resetPassword(token: string, password: string) {
    await this.deleteExpiredResetTokens();

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });

    if (!record || record.consumedAt || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Reset token invalid or expired');
    }

    const passwordHash = await hashPassword(password);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });

      await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      await tx.refreshSession.deleteMany({ where: { userId: record.userId } });
    });

    return { success: true };
  }

  async requestEmailVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.emailVerifiedAt) {
      return { success: true, alreadyVerified: true };
    }

    await this.deleteExpiredVerificationTokens();
    const token = await this.createEmailVerificationToken(userId);

    return {
      success: true,
      debug: this.exposeDebugToken('verificationToken', token),
    };
  }

  async enableTwoFactor(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabledAt: null,
      },
    });

    return {
      success: true,
      enabled: false,
      secret,
      otpauthUrl: buildOtpAuthUrl(this.twoFactorIssuer, user.email, secret),
      debug: this.isProduction ? undefined : { currentCode: generateTotpCode(secret) },
    };
  }

  async verifyTwoFactor(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.twoFactorSecret) {
      throw new UnauthorizedException('Two-factor setup not found');
    }

    if (!verifyTotpCode(user.twoFactorSecret, code)) {
      throw new UnauthorizedException('Invalid two-factor code');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: user.twoFactorEnabledAt ? {} : { twoFactorEnabledAt: new Date() },
    });

    return {
      success: true,
      enabled: Boolean(updatedUser.twoFactorEnabledAt),
    };
  }

  async listApiKeys(userId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: keys.map((apiKey) => this.toApiKeySummary(apiKey)),
    };
  }

  async createApiKey(userId: string, name: string, requestedPermissions?: Permission[], expiresAtInput?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const permissions = this.resolveApiKeyPermissions(user.role as DomainUserRole, requestedPermissions);
    const expiresAt = this.parseApiKeyExpiration(expiresAtInput);
    const token = `bhk_${generateToken(40)}`;
    const created = await this.prisma.apiKey.create({
      data: {
        userId,
        name: name.trim(),
        keyPrefix: token.slice(0, 12),
        keyHash: this.hashToken(token),
        permissions,
        expiresAt,
      },
    });

    return {
      ...this.toApiKeySummary(created),
      token,
    };
  }

  async revokeApiKey(apiKeyId: string, userId: string) {
    const revoked = await this.prisma.apiKey.updateMany({
      where: {
        id: apiKeyId,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { success: revoked.count > 0 };
  }

  async verifyEmail(token: string) {
    await this.deleteExpiredVerificationTokens();

    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });

    if (!record || record.consumedAt || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Verification token invalid or expired');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });

      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      });
    });

    return { success: true };
  }

  async authenticateApiKey(token: string): Promise<JwtUserPayload> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash: this.hashToken(token) },
      include: { user: true },
    });

    if (!apiKey || apiKey.revokedAt || (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now())) {
      throw new UnauthorizedException('API key invalid or expired');
    }

    if (apiKey.user.lockedUntil && apiKey.user.lockedUntil.getTime() > Date.now()) {
      throw new ForbiddenException('Account temporarily locked');
    }

    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      sub: apiKey.user.id,
      role: apiKey.user.role as DomainUserRole,
      email: apiKey.user.email,
      permissions: apiKey.permissions as Permission[],
      authType: 'api_key',
      apiKeyId: apiKey.id,
    };
  }

  verifyAccessToken(token: string): JwtUserPayload {
    const payload = jwt.verify(token, this.accessVerifyKey, {
      algorithms: [this.jwtAlgorithm],
    }) as JwtUserPayload;

    if (!payload?.sub || !payload?.email || !payload?.role) {
      throw new UnauthorizedException('Token invalid');
    }

    return payload;
  }

  createCsrfToken(refreshToken: string) {
    return hashOpaqueToken(refreshToken, `${this.tokenHashSecret}:csrf`);
  }

  getRefreshCookieMaxAgeMs() {
    return this.refreshTtlSec * 1000;
  }

  private async issueTokens(user: User, meta: RequestMeta) {
    const accessToken = jwt.sign(
      {
        sub: user.id,
        role: user.role as DomainUserRole,
        email: user.email,
      },
      this.accessSigningKey,
      {
        algorithm: this.jwtAlgorithm,
        expiresIn: this.accessTtlSec,
      },
    );

    const refreshToken = generateToken(48);

    const session = await this.prisma.refreshSession.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId: user.id,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: new Date(Date.now() + this.refreshTtlSec * 1000),
        lastUsedAt: new Date(),
      },
    });

    return {
      accessToken,
      refreshToken,
      csrfToken: this.createCsrfToken(refreshToken),
      expiresIn: this.accessTtlSec,
      sessionId: session.id,
      user: this.toPublicUser(user),
    };
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      phone: user.phone,
      emailVerifiedAt: user.emailVerifiedAt,
      twoFactorEnabledAt: user.twoFactorEnabledAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  private toApiKeySummary(apiKey: ApiKey) {
    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      permissions: apiKey.permissions as Permission[],
      lastUsedAt: apiKey.lastUsedAt,
      expiresAt: apiKey.expiresAt,
      revokedAt: apiKey.revokedAt,
      createdAt: apiKey.createdAt,
    };
  }

  private async registerFailedLogin(user: User) {
    const attempts = user.failedLoginAttempts + 1;
    const lockedUntil =
      attempts >= this.maxFailedLoginAttempts
        ? new Date(Date.now() + this.lockoutMinutes * 60 * 1000)
        : null;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts >= this.maxFailedLoginAttempts ? 0 : attempts,
        lockedUntil,
      },
    });
  }

  private async createPasswordResetToken(
    userId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const rawToken = generateToken(24);
    await tx.passwordResetToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(Date.now() + this.resetPasswordTtlMinutes * 60 * 1000),
      },
    });

    return rawToken;
  }

  private async createEmailVerificationToken(
    userId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const rawToken = generateToken(24);
    await tx.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(Date.now() + this.emailVerificationTtlHours * 60 * 60 * 1000),
      },
    });

    return rawToken;
  }

  private async deleteExpiredSessions() {
    await this.prisma.refreshSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }

  private async deleteExpiredResetTokens() {
    await this.prisma.passwordResetToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }

  private async deleteExpiredVerificationTokens() {
    await this.prisma.emailVerificationToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private resolveGuestUserId(guestAccessToken?: string) {
    if (!guestAccessToken) {
      return undefined;
    }

    try {
      const payload = this.verifyAccessToken(guestAccessToken);
      if (payload.role !== 'guest') {
        throw new UnauthorizedException('Guest session invalid');
      }

      return payload.sub;
    } catch {
      throw new UnauthorizedException('Guest session invalid');
    }
  }

  private async mergeGuestContext(guestUserId: string, targetUserId: string) {
    if (guestUserId === targetUserId) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const [guestUser, targetUser] = await Promise.all([
        tx.user.findUnique({ where: { id: guestUserId } }),
        tx.user.findUnique({ where: { id: targetUserId } }),
      ]);

      if (!guestUser || guestUser.role !== UserRole.guest) {
        throw new UnauthorizedException('Guest session invalid');
      }

      if (!targetUser) {
        throw new UnauthorizedException('User not found');
      }

      await this.mergeGuestCartItems(tx, guestUserId, targetUserId);
      await this.mergeGuestCoupon(tx, guestUserId, targetUserId);
      await this.mergeGuestWishlist(tx, guestUserId, targetUserId);

      await Promise.all([
        tx.inventoryReservation.updateMany({
          where: { userId: guestUserId },
          data: { userId: targetUserId },
        }),
        tx.order.updateMany({
          where: { userId: guestUserId },
          data: { userId: targetUserId },
        }),
        tx.address.updateMany({
          where: { userId: guestUserId },
          data: { userId: targetUserId },
        }),
        tx.notification.updateMany({
          where: { userId: guestUserId },
          data: { userId: targetUserId },
        }),
        tx.refreshSession.deleteMany({
          where: { userId: guestUserId },
        }),
      ]);
    });
  }

  private async mergeGuestCartItems(
    tx: Prisma.TransactionClient,
    guestUserId: string,
    targetUserId: string,
  ) {
    const guestItems = await tx.cartItem.findMany({
      where: { userId: guestUserId },
      include: {
        product: {
          select: {
            stock: true,
            status: true,
          },
        },
        variant: {
          select: {
            stock: true,
            isActive: true,
          },
        },
      },
    });

    for (const item of guestItems) {
      if (item.product.status !== 'active' || !item.variant || !item.variant.isActive) {
        continue;
      }

      const existing = await tx.cartItem.findFirst({
        where: {
          userId: targetUserId,
          productId: item.productId,
          variantId: item.variantId,
        },
      });

      const existingQuantity = existing?.quantity ?? 0;
      const transferableQuantity = Math.min(
        item.quantity,
        Math.max(0, item.variant.stock - existingQuantity),
      );

      if (transferableQuantity <= 0) {
        continue;
      }

      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: existingQuantity + transferableQuantity },
        });
        continue;
      }

      await tx.cartItem.create({
        data: {
          userId: targetUserId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: transferableQuantity,
        },
      });
    }

    await tx.cartItem.deleteMany({ where: { userId: guestUserId } });
  }

  private async mergeGuestCoupon(
    tx: Prisma.TransactionClient,
    guestUserId: string,
    targetUserId: string,
  ) {
    const [guestCoupon, targetCoupon] = await Promise.all([
      tx.cartCoupon.findUnique({ where: { userId: guestUserId } }),
      tx.cartCoupon.findUnique({ where: { userId: targetUserId } }),
    ]);

    if (guestCoupon && !targetCoupon) {
      await tx.cartCoupon.upsert({
        where: { userId: targetUserId },
        create: {
          userId: targetUserId,
          couponId: guestCoupon.couponId,
        },
        update: {
          couponId: guestCoupon.couponId,
          appliedAt: new Date(),
        },
      });
    }

    await tx.cartCoupon.deleteMany({
      where: { userId: guestUserId },
    });
  }

  private async mergeGuestWishlist(
    tx: Prisma.TransactionClient,
    guestUserId: string,
    targetUserId: string,
  ) {
    const guestWishlistItems = await tx.wishlistItem.findMany({
      where: { userId: guestUserId },
    });

    for (const item of guestWishlistItems) {
      await tx.wishlistItem.upsert({
        where: {
          userId_productId: {
            userId: targetUserId,
            productId: item.productId,
          },
        },
        create: {
          userId: targetUserId,
          productId: item.productId,
        },
        update: {},
      });
    }

    await tx.wishlistItem.deleteMany({
      where: { userId: guestUserId },
    });
  }

  private generateGuestEmail() {
    return `guest+${generateToken(12).toLowerCase()}@guest.banhang.local`;
  }

  private resolveApiKeyPermissions(role: DomainUserRole, requestedPermissions?: Permission[]) {
    const allowedPermissions = ROLE_PERMISSIONS[role] ?? [];

    if (!requestedPermissions?.length) {
      return [...allowedPermissions];
    }

    const denied = requestedPermissions.find((permission) => !allowedPermissions.includes(permission));
    if (denied) {
      throw new ForbiddenException(`Permission not allowed for API key: ${denied}`);
    }

    return [...new Set(requestedPermissions)];
  }

  private parseApiKeyExpiration(value?: string) {
    if (!value) {
      return null;
    }

    const expiresAt = new Date(value);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Invalid API key expiration date');
    }

    if (expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('API key expiration must be in the future');
    }

    return expiresAt;
  }

  private deriveSocialFullName(email: string) {
    return email.split('@')[0].replace(/[._-]+/g, ' ').trim() || 'Social User';
  }

  private assertTwoFactorCode(user: User, otp?: string) {
    if (!user.twoFactorSecret || !user.twoFactorEnabledAt) {
      return;
    }

    if (!otp) {
      throw new UnauthorizedException('Two-factor code required');
    }

    if (!verifyTotpCode(user.twoFactorSecret, otp)) {
      throw new UnauthorizedException('Invalid two-factor code');
    }
  }

  private parseSocialProvider(providerInput: string): AuthProvider {
    const provider = providerInput.toLowerCase() as AuthProvider;
    if (!this.supportedSocialProviders.has(provider)) {
      throw new BadRequestException('Unsupported social provider');
    }

    return provider;
  }

  private hashToken(token: string) {
    return hashOpaqueToken(token, this.tokenHashSecret);
  }

  private exposeDebugToken(
    key: 'verificationToken' | 'resetToken',
    value: string,
  ): Record<string, string> | undefined {
    if (this.isProduction) {
      return undefined;
    }

    return { [key]: value };
  }

  private getConfig<K extends keyof AppEnv>(key: K, fallback: AppEnv[K]) {
    return this.config?.get(key, { infer: true }) ?? fallback;
  }

  private getOptionalConfig<K extends keyof AppEnv>(key: K) {
    return this.config?.get(key, { infer: true });
  }

  private getConfigNumber<K extends keyof AppEnv>(key: K, fallback: number) {
    return Number(this.config?.get(key, { infer: true }) ?? fallback);
  }

  private getRequiredConfig<K extends keyof AppEnv>(key: K) {
    const configured = this.config?.get(key, { infer: true });
    if (configured !== undefined && configured !== null && `${configured}`.trim().length > 0) {
      return configured;
    }

    const value = process.env[key];
    if (!value || !value.trim()) {
      throw new Error(`Missing environment variable ${key}`);
    }

    return value as AppEnv[K];
  }

  private assertRefreshToken(
    refreshToken: string | undefined,
    options: { requireCsrf?: boolean; csrfToken?: string },
  ) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    if (!options.requireCsrf) {
      return;
    }

    const expected = this.createCsrfToken(refreshToken);
    if (!options.csrfToken || options.csrfToken !== expected) {
      throw new UnauthorizedException('CSRF token invalid');
    }
  }

  private normalizeKey(value?: string) {
    if (!value) {
      return undefined;
    }

    return value.replace(/\\n/g, '\n');
  }
}
