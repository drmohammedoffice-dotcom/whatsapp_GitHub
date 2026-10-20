import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../../security/password.service';
import { AdminAuditService } from './admin-audit.service';
import {
  EMPLOYEE_ROLES,
  normalizeStaffRoles,
  parseStoredRoles,
  primaryStaffRole,
} from '../staff-roles';

@Injectable()
export class AdminStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AdminAuditService,
  ) {}

  private mapStaff(row: {
    id: string;
    role: AdminRole;
    roles: unknown;
    residence: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt?: Date;
    user: { id: string; email: string; name: string; createdAt: Date };
  }) {
    const roles = parseStoredRoles(row.roles, row.role);
    return {
      id: row.id,
      role: row.role,
      roles,
      residence: row.residence,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: row.user,
    };
  }

  async list() {
    const staff = await this.prisma.adminUser.findMany({
      where: { role: { in: EMPLOYEE_ROLES } },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true, createdAt: true } },
      },
    });
    return staff.map((row) => this.mapStaff(row));
  }

  async create(
    actorAdminId: string,
    input: {
      email: string;
      name: string;
      password: string;
      residence?: string;
      role?: string;
      roles?: string[];
    },
    ipAddress?: string,
    userAgent?: string,
  ) {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    const password = input.password;
    const residence = input.residence?.trim() || null;
    const roles = normalizeStaffRoles(input.roles?.length ? input.roles : input.role);
    const role = primaryStaffRole(roles);
    const rolesJson = roles;

    if (!email || !name || password.length < 8) {
      throw new BadRequestException('Email, name, and password (min 8 chars) are required');
    }

    const passwordHash = await this.passwords.hash(password);
    const existing = await this.prisma.user.findUnique({
      where: { email },
      include: { adminProfile: true },
    });

    if (existing?.adminProfile) {
      const profile = existing.adminProfile;
      if (!EMPLOYEE_ROLES.includes(profile.role)) {
        throw new BadRequestException(
          'هذا البريد حساب إدارة عليا — استخدم بريداً آخر للموظف',
        );
      }
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: existing.id },
          data: { name, passwordHash, emailVerifiedAt: existing.emailVerifiedAt ?? new Date() },
        }),
        this.prisma.adminUser.update({
          where: { id: profile.id },
          data: { role, roles: rolesJson, residence, isActive: true },
        }),
      ]);

      await this.audit.log({
        adminUserId: actorAdminId,
        action: 'staff.upsert',
        resource: 'admin_user',
        resourceId: profile.id,
        metadata: { email, name, residence, role, roles, reused: true },
        ipAddress,
        userAgent,
      });

      return this.getById(profile.id);
    }

    if (existing) {
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          passwordHash,
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          adminProfile: {
            create: { role, roles: rolesJson, residence, isActive: true },
          },
        },
        include: { adminProfile: true },
      });

      await this.audit.log({
        adminUserId: actorAdminId,
        action: 'staff.create',
        resource: 'admin_user',
        resourceId: updated.adminProfile!.id,
        metadata: { email, name, residence, role, roles, promotedExistingUser: true },
        ipAddress,
        userAgent,
      });

      return this.mapStaff({
        id: updated.adminProfile!.id,
        role,
        roles: rolesJson,
        residence,
        isActive: true,
        createdAt: updated.adminProfile!.createdAt,
        user: { id: updated.id, email: updated.email, name: updated.name, createdAt: updated.createdAt },
      });
    }

    const created = await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        emailVerifiedAt: new Date(),
        adminProfile: {
          create: { role, roles: rolesJson, residence, isActive: true },
        },
      },
      include: { adminProfile: true },
    });

    await this.audit.log({
      adminUserId: actorAdminId,
      action: 'staff.create',
      resource: 'admin_user',
      resourceId: created.adminProfile!.id,
      metadata: { email, name, residence, role, roles },
      ipAddress,
      userAgent,
    });

    return this.mapStaff({
      id: created.adminProfile!.id,
      role,
      roles: rolesJson,
      residence,
      isActive: true,
      createdAt: created.createdAt,
      user: { id: created.id, email: created.email, name: created.name, createdAt: created.createdAt },
    });
  }

  async update(
    actorAdminId: string,
    staffId: string,
    input: {
      name?: string;
      email?: string;
      password?: string;
      residence?: string;
      isActive?: boolean;
      role?: string;
      roles?: string[];
    },
    ipAddress?: string,
    userAgent?: string,
  ) {
    const staff = await this.prisma.adminUser.findUnique({
      where: { id: staffId },
      include: { user: true },
    });
    if (!staff || !EMPLOYEE_ROLES.includes(staff.role)) {
      throw new NotFoundException('Staff member not found');
    }

    const userData: { name?: string; email?: string; passwordHash?: string } = {};
    if (input.name?.trim()) userData.name = input.name.trim();
    if (input.email?.trim()) {
      const nextEmail = input.email.trim().toLowerCase();
      if (nextEmail !== staff.user.email) {
        const taken = await this.prisma.user.findUnique({ where: { email: nextEmail } });
        if (taken && taken.id !== staff.userId) {
          throw new BadRequestException('هذا البريد مستخدم لحساب آخر');
        }
        userData.email = nextEmail;
      }
    }
    if (input.password) {
      if (input.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
      userData.passwordHash = await this.passwords.hash(input.password);
    }

    const adminData: {
      residence?: string | null;
      isActive?: boolean;
      role?: AdminRole;
      roles?: AdminRole[];
    } = {};
    if (input.residence !== undefined) adminData.residence = input.residence.trim() || null;
    if (typeof input.isActive === 'boolean') adminData.isActive = input.isActive;
    if (input.roles?.length || input.role) {
      const roles = normalizeStaffRoles(input.roles?.length ? input.roles : input.role);
      adminData.role = primaryStaffRole(roles);
      adminData.roles = roles;
    }

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
        email: input.email,
        residence: input.residence,
        isActive: input.isActive,
        role: input.role,
        roles: input.roles,
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
    if (!staff || !EMPLOYEE_ROLES.includes(staff.role)) throw new NotFoundException('Staff member not found');
    return this.mapStaff(staff);
  }

  async deactivate(actorAdminId: string, staffId: string, ipAddress?: string, userAgent?: string) {
    return this.update(actorAdminId, staffId, { isActive: false }, ipAddress, userAgent);
  }

  async activity(params?: { staffId?: string; skip?: number; take?: number }) {
    const staffIds = params?.staffId
      ? [params.staffId]
      : (
          await this.prisma.adminUser.findMany({
            where: { role: { in: EMPLOYEE_ROLES } },
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
