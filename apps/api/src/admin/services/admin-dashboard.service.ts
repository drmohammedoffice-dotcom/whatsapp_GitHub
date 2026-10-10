import { Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeSubscriptions,
      trialUsers,
      newUsersToday,
      activeWorkspaces,
      connectedWhatsAppSessions,
      connectedWhatsAppCloud,
      connectedTikTok,
      connectedMeta,
      mrrAgg,
      apiHealth,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.TRIAL } }),
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
      this.prisma.team.count(),
      this.prisma.whatsAppSession.count({ where: { status: 'CONNECTED' } }),
      this.prisma.whatsAppCloudAccount.count({ where: { status: 'CONNECTED' } }),
      this.prisma.tikTokMarketingConnection.count(),
      this.prisma.metaConnection.count(),
      this.prisma.subscription.aggregate({
        where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] } },
        _sum: { mrrCents: true },
      }),
      this.prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`,
    ]);

    return {
      totalUsers,
      activeSubscriptions,
      trialUsers,
      monthlyRevenueMrrCents: mrrAgg._sum.mrrCents ?? 0,
      newUsersToday,
      activeWorkspaces,
      connectedWhatsAppNumbers: connectedWhatsAppSessions + connectedWhatsAppCloud,
      connectedTikTokAccounts: connectedTikTok,
      connectedMetaAccounts: connectedMeta,
      systemHealth: {
        database: apiHealth.length > 0 ? 'healthy' : 'degraded',
        api: 'healthy',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
