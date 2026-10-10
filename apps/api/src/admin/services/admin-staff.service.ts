import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../../security/password.service';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AdminAuditService,
  ) {}

  async list() {
    const staff = await this.prisma.adminUser.findMany({
      where: { role: AdminRole.STAFF },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true, createdAt: true } },
      },
    });
    return staff.map((row) => ({
      id: row.id,
      role: row.role,
      residence: row.residence,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: row.user,
    }));
  }

  async create(
    actorAdminId: string,
    input: { email: string; name: string; password: string; residence?: string },
    ipAddress?: string,
    userAgent?: string,
  ) {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const password = input.password;
    const residence = input.residence?.trim() || null;

    if (!email || !name || password.length < 8) {
      throw new BadRequestException('Email, name, and password (min 8 chars) are required');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
      include: { adminProfile: true },
    });
    if (existing?.adminProfile) {
      throw new ConflictException('This email is already an admin/staff account');
    }
    if (existing) {
      throw new ConflictException('This email belongs to a customer account — use a different email');
    }

    const passwordHash = await this.passwords.hash(password);
    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          emailVerifiedAt: new Date(),
          adminProfile: {
            create: {
              role: AdminRole.STAFF,
              residence,
              isActive: true,
            },
          },
        },
        include: { adminProfile: true },
      });
      return user;
    });

    await this.audit.log({
      adminUserId: actorAdminId,
      action: 'staff.create',
      resource: 'admin_user',
      resourceId: created.adminProfile!.id,
      metadata: { email, name, residence },
      ipAddress,
      userAgent,
    });

    return {
      id: created.adminProfile!.id,
      role: AdminRole.STAFF,
      residence,
      isActive: true,
      createdAt: created.createdAt,
      user: { id: created.id, email: created.email, name: created.name, createdAt: created.createdAt },
    };
  }

  async update(
    actorAdminId: string,
    staffId: string,
    input: { name?: string; password?: string; residence?: string; isActive?: boolean },
    ipAddress?: string,
    userAgent?: string,
  ) {
    const staff = await this.prisma.adminUser.findUnique({
      where: { id: staffId },
      include: { user: true },
    });
    if (!staff || staff.role !== AdminRole.STAFF) {
      throw new NotFoundException('Staff member not found');
    }

    const userData: { name?: string; passwordHash?: string } = {};
    if (input.name?.trim()) userData.name = input.name.trim();
    if (input.password) {
      if (input.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
      userData.passwordHash = await this.passwords.hash(input.password);
    }

    const adminData: { residence?: string | null; isActive?: boolean } = {};
    if (input.residence !== undefined) adminData.residence = input.residence.trim() || null;
    if (typeof input.isActive === 'boolean') adminData.isActive = input.isActive;

    const ops = [];
    if (Object.keys(userData).length) {
      ops.push(this.prisma.user.update({ where: { id: staff.userId }, data: userData }));
    }
    if (Object.keys(adminData).length) {
      ops.push(this.prisma.adminUser.update({ where: { id: staffId }, data: adminData }));
    }
    if (ops.length) await this.prisma.$transaction(ops);

    await this.audit.log({
      adminUserId: actorAdminId,
      action: 'staff.update',
      resource: 'admin_user',
      resourceId: staffId,
      metadata: {
        name: input.name,
        residence: input.residence,
        isActive: input.isActive,
        passwordChanged: Boolean(input.password),
      },
      ipAddress,
      userAgent,
    });

    return this.getById(staffId);
  }

  async getById(staffId: string) {
    const staff = await this.prisma.adminUser.findUnique({
      where: { id: staffId },
      include: { user: { select: { id: true, email: true, name: true, createdAt: true } } },
    });
    if (!staff || staff.role !== AdminRole.STAFF) throw new NotFoundException('Staff member not found');
    return {
      id: staff.id,
      role: staff.role,
      residence: staff.residence,
      isActive: staff.isActive,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
      user: staff.user,
    };
  }

  async deactivate(actorAdminId: string, staffId: string, ipAddress?: string, userAgent?: string) {
    return this.update(actorAdminId, staffId, { isActive: false }, ipAddress, userAgent);
  }

  async activity(params?: { staffId?: string; skip?: number; take?: number }) {
    const staffIds = params?.staffId
      ? [params.staffId]
      : (
          await this.prisma.adminUser.findMany({
            where: { role: AdminRole.STAFF },
            select: { id: true },
          })
        ).map((s) => s.id);

    if (!staffIds.length) return [];

    return this.prisma.platformAuditLog.findMany({
      where: { adminUserId: { in: staffIds } },
      orderBy: { createdAt: 'desc' },
      skip: params?.skip ?? 0,
      take: Math.min(params?.take ?? 100, 300),
      include: {
        adminUser: {
          include: { user: { select: { email: true, name: true } } },
        },
      },
    });
  }
}
