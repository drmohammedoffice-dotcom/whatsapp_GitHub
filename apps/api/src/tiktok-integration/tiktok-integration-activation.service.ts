import { randomUUID } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service';

import { TikTokAdsService } from '../integrations/tiktok-login-kit/tiktok-ads.service';

import { TikTokMarketingOAuthService } from '../integrations/tiktok-login-kit/tiktok-marketing-oauth.service';

import {
  activationOptimizationSeedEvents,
  activationTrackEvents,
  eventsToActivate,
  optimizationEventProperties,
} from './tiktok-integration.constants';

import { TikTokEventsApiCredentialsService } from './tiktok-events-api-credentials.service';
import { TikTokIntegrationPixelStatusService } from './tiktok-integration-pixel-status.service';

const ACTIVATION_SERVER_UA =
  'Mozilla/5.0 (compatible; ChatlooraPixelActivation/1.0; +https://www.chatloora.com)';

@Injectable()
export class TikTokIntegrationActivationService {
  private readonly logger = new Logger(TikTokIntegrationActivationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ads: TikTokAdsService,
    private readonly marketingOAuth: TikTokMarketingOAuthService,
    private readonly pixelStatus: TikTokIntegrationPixelStatusService,
    private readonly eventsApiCredentials: TikTokEventsApiCredentialsService,
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

    const dest = integration.redirectDestinationType;
    const events = eventsToActivate({
      defaultOptimizationEvent: integration.defaultOptimizationEvent,
      customEventName: integration.customEventName,
      eventConfigurations: integration.eventConfigurations,
    });
    // دائماً سجّل أهداف التحسين الشائعة حتى تظهر في Ads Manager بدون رسالة واتساب
    for (const name of activationOptimizationSeedEvents()) events.push(name);
    if (dest === 'STORE' || integration.externalRedirectUrl?.includes('/s/')) {
      events.push('InitiateCheckout');
    }

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
    const pageUrl = integration.externalRedirectUrl || landingUrl;
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

    // بذور Events API: Contact + Lead + Purchase لتفعيل أهداف التحسين فوراً (بدون واتساب)
    const seedEvents = activationOptimizationSeedEvents();
    for (const event of seedEvents) {
      try {
        const props = optimizationEventProperties(event);
        await this.ads.trackPixelEvent(accessToken, pixelCode, {
          event,
          event_id: `activate_${event.toLowerCase()}_${randomUUID()}`,
          event_time: Math.floor(Date.now() / 1000),
          url: pageUrl,
          userAgent: ACTIVATION_SERVER_UA,
          properties: props
            ? {
                ...props,
                order_id: `activate_${integration.id}`,
                content_type:
                  dest === 'INSTANT_FORM'
                    ? 'lead_form'
                    : dest === 'STORE'
                      ? 'product'
                      : 'activation',
              }
            : undefined,
        });
        this.logger.log(`[Activation] optimization seed ${event} sent pixel=${pixelCode}`);
      } catch (err) {
        this.logger.warn(
          `[Activation] optimization seed ${event} failed pixel=${pixelCode}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      await this.delay(400);
    }

    this.logger.log(
      `[Activation] pixel warmup complete slug=${integration.redirectSlug} seeds=${seedEvents.join(',')}`,
    );

    // ربط Events API فوراً من توكن الحساب الإعلاني + تعليم البكسل نشطاً عند نجاح الإرسال
    let eventsReady = false;
    try {
      const linked = await this.eventsApiCredentials.ensureAdvertiserToken(userId, {
        id: integration.id,
        pixelCode,
        pixelId: integration.pixelId,
        advertiserId: integration.advertiserId,
        eventsApiConnected: Boolean(integration.eventsApiConnected),
        eventsApiTokenHint: integration.eventsApiTokenHint,
        encryptedEventsApiAccessToken: integration.encryptedEventsApiAccessToken,
      });
      eventsReady = Boolean(
        (linked as { eventsApiConnected?: boolean }).eventsApiConnected
        || (linked as { eventsApiStatus?: string }).eventsApiStatus === 'connected',
      );
    } catch (err) {
      this.logger.warn(
        `[Activation] ensureAdvertiserToken failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const tiktokStatus = await this.pixelStatus
      .refreshIntegrationStatus(integration.id, userId, integration.pixelId, integration.advertiserId)
      .catch(() => null);

    const readyNow = eventsReady || tiktokStatus?.status === 'active';
    await this.prisma.tikTokIntegration.update({
      where: { id: integration.id },
      data: {
        activatedAt: new Date(),
        ...(readyNow
          ? {
              pixelStatus: 'active',
              pixelStatusMessage: eventsReady
                ? 'مفعّل مباشرة عبر Events API'
                : 'نشط حسب حالة تيك توك',
            }
          : {
              pixelStatus: tiktokStatus?.status || 'waiting_for_activity',
              pixelStatusMessage:
                tiktokStatus?.message
                || 'بانتظار تأكيد تيك توك — افتح رابط التتبع مرة واحدة',
            }),
      },
    });
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
