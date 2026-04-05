import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasPermission } from './authz';
import { PERMISSIONS_KEY } from './decorators/permissions.decorator';
import { RequestWithUser } from './interfaces/request-with-user.interface';
import { Permission } from './types/domain';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new UnauthorizedException('Unauthorized');
    }

    const effectivePermissions = request.user.permissions;
    const denied = requiredPermissions.find(
      (permission) =>
        effectivePermissions ? !effectivePermissions.includes(permission) : !hasPermission(request.user!.role, permission),
    );

    if (denied) {
      throw new ForbiddenException(`Missing permission: ${denied}`);
    }

    return true;
  }
}
