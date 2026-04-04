import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../common/jwt.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: LoginDto, @Req() request: RequestWithUser) {
    return this.authService.login(body.email, body.password, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('register')
  register(@Body() body: RegisterDto, @Req() request: RequestWithUser) {
    return this.authService.register(body.email, body.password, body.fullName, body.phone, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('refresh')
  refresh(@Body() body: RefreshDto, @Req() request: RequestWithUser) {
    return this.authService.refresh(body.refreshToken, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
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
  logout(@Req() request: RequestWithUser, @Body() body: LogoutDto) {
    return this.authService.logout(body.refreshToken, request.user!.sub);
  }
}
