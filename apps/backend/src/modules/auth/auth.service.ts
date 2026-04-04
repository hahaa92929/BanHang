import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, User, UserRole } from '@prisma/client';
import jwt from 'jsonwebtoken';
import {
  comparePassword,
  generateToken,
  hashOpaqueToken,
  hashPassword,
} from '../../common/security';
import { JwtUserPayload, UserRole as DomainUserRole } from '../../common/types/domain';
import { AppEnv } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';

type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly accessTtlSec: number;
  private readonly refreshTtlSec: number;
  private readonly tokenHashSecret: string;
  private readonly resetPasswordTtlMinutes: number;
  private readonly emailVerificationTtlHours: number;
  private readonly isProduction: boolean;
  private readonly maxFailedLoginAttempts = 5;
  private readonly lockoutMinutes = 15;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService<AppEnv, true>,
  ) {
    this.accessSecret = this.getConfig('JWT_SECRET', process.env.JWT_SECRET || 'test-jwt-secret-12345678901234567890');
    this.accessTtlSec = this.getConfigNumber('JWT_ACCESS_TTL_SEC', Number(process.env.JWT_ACCESS_TTL_SEC) || 3600);
    this.refreshTtlSec = this.getConfigNumber('JWT_REFRESH_TTL_SEC', Number(process.env.JWT_REFRESH_TTL_SEC) || 604800);
    this.tokenHashSecret = this.getConfig(
      'TOKEN_HASH_SECRET',
      process.env.TOKEN_HASH_SECRET || 'test-token-hash-secret-12345678901234567890',
    );
    this.resetPasswordTtlMinutes = this.getConfigNumber(
      'RESET_PASSWORD_TTL_MINUTES',
      Number(process.env.RESET_PASSWORD_TTL_MINUTES) || 30,
    );
    this.emailVerificationTtlHours = this.getConfigNumber(
      'EMAIL_VERIFICATION_TTL_HOURS',
      Number(process.env.EMAIL_VERIFICATION_TTL_HOURS) || 24,
    );
    this.isProduction = this.getConfig('NODE_ENV', process.env.NODE_ENV || 'test') === 'production';
  }

  async login(email: string, password: string, meta: RequestMeta = {}) {
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

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    return this.issueTokens(updatedUser, meta);
  }

  async register(email: string, password: string, fullName: string, phone?: string, meta: RequestMeta = {}) {
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

    const auth = await this.issueTokens(user, meta);

    return {
      ...auth,
      verificationRequired: true,
      debug: this.exposeDebugToken('verificationToken', verificationToken),
    };
  }

  async refresh(refreshToken: string, meta: RequestMeta = {}) {
    await this.deleteExpiredSessions();

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

  async logout(refreshToken?: string, userId?: string) {
    if (refreshToken) {
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

  verifyAccessToken(token: string): JwtUserPayload {
    const payload = jwt.verify(token, this.accessSecret) as JwtUserPayload;

    if (!payload?.sub || !payload?.email || !payload?.role) {
      throw new UnauthorizedException('Token invalid');
    }

    return payload;
  }

  private async issueTokens(user: User, meta: RequestMeta) {
    const accessToken = jwt.sign(
      {
        sub: user.id,
        role: user.role as DomainUserRole,
        email: user.email,
      },
      this.accessSecret,
      { expiresIn: this.accessTtlSec },
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
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
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

  private getConfigNumber<K extends keyof AppEnv>(key: K, fallback: number) {
    return Number(this.config?.get(key, { infer: true }) ?? fallback);
  }
}
