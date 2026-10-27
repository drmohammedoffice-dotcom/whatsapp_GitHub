import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { WebmailJwtPayload } from './webmail.service';

@Injectable()
export class WebmailAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      webmail?: WebmailJwtPayload;
    }>();
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('تسجيل الدخول مطلوب');

    try {
      const payload = await this.jwt.verifyAsync<WebmailJwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      if (payload.scope !== 'webmail' || !payload.sub || !payload.email) {
        throw new UnauthorizedException('رمز غير صالح');
      }
      request.webmail = payload;
      return true;
    } catch {
      throw new UnauthorizedException('انتهت الجلسة أو الرمز غير صالح');
    }
  }
}
