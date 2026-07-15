import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TikTokOptimizationEvent } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { TikTokAdsService } from '../integrations/tiktok-login-kit/tiktok-ads.service';
import { TikTokMarketingOAuthService } from '../integrations/tiktok-login-kit/tiktok-marketing-oauth.service';
import {
  DEFAULT_REDIRECT_MESSAGE,
  TIKTOK_OPTIMIZATION_EVENTS,
  generateRedirectSlug,
  buildConversionTrackingUrl,
  buildConversionEventBuilderUrl,
  conversionEventName,
} from './tiktok-integration.constants';
import {
  CreatePixelDto,
  SaveOptimizationEventDto,
  SaveWhatsappDto,
  SelectAdvertiserDto,
  UpdateIntegrationDto,
} from './dto/tiktok-integration.dto';
import { TikTokIntegrationActivationService } from './tiktok-integration-activation.service';
import { TikTokIntegrationPixelStatusService } from './tiktok-integration-pixel-status.service';
import { TikTokIntegrationTrackingService } from './tiktok-integration-tracking.service';
import { TikTokTrackingPhonesService } from './tiktok-tracking-phones.service';

@Injectable()
export class TikTokIntegrationService {
  private readonly logger = new Logger(TikTokIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ads: TikTokAdsService,
    private readonly marketingOAuth: TikTokMarketingOAuthService,
    private readonly activation: TikTokIntegrationActivationService,
    private readonly pixelStatus: TikTokIntegrationPixelStatusService,
    private readonly tracking: TikTokIntegrationTrackingService,
    private readonly trackingPhones: TikTokTrackingPhonesService,
  ) {}

  async listIntegrations(userId: string, teamId: string) {
    const rows = await this.prisma.tikTokIntegration.findMany({
      where: { userId, teamId },
      include: { eventConfigurations: true },
      orderBy: { updatedAt: 'desc' },
    });
    const webUrl = this.webUrl();
    return {
      integrations: rows.map((row) => this.toView(row, webUrl)),
    };
  }

  async createIntegration(userId: string, teamId: string) {
    let slug = generateRedirectSlug();
    while (await this.prisma.tikTokIntegration.findUnique({ where: { redirectSlug: slug } })) {
      slug = generateRedirectSlug();
    }

    const integration = await this.prisma.tikTokIntegration.create({
      data: {
        userId,
        teamId,
        redirectSlug: slug,
        redirectMessage: DEFAULT_REDIRECT_MESSAGE,
        defaultOptimizationEvent: 'Contact',
        wizardStep: 1,
      },
    });

    await this.seedEventConfigurations(integration.id);
    const created = await this.prisma.tikTokIntegration.findUniqueOrThrow({
      where: { id: integration.id },
      include: { eventConfigurations: true },
    });
    return this.toView(created, this.webUrl());
  }

