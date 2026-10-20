import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveAdminRoles } from '../staff-roles';
import { AdminJwtPayload, AdminPrincipal } from '../types/admin-principal';

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      admin?: AdminPrincipal;
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Admin authentication required');

    let payload: AdminJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<AdminJwtPayload>(header.slice(7), {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid admin token');
    }

    if (payload.scope !== 'admin' || !payload.adminUserId) {
      throw new UnauthorizedException('Invalid admin token scope');
    }

    const adminUser = await this.prisma.adminUser.findUnique({
      where: { id: payload.adminUserId },
      include: { user: true },
    });
    if (!adminUser?.isActive || !adminUser.user) {
      throw new UnauthorizedException('Admin account is inactive');
    }

    request.admin = {
      userId: adminUser.userId,
      adminUserId: adminUser.id,
      role: adminUser.role,
      roles: resolveAdminRoles(adminUser.role, adminUser.roles),
      email: adminUser.user.email,
      name: adminUser.user.name,
    };
    return true;
  }
}
