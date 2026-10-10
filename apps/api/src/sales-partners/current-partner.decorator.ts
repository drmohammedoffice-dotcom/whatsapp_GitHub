import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentPartnerId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<{ partner?: { id: string } }>();
  return request.partner?.id as string;
});
