import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../modules/auth/auth.service';
import { RequestWithUser } from './interfaces/request-with-user.interface';

@Injectable()
export class AuthOrApiKeyGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = request.headers.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : undefined;

    if (bearerToken) {
      try {
        request.user = this.authService.verifyAccessToken(bearerToken);
        return true;
      } catch {
        // Fall back to API key auth if one is present.
      }
    }

    const apiKeyHeader = request.headers['x-api-key'];
    const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
    if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
      request.user = await this.authService.authenticateApiKey(apiKey.trim());
      return true;
    }

    if (bearerToken || authHeader) {
      throw new UnauthorizedException('Token invalid or expired');
    }

    throw new UnauthorizedException('Missing authentication');
  }
}
