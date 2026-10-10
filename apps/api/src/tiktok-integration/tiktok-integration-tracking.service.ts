import { randomUUID } from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelPurpose, MessageType } from '@watsapp/database';
import { SOCKET_EVENTS } from '@watsapp/shared';
import { Queue } from 'bullmq';
import { ChannelMetadataWithPurpose, isTrackingChannel, readChannelPurpose } from '../channels/channel-purpose';
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
import { decodeHiddenTrackingRef } from '../tiktok/hidden-tracking-ref';
import {
  TIKTOK_CONVERSION_ATTRIBUTION_DAYS,
  TIKTOK_CLICK_TO_MESSAGE_MINUTES,
  TIKTOK_CONTACT_EVENT,
  TIKTOK_CONTACT_MAX_RETRIES,
  contactRetryDelayMs,
  sanitizeTtclid,
  sanitizeTikTokMacroId,
  conversionEventName,
  optimizationEventProperties,
  TIKTOK_LEAD_EVENT,
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
  /** ConversationMessage id — webhook retry idempotency. */
  messageId?: string | null;
  senderPhone?: string | null;
  messageText?: string | null;
  messageType: MessageType;
  isNewConversation?: boolean;
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

    const urlDestination = this.isUrlDestination(integration?.redirectDestinationType);
    const hasDestination = urlDestination
      ? Boolean(integration?.externalRedirectUrl)
      : Boolean(integration?.whatsappNumber);
    if (!integration?.wizardCompleted || !hasDestination || integration.billingSuspended) {
      return {
        redirectUrl: null,
        subscriptionExpired: true,
        active: false,
        pixelCode: null,
        pixelId: null,
      };
    }

    const access = await this.billingAccess.getTeamAccess(integration.teamId);
    if (!access.isActive) {
      return {
        redirectUrl: null,
        subscriptionExpired: true,
        active: false,
        pixelCode: null,
        pixelId: null,
      };
    }

    const cleanTtclid = sanitizeTtclid(input.ttclid);
    // Persist click async so redirect is not blocked by DB write latency.
    void this.prisma.tikTokIntegrationClick.create({
      data: {
        integrationId: integration.id,
        ttclid: cleanTtclid,
        campaignId: sanitizeTikTokMacroId(input.campaignId),
        adgroupId: sanitizeTikTokMacroId(input.adgroupId),
        adId: sanitizeTikTokMacroId(input.adId),
        advertiserId: sanitizeTikTokMacroId(input.advertiserId) ?? integration.advertiserId ?? null,
        ipAddress: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    }).then(() => {
      this.emitIntegrationUpdated(integration.teamId, integration.id, 'click');
    }).catch((err) => {
      this.logger.warn(`[TikTokRedirect] click insert failed: ${err instanceof Error ? err.message : String(err)}`);
    });

    let redirectUrl: string;
    if (urlDestination && integration.externalRedirectUrl) {
      // مرّر ttclid ووسوم الحملة للمتجر/الاستمارة حتى يُرسل التحويل عند الطلب
      redirectUrl = this.appendAttributionQuery(integration.externalRedirectUrl, {
        ttclid: cleanTtclid,
        campaignId: sanitizeTikTokMacroId(input.campaignId),
        adgroupId: sanitizeTikTokMacroId(input.adgroupId),
        adId: sanitizeTikTokMacroId(input.adId),
      });
    } else {
      const whatsappTarget = await this.resolveWhatsappRedirectTarget(integration);
      redirectUrl = whatsappTarget
        ? `https://wa.me/${whatsappTarget}`
        : `${fallbackWeb}/whatsapp`;
    }

    const optimizationEvent = conversionEventName({
      defaultOptimizationEvent: integration.defaultOptimizationEvent,
      customEventName: integration.customEventName,
    });

    return {
      redirectUrl,
      destinationType: integration.redirectDestinationType,
      click: null,
      pixelId: integration.pixelId,
      pixelCode: integration.pixelCode,
      optimizationEvent,
      eventsSent: [] as string[],
      active: true,
      subscriptionExpired: false,
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
    const matched = connected.find((phone) => this.phonesMatch(configured, phone));
    if (!matched) {
      this.logger.warn(
        `[TikTokRedirect] pixel phone ${configured} not connected on team ${integration.teamId}; still redirecting to configured number (Contact requires this WA session online)`,
      );
    }
    // Never silently redirect to a different WhatsApp — that breaks Contact attribution.
    return configured;
  }

  private async findTeamTrackingConnectedPhones(teamId: string): Promise<string[]> {
    const channels = await this.prisma.channel.findMany({
      where: {
        teamId,
        purpose: 'TRACKING',
        provider: { in: ['WHATSAPP_BAILEYS', 'WHATSAPP_CLOUD'] },
      },
      include: { whatsAppSession: true, whatsAppCloudAccount: true },
      orderBy: { updatedAt: 'desc' },
    });

    const phones: string[] = [];
    for (const channel of channels) {
      if (channel.purpose !== 'TRACKING' && !isTrackingChannel(channel)) continue;

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

  /**
   * Synthetic conversation key for TikTok tracking (no Inbox Conversation row).
   * Same phone keeps one key until the WhatsApp silence window expires —
   * one conversion per customer journey (click → first message), not per message.
   */
  async resolveTrackingConversationKey(input: {
    channelId: string;
    customerPhone: string;
    windowMs: number;
    teamId?: string;
  }): Promise<{ conversationId: string; isNewConversation: boolean }> {
    const phone = input.customerPhone.replace(/\D/g, '');
    const prefix = `ttk:${input.channelId}:${phone}`;
    const last = await this.prisma.tikTokIntegrationConversion.findFirst({
      where: {
        conversationId: { startsWith: prefix },
        eventName: TIKTOK_CONTACT_EVENT,
      },
      orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        conversationId: true,
        sentAt: true,
        createdAt: true,
        contactSent: true,
        ttclid: true,
        clickId: true,
        integrationId: true,
      },
    });
    if (!last?.conversationId) {
      return { conversationId: prefix, isNewConversation: true };
    }
    const anchor = (last.sentAt ?? last.createdAt).getTime();
    if (Date.now() - anchor <= input.windowMs) {
      // Keep the same conversation — follow-up WhatsApp messages must NOT create
      // another Contact/Lead (would inflate Ads conversions vs clicks).
      return { conversationId: last.conversationId, isNewConversation: false };
    }
    return { conversationId: `${prefix}:${Date.now()}`, isNewConversation: true };
  }

  async handleFirstInboundMessage(input: FirstInboundMessageInput) {
    this.logger.log(
      `[TikTokConversion] inbound conversation=${input.conversationId} team=${input.teamId} type=${input.messageType}`,
    );

    if (!REAL_INBOUND_TYPES.has(input.messageType)) {
      await this.recordDiag({
        teamId: input.teamId,
        channelId: input.channelId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        whatsappPhone: input.senderPhone ?? null,
        isNewConversation: input.isNewConversation,
        outcome: 'skip',
        reason: 'unsupported_message_type',
      });
      this.logConversion('skip', {
        whatsappPhone: input.senderPhone ?? null,
        reason: 'unsupported_message_type',
        messageType: input.messageType,
      });
      return null;
    }

    const customerPhone = this.normalizePhone(input.senderPhone);
    if (!customerPhone) {
      await this.recordDiag({
        teamId: input.teamId,
        channelId: input.channelId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        isNewConversation: input.isNewConversation,
        outcome: 'skip',
        reason: 'missing_customer_phone',
      });
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
      await this.recordDiag({
        teamId: input.teamId,
        channelId: input.channelId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        whatsappPhone: customerPhone,
        isNewConversation: input.isNewConversation,
        outcome: 'skip',
        reason: 'channel_not_found',
      });
      this.logConversion('skip', {
        whatsappPhone: customerPhone,
        reason: 'channel_not_found',
        channelId: input.channelId,
        teamId: input.teamId,
        conversationId: input.conversationId,
      });
      return null;
    }

    // Contact / Ads conversions only from TikTok tracking WhatsApp (pixel "Business WhatsApp"),
    // never from the AI/inbox WhatsApp session. purpose column is authoritative.
    const tracking = channel.purpose === 'TRACKING' || isTrackingChannel(channel);
    if (!tracking) {
      await this.recordDiag({
        teamId: input.teamId,
        channelId: input.channelId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        whatsappPhone: customerPhone,
        isNewConversation: input.isNewConversation,
        outcome: 'skip',
        reason: 'not_tracking_whatsapp',
        errorMessage: 'Inbox/AI WhatsApp ignored — use Business WhatsApp from pixel Connect WhatsApp',
      });
      this.logConversion('skip', {
        whatsappPhone: customerPhone,
        reason: 'not_tracking_whatsapp',
        channelId: input.channelId,
        conversationId: input.conversationId,
        purpose: readChannelPurpose(channel),
      });
      return null;
    }

    const businessPhone =
      this.normalizePhone(
        resolveStoredPhone({
          phoneNumber:
            channel.whatsAppSession?.phoneNumber ??
            (channel.metadata as ChannelMetadataWithPurpose | null)?.phoneNumber,
          jid: channel.whatsAppSession?.jid,
          externalId: channel.externalId,
        }),
      ) ??
      this.normalizePhone(channel.whatsAppSession?.phoneNumber) ??
      this.normalizePhone((channel.metadata as ChannelMetadataWithPurpose | null)?.phoneNumber) ??
      '';

    const refAttribution = await this.resolveRefAttribution(input.messageText, input.teamId);
    if (refAttribution) {
      return this.completeLeadConversion({
        input,
        customerPhone,
        businessPhone,
        attribution: refAttribution,
      });
    }

    const channelMeta = channel.metadata as ChannelMetadataWithPurpose | null;
    const linkedIntegrationId = channelMeta?.integrationId ?? null;

    // Resolve pixels for THIS tracking WhatsApp session — every connected tracking
    // number must be able to fire Contact+Lead for its linked / phone-matched pixel(s).
    let integrations = await this.resolveIntegrationsForTrackingInbound({
      teamId: input.teamId,
      channelId: input.channelId,
      businessPhone,
      linkedIntegrationId,
    });

    // Auto-heal: bind unbound tracking channel to the matched pixel so future
    // messages on this number stay attributed correctly.
    if (!linkedIntegrationId && integrations.length === 1 && businessPhone) {
      await this.bindChannelToIntegration(input.channelId, integrations[0].id, businessPhone);
    }

    if (integrations.length === 0) {
      const reason = businessPhone ? 'no_matching_integration' : 'missing_business_phone';
      await this.recordDiag({
        teamId: input.teamId,
        channelId: input.channelId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        whatsappPhone: customerPhone,
        businessPhone: businessPhone || null,
        isNewConversation: input.isNewConversation,
        outcome: 'skip',
        reason,
        errorMessage: 'No TikTok integration found for this tracking WhatsApp number',
      });
      this.logConversion('skip', {
        whatsappPhone: customerPhone,
        reason,
        businessPhone: businessPhone || null,
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
      input.teamId,
    );
    if (!attribution) {
      // New conversations on tracking Business WA still get one Contact even without a fresh click,
      // so Chatloora / Events Manager counters keep rising. Ads attribution needs ttclid when available.
      const integration = integrations[0];
      this.logger.warn(
        `[TikTokConversion] no_click_attribution → contact_without_click team=${input.teamId} conversation=${input.conversationId} integration=${integration.id}`,
      );
      return this.completeLeadConversion({
        input,
        customerPhone,
        businessPhone,
        attribution: { integration, lead: null, click: null },
        skipReasonHint: 'contact_without_click_attribution',
      });
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
    skipReasonHint?: string;
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
      lead: { id: string } | null;
      click: {
        id: string;
        ttclid: string | null;
        ipAddress: string | null;
        userAgent: string | null;
        campaignId: string | null;
        adgroupId: string | null;
        adId: string | null;
      } | null;
    };
  }) {
    const { input, customerPhone, attribution } = params;
    const { integration, click } = attribution;

    if (integration.teamId !== input.teamId) {
      await this.recordDiag({
        teamId: input.teamId,
        integrationId: integration.id,
        channelId: input.channelId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        whatsappPhone: customerPhone,
        businessPhone: params.businessPhone,
        pixelCode: integration.pixelCode,
        isNewConversation: input.isNewConversation,
        outcome: 'skip',
        reason: 'team_mismatch',
      });
      this.logConversion('skip', {
        whatsappPhone: customerPhone,
        reason: 'team_mismatch',
        conversationId: input.conversationId,
        integrationId: integration.id,
        teamId: input.teamId,
      });
      return null;
    }

    const lead = click ? await this.ensureLeadForClick(integration.id, click.id) : attribution.lead;

    // One Contact/Lead per customer conversation — first WhatsApp message only.
    // Re-open ONLY when this message carries an explicit new click ref (hidden tracking
    // token) with a different ttclid; never steal unrelated unused clicks from the pool.
    let conversationId = input.conversationId;
    let isNewConversation = input.isNewConversation ?? true;

    const phoneAlreadySent = await this.prisma.tikTokIntegrationConversion.findFirst({
      where: {
        integrationId: integration.id,
        whatsappPhone: customerPhone,
        eventName: TIKTOK_CONTACT_EVENT,
        contactSent: true,
        createdAt: {
          gte: new Date(Date.now() - TIKTOK_CLICK_TO_MESSAGE_MINUTES * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const explicitNewClickRef = Boolean(this.extractLeadRef(input.messageText));
    const newTtclid = sanitizeTtclid(click?.ttclid);
    const oldPhoneTtclid = sanitizeTtclid(phoneAlreadySent?.ttclid);
    const allowNewJourney =
      Boolean(phoneAlreadySent) &&
      explicitNewClickRef &&
      Boolean(newTtclid) &&
      Boolean(click?.id) &&
      click!.id !== phoneAlreadySent?.clickId &&
      newTtclid !== oldPhoneTtclid;

    if (phoneAlreadySent && !allowNewJourney) {
      await this.recordDiag({
        teamId: input.teamId,
        integrationId: integration.id,
        channelId: input.channelId,
        conversationId,
        messageId: input.messageId,
        whatsappPhone: customerPhone,
        businessPhone: params.businessPhone,
        pixelCode: integration.pixelCode,
        ttclid: phoneAlreadySent.ttclid,
        isNewConversation,
        outcome: 'skip',
        reason: 'phone_already_converted',
        tiktokStatus: phoneAlreadySent.tiktokStatus,
      });
      this.logConversion('linked', {
        whatsappPhone: customerPhone,
        reason: 'phone_already_converted',
        conversationId,
        eventId: phoneAlreadySent.eventId,
        convertedAt: phoneAlreadySent.sentAt?.toISOString() ?? null,
        leadId: lead?.id ?? null,
      });
      return null;
    }

    if (allowNewJourney) {
      const phone = customerPhone.replace(/\D/g, '');
      conversationId = `ttk:${input.channelId}:${phone}:${Date.now()}`;
      isNewConversation = true;
      this.logger.log(
        `[TikTokConversion] new_ad_click_journey conversation=${conversationId} phone=${customerPhone}`,
      );
    }

    const existingConversation = await this.prisma.tikTokIntegrationConversion.findFirst({
      where: {
        integrationId: integration.id,
        conversationId,
        eventName: TIKTOK_CONTACT_EVENT,
      },
    });
    if (existingConversation) {
      const canRetry =
        !existingConversation.contactSent &&
        existingConversation.tiktokStatus === 'pending' &&
        existingConversation.retryCount < TIKTOK_CONTACT_MAX_RETRIES;
      if (canRetry) {
        if (lead) {
          await this.linkLeadRecord(lead.id, {
            conversationId,
            contactId: input.contactId,
            customerPhone,
          });
        }
        return this.dispatchContactEvent(existingConversation.id);
      }

      await this.recordDiag({
        teamId: input.teamId,
        integrationId: integration.id,
        channelId: input.channelId,
        conversationId,
        messageId: input.messageId,
        whatsappPhone: customerPhone,
        businessPhone: params.businessPhone,
        pixelCode: integration.pixelCode,
        ttclid: existingConversation.ttclid,
        isNewConversation,
        outcome: 'skip',
        reason: existingConversation.contactSent
          ? 'conversation_already_tracked'
          : 'conversation_contact_not_retryable',
        tiktokStatus: existingConversation.tiktokStatus,
      });
      this.logConversion('linked', {
        whatsappPhone: customerPhone,
        reason: existingConversation.contactSent
          ? 'conversation_already_tracked'
          : 'conversation_contact_not_retryable',
        conversationId,
        eventId: existingConversation.eventId,
        tiktokStatus: existingConversation.tiktokStatus,
        convertedAt: existingConversation.sentAt?.toISOString() ?? null,
        leadId: lead?.id ?? null,
      });
      return null;
    }

    const messageId = input.messageId?.trim() || null;
    if (messageId) {
      const existingForMessage = await this.prisma.tikTokIntegrationConversion.findFirst({
        where: {
          integrationId: integration.id,
          messageId,
          eventName: TIKTOK_CONTACT_EVENT,
        },
      });
      if (existingForMessage) {
        await this.recordDiag({
          teamId: input.teamId,
          integrationId: integration.id,
          channelId: input.channelId,
          conversationId,
          messageId,
          whatsappPhone: customerPhone,
          outcome: 'skip',
          reason: 'duplicate_webhook',
          ttclid: existingForMessage.ttclid,
          isNewConversation,
          tiktokStatus: existingForMessage.tiktokStatus,
        });
        if (
          !existingForMessage.contactSent &&
          existingForMessage.tiktokStatus === 'pending' &&
          existingForMessage.retryCount < TIKTOK_CONTACT_MAX_RETRIES
        ) {
          return this.dispatchContactEvent(existingForMessage.id);
        }
        return null;
      }
    }

    const access = await this.billingAccess.getTeamAccess(integration.teamId);
    if (!access.isActive) {
      await this.recordDiag({
        teamId: input.teamId,
        integrationId: integration.id,
        conversationId,
        whatsappPhone: customerPhone,
        outcome: 'skip',
        reason: 'subscription_inactive',
        isNewConversation,
      });
      this.logConversion('linked', {
        whatsappPhone: customerPhone,
        reason: 'subscription_inactive',
        conversationId,
        leadId: lead?.id ?? null,
      });
      return null;
    }

    if (lead) {
      await this.linkLeadRecord(lead.id, {
        conversationId,
        contactId: input.contactId,
        customerPhone,
      });
    }

    const eventName = TIKTOK_CONTACT_EVENT;
    const eventId = randomUUID();
    const firstMessageAt = new Date();
    const landingUrl = `${this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '')}/r/${integration.redirectSlug}?event=${encodeURIComponent(eventName)}`;
    const externalId = lead?.id ?? conversationId;
    const ttclid = sanitizeTtclid(click?.ttclid);

    let conversion;
    try {
      conversion = await this.prisma.tikTokIntegrationConversion.create({
        data: {
          integrationId: integration.id,
          leadId: lead?.id ?? null,
          clickId: click?.id ?? null,
          conversationId,
          messageId,
          contactId: input.contactId,
          whatsappPhone: customerPhone,
          eventId,
          eventName,
          ttclid,
          externalId,
          pageUrl: landingUrl,
          firstMessageAt,
          contactSent: false,
          tiktokStatus: 'pending',
        },
      });
    } catch (err) {
      const code = (err as { code?: string; meta?: { target?: string[] } } | null)?.code;
      if (code === 'P2002') {
        const raced = await this.prisma.tikTokIntegrationConversion.findFirst({
          where: {
            integrationId: integration.id,
            conversationId,
            eventName: TIKTOK_CONTACT_EVENT,
          },
        });
        if (raced && !raced.contactSent && raced.tiktokStatus === 'pending') {
          return this.dispatchContactEvent(raced.id);
        }
        await this.recordDiag({
          teamId: input.teamId,
          integrationId: integration.id,
          conversationId,
          messageId,
          whatsappPhone: customerPhone,
          outcome: 'skip',
          reason: 'duplicate_event',
          isNewConversation,
        });
        this.logConversion('linked', {
          whatsappPhone: customerPhone,
          reason: 'unique_race_already_counted',
          conversationId,
          messageId,
          eventId: raced?.eventId,
        });
        return null;
      }
      throw err;
    }

    await this.recordDiag({
      teamId: input.teamId,
      integrationId: integration.id,
      channelId: input.channelId,
      conversationId,
      messageId,
      whatsappPhone: customerPhone,
      businessPhone: params.businessPhone,
      pixelCode: integration.pixelCode,
      ttclid,
      isNewConversation,
      outcome: 'pending',
      reason: params.skipReasonHint ?? 'contact_created',
      tiktokStatus: 'pending',
    });

    return this.dispatchContactEvent(conversion.id);
  }

  /** Send or retry Contact Events API for a stored conversion row. */
  async dispatchContactEvent(conversionId: string) {
    // Atomic claim with a short lease prevents concurrent double-posts and recovers stuck "sending" rows.
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

    // Lead Gen Ads campaigns optimize for Lead (FORM). Always pair Contact + Lead in one
    // Events API request with the same ttclid so Ads Manager conversions match Events Manager.
    const mirrorLead =
      eventName === TIKTOK_CONTACT_EVENT
        ? [{ event: TIKTOK_LEAD_EVENT, event_id: `${conversion.eventId}_lead` }]
        : undefined;

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
      companionEvents: mirrorLead,
    };

    const started = Date.now();
    try {
      if (integration.advertiserId && integration.pixelId) {
        await this.ads
          .registerPixelEvents(accessToken, integration.advertiserId, integration.pixelId, [
            eventName,
            ...(mirrorLead?.map((e) => e.event) ?? []),
          ])
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
            companion_events: mirrorLead?.map((e) => e.event) ?? [],
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
          lastEventName: mirrorLead?.length
            ? `${eventName}+${mirrorLead.map((e) => e.event).join('+')}`
            : eventName,
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
            eventsPayload: [
              { event: eventName, status: 'sent', source: 'whatsapp_first_message' },
              ...(mirrorLead?.map((e) => ({
                event: e.event,
                status: 'sent',
                source: 'whatsapp_first_message_batch',
                event_id: e.event_id,
              })) ?? []),
            ],
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

      await this.recordDiag({
        teamId: integration.teamId,
        integrationId: integration.id,
        conversationId: conversion.conversationId,
        messageId: conversion.messageId,
        whatsappPhone: conversion.whatsappPhone,
        pixelCode: integration.pixelCode,
        ttclid: conversion.ttclid,
        outcome: 'sent',
        reason: mirrorLead?.length ? 'contact_and_lead_sent' : 'contact_sent',
        tiktokStatus: 'sent',
        tiktokResponse: response as object,
      });

      this.emitIntegrationUpdated(
        integration.teamId,
        integration.id,
        'conversion',
        conversion.whatsappPhone ?? undefined,
      );

      // Persist Lead row as already sent (batched in the same Events API call above).
      // Avoid a second API post that would duplicate Lead for Ads Manager.
      if (mirrorLead?.length && conversion.conversationId) {
        await this.persistBatchedLeadConversion({
          contactConversion: updated,
          integration,
          leadEventId: mirrorLead[0].event_id,
          pageUrl,
          sentAt,
          response: response as object,
        });
      }

      // Always mirror the pixel's selected optimization event (e.g. Purchase → CompletePayment)
      // after Contact (+ batched Lead). Previously this only ran when Lead was NOT batched,
      // so Purchase-optimized sales campaigns never received CompletePayment with ttclid.
      await this.maybeSendCompanionOptimizationEvent(updated, integration);

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
      await this.recordDiag({
        teamId: integration.teamId,
        integrationId: integration.id,
        conversationId: conversion.conversationId,
        messageId: conversion.messageId,
        whatsappPhone: conversion.whatsappPhone,
        pixelCode: integration.pixelCode,
        ttclid: conversion.ttclid,
        outcome: 'failed',
        reason: 'events_api_error',
        tiktokStatus: 'pending',
        errorMessage: message.slice(0, 2000),
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
        // Always leave the claim lease — queue resumes from pending only.
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
    const row = await this.prisma.tikTokIntegrationConversion.update({
      where: { id: conversionId },
      data: {
        contactSent: false,
        tiktokStatus: terminal ? 'failed' : 'pending',
        tiktokError: error.slice(0, 2000),
        nextRetryAt: terminal ? null : new Date(Date.now() + contactRetryDelayMs(1)),
      },
      include: { integration: { select: { teamId: true, pixelCode: true } } },
    });
    if (row?.integration) {
      await this.recordDiag({
        teamId: row.integration.teamId,
        integrationId: row.integrationId,
        conversationId: row.conversationId,
        messageId: row.messageId,
        whatsappPhone: row.whatsappPhone,
        pixelCode: row.integration.pixelCode,
        ttclid: row.ttclid,
        outcome: terminal ? 'failed' : 'skip',
        reason: error,
        tiktokStatus: terminal ? 'failed' : 'pending',
        errorMessage: error,
      });
    }
  }

  private async resolveRefAttribution(messageText: string | null | undefined, teamId: string) {
    const trackingRef = this.extractLeadRef(messageText);
    if (!trackingRef) return null;
    return this.resolveAttributionFromRef(trackingRef, teamId);
  }

  private async resolveAttributionFromRef(trackingRef: string, teamId: string) {
    const attributionSince = new Date(Date.now() - TIKTOK_CONVERSION_ATTRIBUTION_DAYS * 24 * 60 * 60 * 1000);

    const click = await this.prisma.tikTokIntegrationClick.findFirst({
      where: {
        id: trackingRef,
        createdAt: { gte: attributionSince },
        integration: {
          teamId,
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
      if (click.integration.teamId !== teamId) return null;
      const lead = click.lead ?? (await this.ensureLeadForClick(click.integrationId, click.id));
      return { integration: click.integration, lead, click };
    }

    const lead = await this.prisma.tikTokIntegrationLead.findFirst({
      where: {
        id: trackingRef,
        createdAt: { gte: attributionSince },
        integration: { teamId },
      },
      include: {
        click: true,
        integration: { include: { eventConfigurations: true } },
      },
    });
    if (!lead?.click || !lead.integration?.wizardCompleted || lead.integration.billingSuspended) {
      return null;
    }
    if (lead.integration.teamId !== teamId) return null;
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

    try {
      return await this.prisma.tikTokIntegrationLead.create({
        data: { integrationId, clickId },
      });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === 'P2002') {
        const raced = await this.prisma.tikTokIntegrationLead.findUnique({
          where: { clickId },
        });
        if (raced) return raced;
      }
      throw err;
    }
  }

  /**
   * After a tracking WhatsApp connects, persist the live phone on the channel and
   * sync it onto the linked pixel (or auto-link a sole / phone-matched pixel).
   * Ensures every added tracking number can fire Contact+Lead.
   */
  async syncTrackingPhoneOnConnect(teamId: string, sessionId: string, phoneNumber?: string | null) {
    const channel = await this.prisma.channel.findFirst({
      where: { teamId, whatsAppSessionId: sessionId },
      include: { whatsAppSession: true },
    });
    if (!channel) return null;
    if (channel.purpose !== ChannelPurpose.TRACKING && !isTrackingChannel(channel)) return null;

    const livePhone =
      this.normalizePhone(phoneNumber) ||
      this.normalizePhone(
        resolveStoredPhone({
          phoneNumber: channel.whatsAppSession?.phoneNumber,
          jid: channel.whatsAppSession?.jid,
          externalId: channel.externalId,
        }),
      );
    if (!livePhone) return null;

    const meta = (channel.metadata as ChannelMetadataWithPurpose | null) ?? {};
    let integrationId = meta.integrationId ?? null;

    if (!integrationId) {
      const matched = await this.findMatchingIntegrations(livePhone, teamId);
      if (matched.length === 1) {
        integrationId = matched[0].id;
      } else {
        const any = await this.findTeamIntegrationsAny(teamId);
        if (any.length === 1) integrationId = any[0].id;
      }
    }

    await this.prisma.channel.update({
      where: { id: channel.id },
      data: {
        name: livePhone,
        metadata: {
          ...meta,
          purpose: 'tracking',
          connectionSource: 'tiktok_tracking',
          phoneNumber: livePhone,
          ...(integrationId ? { integrationId } : {}),
        },
      },
    });

    if (integrationId) {
      const current = await this.prisma.tikTokIntegration.findFirst({
        where: { id: integrationId, teamId },
        select: { whatsappNumber: true },
      });
      const saved = this.normalizePhone(current?.whatsappNumber);
      if (!saved) {
        await this.prisma.tikTokIntegration.updateMany({
          where: { id: integrationId, teamId },
          data: { whatsappNumber: livePhone },
        });
        this.logger.log(
          `[TikTokConversion] synced tracking phone=${livePhone} → integration=${integrationId} channel=${channel.id}`,
        );
      }
    } else {
      this.logger.warn(
        `[TikTokConversion] tracking phone=${livePhone} connected without pixel link channel=${channel.id} team=${teamId}`,
      );
    }

    return { channelId: channel.id, phoneNumber: livePhone, integrationId };
  }

  async bindChannelToIntegration(channelId: string, integrationId: string, phoneNumber?: string | null) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return;
    const meta = (channel.metadata as ChannelMetadataWithPurpose | null) ?? {};
    const livePhone =
      this.normalizePhone(phoneNumber) ||
      this.normalizePhone((meta as ChannelMetadataWithPurpose).phoneNumber) ||
      null;
    await this.prisma.channel.update({
      where: { id: channelId },
      data: {
        ...(livePhone ? { name: livePhone } : {}),
        metadata: {
          ...meta,
          purpose: 'tracking',
          connectionSource: 'tiktok_tracking',
          integrationId,
          ...(livePhone ? { phoneNumber: livePhone } : {}),
        },
      },
    });
    if (livePhone) {
      const current = await this.prisma.tikTokIntegration.findFirst({
        where: { id: integrationId, teamId: channel.teamId },
        select: { whatsappNumber: true },
      });
      if (!this.normalizePhone(current?.whatsappNumber)) {
        await this.prisma.tikTokIntegration.updateMany({
          where: { id: integrationId, teamId: channel.teamId },
          data: { whatsappNumber: livePhone },
        });
      }
    }
  }

  /**
   * Pick pixels for an inbound message on a tracking WhatsApp.
   * Order: channel→pixel link → phone match → other tracking channels with same phone
   * → recent clicks → any active pixel (so every connected tracking number is covered).
   */
  private async resolveIntegrationsForTrackingInbound(input: {
    teamId: string;
    channelId: string;
    businessPhone: string;
    linkedIntegrationId: string | null;
  }) {
    const byId = new Map<string, Awaited<ReturnType<typeof this.findTeamIntegrationsAny>>[number]>();

    const add = (rows: Array<Awaited<ReturnType<typeof this.findTeamIntegrationsAny>>[number]>) => {
      for (const row of rows) byId.set(row.id, row);
    };

    if (input.linkedIntegrationId) {
      const linked = await this.findTeamIntegrationById(input.linkedIntegrationId, input.teamId);
      if (linked) add([linked]);
    }

    if (input.businessPhone) {
      add(await this.findMatchingIntegrations(input.businessPhone, input.teamId));
      // Also pick pixels linked on ANY team tracking channel that shares this live phone.
      add(await this.findIntegrationsLinkedToPhone(input.businessPhone, input.teamId));
    }

    if (byId.size === 0) {
      const recent = await this.findTeamIntegrationsWithRecentClicks(input.teamId);
      if (recent.length) {
        this.logger.warn(
          `[TikTokConversion] tracking phone mismatch → recent_click_fallback team=${input.teamId} businessPhone=${input.businessPhone || 'none'} candidates=${recent.length}`,
        );
        add(recent);
      }
    }

    if (byId.size === 0) {
      const any = await this.findTeamIntegrationsAny(input.teamId);
      if (any.length) {
        this.logger.warn(
          `[TikTokConversion] tracking phone unbound → team_pixel_fallback team=${input.teamId} channel=${input.channelId} businessPhone=${input.businessPhone || 'none'} candidates=${any.length}`,
        );
        add(any);
      }
    }

    // Prefer linked / phone-matched first in array order for resolveAttribution / [0] fallback.
    const ordered: Array<Awaited<ReturnType<typeof this.findTeamIntegrationsAny>>[number]> = [];
    if (input.linkedIntegrationId && byId.has(input.linkedIntegrationId)) {
      ordered.push(byId.get(input.linkedIntegrationId)!);
      byId.delete(input.linkedIntegrationId);
    }
    for (const row of byId.values()) ordered.push(row);
    return ordered;
  }

  private async findIntegrationsLinkedToPhone(businessPhone: string, teamId: string) {
    const channels = await this.prisma.channel.findMany({
      where: { teamId, purpose: ChannelPurpose.TRACKING },
      include: { whatsAppSession: true },
    });
    const integrationIds: string[] = [];
    for (const row of channels) {
      const meta = row.metadata as ChannelMetadataWithPurpose | null;
      const phone =
        this.normalizePhone(
          resolveStoredPhone({
            phoneNumber: row.whatsAppSession?.phoneNumber ?? meta?.phoneNumber,
            jid: row.whatsAppSession?.jid,
            externalId: row.externalId,
          }),
        ) || this.normalizePhone(meta?.phoneNumber);
      if (!phone || !this.phonesMatch(phone, businessPhone)) continue;
      if (meta?.integrationId) integrationIds.push(meta.integrationId);
    }
    if (!integrationIds.length) return [];
    return this.prisma.tikTokIntegration.findMany({
      where: {
        id: { in: [...new Set(integrationIds)] },
        teamId,
        billingSuspended: false,
        pixelCode: { not: null },
      },
      include: { eventConfigurations: true },
    });
  }

  private async findMatchingIntegrations(businessPhone: string, teamId: string) {
    const integrations = await this.prisma.tikTokIntegration.findMany({
      where: {
        teamId,
        billingSuspended: false,
        pixelCode: { not: null },
        whatsappNumber: { not: null },
      },
      include: { eventConfigurations: true },
    });

    const normalizedBusiness = this.normalizePhone(businessPhone);
    return integrations.filter((row) =>
      this.phonesMatch(this.normalizePhone(row.whatsappNumber), normalizedBusiness),
    );
  }

  private async findTeamIntegrationById(integrationId: string, teamId: string) {
    return this.prisma.tikTokIntegration.findFirst({
      where: {
        id: integrationId,
        teamId,
        billingSuspended: false,
        pixelCode: { not: null },
      },
      include: { eventConfigurations: true },
    });
  }

  private async findTeamIntegrationsAny(teamId: string) {
    return this.prisma.tikTokIntegration.findMany({
      where: {
        teamId,
        billingSuspended: false,
        pixelCode: { not: null },
      },
      include: { eventConfigurations: true },
      orderBy: [{ wizardCompleted: 'desc' }, { updatedAt: 'desc' }],
      take: 25,
    });
  }

  /** When inbound WA number ≠ pixel.whatsappNumber, still find pixels with any recent click. */
  private async findTeamIntegrationsWithRecentClicks(teamId: string) {
    const since = new Date(Date.now() - TIKTOK_CLICK_TO_MESSAGE_MINUTES * 60 * 1000);
    const recent = await this.prisma.tikTokIntegrationClick.findMany({
      where: {
        createdAt: { gte: since },
        integration: {
          teamId,
          billingSuspended: false,
          pixelCode: { not: null },
        },
      },
      select: { integrationId: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const integrationIds = [...new Set(recent.map((row) => row.integrationId))].slice(0, 25);
    if (!integrationIds.length) return [];

    return this.prisma.tikTokIntegration.findMany({
      where: {
        id: { in: integrationIds },
        teamId,
        billingSuspended: false,
        pixelCode: { not: null },
      },
      include: { eventConfigurations: true },
    });
  }

  private async findRecentClickLead(integrationIds: string[], teamId: string) {
    if (!integrationIds.length) return null;
    const since = new Date(Date.now() - RECENT_LEAD_LINK_MINUTES * 60 * 1000);

    const click = await this.prisma.tikTokIntegrationClick.findFirst({
      where: {
        createdAt: { gte: since },
        integrationId: { in: integrationIds },
        integration: {
          teamId,
          wizardCompleted: true,
          billingSuspended: false,
          pixelCode: { not: null },
        },
        OR: [
          { lead: null },
          {
            lead: {
              convertedAt: null,
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
    if (!click?.integration || click.integration.teamId !== teamId) return null;

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
    if (integration.billingSuspended) return null;

    const access = await this.billingAccess.getTeamAccess(integration.teamId);
    if (!access.isActive) return null;

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
    if (result.subscriptionExpired || result.active === false) {
      return {
        active: false,
        subscriptionExpired: true,
        redirectUrl: null,
        pixelId: null,
        pixelCode: null,
        optimizationEvent: null,
        eventsSent: [] as string[],
      };
    }
    return {
      active: true,
      subscriptionExpired: false,
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
    teamId: string,
  ) {
    const integrationIds = integrations.map((row) => row.id);
    const attributionSince = new Date(Date.now() - TIKTOK_CONVERSION_ATTRIBUTION_DAYS * 24 * 60 * 60 * 1000);

    // 1) Explicit hidden ref in the WhatsApp prefill (strongest).
    const leadRef = this.extractLeadRef(messageText);
    if (leadRef) {
      const refAttribution = await this.resolveAttributionFromRef(leadRef, teamId);
      if (refAttribution?.integration.id && integrationIds.includes(refAttribution.integration.id)) {
        return refAttribution;
      }
    }

    // 2) Sticky conversation / phone attribution first — keep the same click for
    // follow-up messages so we never mint another conversion from a random unused click.
    const conversationLead = await this.prisma.tikTokIntegrationLead.findFirst({
      where: {
        conversationId,
        integrationId: { in: integrationIds },
        integration: { teamId },
      },
      include: { click: true, integration: { include: { eventConfigurations: true } } },
      orderBy: { createdAt: 'desc' },
    });
    if (conversationLead?.click && conversationLead.integration.teamId === teamId) {
      return {
        integration: conversationLead.integration,
        lead: conversationLead,
        click: conversationLead.click,
      };
    }

    const phoneLead = await this.prisma.tikTokIntegrationLead.findFirst({
      where: {
        integrationId: { in: integrationIds },
        createdAt: { gte: attributionSince },
        integration: { teamId },
        OR: [{ contactId }, { customerPhone }],
        convertedAt: { not: null },
      },
      include: {
        click: true,
        integration: { include: { eventConfigurations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (phoneLead?.click && phoneLead.integration.teamId === teamId) {
      return { integration: phoneLead.integration, lead: phoneLead, click: phoneLead.click };
    }

    // 3) Newest unused click with ttclid — only for first-time attribution.
    const recentClicks = await this.prisma.tikTokIntegrationClick.findMany({
      where: {
        integrationId: { in: integrationIds },
        createdAt: { gte: new Date(Date.now() - TIKTOK_CLICK_TO_MESSAGE_MINUTES * 60 * 1000) },
        ttclid: { not: null },
        integration: { teamId },
      },
      include: {
        lead: true,
        integration: { include: { eventConfigurations: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    const unusedClick = recentClicks.find((row) => {
      if (!row.integration || row.integration.teamId !== teamId) return false;
      const lead = row.lead;
      if (!lead) return true;
      return !lead.convertedAt && (!lead.conversationId || lead.conversationId === conversationId);
    });

    if (unusedClick?.integration) {
      const leadRow =
        unusedClick.lead ??
        (await this.ensureLeadForClick(unusedClick.integrationId, unusedClick.id));
      return {
        integration: unusedClick.integration,
        lead: leadRow,
        click: unusedClick,
      };
    }

    // 4) Unconverted lead matched by contact / phone.
    const lead = await this.prisma.tikTokIntegrationLead.findFirst({
      where: {
        integrationId: { in: integrationIds },
        convertedAt: null,
        createdAt: { gte: attributionSince },
        integration: { teamId },
        OR: [{ contactId }, { customerPhone }],
      },
      include: {
        click: true,
        integration: { include: { eventConfigurations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (lead?.click && lead.integration.teamId === teamId) {
      return { integration: lead.integration, lead, click: lead.click };
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

  /**
   * Record Lead conversion as sent after Contact+Lead were posted in one Events API batch.
   * Does not call TikTok again (would double-count Lead in Ads Manager).
   */
  private async persistBatchedLeadConversion(input: {
    contactConversion: {
      id: string;
      integrationId: string;
      conversationId: string | null;
      messageId: string | null;
      contactId: string | null;
      whatsappPhone: string | null;
      ttclid: string | null;
      clickId: string | null;
      leadId: string | null;
      externalId: string | null;
      firstMessageAt: Date | null;
      createdAt: Date;
    };
    integration: { id: string; redirectSlug: string; pixelCode: string | null; teamId: string };
    leadEventId: string;
    pageUrl: string;
    sentAt: Date;
    response: object;
  }) {
    const { contactConversion, integration, leadEventId, pageUrl, sentAt, response } = input;
    if (!contactConversion.conversationId) return;

    const existing = await this.prisma.tikTokIntegrationConversion.findFirst({
      where: {
        integrationId: integration.id,
        conversationId: contactConversion.conversationId,
        eventName: TIKTOK_LEAD_EVENT,
      },
    });
    if (existing?.contactSent) return;

    if (existing) {
      await this.prisma.tikTokIntegrationConversion.update({
        where: { id: existing.id },
        data: {
          contactSent: true,
          tiktokStatus: 'sent',
          ttclid: contactConversion.ttclid,
          clickId: contactConversion.clickId,
          sentAt,
          tiktokResponse: response,
          tiktokError: null,
          nextRetryAt: null,
          eventId: existing.eventId || leadEventId,
        },
      });
      return;
    }

    try {
      await this.prisma.tikTokIntegrationConversion.create({
        data: {
          integrationId: integration.id,
          leadId: contactConversion.leadId,
          clickId: contactConversion.clickId,
          conversationId: contactConversion.conversationId,
          messageId: contactConversion.messageId
            ? `${contactConversion.messageId}:${TIKTOK_LEAD_EVENT}`
            : null,
          contactId: contactConversion.contactId,
          whatsappPhone: contactConversion.whatsappPhone,
          eventId: leadEventId,
          eventName: TIKTOK_LEAD_EVENT,
          ttclid: contactConversion.ttclid,
          externalId: contactConversion.externalId,
          pageUrl,
          firstMessageAt: contactConversion.firstMessageAt ?? contactConversion.createdAt,
          contactSent: true,
          tiktokStatus: 'sent',
          sentAt,
          tiktokResponse: response,
        },
      });
    } catch {
      // Unique race — ignore; Lead already recorded.
    }

    this.logConversion('sent', {
      whatsappPhone: contactConversion.whatsappPhone,
      conversationId: contactConversion.conversationId,
      eventId: leadEventId,
      eventName: TIKTOK_LEAD_EVENT,
      convertedAt: sentAt.toISOString(),
      ttclid: contactConversion.ttclid,
      reason: 'lead_batched_with_contact',
    });
  }

  private async maybeSendCompanionOptimizationEvent(
    contactConversion: {
      id: string;
      integrationId: string;
      conversationId: string | null;
      messageId: string | null;
      contactId: string | null;
      whatsappPhone: string | null;
      ttclid: string | null;
      clickId: string | null;
      leadId: string | null;
      externalId: string | null;
      pageUrl: string | null;
      firstMessageAt: Date | null;
      createdAt: Date;
      contactSent: boolean;
    },
    integration: {
      id: string;
      teamId: string;
      userId: string;
      redirectSlug: string;
      pixelCode: string | null;
      pixelId: string | null;
      advertiserId: string | null;
      defaultOptimizationEvent: import('@watsapp/database').TikTokOptimizationEvent;
      customEventName: string | null;
    },
  ) {
    if (!contactConversion.contactSent || !integration.pixelCode) return;

    const companionEvent = conversionEventName({
      defaultOptimizationEvent: integration.defaultOptimizationEvent,
      customEventName: integration.customEventName,
    });
    // Always send Lead for Lead-gen Ads when Contact succeeded, even if default is Contact —
    // many Ads Manager campaigns optimize for Lead while the pixel URL uses Contact.
    const eventsToMirror = new Set<string>();
    if (companionEvent && companionEvent !== TIKTOK_CONTACT_EVENT) {
      eventsToMirror.add(companionEvent);
    }
    eventsToMirror.add(TIKTOK_LEAD_EVENT);

    for (const eventName of eventsToMirror) {
      if (eventName === TIKTOK_CONTACT_EVENT) continue;
      if (!contactConversion.conversationId) continue;

      const existing = await this.prisma.tikTokIntegrationConversion.findFirst({
        where: {
          integrationId: integration.id,
          conversationId: contactConversion.conversationId,
          eventName,
        },
      });
      if (existing?.contactSent) continue;
      if (existing && !existing.contactSent && existing.tiktokStatus === 'pending') {
        await this.dispatchCompanionEvent(existing.id);
        continue;
      }
      if (existing) continue;

      const eventId = randomUUID();
      const pageUrl =
        contactConversion.pageUrl ??
        `${this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '')}/r/${integration.redirectSlug}?event=${encodeURIComponent(eventName)}`;

      let row;
      try {
        row = await this.prisma.tikTokIntegrationConversion.create({
          data: {
            integrationId: integration.id,
            leadId: contactConversion.leadId,
            clickId: contactConversion.clickId,
            conversationId: contactConversion.conversationId,
            messageId: contactConversion.messageId
              ? `${contactConversion.messageId}:${eventName}`
              : null,
            contactId: contactConversion.contactId,
            whatsappPhone: contactConversion.whatsappPhone,
            eventId,
            eventName,
            ttclid: contactConversion.ttclid,
            externalId: contactConversion.externalId,
            pageUrl,
            firstMessageAt: contactConversion.firstMessageAt ?? contactConversion.createdAt,
            contactSent: false,
            tiktokStatus: 'pending',
          },
        });
      } catch {
        continue;
      }
      await this.dispatchCompanionEvent(row.id);
    }
  }

  /** Dispatch a non-Contact companion event (Lead, etc.) reusing Contact send path fields. */
  private async dispatchCompanionEvent(conversionId: string) {
    // Reuse Contact dispatcher — it posts conversion.eventName as-is to Events API.
    return this.dispatchContactEvent(conversionId);
  }

  private phonesMatch(stored?: string | null, incoming?: string | null): boolean {
    const a = this.normalizePhone(stored);
    const b = this.normalizePhone(incoming);
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.slice(-10) === b.slice(-10)) return true;
    // Extra leniency for regional formatting differences (9–11 national digits).
    if (a.length >= 9 && b.length >= 9 && a.slice(-9) === b.slice(-9)) return true;
    return false;
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
    let digits = value.replace(/[^\d]/g, '');
    // Strip national trunk '0' after country code (e.g. 9640773… → 964773…).
    const trunkZero = /^(964|971|966|973|974|968|965|961|962|20|90)0(\d{8,12})$/;
    const match = digits.match(trunkZero);
    if (match) digits = `${match[1]}${match[2]}`;
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

  private isUrlDestination(type?: string | null) {
    return type === 'EXTERNAL_URL' || type === 'INSTANT_FORM' || type === 'STORE';
  }

  private appendAttributionQuery(
    baseUrl: string,
    params: {
      ttclid?: string | null;
      campaignId?: string | null;
      adgroupId?: string | null;
      adId?: string | null;
    },
  ) {
    try {
      const url = new URL(baseUrl);
      if (params.ttclid && !url.searchParams.get('ttclid')) url.searchParams.set('ttclid', params.ttclid);
      if (params.campaignId && !url.searchParams.get('campaign_id')) {
        url.searchParams.set('campaign_id', params.campaignId);
      }
      if (params.adgroupId && !url.searchParams.get('adgroup_id')) {
        url.searchParams.set('adgroup_id', params.adgroupId);
      }
      if (params.adId && !url.searchParams.get('ad_id')) url.searchParams.set('ad_id', params.adId);
      return url.toString();
    } catch {
      return baseUrl;
    }
  }

  /**
   * Store / Instant Form order → TikTok Events API (CompletePayment / Lead / SubmitForm).
   * Idempotent per (integrationId, eventName, orderId).
   */
  async trackEcommerceOrderConversion(input: {
    integrationId: string;
    orderId: string;
    orderNumber?: string | null;
    ttclid?: string | null;
    phone?: string | null;
    value?: number | null;
    currency?: string | null;
    pageUrl?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    kind: 'STORE' | 'INSTANT_FORM' | 'LANDING_LEAD';
    /** Browser↔server dedupe for Lead */
    eventId?: string | null;
  }) {
    const integration = await this.prisma.tikTokIntegration.findUnique({
      where: { id: input.integrationId },
    });
    if (!integration?.pixelCode || integration.billingSuspended) {
      this.logger.warn(`[TikTokOrder] skip — missing pixel or suspended integration=${input.integrationId}`);
      return { ok: false as const, reason: 'no_pixel' };
    }

    const access = await this.billingAccess.getTeamAccess(integration.teamId);
    if (!access.isActive) return { ok: false as const, reason: 'billing_inactive' };

    const companions: Array<{ event: string; event_id: string }> = [];
    let eventName: string;

    if (input.kind === 'LANDING_LEAD') {
      // طلب COD معلّق = Lead فقط — بدون Purchase / CompletePayment
      eventName = TIKTOK_LEAD_EVENT;
    } else {
      const primaryEvent = conversionEventName({
        defaultOptimizationEvent: integration.defaultOptimizationEvent,
        customEventName: integration.customEventName,
      });
      // Fallback: store/form orders always count as CompletePayment for Ads purchase optimization
      eventName =
        primaryEvent === 'Contact' || primaryEvent === 'PageView' || primaryEvent === 'ViewContent'
          ? 'CompletePayment'
          : primaryEvent;

      if (input.kind === 'INSTANT_FORM') {
        // هدف التحسين للاستمارة يحتاج Lead (FORM) + CompletePayment (SHOPPING / Purchase)
        // دائماً — حتى لو السعر غير مضبوط — حتى يظهر الهدف Active في Ads Manager
        if (eventName !== TIKTOK_LEAD_EVENT) {
          companions.push({ event: TIKTOK_LEAD_EVENT, event_id: `lead_${input.orderId}` });
        }
        if (eventName !== 'CompletePayment') {
          companions.push({ event: 'CompletePayment', event_id: `pay_${input.orderId}` });
        }
      } else if (eventName !== 'CompletePayment' && (input.kind === 'STORE' || input.value != null)) {
        companions.push({ event: 'CompletePayment', event_id: `pay_${input.orderId}` });
      }
    }

    const ttclid = sanitizeTtclid(input.ttclid);
    const existing = await this.prisma.tikTokIntegrationConversion.findFirst({
      where: {
        integrationId: integration.id,
        eventName,
        orderId: input.orderId,
      },
    });
    if (existing?.contactSent) {
      return { ok: true as const, deduped: true, eventName };
    }

    let conversion = existing;
    if (!conversion) {
      try {
        conversion = await this.prisma.tikTokIntegrationConversion.create({
          data: {
            integrationId: integration.id,
            eventId: (input.eventId && String(input.eventId).trim().slice(0, 80)) || randomUUID(),
            eventName,
            orderId: input.orderId,
            ttclid,
            whatsappPhone: input.phone?.replace(/\D/g, '') || null,
            externalId: input.orderNumber || input.orderId,
            pageUrl: input.pageUrl ?? null,
            valueAmount: input.value != null && Number.isFinite(input.value) ? Number(input.value) : null,
            currency: input.currency || null,
            firstMessageAt: new Date(),
            contactSent: false,
            tiktokStatus: 'pending',
          },
        });
      } catch (err) {
        const raced = await this.prisma.tikTokIntegrationConversion.findFirst({
          where: { integrationId: integration.id, eventName, orderId: input.orderId },
        });
        if (raced?.contactSent) return { ok: true as const, deduped: true, eventName };
        conversion = raced;
        if (!conversion) {
          this.logger.warn(`[TikTokOrder] create failed: ${err instanceof Error ? err.message : String(err)}`);
          return { ok: false as const, reason: 'create_failed' };
        }
      }
    }

    let accessToken =
      this.credentials.getAccessTokenForIntegration(integration) ?? null;
    if (!accessToken) {
      try {
        accessToken = await this.marketingOAuth.getValidMarketingAccessToken(integration.userId);
      } catch {
        accessToken = null;
      }
    }
    // محاولة تفعيل Events API تلقائياً من توكن الحساب الإعلاني قبل الفشل
    if (!accessToken || !integration.eventsApiConnected) {
      try {
        const linked = await this.credentials.ensureAdvertiserToken(integration.userId, {
          id: integration.id,
          pixelCode: integration.pixelCode,
          pixelId: integration.pixelId,
          advertiserId: integration.advertiserId,
          eventsApiConnected: Boolean(integration.eventsApiConnected),
          eventsApiTokenHint: integration.eventsApiTokenHint,
          encryptedEventsApiAccessToken: integration.encryptedEventsApiAccessToken,
        });
        accessToken =
          this.credentials.getAccessTokenForIntegration(linked as typeof integration)
          ?? accessToken
          ?? (await this.marketingOAuth.getValidMarketingAccessToken(integration.userId).catch(() => null));
      } catch (err) {
        this.logger.warn(
          `[TikTokOrder] ensureAdvertiserToken soft-fail: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    if (!accessToken) {
      await this.prisma.tikTokIntegrationConversion.update({
        where: { id: conversion.id },
        data: { tiktokStatus: 'failed', tiktokError: 'missing_events_api_token' },
      });
      return { ok: false as const, reason: 'missing_token' };
    }

    const eventTime = Math.floor(Date.now() / 1000);
    // تيك توك يشترط value+currency لتفعيل CompletePayment كهدف تحسين
    const numericValue =
      conversion.valueAmount != null && Number.isFinite(conversion.valueAmount) && conversion.valueAmount > 0
        ? Number(conversion.valueAmount)
        : Math.max(1, Number(input.value) || 1);
    const currency = (conversion.currency || input.currency || 'IQD').toUpperCase();
    const valueStr = String(numericValue);
    const properties: Record<string, string | undefined> = {
      value: valueStr,
      currency,
      order_id: input.orderNumber || input.orderId,
      content_type: input.kind === 'STORE' ? 'product' : 'lead_form',
      contents: JSON.stringify([{ content_id: input.orderId, quantity: 1, price: numericValue }]),
    };

    const pageUrl =
      conversion.pageUrl
      ?? `${this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '')}/r/${integration.redirectSlug}`;

    const payload = {
      event: eventName,
      event_id: conversion.eventId,
      event_time: eventTime,
      url: pageUrl,
      ttclid,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      phone: hashTikTokPhone(input.phone),
      externalId: conversion.externalId,
      properties,
      companionEvents: companions,
    };

    try {
      const eventsToRegister = [eventName, ...companions.map((c) => c.event)];
      if (input.kind === 'STORE') eventsToRegister.push('InitiateCheckout', 'CompletePayment');
      if (input.kind === 'INSTANT_FORM') eventsToRegister.push('Lead', 'CompletePayment', 'InitiateCheckout');
      if (integration.advertiserId && integration.pixelId) {
        await this.ads
          .registerPixelEvents(accessToken, integration.advertiserId, integration.pixelId, eventsToRegister)
          .catch((err) => {
            this.logger.warn(
              `[TikTokOrder] register events soft-fail: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
      }

      let response: unknown;
      try {
        response = await this.ads.trackPixelEvent(accessToken, integration.pixelCode, payload);
      } catch (batchErr) {
        // إن فشل الإرسال الجماعي، أرسل كل حدث على حدة حتى لا يضيع هدف التحسين
        this.logger.warn(
          `[TikTokOrder] batch track failed, retrying singly: ${batchErr instanceof Error ? batchErr.message : String(batchErr)}`,
        );
        const singles = [
          { event: eventName, event_id: conversion.eventId },
          ...companions,
        ];
        let lastOk: unknown = null;
        for (const single of singles) {
          lastOk = await this.ads.trackPixelEvent(accessToken, integration.pixelCode, {
            event: single.event,
            event_id: single.event_id,
            event_time: eventTime,
            url: pageUrl,
            ttclid,
            ip: input.ip ?? null,
            userAgent: input.userAgent ?? null,
            phone: hashTikTokPhone(input.phone),
            externalId: conversion.externalId,
            properties,
          });
        }
        response = lastOk;
      }
      const sentAt = new Date();
      await this.prisma.tikTokIntegrationConversion.update({
        where: { id: conversion.id },
        data: {
          contactSent: true,
          tiktokStatus: 'sent',
          sentAt,
          ttclid: ttclid ?? conversion.ttclid,
          valueAmount: numericValue,
          currency,
          tiktokResponse: response as object,
          tiktokError: null,
        },
      });
      await this.prisma.tikTokIntegration.update({
        where: { id: integration.id },
        data: {
          lastEventSentAt: sentAt,
          lastEventName: eventName,
          lastApiHttpStatus: 200,
          lastApiError: null,
          pixelStatus: 'active',
          pixelStatusMessage: `Received ${eventName}`,
        },
      });

      // سجّل أحداث Lead المرافقة في جدول التحويلات حتى تظهر في إحصائيات البكسل
      for (const companion of companions) {
        try {
          const existingCompanion = await this.prisma.tikTokIntegrationConversion.findFirst({
            where: {
              integrationId: integration.id,
              eventName: companion.event,
              orderId: input.orderId,
            },
          });
          if (existingCompanion?.contactSent) continue;
          if (existingCompanion) {
            await this.prisma.tikTokIntegrationConversion.update({
              where: { id: existingCompanion.id },
              data: {
                contactSent: true,
                tiktokStatus: 'sent',
                sentAt,
                ttclid: ttclid ?? existingCompanion.ttclid,
                tiktokError: null,
              },
            });
          } else {
            await this.prisma.tikTokIntegrationConversion.create({
              data: {
                integrationId: integration.id,
                eventId: companion.event_id,
                eventName: companion.event,
                orderId: input.orderId,
                ttclid,
                whatsappPhone: input.phone?.replace(/\D/g, '') || null,
                externalId: input.orderNumber || input.orderId,
                pageUrl: input.pageUrl ?? null,
                valueAmount: numericValue,
                currency,
                firstMessageAt: new Date(),
                contactSent: true,
                sentAt,
                tiktokStatus: 'sent',
              },
            });
          }
        } catch (err) {
          this.logger.warn(
            `[TikTokOrder] companion ${companion.event} record soft-fail: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      this.emitIntegrationUpdated(integration.teamId, integration.id, 'conversion');
      this.logger.log(
        `[TikTokOrder] sent ${eventName} kind=${input.kind} order=${input.orderId} value=${valueStr} ${currency} ttclid=${ttclid ? 'yes' : 'no'}`,
      );
      return { ok: true as const, eventName, companions: companions.map((c) => c.event) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.tikTokIntegrationConversion.update({
        where: { id: conversion.id },
        data: {
          tiktokStatus: 'failed',
          tiktokError: message.slice(0, 500),
          retryCount: { increment: 1 },
        },
      });
      this.logger.warn(`[TikTokOrder] Events API failed: ${message}`);
      return { ok: false as const, reason: message };
    }
  }

  /** إعادة تسجيل أحداث المتجر/الاستمارة وإعادة إرسال طلبات لتيك توك لتفعيل هدف التحسين */
  async resyncEcommercePixel(integrationId: string, userId: string) {
    const integration = await this.prisma.tikTokIntegration.findFirst({
      where: { id: integrationId, userId },
    });
    if (!integration?.pixelCode || !integration.pixelId || !integration.advertiserId) {
      return { ok: false as const, reason: 'pixel_incomplete' };
    }

    let accessToken = '';
    try {
      accessToken = await this.marketingOAuth.getValidMarketingAccessToken(userId);
    } catch (err) {
      return {
        ok: false as const,
        reason: err instanceof Error ? err.message : 'missing_token',
      };
    }

    const kind =
      integration.redirectDestinationType === 'STORE'
        ? 'STORE'
        : integration.redirectDestinationType === 'INSTANT_FORM'
          ? 'INSTANT_FORM'
          : integration.externalRedirectUrl?.includes('/s/')
            ? 'STORE'
            : integration.externalRedirectUrl?.includes('/f/')
              ? 'INSTANT_FORM'
              : null;
    const events =
      kind === 'STORE'
        ? ['CompletePayment', 'InitiateCheckout']
        : kind === 'INSTANT_FORM'
          ? ['CompletePayment', 'Lead']
          : ['CompletePayment', 'Lead'];

    try {
      await this.ads.registerPixelEvents(accessToken, integration.advertiserId, integration.pixelId, events);
    } catch (err) {
      this.logger.warn(
        `[TikTokOrder] resync register soft-fail: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const pageUrl =
      integration.externalRedirectUrl
      || `${this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '')}/r/${integration.redirectSlug}`;

    const recent = await this.prisma.tikTokIntegrationConversion.findMany({
      where: {
        integrationId: integration.id,
        orderId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });

    let resent = 0;
    const stamp = Date.now();
    const fire = async (event: string, props?: Record<string, string | undefined>, ttclid?: string | null) => {
      try {
        await this.ads.trackPixelEvent(accessToken, integration.pixelCode!, {
          event,
          event_id: `resync_${event}_${integration.id}_${stamp}_${resent}`,
          event_time: Math.floor(Date.now() / 1000),
          url: pageUrl,
          ttclid: ttclid ?? null,
          properties: props,
        });
        resent += 1;
      } catch (err) {
        this.logger.warn(
          `[TikTokOrder] resync fire ${event} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    };

    if (recent.length) {
      const row = recent[0]!;
      const value = row.valueAmount && row.valueAmount > 0 ? String(row.valueAmount) : '1';
      const currency = row.currency || 'IQD';
      await fire(
        'CompletePayment',
        {
          value,
          currency,
          order_id: row.externalId || row.orderId || row.id,
          content_type: kind === 'STORE' ? 'product' : 'lead_form',
        },
        row.ttclid,
      );
      if (kind === 'INSTANT_FORM') {
        await fire('Lead', { content_type: 'lead_form' }, row.ttclid);
      }
    } else if (kind === 'INSTANT_FORM') {
      // أعد إرسال آخر طلبات الاستمارة المرتبطة بهذا البكسل إن لم توجد تحويلات سابقة
      const formOrders = await this.prisma.instantFormOrder.findMany({
        where: { form: { pixelIntegrationId: integration.id } },
        orderBy: { submittedAt: 'desc' },
        take: 3,
      });
      if (formOrders.length) {
        for (const order of formOrders) {
          await this.trackEcommerceOrderConversion({
            integrationId: integration.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            ttclid: order.ttclid,
            phone: order.customerWhatsapp || order.customerPhone,
            value: order.totalPrice != null ? Number(order.totalPrice) : 1,
            currency: order.currency || 'IQD',
            pageUrl: pageUrl,
            kind: 'INSTANT_FORM',
          }).catch((err) => {
            this.logger.warn(
              `[TikTokOrder] resync form order failed: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
          resent += 1;
        }
      } else {
        await fire('CompletePayment', {
          value: '1',
          currency: 'IQD',
          order_id: `activate_${integration.id}`,
          content_type: 'lead_form',
        });
        await fire('Lead', { content_type: 'lead_form' });
      }
    } else {
      await fire('CompletePayment', {
        value: '1',
        currency: 'IQD',
        order_id: `activate_${integration.id}`,
        content_type: kind === 'STORE' ? 'product' : 'lead_form',
      });
    }

    await fire('PageView');

    await this.prisma.tikTokIntegration.update({
      where: { id: integration.id },
      data: {
        lastEventSentAt: new Date(),
        lastEventName: 'CompletePayment',
        lastApiHttpStatus: 200,
        lastApiError: null,
        pixelStatus: 'waiting_for_activity',
        pixelStatusMessage: 'Events re-synced to TikTok Events Manager',
        activatedAt: new Date(),
      },
    });

    this.logger.log(`[TikTokOrder] resync pixel=${integration.pixelCode} kind=${kind} resent=${resent}`);
    return { ok: true as const, resent, events, kind };
  }

  private async recordDiag(input: {
    teamId: string;
    integrationId?: string | null;
    channelId?: string | null;
    conversationId?: string | null;
    messageId?: string | null;
    whatsappPhone?: string | null;
    businessPhone?: string | null;
    pixelCode?: string | null;
    ttclid?: string | null;
    isNewConversation?: boolean | null;
    outcome: string;
    reason?: string | null;
    tiktokStatus?: string | null;
    tiktokResponse?: object | null;
    errorMessage?: string | null;
  }) {
    try {
      await this.prisma.tikTokIntegrationInboundDiag.create({
        data: {
          id: randomUUID(),
          teamId: input.teamId,
          integrationId: input.integrationId ?? null,
          channelId: input.channelId ?? null,
          conversationId: input.conversationId ?? null,
          messageId: input.messageId ?? null,
          whatsappPhone: input.whatsappPhone ?? null,
          businessPhone: input.businessPhone ?? null,
          pixelCode: input.pixelCode ?? null,
          ttclid: input.ttclid ?? null,
          isNewConversation: input.isNewConversation ?? null,
          outcome: input.outcome,
          reason: input.reason ?? null,
          tiktokStatus: input.tiktokStatus ?? null,
          tiktokResponse: input.tiktokResponse ?? undefined,
          errorMessage: input.errorMessage ?? input.reason ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(
        `[TikTokConversion] recordDiag failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