  private async resolveIntegration(userId: string, teamId: string, integrationId?: string) {
    if (integrationId) {
      const row = await this.prisma.tikTokIntegration.findFirst({
        where: { id: integrationId, userId, teamId },
        include: { eventConfigurations: true },
      });
      if (!row) throw new NotFoundException('Integration not found');
      return row;
    }

    const existing = await this.prisma.tikTokIntegration.findFirst({
      where: { userId, teamId },
      include: { eventConfigurations: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) return existing;

    return this.createIntegrationRecord(userId, teamId);
  }

  private async createIntegrationRecord(userId: string, teamId: string) {
    let slug = generateRedirectSlug();
    while (await this.prisma.tikTokIntegration.findUnique({ where: { redirectSlug: slug } })) {
      slug = generateRedirectSlug();
    }

    const integration = await this.prisma.tikTokIntegration.create({
      data: {
        userId,
        teamId,
        redirectSlug: slug,
        redirectMessage: DEFAULT_REDIRECT_MESSAGE,
        defaultOptimizationEvent: 'Contact',
        wizardStep: 1,
      },
    });

    await this.seedEventConfigurations(integration.id);
    return this.prisma.tikTokIntegration.findUniqueOrThrow({
      where: { id: integration.id },
      include: { eventConfigurations: true },
    });
  }

  async getWizardState(userId: string, teamId: string, integrationId?: string, createNew = false) {
    const integration = createNew
      ? await this.createIntegrationRecord(userId, teamId)
      : await this.resolveIntegration(userId, teamId, integrationId);

    const marketing = await this.prisma.tikTokMarketingConnection.findUnique({
      where: { userId },
      include: { advertisers: { orderBy: { name: 'asc' } } },
    });

    const webUrl = this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '');
    return {
      integration: this.toView(integration, webUrl),
      marketingConnected: Boolean(marketing),
      advertisers:
        marketing?.advertisers.map((a) => ({
          advertiserId: a.advertiserId,
          name: a.name,
          currency: a.currency,
          status: a.status,
        })) ?? [],
      optimizationEvents: TIKTOK_OPTIMIZATION_EVENTS.map((eventName) => ({
        eventName,
        enabled:
          integration.eventConfigurations.find((c) => c.eventName === eventName)?.enabled ?? false,
      })),
    };
  }

  async startOAuth(userId: string, teamId: string, integrationId?: string) {
    const integration = await this.resolveIntegration(userId, teamId, integrationId);
    const returnTo = `/tiktok/integration/wizard?id=${integration.id}`;
    return this.marketingOAuth.startLogin(userId, teamId, returnTo);
  }

  async listAdvertiserPixels(userId: string, teamId: string, integrationId: string) {
    const integration = await this.resolveIntegration(userId, teamId, integrationId);
    if (!integration.advertiserId) {
      throw new BadRequestException('Select an advertiser first');
    }
    const accessToken = await this.marketingOAuth.getValidMarketingAccessToken(userId);
    const pixels = await this.ads.listPixels(accessToken, integration.advertiserId);
    return {
      pixels: pixels.map((p) => ({
        pixelId: p.pixel_id,
        pixelCode: p.pixel_code,
        pixelName: p.pixel_name,
        activityStatus: p.activity_status,
      })),
    };
  }

  async saveAdvertiser(userId: string, teamId: string, dto: SelectAdvertiserDto) {
    const integration = await this.resolveIntegration(userId, teamId, dto.integrationId);
    const updated = await this.prisma.tikTokIntegration.update({
      where: { id: integration.id },
      data: {
        advertiserId: dto.advertiserId,
        advertiserName: dto.advertiserName ?? null,
        wizardStep: Math.max(integration.wizardStep, 3),
      },
      include: { eventConfigurations: true },
    });

    let result = updated;
    if (dto.useExistingPixelId) {
      result = await this.applyExistingPixel(userId, updated, dto.useExistingPixelId);
    } else if (!updated.pixelId && dto.createNewPixel === true) {
      try {
        result = await this.provisionPixel(userId, updated, dto.pixelName);
      } catch (err) {
        this.throwTikTokApiError(err);
      }
    }

    return this.toView(result, this.webUrl());
  }

  async saveWhatsapp(userId: string, teamId: string, dto: SaveWhatsappDto) {
    const integration = await this.resolveIntegration(userId, teamId, dto.integrationId);
    const phone = dto.whatsappNumber.replace(/\D/g, '');
    if (phone.length < 8) throw new BadRequestException('Invalid WhatsApp number');

    const updated = await this.prisma.tikTokIntegration.update({
      where: { id: integration.id },
      data: {
        whatsappNumber: phone,
        wizardStep: Math.max(integration.wizardStep, 4),
      },
      include: { eventConfigurations: true },
    });
    return this.toView(updated, this.webUrl());
  }

  async createPixel(userId: string, teamId: string, dto: CreatePixelDto) {
    const integration = await this.resolveIntegration(userId, teamId, dto.integrationId);
    if (!integration.advertiserId) {
      throw new BadRequestException('Select an advertiser first (wizard step 2)');
    }
    if (integration.pixelId) {
      throw new BadRequestException('This integration already has a pixel. Create a new pixel setup instead.');
    }
    try {
      const updated = await this.provisionPixel(userId, integration, dto.pixelName);
      return this.toView(updated, this.webUrl());
    } catch (err) {
      this.throwTikTokApiError(err);
    }
  }

  private throwTikTokApiError(err: unknown): never {
    if (err instanceof BadRequestException) throw err;
    const msg = err instanceof Error ? err.message : 'TikTok API error';
    throw new BadRequestException(msg);
  }

  private async provisionPixel(
    userId: string,
    integration: { id: string; advertiserId: string | null; advertiserName: string | null; wizardStep: number },
    pixelNameInput?: string | null,
  ) {
    if (!integration.advertiserId) {
      throw new BadRequestException('Advertiser is required to create a pixel');
    }
    const accessToken = await this.marketingOAuth.getValidMarketingAccessToken(userId);
    const baseName = `Chatloora ${integration.advertiserName ?? integration.advertiserId}`;
    const pixelName = pixelNameInput?.trim()
      ? pixelNameInput.trim().slice(0, 100)
      : `${baseName} ${Date.now().toString(36)}`.slice(0, 100);

    const pixel = await this.ads.createPixel(accessToken, integration.advertiserId, pixelName);

    const pixelCode = await this.ads.ensurePixelCode(
      accessToken,
      integration.advertiserId,
      pixel.pixel_id,
      pixel.pixel_code,
    );

    const updated = await this.prisma.tikTokIntegration.update({
      where: { id: integration.id },
      data: {
        pixelId: pixel.pixel_id,
        pixelCode,
        pixelName: pixel.pixel_name,
        name: pixel.pixel_name,
        pixelStatus: 'waiting_for_activity',
        wizardStep: Math.max(integration.wizardStep, 4),
      },
      include: { eventConfigurations: true },
    });

    await this.activation.activateIntegration(updated.id, userId);
    return updated;
  }

  private async applyExistingPixel(
    userId: string,
    integration: { id: string; advertiserId: string | null; wizardStep: number },
    pixelId: string,
  ) {
    if (!integration.advertiserId) {
      throw new BadRequestException('Advertiser is required');
    }
    const accessToken = await this.marketingOAuth.getValidMarketingAccessToken(userId);
    const pixels = await this.ads.listPixels(accessToken, integration.advertiserId);
    const match = pixels.find((p) => p.pixel_id === pixelId);
    if (!match) {
      throw new BadRequestException('Pixel not found on this advertiser account');
    }
    const { status, message } = this.pixelStatus.mapTikTokPixelStatus(match.activity_status);
    const updated = await this.prisma.tikTokIntegration.update({
      where: { id: integration.id },
      data: {
        pixelId: match.pixel_id,
        pixelCode: match.pixel_code,
        pixelName: match.pixel_name ?? null,
        name: match.pixel_name ?? null,
        pixelStatus: status,
        pixelStatusMessage: message,
        wizardStep: Math.max(integration.wizardStep, 4),
      },
      include: { eventConfigurations: true },
    });
    await this.activation.activateIntegration(updated.id, userId);
    return updated;
  }

  async saveOptimizationEvent(userId: string, teamId: string, dto: SaveOptimizationEventDto) {
    const integration = await this.resolveIntegration(userId, teamId, dto.integrationId);
    if (!integration.pixelCode) {
      throw new BadRequestException('Create a pixel first (wizard step 4)');
    }
    if (dto.defaultOptimizationEvent === 'Custom' && !dto.customEventName?.trim()) {
      throw new BadRequestException('Custom event name is required when selecting Custom Event');
    }

    const enabledList = dto.enabledEvents?.length
      ? dto.enabledEvents
      : [dto.defaultOptimizationEvent];
    const enabled = new Set(enabledList);
    enabled.add(dto.defaultOptimizationEvent);

    await this.prisma.$transaction(
      TIKTOK_OPTIMIZATION_EVENTS.map((eventName) =>
        this.prisma.tikTokEventConfiguration.upsert({
          where: {
            integrationId_eventName: { integrationId: integration.id, eventName },
          },
          update: { enabled: enabled.has(eventName) },
          create: { integrationId: integration.id, eventName, enabled: enabled.has(eventName) },
        }),
      ),
    );

    const updated = await this.prisma.tikTokIntegration.update({
      where: { id: integration.id },
      data: {
        defaultOptimizationEvent: dto.defaultOptimizationEvent,
        customEventName: dto.customEventName?.trim() || null,
        redirectMessage: dto.redirectMessage?.trim() || integration.redirectMessage || DEFAULT_REDIRECT_MESSAGE,
        wizardStep: 6,
        wizardCompleted: true,
      },
      include: { eventConfigurations: true },
    });

    await this.activation.activateIntegration(updated.id, userId);

    return this.toView(updated, this.webUrl());
  }

  async repairWaitingPixels(userId: string, teamId: string) {
    return this.activation.repairWaitingPixels(userId, teamId);
  }

  async refreshPixelStatus(userId: string, teamId: string, integrationId: string) {
    const integration = await this.resolveIntegration(userId, teamId, integrationId);
    if (!integration.pixelId || !integration.advertiserId) {
      throw new BadRequestException('Pixel not configured');
    }
    await this.activation.activateIntegration(integration.id, userId);
    await this.pixelStatus.refreshIntegrationStatus(
      integration.id,
      userId,
      integration.pixelId,
      integration.advertiserId,
    );
    const fresh = await this.prisma.tikTokIntegration.findUniqueOrThrow({
      where: { id: integration.id },
      include: { eventConfigurations: true },
    });
    return this.toView(fresh, this.webUrl());
  }

  async updateIntegration(
    userId: string,
    teamId: string,
    integrationId: string,
    dto: UpdateIntegrationDto,
  ) {
    const integration = await this.resolveIntegration(userId, teamId, integrationId);

    const data: {
      name?: string | null;
      whatsappNumber?: string;
      defaultOptimizationEvent?: TikTokOptimizationEvent;
      customEventName?: string | null;
      redirectMessage?: string;
    } = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim() || null;
    }
    if (dto.whatsappNumber !== undefined) {
      const phone = dto.whatsappNumber.replace(/\D/g, '');
      if (phone.length < 8) throw new BadRequestException('Invalid WhatsApp number');
      data.whatsappNumber = phone;
    }
    if (dto.redirectMessage !== undefined) {
      data.redirectMessage = dto.redirectMessage.trim() || DEFAULT_REDIRECT_MESSAGE;
    }
    if (dto.defaultOptimizationEvent !== undefined) {
      if (dto.defaultOptimizationEvent === 'Custom' && !dto.customEventName?.trim()) {
        throw new BadRequestException('Custom event name is required when selecting Custom Event');
      }
      data.defaultOptimizationEvent = dto.defaultOptimizationEvent;
      data.customEventName =
        dto.defaultOptimizationEvent === 'Custom' ? dto.customEventName?.trim() || null : null;
    }

    if (dto.enabledEvents !== undefined || dto.defaultOptimizationEvent !== undefined) {
      const defaultEvent = dto.defaultOptimizationEvent ?? integration.defaultOptimizationEvent;
      const enabledList = dto.enabledEvents?.length ? dto.enabledEvents : [defaultEvent];
      const enabled = new Set(enabledList);
      enabled.add(defaultEvent);

      await this.prisma.$transaction(
        TIKTOK_OPTIMIZATION_EVENTS.map((eventName) =>
          this.prisma.tikTokEventConfiguration.upsert({
            where: {
              integrationId_eventName: { integrationId: integration.id, eventName },
            },
            update: { enabled: enabled.has(eventName) },
            create: { integrationId: integration.id, eventName, enabled: enabled.has(eventName) },
          }),
        ),
      );
    }

    const updated = await this.prisma.tikTokIntegration.update({
      where: { id: integration.id },
      data,
      include: { eventConfigurations: true },
    });

    if (dto.enabledEvents !== undefined || dto.defaultOptimizationEvent !== undefined) {
      await this.activation.activateIntegration(updated.id, userId);
    }

    return this.toView(updated, this.webUrl());
  }

