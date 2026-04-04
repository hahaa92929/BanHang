import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { comparePassword, generateToken, hashPassword } from '../../common/security';
import { JwtUserPayload } from '../../common/types/domain';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly accessSecret = process.env.JWT_SECRET || 'dev-secret-change-in-prod';
  private readonly accessTtlSec = this.parseDuration(process.env.JWT_ACCESS_TTL_SEC, 3600);
  private readonly refreshTtlSec = this.parseDuration(process.env.JWT_REFRESH_TTL_SEC, 604800);

  constructor(private readonly prisma: PrismaService) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !comparePassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokens(user);
  }

  async register(email: string, password: string, fullName: string) {
    const normalizedEmail = email.toLowerCase();

    const exists = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (exists) {
      throw new BadRequestException('Email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: hashPassword(password),
        fullName,
        role: UserRole.customer,
      },
    });

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    await this.prisma.refreshSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    const session = await this.prisma.refreshSession.findUnique({
      where: { token: refreshToken },
    });

    if (!session || session.expiresAt.getTime() < Date.now()) {
      if (session) {
        await this.prisma.refreshSession.delete({ where: { token: refreshToken } });
      }

      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });

    if (!user) {
      await this.prisma.refreshSession.delete({ where: { token: refreshToken } });
      throw new UnauthorizedException('User not found');
    }

    await this.prisma.refreshSession.delete({ where: { token: refreshToken } });
    return this.issueTokens(user);
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
        where: { token: refreshToken },
      });

      return { success: true };
    }

    if (userId) {
      await this.prisma.refreshSession.deleteMany({ where: { userId } });
    }

    return { success: true };
  }

  verifyAccessToken(token: string): JwtUserPayload {
    const payload = jwt.verify(token, this.accessSecret) as JwtUserPayload;

    if (!payload?.sub || !payload?.email || !payload?.role) {
      throw new UnauthorizedException('Token invalid');
    }

    return payload;
  }

  private async issueTokens(user: User) {
    const accessToken = jwt.sign(
      {
        sub: user.id,
        role: user.role,
        email: user.email,
      },
      this.accessSecret,
      { expiresIn: this.accessTtlSec },
    );

    const refreshToken = generateToken(24);

    await this.prisma.refreshSession.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + this.refreshTtlSec * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTtlSec,
      user: this.toPublicUser(user),
    };
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      createdAt: user.createdAt,
    };
  }

  private parseDuration(rawValue: string | undefined, fallback: number): number {
    const value = Number(rawValue);

    if (Number.isFinite(value) && value > 0) {
      return value;
    }

    return fallback;
  }
}
