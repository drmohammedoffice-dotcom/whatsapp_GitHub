import { Permission, TeamRole } from '@watsapp/database';

export interface AuthenticatedPrincipal {
  userId?: string;
  teamId: string;
  role?: TeamRole;
  permissions?: Permission[];
  apiKeyId?: string;
  scopes?: string[];
}

export interface RequestWithPrincipal extends Request {
  principal?: AuthenticatedPrincipal;
}
