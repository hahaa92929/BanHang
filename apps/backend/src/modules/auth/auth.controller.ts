import { Body, Controller, Delete, Get, Param, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtGuard } from '../../common/jwt.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { AuthService } from './auth.service';
import { CSRF_COOKIE_NAME, REFRESH_COOKIE_NAME } from './auth.cookies';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { VerifyTwoFactorDto } from './dto/verify-2fa.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('guest')
  async guest(@Req() request: RequestWithUser, @Res({ passthrough: true }) response: Response) {
    const auth = await this.authService.createGuestSession({
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    this.setAuthCookies(response, request, auth.refreshToken, auth.csrfToken);
    return auth;
  }

  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const auth = await this.authService.login(
      body.email,
      body.password,
      body.otp,
      {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
      body.guestAccessToken,
    );

    this.setAuthCookies(response, request, auth.refreshToken, auth.csrfToken);
    return auth;
  }

  @Post('social/:provider')
  async socialLogin(
    @Param('provider') provider: string,
    @Body() body: SocialLoginDto,
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const auth = await this.authService.socialLogin(
      provider,
      body.providerUserId,
      body.email,
      body.fullName,
      body.phone,
      {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
      body.guestAccessToken,
    );

    this.setAuthCookies(response, request, auth.refreshToken, auth.csrfToken);
    return auth;
  }

  @Post('register')
  async register(
    @Body() body: RegisterDto,
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const auth = await this.authService.register(
      body.email,
      body.password,
      body.fullName,
      body.phone,
      {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
      body.guestAccessToken,
    );

    this.setAuthCookies(response, request, auth.refreshToken, auth.csrfToken);
    return auth;
  }

  @Post('refresh')
  async refresh(
    @Body() body: RefreshDto,
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = body.refreshToken ?? this.readCookie(request, REFRESH_COOKIE_NAME);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    const auth = await this.authService.refresh(
      refreshToken,
      {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
      {
        requireCsrf: !body.refreshToken,
        csrfToken: this.resolveCsrfHeader(request),
      },
    );

    this.setAuthCookies(response, request, auth.refreshToken, auth.csrfToken);
    return auth;
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.token, body.password);
  }

  @Post('verify-email')
  verifyEmail(@Body() body: VerifyEmailDto) {
    return this.authService.verifyEmail(body.token);
  }

  @UseGuards(JwtGuard)
  @Post('request-email-verification')
  requestEmailVerification(@Req() request: RequestWithUser) {
    return this.authService.requestEmailVerification(request.user!.sub);
  }

  @UseGuards(JwtGuard)
  @Post('2fa/enable')
  enableTwoFactor(@Req() request: RequestWithUser) {
    return this.authService.enableTwoFactor(request.user!.sub);
  }

  @UseGuards(JwtGuard)
  @Post('2fa/verify')
  verifyTwoFactor(@Req() request: RequestWithUser, @Body() body: VerifyTwoFactorDto) {
    return this.authService.verifyTwoFactor(request.user!.sub, body.code);
  }

  @UseGuards(JwtGuard)
  @Get('api-keys')
  apiKeys(@Req() request: RequestWithUser) {
    return this.authService.listApiKeys(request.user!.sub);
  }

  @UseGuards(JwtGuard)
  @Post('api-keys')
  createApiKey(@Req() request: RequestWithUser, @Body() body: CreateApiKeyDto) {
    return this.authService.createApiKey(request.user!.sub, body.name, body.permissions, body.expiresAt);
  }

  @UseGuards(JwtGuard)
  @Delete('api-keys/:id')
  revokeApiKey(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.authService.revokeApiKey(id, request.user!.sub);
  }

  @UseGuards(JwtGuard)
  @Get('me')
  me(@Req() request: RequestWithUser) {
    return this.authService.me(request.user!.sub);
  }

  @UseGuards(JwtGuard)
  @Get('sessions')
  sessions(@Req() request: RequestWithUser) {
    return this.authService.listSessions(request.user!.sub);
  }

  @UseGuards(JwtGuard)
  @Delete('sessions/:id')
  revokeSession(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.authService.revokeSession(id, request.user!.sub);
  }

  @UseGuards(JwtGuard)
  @Post('logout')
  async logout(
    @Req() request: RequestWithUser,
    @Body() body: LogoutDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(
      body.refreshToken ?? this.readCookie(request, REFRESH_COOKIE_NAME),
      request.user!.sub,
      {
        requireCsrf: !body.refreshToken && !!this.readCookie(request, REFRESH_COOKIE_NAME),
        csrfToken: this.resolveCsrfHeader(request),
      },
    );
    this.clearAuthCookies(response, request);
    return { success: true };
  }

  private setAuthCookies(
    response: Response,
    request: RequestWithUser,
    refreshToken: string,
    csrfToken: string,
  ) {
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: this.isSecureRequest(request),
      sameSite: 'lax',
      maxAge: this.authService.getRefreshCookieMaxAgeMs(),
      path: '/api/v1/auth',
    });
    response.cookie(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      secure: this.isSecureRequest(request),
      sameSite: 'lax',
      maxAge: this.authService.getRefreshCookieMaxAgeMs(),
      path: '/api/v1/auth',
    });
  }

  private clearAuthCookies(response: Response, request: RequestWithUser) {
    const options = {
      secure: this.isSecureRequest(request),
      sameSite: 'lax' as const,
      path: '/api/v1/auth',
    };

    response.clearCookie(REFRESH_COOKIE_NAME, {
      ...options,
      httpOnly: true,
    });
    response.clearCookie(CSRF_COOKIE_NAME, {
      ...options,
      httpOnly: false,
    });
  }

  private resolveCsrfHeader(request: RequestWithUser) {
    const candidate = request.headers['x-csrf-token'] ?? request.headers['x-xsrf-token'];
    return Array.isArray(candidate) ? candidate[0] : candidate;
  }

  private readCookie(request: RequestWithUser, name: string) {
    const header = request.headers.cookie;
    if (typeof header !== 'string') {
      return undefined;
    }

    for (const chunk of header.split(';')) {
      const [rawName, ...valueParts] = chunk.trim().split('=');
      if (rawName === name) {
        return decodeURIComponent(valueParts.join('='));
      }
    }

    return undefined;
  }

  private isSecureRequest(request: RequestWithUser) {
    if (request.secure) {
      return true;
    }

    const forwarded = request.headers['x-forwarded-proto'];
    const protocol = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return protocol === 'https';
  }
}
