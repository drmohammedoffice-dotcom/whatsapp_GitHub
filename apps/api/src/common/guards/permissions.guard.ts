import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, TeamRole } from '@watsapp/database';
import { RequestWithPrincipal } from '../principal';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

const OWNER_ADMIN_BYPASS = new Set<TeamRole>([TeamRole.OWNER, TeamRole.ADMIN]);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) ?? [];
    if (!required.length) return true;

    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const principal = request.principal;
    if (!principal) throw new ForbiddenException('Missing principal');
    if (principal.role && OWNER_ADMIN_BYPASS.has(principal.role)) return true;

    const granted = new Set(principal.permissions ?? []);
    if (required.every((permission) => granted.has(permission))) return true;
    throw new ForbiddenException('Insufficient permissions');
  }
}
