import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, SubscriptionStatus, TeamRole } from '@watsapp/database';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { WhatsAppService } from '../modules/whatsapp/whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../security/password.service';
import { LocalStorageService } from '../storage/local-storage.service';

/**
 * Rows that must survive an account deletion: billing/accounting records required by
 * law, platform staff accounts and security audit trails. Team and User rows are
 * never deleted either (deleting them cascades into Subscription → Payment → Invoice);
 * they are anonymized instead.
 */
const RETAINED_MODELS = new Set([
  'Team',
  'User',
  'TeamMember',
  'Subscription',
  'SubscriptionPlan',
  'Payment',
  'Invoice',
  'SubscriptionNotificationLog',
  'SalesPartner',
  'SalesReferral',
  'SalesCommission',
  'SalesPayoutRequest',
  'AdminUser',
  'AuditLog',
  'PlatformAuditLog',
  'PlatformActivityLog',
  'SupportTicket',
]);

const MAX_PURGE_PASSES = 6;

type DeleteManyDelegate = { deleteMany: (args: { where: Record<string, string> }) => Promise<{ count: number }> };

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly whatsapp: WhatsAppService,
    private readonly storage: LocalStorageService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Self-service deletion required by Google Play / App Store.
   * - Workspaces the user is the only member of are wiped (content, connections,
   *   tokens, uploaded files) and their subscription is cancelled; payments and
   *   invoices stay for accounting.
   * - Shared workspaces are kept for the remaining members; ownership moves on.
   * - The user row is anonymized and suspended so the account can never sign in again.
   */
  async deleteAccount(userId: string, password: string, confirmation: string, ipAddress?: string) {
    if (!['DELETE', 'حذف'].includes((confirmation ?? '').trim())) {
      throw new BadRequestException('اكتب كلمة DELETE لتأكيد حذف الحساب.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true, suspendedAt: true },
    });
    if (!user) throw new NotFoundException('Account not found');
    if (!(await this.passwords.verify(password ?? '', user.passwordHash))) {
      throw new ForbiddenException('كلمة المرور غير صحيحة.');
    }

    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      select: { id: true, teamId: true, role: true },
    });

    const purgedTeams: string[] = [];
    const leftTeams: string[] = [];
    for (const membership of memberships) {
      const others = await this.prisma.teamMember.findMany({
        where: { teamId: membership.teamId, userId: { not: userId } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, userId: true, role: true },
      });
      if (others.length === 0) {
        await this.purgeTeam(membership.teamId, userId);
        purgedTeams.push(membership.teamId);
        continue;
      }
      if (membership.role === TeamRole.OWNER && !others.some((m) => m.role === TeamRole.OWNER)) {
        const heir = others.find((m) => m.role === TeamRole.ADMIN) ?? others[0]!;
        await this.prisma.teamMember.update({ where: { id: heir.id }, data: { role: TeamRole.OWNER } });
        await this.prisma.subscription.updateMany({
          where: { teamId: membership.teamId, ownerUserId: userId },
          data: { ownerUserId: heir.userId },
        });
      }
      await this.prisma.teamMember.delete({ where: { id: membership.id } });
      leftTeams.push(membership.teamId);
    }

    await this.purgeRows('userId', userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@deleted.chatloora.invalid`,
        name: 'Deleted user',
        phone: null,
        phoneVerifiedAt: null,
        emailVerifiedAt: null,
        passwordHash: await this.passwords.hash(randomBytes(32).toString('hex')),
        suspendedAt: new Date(),
      },
    });

    const auditTeamId = purgedTeams[0] ?? leftTeams[0];
    if (auditTeamId) {
      await this.audit.log({
        teamId: auditTeamId,
        actorUserId: userId,
        action: 'account.delete',
        resource: 'user',
        resourceId: userId,
        ipAddress,
        metadata: { purgedTeams, leftTeams },
      });
    }
    this.logger.log(`Account deleted user=${userId} purgedTeams=${purgedTeams.length} leftTeams=${leftTeams.length}`);
    return { deleted: true };
  }

  private async purgeTeam(teamId: string, userId: string) {
    // Stop live WhatsApp sockets before their sessions/credentials disappear.
    const sessions = await this.prisma.whatsAppSession.findMany({ where: { teamId }, select: { id: true } });
    for (const session of sessions) {
      await this.whatsapp.disconnect(teamId, session.id, userId).catch((error: unknown) => {
        this.logger.warn(`WhatsApp disconnect failed session=${session.id}: ${String(error)}`);
      });
    }

    await this.prisma.subscription.updateMany({
      where: { teamId, status: { notIn: [SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED] } },
      data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date(), autoRenew: false, mrrCents: 0 },
    });
    await this.prisma.subscription.updateMany({ where: { teamId }, data: { autoRenew: false } });

    await this.purgeRows('teamId', teamId);
    await this.storage.removeTeamMedia(teamId);
    await this.prisma.team.update({
      where: { id: teamId },
      data: { name: 'Deleted workspace', slug: `deleted-${teamId}` },
    });
  }

  /**
   * Deletes every non-retained row keyed by `field` (teamId/userId). Models are
   * discovered from the Prisma schema so new tables are covered automatically.
   * Foreign-key ordering is resolved by retrying failed models in later passes.
   */
  private async purgeRows(field: 'teamId' | 'userId', value: string) {
    let pending = Prisma.dmmf.datamodel.models
      .filter((model) => !RETAINED_MODELS.has(model.name))
      .filter((model) => model.fields.some((f) => f.name === field && f.kind === 'scalar'))
      .map((model) => model.name);

    for (let pass = 0; pass < MAX_PURGE_PASSES && pending.length; pass += 1) {
      const failed: string[] = [];
      for (const name of pending) {
        const delegate = (this.prisma as unknown as Record<string, DeleteManyDelegate | undefined>)[
          name.charAt(0).toLowerCase() + name.slice(1)
        ];
        if (!delegate?.deleteMany) continue;
        try {
          await delegate.deleteMany({ where: { [field]: value } });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
            failed.push(name);
            continue;
          }
          throw error;
        }
      }
      pending = failed;
    }
    if (pending.length) {
      this.logger.error(`Account purge left rows in ${pending.join(', ')} for ${field}=${value}`);
    }
  }
}
