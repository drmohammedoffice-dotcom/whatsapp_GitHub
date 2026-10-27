import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { WebmailJwtPayload } from './webmail.service';

export const CurrentWebmail = createParamDecorator((_data: unknown, ctx: ExecutionContext): WebmailJwtPayload => {
  const request = ctx.switchToHttp().getRequest<{ webmail: WebmailJwtPayload }>();
  return request.webmail;
});
