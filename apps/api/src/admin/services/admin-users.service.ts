import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TeamRole } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../../security/password.service';
import { AdminAuditService } from './admin-audit.service';

function mapAdminUser(user: any) {
  return {
    ...user,
    ownedSubscriptions: user.ownedSubscriptions,
    teamMembers: (user.teamMembers ?? []).map((m: any) => ({
      ...m,
      team: {
        ...m.team,
        subscription: m.team?.subscriptions?.[0] ?? m.team?.subscription ?? null,
      },
    })),
  };
}


@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(params: { q?: string; skip?: number; take?: number; customersOnly?: boolean }) {
    const q = params.q?.trim();
    const search = q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const where = params.customersOnly
      ? { AND: [search, { adminProfile: { is: null } }] }
      : search;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: params.skip ?? 0,
        take: Math.min(params.take ?? 50, 100),
        orderBy: { createdAt: 'desc' },
        include: {
          teamMembers: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  subscriptions: { include: { plan: true }, take: 1 },
                },
              },
            },
          },
          adminProfile: true,
          ownedSubscriptions: { include: { plan: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users: users.map(mapAdminUser), total };
  }

  async getById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        teamMembers: { include: { team: true } },
        adminProfile: true,
        ownedSubscriptions: { include: { plan: true, payments: { take: 20, orderBy: { createdAt: 'desc' } } } },
        tikTokMarketingConnection: true,
        tikTokLoginAccount: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const teamIds = user.teamMembers.map((m) => m.teamId);
    const [messageCount, aiUsage, activityLogs, errorLogs] = await Promise.all([
      this.prisma.conversationMessage.count({ where: { teamId: { in: teamIds } } }),
      this.prisma.aiCostEvent.aggregate({
        where: { teamId: { in: teamIds } },
        _sum: { costCents: true },
        _count: true,
      }),
      this.prisma.platformActivityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.integrationWebhookEvent.findMany({
        where: { teamId: { in: teamIds }, status: 'FAILED' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const integrations = await this.getUserIntegrations(teamIds);

    return {
      user: mapAdminUser(user),
      stats: {
        messageCount,
        aiCostCents: aiUsage._sum.costCents ?? 0,
        aiRuns: aiUsage._count,
      },
      integrations,
      activityLogs,
      errorLogs,
    };
  }

  private async getUserIntegrations(teamIds: string[]) {
    const [whatsappSessions, whatsappCloud, meta, tiktok] = await Promise.all([
      this.prisma.whatsAppSession.findMany({ where: { teamId: { in: teamIds } } }),
      this.prisma.whatsAppCloudAccount.findMany({ where: { teamId: { in: teamIds } } }),
      this.prisma.metaConnection.findMany({ where: { teamId: { in: teamIds } } }),
      this.prisma.tikTokMarketingConnection.findMany({ where: { teamId: { in: teamIds } } }),
    ]);
    return { whatsappSessions, whatsappCloud, meta, tiktok };
  }

  async createUser(adminUserId: string, input: { email: string; name: string; password: string; teamName?: string }) {
    const email = input.email.trim().toLowerCase();
    if (!email || !email.includes('@')) throw new BadRequestException('Valid email required');
    if (!input.name?.trim()) throw new BadRequestException('Name required');
    if (!input.password || input.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email is already registered');

    const teamName = input.teamName?.trim() || input.name.trim();
    const slug = await this.createUniqueSlug(teamName);
    const passwordHash = await this.passwords.hash(input.password);

    const user = await this.prisma.user.create({
      data: {
        email,
        name: input.name.trim(),
        passwordHash,
        teamMembers: {
          create: { role: TeamRole.OWNER, team: { create: { name: teamName, slug } } },
        },
      },
      include: { teamMembers: { include: { team: true } } },
    });

    await this.audit.log({
      adminUserId,
      action: 'user.create',
      resource: 'user',
      resourceId: user.id,
      metadata: { email, teamName },
    });
    return user;
  }

  async updateUser(adminUserId: string, userId: string, input: { email?: string; name?: string; password?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const data: { email?: string; name?: string; passwordHash?: string } = {};

    if (input.email !== undefined) {
      const email = input.email.trim().toLowerCase();
      if (!email || !email.includes('@')) throw new BadRequestException('Valid email required');
      if (email !== user.email) {
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing) throw new ConflictException('Email is already registered');
        data.email = email;
      }
    }

    if (input.name !== undefined) {
      if (!input.name.trim()) throw new BadRequestException('Name required');
      data.name = input.name.trim();
    }

    if (input.password) {
      if (input.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
      data.passwordHash = await this.passwords.hash(input.password);
    }

    const updated = await this.prisma.user.update({ where: { id: userId }, data });
    await this.audit.log({
      adminUserId,
      action: 'user.update',
      resource: 'user',
      resourceId: userId,
      metadata: { emailChanged: !!data.email, nameChanged: !!data.name, passwordChanged: !!data.passwordHash },
    });
    return updated;
  }

  private async createUniqueSlug(name: string) {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'team';
    let slug = base;
    let counter = 1;
    while (await this.prisma.team.findUnique({ where: { slug } })) slug = `${base}-${counter++}`;
    return slug;
  }

  async suspend(adminUserId: string, userId: string, reason?: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { suspendedAt: new Date() },
    });
    await this.audit.log({
      adminUserId,
      action: 'user.suspend',
      resource: 'user',
      resourceId: userId,
      metadata: { reason },
    });
    return user;
  }

  async activate(adminUserId: string, userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { suspendedAt: null },
    });
    await this.audit.log({ adminUserId, action: 'user.activate', resource: 'user', resourceId: userId });
    return user;
  }

  async deleteUser(adminUserId: string, userId: string) {
    await this.audit.log({ adminUserId, action: 'user.delete', resource: 'user', resourceId: userId });
    return this.prisma.user.delete({ where: { id: userId } });
  }

  async resetPassword(adminUserId: string, userId: string, newPassword: string) {
    if (newPassword.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    const passwordHash = await this.passwords.hash(newPassword);
    const user = await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.audit.log({ adminUserId, action: 'user.reset_password', resource: 'user', resourceId: userId });
    return { updated: true, userId: user.id };
  }
}
