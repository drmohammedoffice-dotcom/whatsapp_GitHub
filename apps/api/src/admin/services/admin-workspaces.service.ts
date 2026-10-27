import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TeamRole } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from './admin-audit.service';

function mapWorkspace(workspace: any) {
  return {
    ...workspace,
    subscription: workspace?.subscriptions?.[0] ?? workspace?.subscription ?? null,
  };
}


@Injectable()
export class AdminWorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(params: { q?: string; skip?: number; take?: number }) {
    const q = params.q?.trim();
    const where = q
      ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { slug: { contains: q, mode: 'insensitive' as const } }] }
      : {};
    const [workspaces, total] = await Promise.all([
      this.prisma.team.findMany({
        where,
        skip: params.skip ?? 0,
        take: Math.min(params.take ?? 50, 100),
        orderBy: { createdAt: 'desc' },
        include: {
          members: { include: { user: { select: { id: true, email: true, name: true } } } },
          subscriptions: { include: { plan: true }, take: 1 },
          _count: { select: { conversations: true, sessions: true, metaConnections: true } },
        },
      }),
      this.prisma.team.count({ where }),
    ]);
    return { workspaces: workspaces.map(mapWorkspace), total };
  }

  async getById(teamId: string) {
    const workspace = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: { include: { user: true } },
        subscriptions: { include: { plan: true, payments: { take: 10, orderBy: { createdAt: 'desc' } } }, take: 1 },
        sessions: true,
        whatsAppCloudAccounts: true,
        metaConnections: true,
        tikTokEventSets: true,
      },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const [conversationCount, messageCount] = await Promise.all([
      this.prisma.conversation.count({ where: { teamId } }),
      this.prisma.conversationMessage.count({ where: { teamId } }),
    ]);

    return { workspace: mapWorkspace(workspace), stats: { conversationCount, messageCount } };
  }

  create(adminUserId: string, name: string, slug: string, ownerUserId: string) {
    return this.prisma.team
      .create({
        data: {
          name,
          slug,
          members: { create: { userId: ownerUserId, role: TeamRole.OWNER } },
        },
      })
      .then(async (team) => {
        await this.audit.log({ adminUserId, action: 'workspace.create', resource: 'team', resourceId: team.id });
        return team;
      });
  }

  async disable(adminUserId: string, teamId: string) {
    await this.prisma.setting.upsert({
      where: { teamId_key: { teamId, key: 'workspace.disabled' } },
      create: { teamId, key: 'workspace.disabled', value: true },
      update: { value: true },
    });
    await this.audit.log({ adminUserId, action: 'workspace.disable', resource: 'team', resourceId: teamId });
    return { disabled: true, teamId };
  }

  async deleteWorkspace(adminUserId: string, teamId: string) {
    // A team delete cascades to its subscription, payments and invoices.
    const paid = await this.prisma.payment.count({ where: { teamId } });
    if (paid > 0) {
      throw new BadRequestException('لا يمكن حذف مساحة عمل لها مدفوعات مسجّلة. أوقف الاشتراك أو ألغِه بدلاً من الحذف.');
    }
    const team = await this.prisma.team.delete({ where: { id: teamId } });
    await this.audit.log({ adminUserId, action: 'workspace.delete', resource: 'team', resourceId: teamId });
    return team;
  }
}
