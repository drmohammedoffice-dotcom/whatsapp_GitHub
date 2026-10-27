import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@watsapp/database';
import { ADMIN_ROLES_KEY } from '../decorators/require-admin-roles.decorator';
import { AdminPrincipal } from '../types/admin-principal';

@Injectable()
export class AdminRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AdminRole[]>(ADMIN_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const admin = context.switchToHttp().getRequest<{ admin: AdminPrincipal }>().admin;
    if (!admin) throw new ForbiddenException('Admin context missing');
    if (admin.role === AdminRole.SUPER_ADMIN || admin.roles?.includes(AdminRole.SUPER_ADMIN)) return true;
    const effective = admin.roles?.length ? admin.roles : [admin.role];
    if (required.some((r) => effective.includes(r))) return true;
    throw new ForbiddenException('Insufficient admin permissions');
  }
}