  async deleteIntegration(userId: string, teamId: string, integrationId: string) {
    const integration = await this.resolveIntegration(userId, teamId, integrationId);
    await this.prisma.tikTokIntegration.delete({ where: { id: integration.id } });
    this.logger.log(`[Delete] integration=${integrationId} pixel=${integration.pixelId ?? 'none'}`);
    return { deleted: true, id: integrationId };
  }

  async getDashboard(userId: string, teamId: string, days = 30, integrationId?: string) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const webUrl = this.webUrl();

    if (integrationId) {
      const integration = await this.prisma.tikTokIntegration.findFirst({
        where: { id: integrationId, userId, teamId },
        include: { eventConfigurations: true },
      });
      if (!integration) {
        return { configured: false, integration: null, stats: null, disclaimer: this.disclaimer() };
      }
      const stats = await this.statsForIntegration(integration.id, since, days);
      return {
        configured: integration.wizardCompleted,
        integration: await this.toViewWithConnection(integration, webUrl),
        stats,
        disclaimer: this.disclaimer(),
      };
    }

    const integrations = await this.prisma.tikTokIntegration.findMany({
      where: { userId, teamId },
      include: { eventConfigurations: true },
      orderBy: { updatedAt: 'desc' },
    });

    const items = await Promise.all(
      integrations.map(async (integration) => ({
        integration: await this.toViewWithConnection(integration, webUrl),
        stats: await this.statsForIntegration(integration.id, since, days),
      })),
    );

