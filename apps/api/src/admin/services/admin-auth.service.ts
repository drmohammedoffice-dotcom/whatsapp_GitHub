import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AdminRole, PlatformActivityCategory } from '@watsapp/database';
import type { UploadedMediaFile } from '../../common/uploaded-media-file';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../../security/password.service';
import { TokenHashService } from '../../security/token-hash.service';
import { LocalStorageService } from '../../storage/local-storage.service';
import { AdminAuditService } from './admin-audit.service';
import { isEmployeeRole, resolveAdminRoles } from '../staff-roles';
import { AdminJwtPayload } from '../types/admin-principal';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly tokenHash: TokenHashService,
    private readonly audit: AdminAuditService,
    private readonly storage: LocalStorageService,
  ) {}

  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
    portal: 'admin' | 'staff' = 'admin',
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { adminProfile: true, teamMembers: { orderBy: { createdAt: 'asc' } } },
    });
    if (!user?.adminProfile?.isActive) throw new UnauthorizedException('Invalid admin credentials');
    if (!(await this.passwords.verify(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const role = user.adminProfile.role;
    const roles = resolveAdminRoles(role, user.adminProfile.roles);
    const isStaffAccount = roles.some((r) => isEmployeeRole(r)) || isEmployeeRole(role);
    if (portal === 'staff') {
      if (!isStaffAccount) {
        throw new UnauthorizedException('Use the admin login page for this account');
      }
    } else if (isStaffAccount) {
      throw new UnauthorizedException('Staff must sign in at /staff/login');
    }

    const action = portal === 'staff' ? 'staff.login' : 'admin.login';
    await this.prisma.platformActivityLog.create({
      data: {
        userId: user.id,
        category: PlatformActivityCategory.AUTH,
        action,
        ipAddress,
        userAgent,
      },
    });
    await this.audit.log({
      adminUserId: user.adminProfile.id,
      action,
      resource: 'admin_user',
      resourceId: user.adminProfile.id,
      metadata: { portal },
      ipAddress,
      userAgent,
    });

    return this.issueAdminTokens(user.adminProfile.id, user.id, role, roles);
  }

  async me(adminUserId: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminUserId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (!admin) throw new NotFoundException('Admin user not found');
    const roles = resolveAdminRoles(admin.role, admin.roles);
    return {
      id: admin.id,
      role: admin.role,
      roles,
      residence: admin.residence,
      hasAvatar: Boolean(admin.avatarKey),
      isActive: admin.isActive,
      user: admin.user,
    };
  }

  async saveMyAvatar(adminUserId: string, file?: UploadedMediaFile) {
    if (!file?.buffer?.length || !file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('اختر صورة صالحة');
    }
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminUserId } });
    if (!admin) throw new NotFoundException('Admin user not found');
    const stored = await this.storage.putMedia(`admin-avatars/${adminUserId}`, file);
    if (admin.avatarKey) {
      await this.storage.remove(admin.avatarKey).catch(() => undefined);
    }
    await this.prisma.adminUser.update({
      where: { id: adminUserId },
      data: { avatarKey: stored.storageKey },
    });
    return { updated: true, hasAvatar: true };
  }

  async openMyAvatar(adminUserId: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminUserId },
      select: { avatarKey: true },
    });
    if (!admin?.avatarKey) throw new NotFoundException('لا توجد صورة');
    const { createReadStream } = await import('fs');
    const { extname } = await import('path');
    const filePath = this.storage.resolvePath(admin.avatarKey);
    const ext = extname(admin.avatarKey).toLowerCase();
    const type =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : 'image/jpeg';
    return { stream: createReadStream(filePath), type };
  }

  async impersonate(adminUserId: string, targetUserId: string, ipAddress?: string, userAgent?: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminUserId } });
    if (!admin || admin.role !== AdminRole.SUPER_ADMIN) {
      throw new UnauthorizedException('Only Super Admin can impersonate users');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { teamMembers: { orderBy: { createdAt: 'asc' } } },
    });
    if (!user?.teamMembers[0]) throw new NotFoundException('Target user has no workspace');

    await this.audit.log({
      adminUserId,
      action: 'user.impersonate',
      resource: 'user',
      resourceId: targetUserId,
      ipAddress,
      userAgent,
    });

    return this.issueUserTokens(user.id, user.teamMembers[0].teamId, adminUserId);
  }

  private async issueAdminTokens(
    adminUserId: string,
    userId: string,
    role: AdminRole,
    roles?: AdminRole[],
  ) {
    const payload: AdminJwtPayload = {
      sub: userId,
      adminUserId,
      role,
      roles: roles?.length ? roles : [role],
      scope: 'admin',
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '2h') as never,
    });
    return { accessToken, admin: await this.me(adminUserId) };
  }

  private async issueUserTokens(userId: string, teamId: string, impersonatedBy?: string) {
    const accessToken = await this.jwt.signAsync(
      {
        sub: userId,
        teamId,
        ...(impersonatedBy ? { impersonatedBy } : {}),
      },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '2h') as never,
      },
    );
    const refreshToken = this.tokenHash.createOpaqueToken();
    const refreshTtlDays = this.config.get<number>('JWT_REFRESH_TTL_DAYS') ?? 30;
    const expiresAt = new Date(Date.now() + refreshTtlDays * 86_400_000);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: this.tokenHash.hash(refreshToken), expiresAt },
    });
    return { accessToken, refreshToken, teamId, impersonatedBy: impersonatedBy ?? null };
  }
}
