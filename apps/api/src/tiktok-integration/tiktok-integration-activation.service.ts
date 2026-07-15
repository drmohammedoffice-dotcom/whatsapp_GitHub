import { randomUUID } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service';

import { TikTokAdsService } from '../integrations/tiktok-login-kit/tiktok-ads.service';

import { TikTokMarketingOAuthService } from '../integrations/tiktok-login-kit/tiktok-marketing-oauth.service';

import { eventsToActivate, activationTrackEvents } from './tiktok-integration.constants';

import { TikTokIntegrationPixelStatusService } from './tiktok-integration-pixel-status.service';

const ACTIVATION_SERVER_UA =
  'Mozilla/5.0 (compatible; ChatlooraPixelActivation/1.0; +https://almutamayiziq.com)';

@Injectable()
export class TikTokIntegrationActivationService {
  private readonly logger = new Logger(TikTokIntegrationActivationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ads: TikTokAdsService,
    private readonly marketingOAuth: TikTokMarketingOAuthService,
    private readonly pixelStatus: TikTokIntegrationPixelStatusService,
  ) {}

  async activateIntegration(integrationId: string, userId: string) {
    const integration = await this.prisma.tikTokIntegration.findFirst({
      where: { id: integrationId, userId },
      include: { eventConfigurations: true },
    });
    if (!integration?.pixelCode || !integration.pixelId || !integration.advertiserId) return;

    const accessToken = await this.marketingOAuth.getValidMarketingAccessToken(userId);
    const pixelCode = await this.ads.ensurePixelCode(
      accessToken,
      integration.advertiserId,
      integration.pixelId,
      integration.pixelCode,
    );

    if (pixelCode !== integration.pixelCode) {
      await this.prisma.tikTokIntegration.update({
        where: { id: integration.id },
        data: { pixelCode },
      });
    }

    const events = eventsToActivate({
      defaultOptimizationEvent: integration.defaultOptimizationEvent,
      customEventName: integration.customEventName,
      eventConfigurations: integration.eventConfigurations,
    });

    try {
      await this.ads.registerPixelEvents(
        accessToken,
        integration.advertiserId,
        integration.pixelId,
        events,
      );
      this.logger.log(`[Activation] registered events pixel=${integration.pixelId}`);
    } catch (err) {
      this.logger.warn(
        `[Activation] register events skipped pixel=${integration.pixelId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const landingUrl = `${this.webUrl()}/r/${integration.redirectSlug}`;
    const trackEvents = activationTrackEvents();
    await this.pixelStatus.triggerBrowserActivation(pixelCode, trackEvents);

    for (const event of trackEvents) {
      try {
        await this.ads.trackPixelEvent(accessToken, pixelCode, {
          event,
          event_id: randomUUID(),
          event_time: Math.floor(Date.now() / 1000),
          url: landingUrl,
          userAgent: ACTIVATION_SERVER_UA,
        });
        this.logger.log(`[Activation] ${event} sent pixel=${pixelCode}`);
      } catch (err) {
        this.logger.warn(
          `[Activation] ${event} failed pixel=${pixelCode}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      await this.delay(350);
    }

    if (integration.wizardCompleted && integration.whatsappNumber) {
      this.logger.log(`[Activation] pixel warmup complete slug=${integration.redirectSlug}`);
    }

    await this.prisma.tikTokIntegration.update({
      where: { id: integration.id },
      data: { activatedAt: new Date(), pixelStatus: 'waiting_for_activity' },
    });

    await this.pixelStatus
      .refreshIntegrationStatus(integration.id, userId, integration.pixelId, integration.advertiserId)
      .catch(() => undefined);
  }

  /** Re-sync pixel codes and re-send activation events for pixels stuck waiting. */
  async repairWaitingPixels(userId: string, teamId: string) {
    const waiting = await this.prisma.tikTokIntegration.findMany({
      where: {
        userId,
        teamId,
        wizardCompleted: true,
        pixelId: { not: null },
        pixelStatus: { in: ['waiting_for_activity', 'pending', 'unknown'] },
      },
      include: { eventConfigurations: true },
      take: 10,
    });
    for (const row of waiting) {
      await this.activateIntegration(row.id, userId);
    }
    return { repaired: waiting.length };
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private webUrl() {
    return this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '');
  }
}
