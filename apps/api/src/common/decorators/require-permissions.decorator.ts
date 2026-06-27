import { SetMetadata } from '@nestjs/common';
import { Permission } from '@watsapp/database';

export const REQUIRED_PERMISSIONS_KEY = 'required_permissions';
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
