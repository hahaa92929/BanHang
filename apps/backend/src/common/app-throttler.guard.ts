import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RequestWithUser } from './interfaces/request-with-user.interface';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(request: RequestWithUser): Promise<string> {
    const authHeader = request.headers.authorization ?? 'anonymous';
    const userKey = request.user?.sub ?? authHeader;
    return `${request.ip}:${userKey}`;
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.path?.endsWith('/health') ?? false;
  }
}
