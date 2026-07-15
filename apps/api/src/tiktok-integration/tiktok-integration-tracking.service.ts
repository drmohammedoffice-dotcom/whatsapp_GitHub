import { randomUUID } from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageType } from '@watsapp/database';
import { SOCKET_EVENTS } from '@watsapp/shared';
import { Queue } from 'bullmq';
import { ChannelMetadataWithPurpose, isTrackingChannel } from '../channels/channel-purpose';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { BillingAccessService } from '../billing/billing-access.service';
import { TikTokAdsService } from '../integrations/tiktok-login-kit/tiktok-ads.service';
import { TikTokMarketingOAuthService } from '../integrations/tiktok-login-kit/tiktok-marketing-oauth.service';
import { phoneFromJid, resolveStoredPhone } from '../modules/whatsapp/utils/disconnect.util';
import { SessionManager } from '../modules/whatsapp/session.manager';
import { QUEUES } from '../queues/queues.constants';
import {
  TIKTOK_TRACKING_REF_PREFIX,
  TIKTOK_TRACKING_REF_SUFFIX,
} from '../tiktok/tiktok.constants';
import { decodeHiddenTrackingRef, encodeHiddenTrackingRef } from '../tiktok/hidden-tracking-ref';
import {
  TIKTOK_CONVERSION_ATTRIBUTION_DAYS,
  DEFAULT_REDIRECT_MESSAGE,
  TIKTOK_CLICK_TO_MESSAGE_MINUTES,
  TIKTOK_CONTACT_EVENT,
  TIKTOK_CONTACT_MAX_RETRIES,
  contactRetryDelayMs,
  sanitizeTtclid,
  conversionEventName,
  optimizationEventProperties,
} from './tiktok-integration.constants';
import { hashTikTokPhone } from './tiktok-contact-hash';
import { TikTokEventsApiCredentialsService } from './tiktok-events-api-credentials.service';

const RECENT_LEAD_LINK_MINUTES = TIKTOK_CLICK_TO_MESSAGE_MINUTES;

