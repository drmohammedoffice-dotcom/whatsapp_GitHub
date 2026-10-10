import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SubscriptionStatus, TeamRole } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { TikTokAdsService } from '../integrations/tiktok-login-kit/tiktok-ads.service';
import { TikTokMarketingOAuthService } from '../integrations/tiktok-login-kit/tiktok-marketing-oauth.service';
import { BillingEmailService } from './billing-email.service';

const TRIAL_MS = 3 * 24 * 60 * 60 * 1000;

type PausedCampaign = { userId: string; advertiserId: string; campaignId: string };

@Injectable()
export class FreeTrialService {
  private readonly logger = new Logger(FreeTrialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: BillingEmailService,
    private readonly config: ConfigService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async grant(input: { teamId: string; userId: string; email: string; name: string }) {
    const existing = await this.prisma.subscription.findUnique({ where: { teamId: input.teamId } });
    if (existing) return existing;

    const plan =
      (await this.prisma.subscriptionPlan.findFirst({
        where: { isActive: true, slug: { in: ['basic', 'starter'] } },
        orderBy: { sortOrder: 'asc' },
      })) ??
      (await this.prisma.subscriptionPlan.findFirst({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }));
    if (!plan) {
      this.logger.error(`Free trial skipped: no active plan team=${input.teamId}`);
      return null;
    }

    const now = new Date();
    const ends = new Date(now.getTime() + TRIAL_MS);
    const subscription = await this.prisma.subscription.create({
      data: {
        teamId: input.teamId,
        planId: plan.id,
        ownerUserId: input.userId,
        status: SubscriptionStatus.TRIAL,
        trialEndsAt: ends,
        currentPeriodStart: now,
        currentPeriodEnd: ends,
        autoRenew: false,
        mrrCents: 0,
        metadata: { freeTrial: true, trialDays: 3, emails: {} },
      },
    });

    const sent = await Promise.race([
      this.email.sendTrialStarted({
        to: input.email,
        customerName: input.name || input.email,
        endsAt: ends,
        plansUrl: this.plansUrl(),
      }),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 8000)),
    ]);
    if (sent) await this.markEmail(subscription.id, 'startedAt');
    this.logger.log(`Free trial granted team=${input.teamId} until=${ends.toISOString()}`);
    return subscription;
  }

  async sendDueNotices(now = new Date()) {
    const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const trials = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.TRIAL, trialEndsAt: { gt: now } },
      select: { id: true, teamId: true, ownerUserId: true, trialEndsAt: true, metadata: true },
    });

    for (const trial of trials) {
      const emails = this.emailFlags(trial.metadata);
      const endsAt = trial.trialEndsAt;
      if (!endsAt) continue;
      if (!emails.startedAt) {
        const recipient = await this.recipient(trial.teamId, trial.ownerUserId);
        if (recipient) {
          const sent = await this.email.sendTrialStarted({
            to: recipient.email,
            customerName: recipient.name || recipient.email,
            endsAt,
            plansUrl: this.plansUrl(),
          });
          if (sent) await this.markEmail(trial.id, 'startedAt');
        }
      }
      if (!emails.reminderAt && endsAt.getTime() <= soon.getTime()) {
        const recipient = await this.recipient(trial.teamId, trial.ownerUserId);
        if (!recipient) continue;
        const sent = await this.email.sendTrialReminder({
          to: recipient.email,
          customerName: recipient.name || recipient.email,
          endsAt,
          plansUrl: this.plansUrl(),
        });
        if (sent) await this.markEmail(trial.id, 'reminderAt');
      }
    }
  }

  async notifyTrialEnded(subscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { id: true, teamId: true, ownerUserId: true, trialEndsAt: true, metadata: true },
    });
    if (!sub?.trialEndsAt) return;
    if (this.emailFlags(sub.metadata).endedAt) return;
    const recipient = await this.recipient(sub.teamId, sub.ownerUserId);
    if (!recipient) return;
    const sent = await this.email.sendTrialEnded({
      to: recipient.email,
      customerName: recipient.name || recipient.email,
      plansUrl: this.plansUrl(),
    });
    if (sent) await this.markEmail(sub.id, 'endedAt');
  }

  async pauseTeamCampaigns(teamId: string) {
    const ads = this.tryGet(TikTokAdsService);
    const oauth = this.tryGet(TikTokMarketingOAuthService);
    if (!ads || !oauth) {
      await this.setPausePending(teamId, true);
      return;
    }

    await this.setPausePending(teamId, true);
    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      select: { userId: true },
    });
    const paused: PausedCampaign[] = [];
    let pending = false;

    for (const member of members) {
      let token = '';
      try {
        token = await oauth.getValidMarketingAccessToken(member.userId);
      } catch {
        continue;
      }
      const advertisers = await this.prisma.tikTokMarketingAdvertiser.findMany({
        where: { userId: member.userId },
        select: { advertiserId: true },
      });
      for (const advertiser of advertisers) {
        try {
          const rows = await ads.listCampaignRows(token, advertiser.advertiserId);
          const ids = rows
            .filter((row) => this.isRunning(row))
            .map((row) => String(row.campaign_id ?? ''))
            .filter(Boolean);
          for (let index = 0; index < ids.length; index += 20) {
            const chunk = ids.slice(index, index + 20);
            await ads.setCampaignStatus(token, advertiser.advertiserId, chunk, 'DISABLE');
            const saved = chunk.map((campaignId) => ({
              userId: member.userId,
              advertiserId: advertiser.advertiserId,
              campaignId,
            }));
            paused.push(...saved);
            await this.rememberPaused(teamId, saved);
          }
          if (ids.length) {
            await this.prisma.tikTokMarketingCampaign.updateMany({
              where: { teamId, advertiserId: advertiser.advertiserId, campaignId: { in: ids } },
              data: { status: 'DISABLE' },
            });
          }
        } catch (err) {
          pending = true;
          this.logger.warn(
            `Pause campaigns failed team=${teamId} advertiser=${advertiser.advertiserId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    }

    const sub = await this.prisma.subscription.findUnique({ where: { teamId } });
    if (!sub) return;
    const meta = this.readMeta(sub.metadata);
    const previous = this.pausedList(meta.pausedCampaigns);
    const merged = this.dedupePaused([...previous, ...paused]);
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        metadata: {
          ...meta,
          pausedCampaigns: merged,
          campaignsPausePending: pending,
          campaignsPausedAt: new Date().toISOString(),
        },
      },
    });
  }

  async resumePausedCampaigns(teamId: string) {
    const ads = this.tryGet(TikTokAdsService);
    const oauth = this.tryGet(TikTokMarketingOAuthService);
    const sub = await this.prisma.subscription.findUnique({ where: { teamId } });
    if (!sub) return;
    const meta = this.readMeta(sub.metadata);
    const paused = this.pausedList(meta.pausedCampaigns);
    if (!paused.length || !ads || !oauth) {
      if (!paused.length) {
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: { metadata: { ...meta, campaignsPausePending: false } },
        });
      }
      return;
    }

    const groups = new Map<string, string[]>();
    for (const item of paused) {
      const key = `${item.userId}\n${item.advertiserId}`;
      const list = groups.get(key) ?? [];
      list.push(item.campaignId);
      groups.set(key, list);
    }

    const remaining: PausedCampaign[] = [];
    for (const [key, ids] of groups) {
      const [userId, advertiserId] = key.split('\n');
      if (!userId || !advertiserId) continue;
      try {
        const token = await oauth.getValidMarketingAccessToken(userId);
        for (let index = 0; index < ids.length; index += 20) {
          await ads.setCampaignStatus(token, advertiserId, ids.slice(index, index + 20), 'ENABLE');
        }
        await this.prisma.tikTokMarketingCampaign.updateMany({
          where: { teamId, advertiserId, campaignId: { in: ids } },
          data: { status: 'ENABLE' },
        });
      } catch (err) {
        this.logger.warn(
          `Resume campaigns failed team=${teamId} advertiser=${advertiserId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        for (const campaignId of ids) remaining.push({ userId, advertiserId, campaignId });
      }
    }

    const latest = await this.prisma.subscription.findUnique({ where: { id: sub.id } });
    const nextMeta = this.readMeta(latest?.metadata);
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        metadata: {
          ...nextMeta,
          pausedCampaigns: remaining,
          campaignsPausePending: remaining.length > 0,
        },
      },
    });
  }

  async retryPendingPauses() {
    const rows = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.EXPIRED },
      select: { teamId: true, metadata: true },
    });
    for (const row of rows) {
      if (this.readMeta(row.metadata).campaignsPausePending === true) {
        await this.pauseTeamCampaigns(row.teamId);
      }
    }
  }

  private plansUrl() {
    const base = this.config.get<string>('PUBLIC_APP_URL', 'https://www.chatloora.com').replace(/\/$/, '');
    return `${base}/plans`;
  }

  private tryGet<T>(token: new (...args: never[]) => T): T | null {
    try {
      return this.moduleRef.get(token, { strict: false });
    } catch {
      return null;
    }
  }

  private async recipient(teamId: string, ownerUserId: string | null) {
    if (ownerUserId) {
      const owner = await this.prisma.user.findUnique({
        where: { id: ownerUserId },
        select: { email: true, name: true },
      });
      if (owner?.email) return owner;
    }
    const member = await this.prisma.teamMember.findFirst({
      where: { teamId, role: TeamRole.OWNER },
      include: { user: { select: { email: true, name: true } } },
    });
    return member?.user?.email ? member.user : null;
  }

  private async markEmail(subscriptionId: string, key: 'startedAt' | 'reminderAt' | 'endedAt') {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { metadata: true },
    });
    const meta = this.readMeta(sub?.metadata);
    const emails = this.emailFlags(meta);
    emails[key] = new Date().toISOString();
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { metadata: { ...meta, emails } },
    });
  }

  private async rememberPaused(teamId: string, items: PausedCampaign[]) {
    const sub = await this.prisma.subscription.findUnique({ where: { teamId } });
    if (!sub || !items.length) return;
    const meta = this.readMeta(sub.metadata);
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        metadata: {
          ...meta,
          pausedCampaigns: this.dedupePaused([...this.pausedList(meta.pausedCampaigns), ...items]),
          campaignsPausePending: true,
        },
      },
    });
  }

  private async setPausePending(teamId: string, pending: boolean) {
    const sub = await this.prisma.subscription.findUnique({ where: { teamId } });
    if (!sub) return;
    const meta = this.readMeta(sub.metadata);
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { metadata: { ...meta, campaignsPausePending: pending } },
    });
  }

  private readMeta(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
  }

  private emailFlags(metadata: unknown) {
    const emails = this.readMeta(this.readMeta(metadata).emails);
    return {
      startedAt: typeof emails.startedAt === 'string' ? emails.startedAt : '',
      reminderAt: typeof emails.reminderAt === 'string' ? emails.reminderAt : '',
      endedAt: typeof emails.endedAt === 'string' ? emails.endedAt : '',
    };
  }

  private pausedList(value: unknown): PausedCampaign[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const row = item as Record<string, unknown>;
      const userId = String(row.userId ?? '');
      const advertiserId = String(row.advertiserId ?? '');
      const campaignId = String(row.campaignId ?? '');
      return userId && advertiserId && campaignId ? [{ userId, advertiserId, campaignId }] : [];
    });
  }

  private dedupePaused(items: PausedCampaign[]) {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.userId}:${item.advertiserId}:${item.campaignId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private isRunning(row: Record<string, unknown>) {
    const operation = String(row.operation_status ?? '').toUpperCase();
    if (operation === 'DISABLE' || operation === 'DELETE') return false;
    if (operation === 'ENABLE') return true;
    const secondary = String(row.secondary_status ?? '').toUpperCase();
    if (secondary.includes('DISABLE') || secondary.includes('DELETE')) return false;
    return false;
  }
}
