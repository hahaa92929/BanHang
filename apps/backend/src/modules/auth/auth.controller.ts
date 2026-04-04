import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../common/jwt.guard';
import { RequestWithUser } from '../../common/interfaces/request-with-user.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body.email, body.password, body.fullName);
  }

  @Post('refresh')
  refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @UseGuards(JwtGuard)
  @Get('me')
  me(@Req() request: RequestWithUser) {
    return this.authService.me(request.user.sub);
  }

  @UseGuards(JwtGuard)
  @Post('logout')
  logout(@Req() request: RequestWithUser, @Body() body: LogoutDto) {
    return this.authService.logout(body.refreshToken, request.user.sub);
  }
}
