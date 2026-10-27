import { AdminRole } from '@watsapp/database';

export type AdminJwtPayload = {
  sub: string;
  adminUserId: string;
  role: AdminRole;
  roles?: AdminRole[];
  scope: 'admin';
};

export type AdminPrincipal = {
  userId: string;
  adminUserId: string;
  role: AdminRole;
  /** كل الأدوار المفعّلة (للموظفين متعددي الوظائف) */
  roles: AdminRole[];
  email: string;
  name: string;
};