export type RedirectInput = {
  slug: string;
  ttclid?: string | null;
  campaignId?: string | null;
  adgroupId?: string | null;
  adId?: string | null;
  advertiserId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type FirstInboundMessageInput = {
  teamId: string;
  channelId: string;
  conversationId: string;
  contactId: string;
  senderPhone?: string | null;
  messageText?: string | null;
  messageType: MessageType;
};

export type TikTokContactJob = { conversionId: string };

const REAL_INBOUND_TYPES = new Set<MessageType>([
  MessageType.TEXT,
  MessageType.AUDIO,
  MessageType.IMAGE,
  MessageType.STICKER,
  MessageType.VIDEO,
  MessageType.DOCUMENT,
]);

@Injectable()
export class TikTokIntegrationTrackingService {
  private readonly logger = new Logger(TikTokIntegrationTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly billingAccess: BillingAccessService,
    private readonly ads: TikTokAdsService,
    private readonly marketingOAuth: TikTokMarketingOAuthService,
    private readonly credentials: TikTokEventsApiCredentialsService,
    private readonly realtime: RealtimeGateway,
    private readonly sessionManager: SessionManager,
    @InjectQueue(QUEUES.TIKTOK_CONTACT) private readonly contactQueue: Queue<TikTokContactJob>,
  ) {}

  async handleRedirect(input: RedirectInput) {
    const fallbackWeb = this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '');

    const integration = await this.prisma.tikTokIntegration.findUnique({
      where: { redirectSlug: input.slug },
      include: { eventConfigurations: true },
    });

    if (!integration?.wizardCompleted || !integration.whatsappNumber || integration.billingSuspended) {
      return { redirectUrl: `${fallbackWeb}/whatsapp`, subscriptionExpired: true };
    }

    const access = await this.billingAccess.getTeamAccess(integration.teamId);
    if (!access.isActive) {
      return { redirectUrl: `${fallbackWeb}/whatsapp`, subscriptionExpired: true };
    }

    // Persist click + ttclid only — never send conversion events on click.
    // Conversion (Contact / CompletePayment / …) fires on first real inbound WhatsApp message.
    const click = await this.prisma.tikTokIntegrationClick.create({
      data: {
        integrationId: integration.id,
        ttclid: sanitizeTtclid(input.ttclid),
        campaignId: input.campaignId ?? null,
        adgroupId: input.adgroupId ?? null,
        adId: input.adId ?? null,
        advertiserId: input.advertiserId ?? integration.advertiserId ?? null,
        ipAddress: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });

    this.emitIntegrationUpdated(integration.teamId, integration.id, 'click');

    const baseMessage = integration.redirectMessage?.trim() || DEFAULT_REDIRECT_MESSAGE;
    const message = `${baseMessage}${encodeHiddenTrackingRef(click.id)}`;
    const whatsappTarget = await this.resolveWhatsappRedirectTarget(integration);
    const redirectUrl = whatsappTarget
      ? `https://wa.me/${whatsappTarget}?text=${encodeURIComponent(message)}`
      : `${fallbackWeb}/whatsapp`;

    const optimizationEvent = conversionEventName({
      defaultOptimizationEvent: integration.defaultOptimizationEvent,
      customEventName: integration.customEventName,
    });

    return {
      redirectUrl,
      click,
      pixelId: integration.pixelId,
      pixelCode: integration.pixelCode,
      optimizationEvent,
      eventsSent: [] as string[],
    };
  }

  async isWhatsappConnectedOnTeam(teamId: string, whatsappNumber: string | null | undefined) {
    const configured = this.normalizePhone(whatsappNumber);
    if (!configured) return false;
    const phones = await this.findTeamTrackingConnectedPhones(teamId);
    return phones.some((phone) => this.phonesMatch(configured, phone));
  }

  private async resolveWhatsappRedirectTarget(integration: {
    teamId: string;
    whatsappNumber: string | null;
  }) {
    const configured = this.normalizePhone(integration.whatsappNumber);
    if (!configured) return null;

    const connected = await this.findTeamTrackingConnectedPhones(integration.teamId);
    const matched = configured ? connected.find((phone) => this.phonesMatch(configured, phone)) : null;
    if (matched) {
      return configured;
    }
    if (connected.length > 0) {
      this.logger.warn(
        `[TikTokRedirect] pixel phone ${configured} not connected on team ${integration.teamId}; redirecting to ${connected[0]}`,
      );
      return connected[0];
    }

    this.logger.warn(
      `[TikTokRedirect] no connected WhatsApp on team ${integration.teamId}; messages to ${configured} cannot be tracked until connected`,
    );
    return configured;
  }

  private async findTeamTrackingConnectedPhones(teamId: string): Promise<string[]> {
    const channels = await this.prisma.channel.findMany({
      where: {
        teamId,
        provider: { in: ['WHATSAPP_BAILEYS', 'WHATSAPP_CLOUD'] },
      },
      include: { whatsAppSession: true, whatsAppCloudAccount: true },
      orderBy: { updatedAt: 'desc' },
    });

    const phones: string[] = [];
    for (const channel of channels) {
      if (!isTrackingChannel(channel.metadata)) continue;

      const sessionConnected =
        channel.whatsAppSession?.status === 'CONNECTED' ||
        Boolean(channel.whatsAppSession?.connectedAt);
      const channelConnected = channel.status === 'CONNECTED';
      if (!sessionConnected && !channelConnected) continue;

      const metadata = channel.metadata as ChannelMetadataWithPurpose | null;
      let phone = resolveStoredPhone({
        phoneNumber:
          channel.whatsAppSession?.phoneNumber ??
          channel.whatsAppCloudAccount?.phoneNumber ??
          metadata?.phoneNumber,
        jid: channel.whatsAppSession?.jid,
        externalId: channel.externalId,
      });

      if (!phone && channel.whatsAppSessionId) {
        phone = await this.resolveLiveSessionPhone(channel.whatsAppSession);
      }

      if (!phone) continue;

      if (sessionConnected && !channelConnected) {
        void this.prisma.channel
          .update({
            where: { id: channel.id },
            data: {
              status: 'CONNECTED',
              name: phone,
              metadata: {
                ...metadata,
                purpose: 'tracking',
                phoneNumber: phone,
              },
            },
          })
          .catch(() => undefined);
      }

      if (!phones.includes(phone)) phones.push(phone);
    }
    return phones;
  }

  async handleFirstInboundMessage(input: FirstInboundMessageInput) {
    this.logger.log(
      `[TikTokConversion] inbound conversation=${input.conversationId} team=${input.teamId} type=${input.messageType}`,
    );

    if (!REAL_INBOUND_TYPES.has(input.messageType)) {
      this.logConversion('skip', {
        whatsappPhone: input.senderPhone ?? null,
        reason: 'unsupported_message_type',
        messageType: input.messageType,
      });
      return null;
    }

    const customerPhone = this.normalizePhone(input.senderPhone);
    if (!customerPhone) {
      this.logConversion('skip', {
        whatsappPhone: null,
        reason: 'missing_customer_phone',
        conversationId: input.conversationId,
      });
      return null;
    }

    const channel = await this.prisma.channel.findFirst({
      where: { id: input.channelId, teamId: input.teamId },
      include: { whatsAppSession: true },
    });
    if (!channel) {
      this.logConversion('skip', {
        whatsappPhone: customerPhone,
        reason: 'channel_not_found',
        channelId: input.channelId,
        teamId: input.teamId,
        conversationId: input.conversationId,
      });
      return null;
    }

    const businessPhone =
      resolveStoredPhone({
        phoneNumber:
          channel.whatsAppSession?.phoneNumber ??
          (channel.metadata as ChannelMetadataWithPurpose | null)?.phoneNumber,
        jid: channel.whatsAppSession?.jid,
        externalId: channel.externalId,
      }) ?? '';

    const refAttribution = await this.resolveRefAttribution(input.messageText);
    if (refAttribution) {
      return this.completeLeadConversion({
        input,
        customerPhone,
        businessPhone,
        attribution: refAttribution,
      });
    }

    const clickAttribution = await this.findRecentClickLead();
    if (clickAttribution) {
      this.logConversion('linked', {
        whatsappPhone: customerPhone,
        reason: 'recent_click_attribution',
        leadId: clickAttribution.lead.id,
        integrationId: clickAttribution.integration.id,
        configuredPhone: clickAttribution.integration.whatsappNumber,
        receivedOnPhone: businessPhone || null,
        conversationId: input.conversationId,
      });
      return this.completeLeadConversion({
        input,
        customerPhone,
        businessPhone,
        attribution: clickAttribution,
      });
    }

    if (!businessPhone) {
      this.logConversion('skip', {
        whatsappPhone: customerPhone,
        reason: 'missing_business_phone',
        conversationId: input.conversationId,
      });
      return null;
    }

    const integrations = await this.findMatchingIntegrations(businessPhone);

    if (integrations.length === 0) {
      this.logConversion('skip', {
        whatsappPhone: customerPhone,
        reason: 'no_matching_integration',
        businessPhone,
        conversationId: input.conversationId,
      });
      return null;
    }

    const attribution = await this.resolveAttribution(
      integrations,
      input.conversationId,
      input.messageText,
      input.contactId,
      customerPhone,
    );
    if (!attribution) {
      this.logConversion('skip', {
        whatsappPhone: customerPhone,
        reason: 'no_click_attribution',
        businessPhone,
        conversationId: input.conversationId,
      });
      return null;
    }

    return this.completeLeadConversion({
      input,
      customerPhone,
      businessPhone,
      attribution,
    });
  }

  private async completeLeadConversion(params: {
    input: FirstInboundMessageInput;
    customerPhone: string;
    businessPhone: string;
    attribution: {
      integration: {
        id: string;
        userId: string;
        teamId: string;
        whatsappNumber: string | null;
        pixelCode: string | null;
        redirectSlug: string;
        advertiserId: string | null;
        pixelId: string | null;
        defaultOptimizationEvent: import('@watsapp/database').TikTokOptimizationEvent;
        customEventName: string | null;
      };
      lead: { id: string };
      click: {
        id: string;
        ttclid: string | null;
        ipAddress: string | null;
        userAgent: string | null;
        campaignId: string | null;
        adgroupId: string | null;
        adId: string | null;
      };
    };
  }) {
    const { input, customerPhone, attribution } = params;
    const { integration, click } = attribution;
    const lead = await this.ensureLeadForClick(integration.id, click.id);

    await this.linkLeadRecord(lead.id, {
      conversationId: input.conversationId,
      contactId: input.contactId,
      customerPhone,
    });

    const existingConversation = await this.prisma.tikTokIntegrationConversion.findFirst({
      where: {
        conversationId: input.conversationId,
        eventName: TIKTOK_CONTACT_EVENT,
      },
    });
    if (existingConversation) {
      if (!existingConversation.contactSent) {
        return this.dispatchContactEvent(existingConversation.id);
      }
      this.logConversion('linked', {
        whatsappPhone: customerPhone,
        reason: 'conversation_already_counted',
        conversationId: input.conversationId,
        eventId: existingConversation.eventId,
        convertedAt: existingConversation.sentAt?.toISOString() ?? null,
        leadId: lead.id,
      });
      return null;
    }

    const priorContact = await this.prisma.tikTokIntegrationConversion.findFirst({
      where: {
        whatsappPhone: customerPhone,
        integrationId: integration.id,
        eventName: TIKTOK_CONTACT_EVENT,
        contactSent: true,
      },
      orderBy: { sentAt: 'desc' },
    });
    if (priorContact) {
      this.logConversion('linked', {
        whatsappPhone: customerPhone,
        reason: 'contact_already_sent_for_customer',
        conversationId: input.conversationId,
        eventId: priorContact.eventId,
        convertedAt: priorContact.sentAt?.toISOString() ?? null,
        leadId: lead.id,
      });
      return null;
    }

    const access = await this.billingAccess.getTeamAccess(integration.teamId);
    if (!access.isActive) {
      this.logConversion('linked', {
        whatsappPhone: customerPhone,
        reason: 'subscription_inactive',
        conversationId: input.conversationId,
        leadId: lead.id,
      });
      return null;
    }

    // Always Contact on first real WhatsApp message — never on click.
    const eventName = TIKTOK_CONTACT_EVENT;
    const eventId = randomUUID();
    const firstMessageAt = new Date();
    const landingUrl = `${this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '')}/r/${integration.redirectSlug}?event=${encodeURIComponent(eventName)}`;
    const externalId = lead.id;

    const conversion = await this.prisma.tikTokIntegrationConversion.create({
      data: {
        integrationId: integration.id,
        leadId: lead.id,
        clickId: click.id,
        conversationId: input.conversationId,
        contactId: input.contactId,
        whatsappPhone: customerPhone,
        eventId,
        eventName,
        ttclid: sanitizeTtclid(click.ttclid),
        externalId,
        pageUrl: landingUrl,
        firstMessageAt,
        contactSent: false,
        tiktokStatus: 'pending',
      },
    });

    return this.dispatchContactEvent(conversion.id);
  }

  /** Send or retry Contact Events API for a stored conversion row. */
  async dispatchContactEvent(conversionId: string) {
    const conversion = await this.prisma.tikTokIntegrationConversion.findUnique({
      where: { id: conversionId },
      include: {
        integration: true,
      },
    });
    if (!conversion || conversion.contactSent) return conversion;

    const click = conversion.clickId
      ? await this.prisma.tikTokIntegrationClick.findUnique({ where: { id: conversion.clickId } })
      : null;

    const integration = conversion.integration;
    if (!integration?.pixelCode) {
      await this.markContactFailed(conversion.id, 'missing_pixel_code', true);
      return null;
    }

    const access = await this.billingAccess.getTeamAccess(integration.teamId);
    if (!access.isActive) {
      await this.markContactFailed(conversion.id, 'subscription_inactive', true);
      return null;
    }

    // Prefer manual Events API token; fall back to Marketing OAuth.
    let accessToken =
      this.credentials.getAccessTokenForIntegration(integration) ?? null;
    if (!accessToken) {
      try {
        accessToken = await this.marketingOAuth.getValidMarketingAccessToken(integration.userId);
      } catch {
        accessToken = null;
      }
    }
    if (!accessToken) {
      await this.markContactFailed(conversion.id, 'missing_events_api_token', true);
      return null;
    }

    const eventName = conversion.eventName || TIKTOK_CONTACT_EVENT;
    const phoneHash = conversion.whatsappPhone ? hashTikTokPhone(conversion.whatsappPhone) : null;
    const eventTime = Math.floor((conversion.firstMessageAt ?? conversion.createdAt).getTime() / 1000);
    const pageUrl =
      conversion.pageUrl ??
      `${this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '')}/r/${integration.redirectSlug}?event=${encodeURIComponent(eventName)}`;

    const payload = {
      event: eventName,
      event_id: conversion.eventId,
      event_time: eventTime,
      url: pageUrl,
      ttclid: conversion.ttclid ?? click?.ttclid ?? null,
      ip: click?.ipAddress ?? null,
      userAgent: click?.userAgent ?? null,
      phone: phoneHash,
      externalId: conversion.externalId ?? conversion.leadId,
      properties: {
        external_id: conversion.externalId ?? conversion.leadId ?? undefined,
        click_id: conversion.clickId ?? undefined,
        campaign_id: click?.campaignId ?? undefined,
        adgroup_id: click?.adgroupId ?? undefined,
        ad_id: click?.adId ?? undefined,
        ...optimizationEventProperties(eventName),
      },
    };

    const started = Date.now();
    try {
      if (integration.advertiserId && integration.pixelId) {
        await this.ads
          .registerPixelEvents(accessToken, integration.advertiserId, integration.pixelId, [eventName])
          .catch(() => undefined);
      }

      const response = await this.ads.trackPixelEvent(accessToken, integration.pixelCode, payload);

      await this.prisma.tikTokIntegrationApiLog.create({
        data: {
          id: randomUUID(),
          integrationId: integration.id,
          conversionId: conversion.id,
          eventName,
          eventId: conversion.eventId,
          attempt: conversion.retryCount + 1,
          httpStatus: 200,
          success: true,
          processingMs: Date.now() - started,
          requestPayload: {
            event: payload.event,
            event_id: payload.event_id,
            event_time: payload.event_time,
            url: payload.url,
            ttclid: payload.ttclid ? '[present]' : null,
            phone: phoneHash ? '[hashed]' : null,
            external_id: payload.externalId ?? null,
            properties: payload.properties,
          },
          responseBody: response as object,
        },
      }).catch(() => undefined);

      const sentAt = new Date();
      const updated = await this.prisma.tikTokIntegrationConversion.update({
        where: { id: conversion.id },
        data: {
          contactSent: true,
          eventName,
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
          lastEventName: eventName,
          lastApiHttpStatus: 200,
          lastApiError: null,
        },
      });

      if (conversion.leadId) {
        await this.prisma.tikTokIntegrationLead.update({
          where: { id: conversion.leadId },
          data: {
            convertedAt: sentAt,
            conversionEventId: conversion.eventId,
          },
        });
      }

      if (conversion.clickId) {
        await this.prisma.tikTokIntegrationClick.update({
          where: { id: conversion.clickId },
          data: {
            optimizationEventSent: true,
            eventsPayload: [{ event: eventName, status: 'sent', source: 'whatsapp_first_message' }],
          },
        });
      }

      this.logConversion('sent', {
        whatsappPhone: conversion.whatsappPhone,
        conversationId: conversion.conversationId,
        eventId: conversion.eventId,
        eventName,
        convertedAt: sentAt.toISOString(),
        leadId: conversion.leadId,
        clickId: conversion.clickId,
        integrationId: conversion.integrationId,
        conversionId: conversion.id,
        ttclid: conversion.ttclid,
      });

      this.emitIntegrationUpdated(
        integration.teamId,
        integration.id,
        'conversion',
        conversion.whatsappPhone ?? undefined,
      );

      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.tikTokIntegrationApiLog.create({
        data: {
          id: randomUUID(),
          integrationId: integration.id,
          conversionId: conversion.id,
          eventName,
          eventId: conversion.eventId,
          attempt: conversion.retryCount + 1,
          httpStatus: null,
          success: false,
          processingMs: Date.now() - started,
          requestPayload: {
            event: payload.event,
            event_id: payload.event_id,
            event_time: payload.event_time,
            url: payload.url,
            ttclid: payload.ttclid ? '[present]' : null,
            properties: payload.properties,
          },
          errorMessage: message.slice(0, 2000),
        },
      }).catch(() => undefined);
      await this.prisma.tikTokIntegration.update({
        where: { id: integration.id },
        data: { lastApiError: message.slice(0, 2000), lastApiHttpStatus: null },
      }).catch(() => undefined);
      await this.scheduleContactRetry(conversion.id, message);
      this.logConversion('failed', {
        whatsappPhone: conversion.whatsappPhone,
        conversationId: conversion.conversationId,
        eventId: conversion.eventId,
        eventName,
        leadId: conversion.leadId,
        error: message,
      });
      return null;
    }
  }

  private async scheduleContactRetry(conversionId: string, error: string) {
    const current = await this.prisma.tikTokIntegrationConversion.findUnique({
      where: { id: conversionId },
      select: { retryCount: true },
    });
    const retryCount = (current?.retryCount ?? 0) + 1;
    const exhausted = retryCount >= TIKTOK_CONTACT_MAX_RETRIES;
    const delay = contactRetryDelayMs(retryCount);
    const nextRetryAt = exhausted ? null : new Date(Date.now() + delay);

    await this.prisma.tikTokIntegrationConversion.update({
      where: { id: conversionId },
      data: {
        contactSent: false,
        tiktokStatus: exhausted ? 'failed' : 'pending',
        tiktokError: error.slice(0, 2000),
        retryCount,
        nextRetryAt,
      },
    });

    if (!exhausted) {
      await this.contactQueue.add(
        'retry-contact',
        { conversionId },
        {
          jobId: `tiktok-contact-${conversionId}-${retryCount}`,
          delay,
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    }
  }

  private async markContactFailed(conversionId: string, error: string, terminal: boolean) {
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

  private async resolveRefAttribution(messageText: string | null | undefined) {
    const trackingRef = this.extractLeadRef(messageText);
    if (!trackingRef) return null;
    return this.resolveAttributionFromRef(trackingRef);
  }

  private async resolveAttributionFromRef(trackingRef: string) {
    const attributionSince = new Date(Date.now() - TIKTOK_CONVERSION_ATTRIBUTION_DAYS * 24 * 60 * 60 * 1000);

    const click = await this.prisma.tikTokIntegrationClick.findFirst({
      where: {
        id: trackingRef,
        createdAt: { gte: attributionSince },
        integration: {
          wizardCompleted: true,
          billingSuspended: false,
          pixelCode: { not: null },
          whatsappNumber: { not: null },
        },
      },
      include: {
        lead: true,
        integration: { include: { eventConfigurations: true } },
      },
    });
    if (click?.integration) {
      if (click.lead?.convertedAt) return null;
      const lead = click.lead ?? (await this.ensureLeadForClick(click.integrationId, click.id));
      return { integration: click.integration, lead, click };
    }

    const lead = await this.prisma.tikTokIntegrationLead.findFirst({
      where: {
        id: trackingRef,
        convertedAt: null,
        createdAt: { gte: attributionSince },
      },
      include: {
        click: true,
        integration: { include: { eventConfigurations: true } },
      },
    });
    if (!lead?.click || !lead.integration?.wizardCompleted || lead.integration.billingSuspended) {
      return null;
    }
    if (!lead.integration.pixelCode || !lead.integration.whatsappNumber) {
      return null;
    }

    return { integration: lead.integration, lead, click: lead.click };
  }

  private async ensureLeadForClick(integrationId: string, clickId: string) {
    const existing = await this.prisma.tikTokIntegrationLead.findUnique({
      where: { clickId },
    });
    if (existing) return existing;

    return this.prisma.tikTokIntegrationLead.create({
      data: { integrationId, clickId },
    });
  }

  private async findMatchingIntegrations(businessPhone: string) {
    const integrations = await this.prisma.tikTokIntegration.findMany({
      where: {
        wizardCompleted: true,
        billingSuspended: false,
        pixelCode: { not: null },
        whatsappNumber: { not: null },
      },
      include: { eventConfigurations: true },
    });

    return integrations.filter((row) =>
      this.phonesMatch(this.normalizePhone(row.whatsappNumber), businessPhone),
    );
  }

  private async findRecentClickLead(integrationIds?: string[]) {
    const since = new Date(Date.now() - RECENT_LEAD_LINK_MINUTES * 60 * 1000);

    const click = await this.prisma.tikTokIntegrationClick.findFirst({
      where: {
        createdAt: { gte: since },
        ...(integrationIds?.length ? { integrationId: { in: integrationIds } } : {}),
        integration: {
          wizardCompleted: true,
          billingSuspended: false,
          pixelCode: { not: null },
        },
        OR: [
          { lead: null },
          {
            lead: {
              convertedAt: null,
              customerPhone: null,
            },
          },
        ],
      },
      include: {
        lead: true,
        integration: { include: { eventConfigurations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!click?.integration) return null;

    const lead = click.lead ?? (await this.ensureLeadForClick(click.integrationId, click.id));
    return { integration: click.integration, lead, click };
  }

  private async linkLeadRecord(
    leadId: string,
    data: { conversationId: string; contactId: string; customerPhone: string },
  ) {
    const existing = await this.prisma.tikTokIntegrationLead.findUnique({
      where: { id: leadId },
      select: { conversationId: true, customerPhone: true, integrationId: true },
    });
    const wasLinked = Boolean(existing?.customerPhone || existing?.conversationId);
    const update: {
      contactId: string;
      customerPhone: string;
      conversationId?: string;
    } = {
      contactId: data.contactId,
      customerPhone: data.customerPhone,
    };
    if (!existing?.conversationId) {
      const taken = await this.prisma.tikTokIntegrationLead.findUnique({
        where: { conversationId: data.conversationId },
        select: { id: true },
      });
      if (!taken || taken.id === leadId) {
        update.conversationId = data.conversationId;
      }
    }
    await this.prisma.tikTokIntegrationLead.update({
      where: { id: leadId },
      data: update,
    });

    if (!wasLinked && existing?.integrationId) {
      const integration = await this.prisma.tikTokIntegration.findUnique({
        where: { id: existing.integrationId },
        select: { teamId: true },
      });
      if (integration) {
        this.emitIntegrationUpdated(integration.teamId, existing.integrationId, 'lead', data.customerPhone);
      }
    }
  }

  private emitIntegrationUpdated(
    teamId: string,
    integrationId: string,
    kind: 'click' | 'lead' | 'conversion',
    customerPhone?: string,
  ) {
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.TIKTOK_INTEGRATION_UPDATED, {
      integrationId,
      kind,
      customerPhone: customerPhone ?? null,
      updatedAt: new Date().toISOString(),
    });
  }

  async getPixelConfig(slug: string) {
    const integration = await this.prisma.tikTokIntegration.findUnique({
      where: { redirectSlug: slug },
      include: { eventConfigurations: true },
    });
    if (!integration?.wizardCompleted || !integration.pixelCode) return null;

    const optimizationEvent = conversionEventName({
      defaultOptimizationEvent: integration.defaultOptimizationEvent,
      customEventName: integration.customEventName,
    });

    return {
      pixelCode: integration.pixelCode,
      pixelId: integration.pixelId,
      optimizationEvent,
      events: [],
      setupPageUrl: `${this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '')}/tiktok/activate/${encodeURIComponent(integration.pixelCode)}`,
    };
  }

  async getTrackPayload(input: RedirectInput) {
    const result = await this.handleRedirect(input);
    return {
      redirectUrl: result.redirectUrl,
      pixelId: result.pixelId ?? null,
      pixelCode: result.pixelCode ?? null,
      optimizationEvent: result.optimizationEvent ?? TIKTOK_CONTACT_EVENT,
      eventsSent: result.eventsSent ?? [],
    };
  }

  private async resolveAttribution(
    integrations: Array<{
      id: string;
      userId: string;
      teamId: string;
      pixelCode: string | null;
      redirectSlug: string;
      eventConfigurations: Array<{ eventName: import('@watsapp/database').TikTokOptimizationEvent; enabled: boolean }>;
    }>,
    conversationId: string,
    messageText: string | null | undefined,
    contactId: string,
    customerPhone: string,
  ) {
    const integrationIds = integrations.map((row) => row.id);
    const attributionSince = new Date(Date.now() - TIKTOK_CONVERSION_ATTRIBUTION_DAYS * 24 * 60 * 60 * 1000);

    const pendingLead = await this.prisma.tikTokIntegrationLead.findFirst({
      where: {
        conversationId,
        integrationId: { in: integrationIds },
        convertedAt: null,
      },
      include: { click: true, integration: { include: { eventConfigurations: true } } },
    });
    if (pendingLead?.click) {
      return { integration: pendingLead.integration, lead: pendingLead, click: pendingLead.click };
    }

    const leadRef = this.extractLeadRef(messageText);

    if (leadRef) {
      const refAttribution = await this.resolveAttributionFromRef(leadRef);
      if (refAttribution?.integration.id && integrationIds.includes(refAttribution.integration.id)) {
        return refAttribution;
      }
    }

    const lead = await this.prisma.tikTokIntegrationLead.findFirst({
      where: {
        integrationId: { in: integrationIds },
        convertedAt: null,
        createdAt: { gte: attributionSince },
        OR: [{ contactId }, { customerPhone }],
      },
      include: {
        click: true,
        integration: { include: { eventConfigurations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (lead?.click) {
      return { integration: lead.integration, lead, click: lead.click };
    }

    const fallbackClick = await this.prisma.tikTokIntegrationClick.findFirst({
      where: {
        integrationId: { in: integrationIds },
        createdAt: { gte: new Date(Date.now() - TIKTOK_CLICK_TO_MESSAGE_MINUTES * 60 * 1000) },
        OR: [
          { lead: null },
          {
            lead: {
              convertedAt: null,
              customerPhone: null,
            },
          },
        ],
      },
      include: {
        lead: true,
        integration: { include: { eventConfigurations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (fallbackClick?.integration) {
      const leadRow =
        fallbackClick.lead ??
        (await this.ensureLeadForClick(fallbackClick.integrationId, fallbackClick.id));
      return {
        integration: fallbackClick.integration,
        lead: leadRow,
        click: fallbackClick,
      };
    }

    return null;
  }

  private async trackConversionApiEvent(
    integration: {
      userId: string;
      advertiserId: string | null;
      pixelId: string | null;
      pixelCode: string | null;
    },
    eventName: string,
    payload: Parameters<TikTokAdsService['trackPixelEvent']>[2],
  ) {
    try {
      const accessToken = await this.marketingOAuth.getValidMarketingAccessToken(integration.userId);
      if (integration.advertiserId && integration.pixelId) {
        await this.ads
          .registerPixelEvents(accessToken, integration.advertiserId, integration.pixelId, [eventName])
          .catch(() => undefined);
      }
      return await this.ads.trackPixelEvent(accessToken, integration.pixelCode!, payload);
    } catch (err) {
      if (!this.isAuthError(err)) throw err;
      this.logger.warn(
        `[TikTokConversion] token refresh retry userId=${integration.userId} event=${eventName}`,
      );
      const refreshed = await this.marketingOAuth.forceRefreshMarketingAccessToken(integration.userId);
      return await this.ads.trackPixelEvent(refreshed, integration.pixelCode!, payload);
    }
  }

  private isAuthError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return message.includes('401') || message.toLowerCase().includes('unauthorized');
  }

  private async resolveLiveSessionPhone(
    session?: { id: string; phoneNumber?: string | null; jid?: string | null } | null,
  ): Promise<string | null> {
    if (!session) return null;
    const stored = resolveStoredPhone({ phoneNumber: session.phoneNumber, jid: session.jid });
    if (stored) return stored;

    const socket = this.sessionManager.getSocket(session.id);
    const jid = socket?.user?.id ?? session.jid;
    if (!jid) return null;

    let phone = phoneFromJid(jid);
    if (!phone && jid.includes('@lid') && socket) {
      const lidMapping = (
        socket as unknown as {
          signalRepository?: { lidMapping?: { getPNForLID?: (lid: string) => Promise<string | null> } };
        }
      ).signalRepository?.lidMapping;
      if (lidMapping?.getPNForLID) {
        try {
          const pn = await lidMapping.getPNForLID(jid);
          phone = phoneFromJid(pn);
        } catch {
          /* ignore */
        }
      }
    }
    return phone;
  }

  private phonesMatch(stored?: string | null, incoming?: string | null): boolean {
    if (!stored || !incoming) return false;
    if (stored === incoming) return true;
    const tail = (value: string) => value.slice(-10);
    return tail(stored) === tail(incoming);
  }

  private extractLeadRef(text?: string | null): string | null {
    if (!text) return null;

    const hidden = decodeHiddenTrackingRef(text);
    if (hidden) return hidden;

    const start = text.indexOf(TIKTOK_TRACKING_REF_PREFIX);
    if (start === -1) return null;
    const from = start + TIKTOK_TRACKING_REF_PREFIX.length;
    const end = text.indexOf(TIKTOK_TRACKING_REF_SUFFIX, from);
    if (end === -1) return null;
    return text.slice(from, end).trim() || null;
  }

  private normalizePhone(value?: string | null): string | null {
    if (!value) return null;
    const digits = value.replace(/[^\d]/g, '');
    return digits.length >= 10 && digits.length <= 15 ? digits : null;
  }

  private logConversion(
    outcome: 'sent' | 'skip' | 'failed' | 'linked',
    details: Record<string, string | null | undefined>,
  ) {
    const payload = {
      outcome,
      whatsappPhone: details.whatsappPhone ?? null,
      convertedAt: details.convertedAt ?? null,
      eventId: details.eventId ?? null,
      ...details,
    };
    if (outcome === 'sent' || outcome === 'linked') {
      this.logger.log(`[TikTokConversion] ${JSON.stringify(payload)}`);
      return;
    }
    if (outcome === 'failed') {
      this.logger.warn(`[TikTokConversion] ${JSON.stringify(payload)}`);
      return;
    }
    this.logger.log(`[TikTokConversion] ${JSON.stringify(payload)}`);
  }
}
