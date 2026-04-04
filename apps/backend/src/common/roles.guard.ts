import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasRole } from './authz';
import { ROLES_KEY } from './decorators/roles.decorator';
import { RequestWithUser } from './interfaces/request-with-user.interface';
import { UserRole } from './types/domain';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new UnauthorizedException('Unauthorized');
    }

    const allowed = requiredRoles.some((role) => hasRole(request.user!.role, role));
    if (!allowed) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
