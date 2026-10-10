import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '@watsapp/database';

export const ADMIN_ROLES_KEY = 'admin_roles';
export const RequireAdminRoles = (...roles: AdminRole[]) => SetMetadata(ADMIN_ROLES_KEY, roles);
