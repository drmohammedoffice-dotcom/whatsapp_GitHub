import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithPrincipal } from './principal';

export const CurrentPrincipal = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
  return request.principal;
});
