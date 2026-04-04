import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../modules/auth/auth.service';
import { RequestWithUser } from './interfaces/request-with-user.interface';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const auth = request.headers.authorization;

    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const accessToken = auth.slice(7);

    try {
      request.user = this.authService.verifyAccessToken(accessToken);
      return true;
    } catch {
      throw new UnauthorizedException('Token invalid or expired');
    }
  }
}
