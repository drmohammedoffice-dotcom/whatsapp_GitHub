import { Injectable } from '@nestjs/common';
import { WhatsAppRoutingStrategy } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';

export type RoutingContext = {
  teamId: string;
  campaignId?: string;
  countryCode?: string;
  routingRuleId?: string;
  manualAccountId?: string;
};

export type RoutingPick = {
  accountId: string;
  phoneNumber: string;
  strategy: WhatsAppRoutingStrategy;
};

type PercentageConfig = { weights: Array<{ accountId: string; percent: number }> };
type CountryConfig = { map: Record<string, string> };

@Injectable()
export class WhatsAppRoutingService {
  private readonly roundRobinCursor = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  async pickAccount(context: RoutingContext): Promise<RoutingPick | null> {
    if (context.manualAccountId) {
      const account = await this.prisma.whatsAppCloudAccount.findFirst({
        where: { id: context.manualAccountId, teamId: context.teamId, status: 'CONNECTED' },
      });
      if (!account) return null;
      return { accountId: account.id, phoneNumber: account.phoneNumber, strategy: WhatsAppRoutingStrategy.MANUAL };
    }

    const campaign = context.campaignId
      ? await this.prisma.campaign.findFirst({
          where: { id: context.campaignId, teamId: context.teamId, active: true },
          include: { whatsAppCloudAccount: true, routingRule: { include: { poolMembers: { include: { account: true } } } } },
        })
      : null;

    if (campaign?.whatsAppCloudAccount?.status === 'CONNECTED') {
      return {
        accountId: campaign.whatsAppCloudAccount.id,
        phoneNumber: campaign.whatsAppCloudAccount.phoneNumber,
        strategy: WhatsAppRoutingStrategy.CAMPAIGN,
      };
    }

    const ruleId = context.routingRuleId ?? campaign?.routingRuleId;
    if (ruleId) {
      const rule = await this.prisma.whatsAppRoutingRule.findFirst({
        where: { id: ruleId, teamId: context.teamId, active: true },
        include: { poolMembers: { include: { account: true }, orderBy: { sortOrder: 'asc' } } },
      });
      if (rule) {
        const pool = rule.poolMembers
          .map((m) => m.account)
          .filter((a) => a.status === 'CONNECTED');
        if (pool.length) {
          return this.applyStrategy(rule.strategy, rule.id, rule.config, pool, context);
        }
      }
    }

    const fallback = await this.prisma.whatsAppCloudAccount.findFirst({
      where: { teamId: context.teamId, status: 'CONNECTED' },
      orderBy: { connectedAt: 'desc' },
    });
    if (!fallback) return null;
    return { accountId: fallback.id, phoneNumber: fallback.phoneNumber, strategy: WhatsAppRoutingStrategy.MANUAL };
  }

  private applyStrategy(
    strategy: WhatsAppRoutingStrategy,
    ruleId: string,
    config: unknown,
    pool: Array<{ id: string; phoneNumber: string }>,
    context: RoutingContext,
  ): RoutingPick {
    if (strategy === WhatsAppRoutingStrategy.COUNTRY && context.countryCode) {
      const countryMap = (config as CountryConfig | null)?.map ?? {};
      const targetId = countryMap[context.countryCode.toUpperCase()];
      const match = pool.find((a) => a.id === targetId);
      if (match) return { accountId: match.id, phoneNumber: match.phoneNumber, strategy };
    }

    if (strategy === WhatsAppRoutingStrategy.PERCENTAGE) {
      const weights = (config as PercentageConfig | null)?.weights ?? pool.map((a) => ({ accountId: a.id, percent: 100 / pool.length }));
      const roll = Math.random() * 100;
      let acc = 0;
      for (const w of weights) {
        acc += w.percent;
        const match = pool.find((a) => a.id === w.accountId);
        if (roll <= acc && match) return { accountId: match.id, phoneNumber: match.phoneNumber, strategy };
      }
    }

    if (strategy === WhatsAppRoutingStrategy.RANDOM) {
      const pick = pool[Math.floor(Math.random() * pool.length)]!;
      return { accountId: pick.id, phoneNumber: pick.phoneNumber, strategy };
    }

    // ROUND_ROBIN (default for pools)
    const cursor = this.roundRobinCursor.get(ruleId) ?? 0;
    const pick = pool[cursor % pool.length]!;
    this.roundRobinCursor.set(ruleId, cursor + 1);
    return {
      accountId: pick.id,
      phoneNumber: pick.phoneNumber,
      strategy: strategy === WhatsAppRoutingStrategy.ROUND_ROBIN ? strategy : WhatsAppRoutingStrategy.ROUND_ROBIN,
    };
  }
}
