import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminPrincipal } from '../types/admin-principal';

export const CurrentAdmin = createParamDecorator((_data: unknown, ctx: ExecutionContext): AdminPrincipal => {
  const request = ctx.switchToHttp().getRequest<{ admin: AdminPrincipal }>();
  return request.admin;
});
