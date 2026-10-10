import { AdminRole } from '@watsapp/database';

export type AdminJwtPayload = {
  sub: string;
  adminUserId: string;
  role: AdminRole;
  scope: 'admin';
};

export type AdminPrincipal = {
  userId: string;
  adminUserId: string;
  role: AdminRole;
  email: string;
  name: string;
};
