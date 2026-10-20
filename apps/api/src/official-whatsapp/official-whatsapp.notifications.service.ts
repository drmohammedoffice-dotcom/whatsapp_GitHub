import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  OfficialNotificationStatus,
  OfficialNotificationType,
  SubscriptionStatus,
} from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { OfficialWhatsAppSenderService } from './official-whatsapp.sender.service';
import { dateOnlyUtc, normalizeWaDigits } from './official-whatsapp.util';

@Injectable()
export class OfficialWhatsAppNotificationService {
  private readonly logger = new Logger(OfficialWhatsAppNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: OfficialWhatsAppSenderService,
    private readonly config: ConfigService,
  ) {}

  async getConfig() {
    return this.prisma.officialSubscriptionNotifyConfig.upsert({
      where: { id: 'subscription' },
      create: { id: 'subscription' },
      update: {},
    });
  }

  async saveConfig(input: Partial<{
    enabled: boolean;
    reminder1Days: number;
    reminder1Enabled: boolean;
    reminder2Days: number;
    reminder2Enabled: boolean;
    expiredEnabled: boolean;
    paymentEnabled: boolean;
    activatedEnabled: boolean;
    renewalEnabled: boolean;
  }>) {
    const current = await this.getConfig();
    return this.prisma.officialSubscriptionNotifyConfig.update({
      where: { id: 'subscription' },
      data: {
        enabled: input.enabled ?? current.enabled,
        reminder1Days: input.reminder1Days ?? current.reminder1Days,
        reminder1Enabled: input.reminder1Enabled ?? current.reminder1Enabled,
        reminder2Days: input.reminder2Days ?? current.reminder2Days,
        reminder2Enabled: input.reminder2Enabled ?? current.reminder2Enabled,
        expiredEnabled: input.expiredEnabled ?? current.expiredEnabled,
        paymentEnabled: input.paymentEnabled ?? current.paymentEnabled,
        activatedEnabled: input.activatedEnabled ?? current.activatedEnabled,
        renewalEnabled: input.renewalEnabled ?? current.renewalEnabled,
      },
    });
  }

  async listLogs(skip = 0, take = 50) {
    const [items, total] = await Promise.all([
      this.prisma.subscriptionNotificationLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: Math.min(take, 200),
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
      this.prisma.subscriptionNotificationLog.count(),
    ]);
    return { items, total };
  }

  async listTemplates() {
    await this.ensureDefaultTemplates();
    return this.prisma.officialWhatsAppTemplate.findMany({ orderBy: { type: 'asc' } });
  }

  async upsertTemplate(input: {
    type: OfficialNotificationType;
    name: string;
    language?: string;
    enabled?: boolean;
  }) {
    return this.prisma.officialWhatsAppTemplate.upsert({
      where: { type: input.type },
      create: {
        type: input.type,
        name: input.name.trim(),
        language: input.language?.trim() || 'en',
        enabled: input.enabled ?? false,
      },
      update: {
        name: input.name.trim(),
        language: input.language?.trim() || undefined,
        enabled: input.enabled,
      },
    });
  }

