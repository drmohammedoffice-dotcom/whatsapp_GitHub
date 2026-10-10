import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TikTokAdsService } from '../integrations/tiktok-login-kit/tiktok-ads.service';
import { TikTokMarketingOAuthService } from '../integrations/tiktok-login-kit/tiktok-marketing-oauth.service';
import { TikTokEventsApiCredentialsService } from './tiktok-events-api-credentials.service';
import {
  TIKTOK_COMPLETE_REGISTRATION_EVENT,
  TIKTOK_CONTACT_MAX_RETRIES,
  TIKTOK_LEAD_EVENT,
  TIKTOK_PURCHASE_EVENT,
  contactRetryDelayMs,
} from './tiktok-integration.constants';
import { hashTikTokPhone } from './tiktok-contact-hash';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES } from '../queues/queues.constants';
import type { TikTokContactJob } from './tiktok-integration-tracking.service';

@Injectable()
export class TikTokLifecycleEventsService {
  private readonly logger = new Logger(TikTokLifecycleEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ads: TikTokAdsService,
    private readonly marketingOAuth: TikTokMarketingOAuthService,
    private readonly credentials: TikTokEventsApiCredentialsService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.TIKTOK_CONTACT) private readonly contactQueue: Queue<TikTokContactJob>,
  ) {}

  /** Lead — when conversation is marked as qualified. */
  async sendLeadForConversation(teamId: string, conversationId: string) {
    const conversion = await this.prisma.tikTokIntegrationConversion.findFirst({
      where: {
        conversationId,
        eventName: 'Contact',
        contactSent: true,
        integration: { teamId, billingSuspended: false },
      },
      include: { integration: true },
      orderBy: { sentAt: 'desc' },
    });
    if (!conversion?.integration?.pixelCode) {
      this.logger.debug(`Lead skipped: no sent Contact for conversation=${conversationId}`);
      return null;
    }

    return this.enqueueLifecycleEvent({
      integrationId: conversion.integrationId,
      eventName: TIKTOK_LEAD_EVENT,
      conversationId,
      contactId: conversion.contactId,
      whatsappPhone: conversion.whatsappPhone,
      ttclid: conversion.ttclid,
      clickId: conversion.clickId,
      leadId: conversion.leadId,
      externalId: conversion.externalId ?? conversion.leadId,
      pageUrl: conversion.pageUrl,
    });
  }

  /** CompleteRegistration — Chatloora account creation (platform pixel). */
  async sendCompleteRegistration(input: { teamId: string; userId: string; email?: string }) {
    const platform = this.credentials.getPlatformCredentials();
    if (!platform) {
      this.logger.debug('CompleteRegistration skipped: TIKTOK_PLATFORM_* not configured');
      return null;
    }
    const eventId = `reg_${input.userId}`;
    if (await this.alreadySentPlatformEvent(TIKTOK_COMPLETE_REGISTRATION_EVENT, eventId)) {
      return { ok: true as const, deduped: true };
    }
    return this.sendWithRawCredentials({
      pixelCode: platform.pixelCode,
      accessToken: platform.accessToken,
      eventName: TIKTOK_COMPLETE_REGISTRATION_EVENT,
      eventId,
      externalId: input.userId,
      pageUrl: `${this.webUrl()}/register`,
      properties: { content_id: input.teamId },
      meta: { kind: 'platform_registration', teamId: input.teamId, userId: input.userId },
    });
  }

  /** Purchase — successful Chatloora subscription payment (platform pixel). */
  async sendPurchase(input: {
    teamId: string;
    paymentId: string;
    amountCents: number;
    currency: string;
  }) {
    const platform = this.credentials.getPlatformCredentials();
    if (!platform) {
      this.logger.debug('Purchase skipped: TIKTOK_PLATFORM_* not configured');
      return null;
    }
    const eventId = `purchase_${input.paymentId}`;
    if (await this.alreadySentPlatformEvent(TIKTOK_PURCHASE_EVENT, eventId)) {
      return { ok: true as const, deduped: true };
    }
    const value = (input.amountCents / 100).toFixed(2);
    return this.sendWithRawCredentials({
      pixelCode: platform.pixelCode,
      accessToken: platform.accessToken,
      eventName: TIKTOK_PURCHASE_EVENT,
      eventId,
      externalId: input.paymentId,
      orderId: input.paymentId,
      pageUrl: `${this.webUrl()}/pricing/payment`,
      properties: {
        value,
        currency: input.currency || 'USD',
        order_id: input.paymentId,
        content_id: input.teamId,
      },
      meta: { kind: 'platform_purchase', teamId: input.teamId, paymentId: input.paymentId },
    });
  }

  private async alreadySentPlatformEvent(eventName: string, eventId: string) {
    const prior = await this.prisma.tikTokIntegrationApiLog.findFirst({
      where: { eventName, eventId, success: true },
      select: { id: true },
    });
    return Boolean(prior);
  }

  private async enqueueLifecycleEvent(input: {
    integrationId: string;
    eventName: string;
    conversationId?: string | null;
    contactId?: string | null;
    whatsappPhone?: string | null;
    ttclid?: string | null;
    clickId?: string | null;
    leadId?: string | null;
    externalId?: string | null;
    pageUrl?: string | null;
    orderId?: string | null;
    valueAmount?: number | null;
    currency?: string | null;
  }) {
    const existing = await this.prisma.tikTokIntegrationConversion.findFirst({
      where: {
        integrationId: input.integrationId,
        eventName: input.eventName,
        ...(input.conversationId
          ? { conversationId: input.conversationId }
          : input.orderId
            ? { orderId: input.orderId }
            : {}),
      },
    });
    if (existing?.contactSent) return existing;
    if (existing && !existing.contactSent) {
      await this.dispatchLifecycleEvent(existing.id);
      return existing;
    }

    const created = await this.prisma.tikTokIntegrationConversion.create({
      data: {
        integrationId: input.integrationId,
        eventName: input.eventName,
        eventId: randomUUID(),
        conversationId: input.conversationId ?? null,
        contactId: input.contactId ?? null,
        whatsappPhone: input.whatsappPhone ?? null,
        ttclid: input.ttclid ?? null,
        clickId: input.clickId ?? null,
        leadId: input.leadId ?? null,
        externalId: input.externalId ?? null,
        pageUrl: input.pageUrl ?? null,
        orderId: input.orderId ?? null,
        valueAmount: input.valueAmount ?? null,
        currency: input.currency ?? null,
        firstMessageAt: new Date(),
        contactSent: false,
        tiktokStatus: 'pending',
      },
    });
    await this.dispatchLifecycleEvent(created.id);
    return created;
  }

  async dispatchLifecycleEvent(conversionId: string) {
    const leaseUntil = new Date(Date.now() + 5 * 60 * 1000);
    const claimed = await this.prisma.tikTokIntegrationConversion.updateMany({
      where: {
        id: conversionId,
        contactSent: false,
        retryCount: { lt: TIKTOK_CONTACT_MAX_RETRIES },
        OR: [
          { tiktokStatus: 'pending' },
          { tiktokStatus: 'sending', nextRetryAt: { lte: new Date() } },
        ],
      },
      data: { tiktokStatus: 'sending', nextRetryAt: leaseUntil },
    });
    if (claimed.count !== 1) {
      return this.prisma.tikTokIntegrationConversion.findUnique({ where: { id: conversionId } });
    }

    const conversion = await this.prisma.tikTokIntegrationConversion.findUnique({
      where: { id: conversionId },
      include: { integration: true },
    });
    if (!conversion || conversion.contactSent) return conversion;
    const integration = conversion.integration;
    if (!integration?.pixelCode) {
      await this.fail(conversion.id, 'missing_pixel_code', true);
      return null;
    }

    const accessToken =
      this.credentials.getAccessTokenForIntegration(integration) ??
      (await this.marketingOAuth.getValidMarketingAccessToken(integration.userId).catch(() => null));
    if (!accessToken) {
      await this.fail(conversion.id, 'missing_events_api_token', true);
      return null;
    }

    const properties: Record<string, string> = {};
    if (conversion.valueAmount != null) properties.value = String(conversion.valueAmount);
    if (conversion.currency) properties.currency = conversion.currency;
    if (conversion.orderId) properties.order_id = conversion.orderId;

    const started = Date.now();
    const phoneHash = conversion.whatsappPhone ? hashTikTokPhone(conversion.whatsappPhone) : null;
    const payload = {
      event: conversion.eventName,
      event_id: conversion.eventId,
      event_time: Math.floor((conversion.firstMessageAt ?? conversion.createdAt).getTime() / 1000),
      url: conversion.pageUrl ?? `${this.webUrl()}/tiktok/integration`,
      ttclid: conversion.ttclid,
      phone: phoneHash ?? undefined,
      externalId: conversion.externalId ?? conversion.leadId ?? undefined,
      properties,
    };

    try {
      const response = await this.ads.trackPixelEvent(accessToken, integration.pixelCode, payload);
      await this.logAttempt({
        integrationId: integration.id,
        conversionId: conversion.id,
        eventName: conversion.eventName,
        eventId: conversion.eventId,
        attempt: conversion.retryCount + 1,
        httpStatus: 200,
        success: true,
        processingMs: Date.now() - started,
        requestPayload: this.sanitize(payload),
        responseBody: response as object,
      });
      const sentAt = new Date();
      const updated = await this.prisma.tikTokIntegrationConversion.update({
        where: { id: conversion.id },
        data: {
          contactSent: true,
          tiktokStatus: 'sent',
          tiktokResponse: response as object,
          tiktokError: null,
          nextRetryAt: null,
          sentAt,
        },
      });
      await this.prisma.tikTokIntegration.update({
        where: { id: integration.id },
        data: {
          lastEventSentAt: sentAt,
          lastEventName: conversion.eventName,
          lastApiHttpStatus: 200,
          lastApiError: null,
        },
      });
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.logAttempt({
        integrationId: integration.id,
        conversionId: conversion.id,
        eventName: conversion.eventName,
        eventId: conversion.eventId,
        attempt: conversion.retryCount + 1,
        httpStatus: this.httpStatusFromError(err),
        success: false,
        processingMs: Date.now() - started,
        requestPayload: this.sanitize(payload),
        errorMessage: message,
      });
      await this.scheduleRetry(conversion.id, message);
      return null;
    }
  }

  private async sendWithRawCredentials(input: {
    pixelCode: string;
    accessToken: string;
    eventName: string;
    eventId: string;
    externalId?: string;
    orderId?: string;
    pageUrl?: string;
    properties?: Record<string, string>;
    meta?: Record<string, string>;
  }) {
    const started = Date.now();
    const payload = {
      event: input.eventName,
      event_id: input.eventId,
      event_time: Math.floor(Date.now() / 1000),
      url: input.pageUrl,
      externalId: input.externalId,
      properties: input.properties,
    };
    try {
      const response = await this.ads.trackPixelEvent(input.accessToken, input.pixelCode, payload);
      await this.logAttempt({
        integrationId: null,
        conversionId: null,
        eventName: input.eventName,
        eventId: input.eventId,
        attempt: 1,
        httpStatus: 200,
        success: true,
        processingMs: Date.now() - started,
        requestPayload: { ...this.sanitize(payload), meta: input.meta },
        responseBody: response as object,
      });
      this.logger.log(`[Lifecycle] ${input.eventName} sent eventId=${input.eventId}`);
      return { ok: true, response };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.logAttempt({
        integrationId: null,
        conversionId: null,
        eventName: input.eventName,
        eventId: input.eventId,
        attempt: 1,
        httpStatus: this.httpStatusFromError(err),
        success: false,
        processingMs: Date.now() - started,
        requestPayload: { ...this.sanitize(payload), meta: input.meta },
        errorMessage: message,
      });
      this.logger.warn(`[Lifecycle] ${input.eventName} failed: ${message}`);
      return { ok: false, error: message };
    }
  }

  private async scheduleRetry(conversionId: string, error: string) {
    const current = await this.prisma.tikTokIntegrationConversion.findUnique({
      where: { id: conversionId },
      select: { retryCount: true, integrationId: true },
    });
    const retryCount = (current?.retryCount ?? 0) + 1;
    const exhausted = retryCount >= TIKTOK_CONTACT_MAX_RETRIES;
    const delay = contactRetryDelayMs(retryCount);
    await this.prisma.tikTokIntegrationConversion.update({
      where: { id: conversionId },
      data: {
        contactSent: false,
        tiktokStatus: exhausted ? 'failed' : 'pending',
        tiktokError: error.slice(0, 2000),
        retryCount,
        nextRetryAt: exhausted ? null : new Date(Date.now() + delay),
      },
    });
    if (current?.integrationId) {
      await this.prisma.tikTokIntegration.update({
        where: { id: current.integrationId },
        data: { lastApiError: error.slice(0, 2000) },
      });
    }
    if (!exhausted) {
      await this.contactQueue.add(
        'retry-contact',
        { conversionId },
        { jobId: `tiktok-lifecycle-${conversionId}-${retryCount}`, delay, removeOnComplete: true, removeOnFail: 100 },
      );
    }
  }

  private async fail(conversionId: string, error: string, terminal: boolean) {
    await this.prisma.tikTokIntegrationConversion.update({
      where: { id: conversionId },
      data: {
        contactSent: false,
        tiktokStatus: terminal ? 'failed' : 'pending',
        tiktokError: error.slice(0, 2000),
        nextRetryAt: terminal ? null : new Date(Date.now() + contactRetryDelayMs(1)),
      },
    });
  }

  private async logAttempt(input: {
    integrationId: string | null;
    conversionId: string | null;
    eventName: string;
    eventId: string | null;
    attempt: number;
    httpStatus: number | null;
    success: boolean;
    processingMs: number;
    requestPayload: object;
    responseBody?: object;
    errorMessage?: string;
  }) {
    await this.prisma.tikTokIntegrationApiLog.create({
      data: {
        id: randomUUID(),
        integrationId: input.integrationId,
        conversionId: input.conversionId,
        eventName: input.eventName,
        eventId: input.eventId,
        attempt: input.attempt,
        httpStatus: input.httpStatus,
        success: input.success,
        processingMs: input.processingMs,
        requestPayload: input.requestPayload as object,
        responseBody: (input.responseBody ?? undefined) as object | undefined,
        errorMessage: input.errorMessage?.slice(0, 2000),
      },
    }).catch((err) => this.logger.warn(`API log write failed: ${String(err)}`));
  }

  private sanitize(payload: Record<string, unknown>) {
    const clone = { ...payload };
    if (clone.accessToken) clone.accessToken = '[redacted]';
    return clone;
  }

  private httpStatusFromError(err: unknown): number | null {
    const anyErr = err as { response?: { status?: number }; status?: number };
    return anyErr?.response?.status ?? anyErr?.status ?? null;
  }

  private webUrl() {
    return this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '');
  }
}
