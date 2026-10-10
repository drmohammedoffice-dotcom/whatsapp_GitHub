import { Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const [
      mrr,
      activeSubs,
      cancelledLast30,
      totalUsers,
      newUsers30,
      paidUsers,
      topTeams,
      usage,
    ] = await Promise.all([
      this.prisma.subscription.aggregate({
        where: { status: SubscriptionStatus.ACTIVE },
        _sum: { mrrCents: true },
      }),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.CANCELLED, cancelledAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.subscription.count({
        where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] } },
      }),
      this.prisma.team.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          subscriptions: { take: 1 },
          _count: { select: { conversations: true, members: true } },
        },
      }),
      this.prisma.aiCostEvent.aggregate({ _sum: { costCents: true }, _count: true }),
    ]);

    const churnRate = activeSubs + cancelledLast30 > 0
      ? Number(((cancelledLast30 / (activeSubs + cancelledLast30)) * 100).toFixed(2))
      : 0;
    const conversionRate = totalUsers > 0 ? Number(((paidUsers / totalUsers) * 100).toFixed(2)) : 0;

    const userGrowth = await this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT date_trunc('day', "createdAt") as day, COUNT(*)::bigint as count
      FROM "User"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const revenueByDay = await this.prisma.$queryRaw<Array<{ day: Date; total: bigint }>>`
      SELECT date_trunc('day', "created_at") as day, SUM("amount_cents")::bigint as total
      FROM "payments"
      WHERE "created_at" >= ${thirtyDaysAgo} AND "status" = 'COMPLETED'
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    return {
      mrrCents: mrr._sum.mrrCents ?? 0,
      churnRate,
      conversionRate,
      userGrowth: userGrowth.map((r) => ({ day: r.day, count: Number(r.count) })),
      revenueChart: revenueByDay.map((r) => ({ day: r.day, totalCents: Number(r.total) })),
      topCustomers: topTeams.map((t) => ({ ...t, subscription: t.subscriptions?.[0] ?? null })),
      usage: {
        aiCostCents: usage._sum.costCents ?? 0,
        aiEvents: usage._count,
        newUsers30,
      },
    };
  }
}
