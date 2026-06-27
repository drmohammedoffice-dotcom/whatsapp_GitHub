import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { RequestWithPrincipal } from '../common/principal';
import { PrismaService } from '../prisma/prisma.service';

interface AccessPayload {
  sub: string;
  teamId: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & RequestWithPrincipal>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      const membership = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: payload.teamId, userId: payload.sub } },
      });
      if (!membership) throw new UnauthorizedException('User is not a member of this team');
      request.principal = { userId: payload.sub, teamId: payload.teamId, role: membership.role, permissions: membership.permissions };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid bearer token');
    }
  }

  private extractToken(request: Request) {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