    return {
      configured: integrations.some((i) => i.wizardCompleted),
      integrations: items,
      disclaimer: this.disclaimer(),
    };
  }

  private async statsForIntegration(integrationId: string, since: Date, days: number) {
    const [clicks, contactEvents, leadEvents, purchaseEvents, registrationEvents, lastSent] =
      await Promise.all([
        this.prisma.tikTokIntegrationClick.count({
          where: { integrationId, createdAt: { gte: since } },
        }),
        this.prisma.tikTokIntegrationConversion.count({
          where: {
            integrationId,
            eventName: 'Contact',
            contactSent: true,
            sentAt: { gte: since },
          },
        }),
        this.prisma.tikTokIntegrationConversion.count({
          where: {
            integrationId,
            eventName: 'Lead',
            contactSent: true,
            sentAt: { gte: since },
          },
        }),
        this.prisma.tikTokIntegrationConversion.count({
          where: {
            integrationId,
            eventName: { in: ['Purchase', 'CompletePayment'] },
            contactSent: true,
            sentAt: { gte: since },
          },
        }),
        this.prisma.tikTokIntegrationConversion.count({
          where: {
            integrationId,
            eventName: 'CompleteRegistration',
            contactSent: true,
            sentAt: { gte: since },
          },
        }),
        this.prisma.tikTokIntegrationConversion.findFirst({
          where: { integrationId, contactSent: true },
          orderBy: { sentAt: 'desc' },
          select: {
            eventName: true,
            sentAt: true,
            tiktokResponse: true,
            tiktokError: true,
          },
        }),
      ]);
    return {
      since: since.toISOString(),
      days,
      clicks,
      leads: contactEvents,
      conversions: contactEvents,
      contactEvents,
      leadEvents,
      purchaseEvents,
      registrationEvents,
      conversionRate: clicks > 0 ? Number(((contactEvents / clicks) * 100).toFixed(2)) : 0,
      lastEventSent: lastSent?.sentAt?.toISOString() ?? null,
      lastEventName: lastSent?.eventName ?? null,
      lastApiResponse: lastSent?.tiktokResponse ?? null,
      lastError: lastSent?.tiktokError ?? null,
    };
  }

  async getContactDebug(userId: string, teamId: string, options?: { integrationId?: string; limit?: number }) {
    const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
    const integrations = await this.prisma.tikTokIntegration.findMany({
      where: {
        userId,
        teamId,
        ...(options?.integrationId ? { id: options.integrationId } : {}),
      },
      select: { id: true, name: true, pixelName: true },
    });
    const integrationIds = integrations.map((row) => row.id);
    if (integrationIds.length === 0) {
      return { rows: [] };
    }

    const rows = await this.prisma.tikTokIntegrationConversion.findMany({
      where: { integrationId: { in: integrationIds } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        integrationId: true,
        whatsappPhone: true,
        ttclid: true,
        eventId: true,
        eventName: true,
        firstMessageAt: true,
        contactSent: true,
        tiktokStatus: true,
        tiktokResponse: true,
        tiktokError: true,
        retryCount: true,
        nextRetryAt: true,
        sentAt: true,
        createdAt: true,
        pageUrl: true,
        conversationId: true,
      },
    });

    const byId = new Map(integrations.map((row) => [row.id, row]));
    return {
      rows: rows.map((row) => {
        const integration = byId.get(row.integrationId);
        return {
          ...row,
          firstMessageAt: row.firstMessageAt?.toISOString() ?? null,
          sentAt: row.sentAt?.toISOString() ?? null,
          nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
          integrationName: integration?.name ?? integration?.pixelName ?? row.integrationId,
        };
      }),
    };
  }

  async findBySlug(slug: string) {
    const integration = await this.prisma.tikTokIntegration.findUnique({
      where: { redirectSlug: slug },
      include: { eventConfigurations: true },
    });
    if (!integration || !integration.wizardCompleted) return null;
    return integration;
  }

  private disclaimer() {
    return {
      en: 'Contact is sent via Events API only after the first real WhatsApp message — never on link clicks. Lead fires when a conversation is marked qualified. CompleteRegistration / Purchase use the platform pixel when configured.',
      ar: 'يُرسل Contact عبر Events API فقط بعد أول رسالة واتساب فعلية — وليس عند الضغط على الرابط. Lead عند تأهيل المحادثة. CompleteRegistration / Purchase عبر بكسل المنصة عند ضبطه.',
    };
  }

  private async toViewWithConnection(
    integration: Parameters<TikTokIntegrationService['toView']>[0],
    webUrl: string,
  ) {
    return {
      ...this.toView(integration, webUrl),
      whatsappConnected: await this.trackingPhones.isPixelPhoneConnected(
        integration.teamId,
        integration.whatsappNumber,
      ),
    };
  }

  private async seedEventConfigurations(integrationId: string) {
    await this.prisma.tikTokEventConfiguration.createMany({
      data: TIKTOK_OPTIMIZATION_EVENTS.map((eventName) => ({
        integrationId,
        eventName,
        enabled: eventName === 'Contact',
      })),
      skipDuplicates: true,
    });
  }

  private webUrl() {
    return this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '');
  }

  private toView(
    integration: {
      id: string;
      userId: string;
      teamId: string;
      name: string | null;
      advertiserId: string | null;
      advertiserName: string | null;
      pixelId: string | null;
      pixelCode: string | null;
      pixelName: string | null;
      pixelStatus?: string;
      pixelStatusMessage?: string | null;
      encryptedEventsApiAccessToken?: string | null;
      eventsApiTokenHint?: string | null;
      eventsApiConnected?: boolean;
      eventsApiStatus?: string;
      eventsApiStatusMessage?: string | null;
      lastEventsApiVerificationAt?: Date | null;
      lastEventSentAt?: Date | null;
      lastEventName?: string | null;
      lastApiHttpStatus?: number | null;
      lastApiError?: string | null;
      whatsappNumber: string | null;
      redirectSlug: string;
      defaultOptimizationEvent: TikTokOptimizationEvent;
      customEventName: string | null;
      redirectMessage: string | null;
      wizardStep: number;
      wizardCompleted: boolean;
      createdAt?: Date;
      updatedAt: Date;
      eventConfigurations?: Array<{ eventName: TikTokOptimizationEvent; enabled: boolean }>;
    },
    webUrl: string,
  ) {
    return {
      id: integration.id,
      name: integration.name ?? integration.pixelName,
      advertiserId: integration.advertiserId,
      advertiserName: integration.advertiserName,
      pixelId: integration.pixelId,
      pixelName: integration.pixelName,
      pixelStatus: integration.pixelStatus ?? 'pending',
      pixelStatusMessage: integration.pixelStatusMessage ?? null,
      manualSetupRequired: integration.pixelStatus === 'manual_setup_required',
      whatsappNumber: integration.whatsappNumber,
      redirectSlug: integration.redirectSlug,
      trackingUrl: buildConversionTrackingUrl(
        webUrl,
        integration.redirectSlug,
        conversionEventName({
          defaultOptimizationEvent: integration.defaultOptimizationEvent,
          customEventName: integration.customEventName,
        }),
      ),
      eventBuilderUrl: buildConversionEventBuilderUrl(
        webUrl,
        integration.redirectSlug,
        conversionEventName({
          defaultOptimizationEvent: integration.defaultOptimizationEvent,
          customEventName: integration.customEventName,
        }),
      ),
      setupPageUrl: integration.pixelCode
        ? `${webUrl}/tiktok/activate/${encodeURIComponent(integration.pixelCode)}`
        : null,
      tiktokEventsManagerUrl: integration.pixelCode
        ? `https://ads.tiktok.com/i18n/events_manager/datasource/pixel/detail/${encodeURIComponent(integration.pixelCode)}`
        : integration.pixelId
          ? `https://ads.tiktok.com/i18n/events_manager/datasource/pixel/detail/${encodeURIComponent(integration.pixelId)}`
          : null,
      pixelCode: integration.pixelCode,
      eventsApiConnected: Boolean(
        integration.eventsApiConnected ?? integration.encryptedEventsApiAccessToken,
      ),
      eventsApiStatus: integration.eventsApiStatus ?? 'disconnected',
      eventsApiStatusMessage: integration.eventsApiStatusMessage ?? null,
      eventsApiTokenHint: integration.eventsApiTokenHint ?? null,
      hasEventsApiToken: Boolean(integration.encryptedEventsApiAccessToken),
      lastEventsApiVerificationAt: integration.lastEventsApiVerificationAt?.toISOString() ?? null,
      lastEventSentAt: integration.lastEventSentAt?.toISOString() ?? null,
      lastEventName: integration.lastEventName ?? null,
      lastApiHttpStatus: integration.lastApiHttpStatus ?? null,
      lastApiError: integration.lastApiError ?? null,
      createdAt: integration.createdAt?.toISOString() ?? null,
      defaultOptimizationEvent: integration.defaultOptimizationEvent,
      customEventName: integration.customEventName,
      redirectMessage: integration.redirectMessage,
      wizardStep: integration.wizardStep,
      wizardCompleted: integration.wizardCompleted,
      updatedAt: integration.updatedAt.toISOString(),
      eventConfigurations: (integration.eventConfigurations ?? []).map((c) => ({
        eventName: c.eventName,
        enabled: c.enabled,
      })),
    };
  }
}