  /**
   * Runs on the API process via Nest ScheduleModule (same pattern as subscription-expiry).
   * Failures are logged and never throw into billing/subscription flows.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processDueNotifications() {
    try {
      const cfg = await this.getConfig();
      if (!cfg.enabled) return;
      const sender = await this.sender.getPublicStatus();
      if (!sender.enabled || !sender.hasAccessToken) return;

      const now = new Date();
      const active = await this.prisma.subscription.findMany({
        where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] } },
        include: { owner: true, team: true },
      });

      for (const sub of active) {
        const end = sub.currentPeriodEnd ?? sub.trialEndsAt;
        if (!end) continue;
        const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
        const phone = normalizeWaDigits(sub.owner?.phone ?? '');
        if (!phone) continue;

        if (cfg.reminder1Enabled && daysLeft === cfg.reminder1Days) {
          await this.sendOnce({
            subscriptionId: sub.id,
            teamId: sub.teamId,
            userId: sub.ownerUserId,
            phone,
            type: OfficialNotificationType.SUBSCRIPTION_EXPIRING,
            parameters: [String(cfg.reminder1Days), sub.team.name],
          });
        }
        if (cfg.reminder2Enabled && daysLeft === cfg.reminder2Days) {
          await this.sendOnce({
            subscriptionId: sub.id,
            teamId: sub.teamId,
            userId: sub.ownerUserId,
            phone,
            type: OfficialNotificationType.SUBSCRIPTION_EXPIRING_SOON,
            parameters: [String(cfg.reminder2Days), sub.team.name],
          });
        }
      }

      if (cfg.expiredEnabled) {
        const expired = await this.prisma.subscription.findMany({
          where: { status: SubscriptionStatus.EXPIRED, expiredAt: { gte: new Date(now.getTime() - 36 * 3600_000) } },
          include: { owner: true, team: true },
        });
        for (const sub of expired) {
          const phone = normalizeWaDigits(sub.owner?.phone ?? '');
          if (!phone) continue;
          await this.sendOnce({
            subscriptionId: sub.id,
            teamId: sub.teamId,
            userId: sub.ownerUserId,
            phone,
            type: OfficialNotificationType.SUBSCRIPTION_EXPIRED,
            parameters: [sub.team.name],
          });
        }
      }
    } catch (error) {
      this.logger.warn(
        `[official-wa-notify] cron failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  async notifyPayment(subscriptionId: string, type: OfficialNotificationType) {
    const cfg = await this.getConfig();
    if (!cfg.enabled) return { skipped: true, reason: 'disabled' };
    if (type === OfficialNotificationType.PAYMENT_SUCCESSFUL && !cfg.paymentEnabled) {
      return { skipped: true, reason: 'payment_disabled' };
    }
    if (type === OfficialNotificationType.SUBSCRIPTION_ACTIVATED && !cfg.activatedEnabled) {
      return { skipped: true, reason: 'activated_disabled' };
    }
    if (type === OfficialNotificationType.SUBSCRIPTION_RENEWAL && !cfg.renewalEnabled) {
      return { skipped: true, reason: 'renewal_disabled' };
    }
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { owner: true, team: true },
    });
    if (!sub) return { skipped: true, reason: 'missing_subscription' };
    const phone = normalizeWaDigits(sub.owner?.phone ?? '');
    if (!phone) return { skipped: true, reason: 'no_phone' };
    return this.sendOnce({
      subscriptionId: sub.id,
      teamId: sub.teamId,
      userId: sub.ownerUserId,
      phone,
      type,
      parameters: [sub.team.name],
    });
  }

  async sendOnce(input: {
    subscriptionId: string;
    teamId: string;
    userId: string | null | undefined;
    phone: string;
    type: OfficialNotificationType;
    parameters?: string[];
  }) {
    const scheduledDate = dateOnlyUtc();
    const existing = await this.prisma.subscriptionNotificationLog.findUnique({
      where: {
        subscriptionId_notificationType_scheduledDate: {
          subscriptionId: input.subscriptionId,
          notificationType: input.type,
          scheduledDate,
        },
      },
    });
    if (existing?.status === OfficialNotificationStatus.SENT) {
      return { skipped: true, reason: 'already_sent', id: existing.id };
    }

    const log =
      existing ??
      (await this.prisma.subscriptionNotificationLog.create({
        data: {
          subscriptionId: input.subscriptionId,
          teamId: input.teamId,
          userId: input.userId ?? null,
          notificationType: input.type,
          templateName: input.type,
          status: OfficialNotificationStatus.PENDING,
          scheduledDate,
          phone: input.phone,
        },
      }));

    try {
      const sent = await this.sender.sendNamedTemplate({
        to: input.phone,
        type: input.type,
        parameters: input.parameters,
      });
      await this.prisma.subscriptionNotificationLog.update({
        where: { id: log.id },
        data: {
          status: OfficialNotificationStatus.SENT,
          providerMessageId: sent.messageId ?? null,
          templateName: sent.templateName,
          sentAt: new Date(),
          failureReason: null,
          attempts: { increment: 1 },
        },
      });
      return { skipped: false, id: log.id, messageId: sent.messageId };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'send_failed';
      await this.prisma.subscriptionNotificationLog.update({
        where: { id: log.id },
        data: {
          status: OfficialNotificationStatus.FAILED,
          failureReason: reason.slice(0, 500),
          attempts: { increment: 1 },
        },
      });
      this.logger.warn(`[official-wa-notify] send failed type=${input.type} sub=${input.subscriptionId}`);
      return { skipped: false, failed: true, reason };
    }
  }

  private async ensureDefaultTemplates() {
    const envByType: Partial<Record<OfficialNotificationType, string>> = {
      [OfficialNotificationType.ACCOUNT_VERIFICATION_OTP]: this.config.get<string>('CHATLOORA_WHATSAPP_OTP_TEMPLATE')?.trim() || '',
      [OfficialNotificationType.LOGIN_OTP]: this.config.get<string>('CHATLOORA_WHATSAPP_OTP_TEMPLATE')?.trim() || '',
      [OfficialNotificationType.PASSWORD_RESET_OTP]: this.config.get<string>('CHATLOORA_WHATSAPP_OTP_TEMPLATE')?.trim() || '',
      [OfficialNotificationType.SUBSCRIPTION_EXPIRING]: this.config.get<string>('CHATLOORA_WHATSAPP_SUBSCRIPTION_EXPIRY_TEMPLATE')?.trim() || '',
      [OfficialNotificationType.SUBSCRIPTION_EXPIRING_SOON]: this.config.get<string>('CHATLOORA_WHATSAPP_SUBSCRIPTION_EXPIRY_TEMPLATE')?.trim() || '',
      [OfficialNotificationType.SUBSCRIPTION_EXPIRED]: this.config.get<string>('CHATLOORA_WHATSAPP_SUBSCRIPTION_EXPIRED_TEMPLATE')?.trim() || '',
    };
    for (const type of Object.values(OfficialNotificationType)) {
      await this.prisma.officialWhatsAppTemplate.upsert({
        where: { type },
        create: { type, name: envByType[type] ?? '', language: 'en', enabled: false },
        update: {},
      });
    }
  }
}
