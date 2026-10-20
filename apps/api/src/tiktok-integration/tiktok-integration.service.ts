import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InstantFormStatus, TikTokOptimizationEvent } from '@watsapp/database';
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
import { TikTokEventsApiCredentialsService } from './tiktok-events-api-credentials.service';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { InstantFormsService } from '../instant-forms/instant-forms.service';

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
    private readonly eventsApiCredentials: TikTokEventsApiCredentialsService,
    private readonly entitlements: PlanEntitlementsService,
    private readonly instantForms: InstantFormsService,
  ) {}

  async listIntegrations(userId: string, teamId: string) {
    const found = await this.prisma.tikTokIntegration.findMany({
      where: { teamId },
      include: { eventConfigurations: true },
      // Newest created pixels first; avoid updatedAt so edits don't reshuffle the list.
      orderBy: { createdAt: 'desc' },
    });
    const rows = [];
    for (const row of found) {
      const checkedAt = row.lastEventsApiVerificationAt?.getTime() ?? 0;
      const coolingDown =
        row.eventsApiStatus === 'events_api_unavailable' && Date.now() - checkedAt < 10 * 60 * 1000;
      if (row.pixelCode && row.advertiserId && !row.eventsApiConnected && !coolingDown) {
        const linked = await this.eventsApiCredentials.ensureAdvertiserToken(userId, row).catch(() => row);
        rows.push({ ...row, ...linked, eventConfigurations: row.eventConfigurations });
      } else {
        rows.push(row);
      }
    }
    const webUrl = this.webUrl();
    return {
      integrations: rows.map((row) => this.toView(row, webUrl)),
    };
  }

  async createIntegration(userId: string, teamId: string) {
    await this.entitlements.assertTiktokPixel(teamId);
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
        defaultOptimizationEvent: 'Lead',
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
        where: { id: integrationId, teamId },
        include: { eventConfigurations: true },
      });
      if (!row) throw new NotFoundException('Integration not found');
      return row;
    }

    const existing = await this.prisma.tikTokIntegration.findFirst({
      where: { teamId },
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
        defaultOptimizationEvent: 'Lead',
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
      integration: await this.toViewWithConnection(integration, webUrl),
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

  async startOAuth(
    userId: string,
    teamId: string,
    integrationId?: string,
    returnOrigin?: string,
  ) {
    const integration = await this.resolveIntegration(userId, teamId, integrationId);
    const returnTo = `/tiktok/integration/wizard?id=${integration.id}`;
    return this.marketingOAuth.startLogin(userId, teamId, { returnTo, returnOrigin });
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
    const destinationType = dto.destinationType ?? 'WHATSAPP_NUMBER';

    if (destinationType === 'INSTANT_FORM') {
      const form = await this.instantForms.ensureLeadFormForPixel({
        teamId,
        userId,
        pixelIntegrationId: integration.id,
        pixelName: integration.pixelName || integration.name || 'Lead Form',
        instantFormId: dto.instantFormId,
      });
      const updated = await this.prisma.tikTokIntegration.update({
        where: { id: integration.id },
        data: {
          whatsappNumber: null,
          redirectDestinationType: 'INSTANT_FORM',
          externalRedirectUrl: form.publicUrl,
          defaultOptimizationEvent: integration.defaultOptimizationEvent === 'Contact'
            ? 'CompletePayment'
            : integration.defaultOptimizationEvent,
          wizardStep: Math.max(integration.wizardStep, 4),
        },
        include: { eventConfigurations: true },
      });
      await this.ensureEventDefaults(updated.id, 'INSTANT_FORM', updated.defaultOptimizationEvent);
      return {
        ...this.toView(updated, this.webUrl()),
        linkedFormId: form.id,
        linkedFormUrl: form.publicUrl,
        linkedFormName: form.name,
        destinationKind: 'INSTANT_FORM' as const,
      };
    }

    if (destinationType === 'STORE') {
      const settings = await this.prisma.storeSettings.findUnique({ where: { teamId } });
      if (!settings?.slug) {
        throw new BadRequestException('أنشئ المتجر أولاً من قسم المتجر ثم اربط البكسل');
      }
      const storeUrl = `${this.webUrl()}/s/${encodeURIComponent(settings.slug)}`;
      await this.prisma.storeSettings.update({
        where: { teamId },
        data: { pixelIntegrationId: integration.id },
      });
      const updated = await this.prisma.tikTokIntegration.update({
        where: { id: integration.id },
        data: {
          whatsappNumber: null,
          redirectDestinationType: 'STORE',
          externalRedirectUrl: storeUrl,
          defaultOptimizationEvent: integration.defaultOptimizationEvent === 'Contact'
            ? 'CompletePayment'
            : integration.defaultOptimizationEvent,
          wizardStep: Math.max(integration.wizardStep, 4),
        },
        include: { eventConfigurations: true },
      });
      await this.ensureEventDefaults(updated.id, 'STORE', updated.defaultOptimizationEvent);
      return {
        ...this.toView(updated, this.webUrl()),
        linkedStoreUrl: storeUrl,
        destinationKind: 'STORE' as const,
      };
    }

    const useExternalUrl = destinationType === 'EXTERNAL_URL';
    const phone = useExternalUrl ? null : (dto.whatsappNumber ?? '').replace(/\D/g, '');
    if (!useExternalUrl && (!phone || phone.length < 8)) {
      throw new BadRequestException('Invalid WhatsApp number');
    }
    const externalRedirectUrl = useExternalUrl
      ? this.validateExternalRedirectUrl(dto.externalRedirectUrl)
      : null;

    await this.prisma.storeSettings.updateMany({
      where: { teamId, pixelIntegrationId: integration.id },
      data: { pixelIntegrationId: null },
    });

    const updated = await this.prisma.tikTokIntegration.update({
      where: { id: integration.id },
      data: {
        whatsappNumber: phone,
        redirectDestinationType: destinationType,
        externalRedirectUrl,
        defaultOptimizationEvent: !useExternalUrl ? 'Contact' : integration.defaultOptimizationEvent,
        wizardStep: Math.max(integration.wizardStep, 4),
      },
      include: { eventConfigurations: true },
    });
    if (!useExternalUrl) {
      await this.ensureEventDefaults(updated.id, 'WHATSAPP_NUMBER', 'Contact');
    }
    return this.toView(updated, this.webUrl());
  }

  async createPixel(userId: string, teamId: string, dto: CreatePixelDto) {
    await this.entitlements.assertTiktokPixel(teamId);
    const integration = await this.resolveIntegration(userId, teamId, dto.integrationId);
    if (!integration.advertiserId) {
      throw new BadRequestException('Select an advertiser first (wizard step 2)');
    }
    if (integration.pixelId) {
      throw new BadRequestException('This integration already has a pixel. Create a new pixel setup instead.');
    }
    try {
      const updated = await this.provisionPixel(userId, integration, dto.pixelName);
      let form: { id: string; publicUrl: string } | null = null;
      if (updated.redirectDestinationType === 'INSTANT_FORM') {
        form = await this.instantForms.ensureLeadFormForPixel({
          teamId,
          userId,
          pixelIntegrationId: updated.id,
          pixelName: updated.pixelName || updated.name,
        }).catch((err) => {
          this.logger.warn(`Auto lead form for pixel failed: ${err instanceof Error ? err.message : String(err)}`);
          return null;
        });
        if (form?.publicUrl) {
          await this.prisma.tikTokIntegration.update({
            where: { id: updated.id },
            data: {
              redirectDestinationType: 'INSTANT_FORM',
              externalRedirectUrl: form.publicUrl,
            },
          });
        }
      }
      if (updated.redirectDestinationType === 'STORE') {
        await this.prisma.storeSettings.updateMany({
          where: { teamId },
          data: { pixelIntegrationId: updated.id },
        });
      }
      const refreshed = await this.prisma.tikTokIntegration.findUnique({
        where: { id: updated.id },
        include: { eventConfigurations: true },
      });
      const dest = (refreshed ?? updated).redirectDestinationType;
      return {
        ...this.toView(refreshed ?? updated, this.webUrl()),
        linkedFormId: form?.id ?? null,
        linkedFormUrl: form?.publicUrl ?? null,
        destinationKind:
          dest === 'INSTANT_FORM' ? 'INSTANT_FORM' as const
            : dest === 'STORE' ? 'STORE' as const
              : dest === 'WHATSAPP_NUMBER' ? 'WHATSAPP' as const
                : undefined,
      };
    } catch (err) {
      this.throwTikTokApiError(err);
    }
  }

  private async ensureEventDefaults(
    integrationId: string,
    kind: 'WHATSAPP_NUMBER' | 'STORE' | 'INSTANT_FORM',
    defaultEvent: TikTokOptimizationEvent,
  ) {
    const enabled = new Set<TikTokOptimizationEvent>([defaultEvent]);
    if (kind === 'WHATSAPP_NUMBER') {
      enabled.add('Contact');
      enabled.add('Lead');
      enabled.add('Purchase');
      enabled.add('CompletePayment');
    } else if (kind === 'STORE') {
      enabled.add('CompletePayment');
      enabled.add('Purchase');
      enabled.add('InitiateCheckout');
    } else {
      enabled.add('CompletePayment');
      enabled.add('Lead');
      enabled.add('SubmitForm');
    }
    await this.prisma.$transaction(
      TIKTOK_OPTIMIZATION_EVENTS.map((eventName) =>
        this.prisma.tikTokEventConfiguration.upsert({
          where: {
            integrationId_eventName: { integrationId, eventName },
          },
          update: { enabled: enabled.has(eventName) },
          create: { integrationId, eventName, enabled: enabled.has(eventName) },
        }),
      ),
    );
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

    // للمتجر/الاستمارة: سجّل CompletePayment/Lead وأعد إرسال أحداث لتفعيل هدف التحسين في تيك توك
    const dest = updated.redirectDestinationType;
    if (
      dest === 'STORE'
      || dest === 'INSTANT_FORM'
      || updated.externalRedirectUrl?.includes('/s/')
      || updated.externalRedirectUrl?.includes('/f/')
    ) {
      await this.tracking.resyncEcommercePixel(updated.id, userId).catch((err) => {
        this.logger.warn(`wizard resyncEcommercePixel: ${err instanceof Error ? err.message : String(err)}`);
      });
    }

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
    const dest = integration.redirectDestinationType;
    const isEcommerce =
      dest === 'STORE'
      || dest === 'INSTANT_FORM'
      || Boolean(integration.externalRedirectUrl?.includes('/s/'))
      || Boolean(integration.externalRedirectUrl?.includes('/f/'));
    if (isEcommerce) {
      await this.tracking.resyncEcommercePixel(integration.id, userId).catch((err) => {
        this.logger.warn(`resyncEcommercePixel failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
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

  async resyncEcommercePixel(userId: string, teamId: string, integrationId: string) {
    const integration = await this.resolveIntegration(userId, teamId, integrationId);
    try {
      const result = await this.tracking.resyncEcommercePixel(integration.id, userId);
      await this.pixelStatus
        .refreshIntegrationStatus(
          integration.id,
          userId,
          integration.pixelId!,
          integration.advertiserId!,
        )
        .catch(() => undefined);
      const fresh = await this.prisma.tikTokIntegration.findUniqueOrThrow({
        where: { id: integration.id },
        include: { eventConfigurations: true },
      });
      return {
        ...this.toView(fresh, this.webUrl()),
        resync: result,
        ok: Boolean(result.ok),
        message: result.ok
          ? `تمت مزامنة ${result.resent ?? 0} حدث مع تيك توك`
          : `تعذرت المزامنة: ${result.reason || 'unknown'}`,
      };
    } catch (err) {
      this.logger.warn(`resyncEcommercePixel error: ${err instanceof Error ? err.message : String(err)}`);
      const fresh = await this.prisma.tikTokIntegration.findUnique({
        where: { id: integration.id },
        include: { eventConfigurations: true },
      });
      return {
        ...(fresh ? this.toView(fresh, this.webUrl()) : { id: integrationId }),
        ok: false,
        message: err instanceof Error ? err.message : 'فشل مزامنة أحداث تيك توك',
        resync: { ok: false, reason: err instanceof Error ? err.message : 'error' },
      };
    }
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
      whatsappNumber?: string | null;
      redirectDestinationType?: string;
      externalRedirectUrl?: string | null;
      defaultOptimizationEvent?: TikTokOptimizationEvent;
      customEventName?: string | null;
      redirectMessage?: string;
    } = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim() || null;
    }
    if (dto.destinationType === 'INSTANT_FORM') {
      const form = await this.instantForms.ensureLeadFormForPixel({
        teamId,
        userId,
        pixelIntegrationId: integration.id,
        pixelName: dto.name || integration.pixelName || integration.name || 'Lead Form',
        instantFormId: dto.instantFormId,
      });
      data.redirectDestinationType = 'INSTANT_FORM';
      data.externalRedirectUrl = form.publicUrl;
      data.whatsappNumber = null;
      if (integration.defaultOptimizationEvent === 'Contact') {
        data.defaultOptimizationEvent = 'CompletePayment';
      }
    } else if (dto.destinationType === 'STORE') {
      const settings = await this.prisma.storeSettings.findUnique({ where: { teamId } });
      if (!settings?.slug) {
        throw new BadRequestException('أنشئ المتجر أولاً من قسم المتجر ثم اربط البكسل');
      }
      const storeUrl = `${this.webUrl()}/s/${encodeURIComponent(settings.slug)}`;
      await this.prisma.storeSettings.update({
        where: { teamId },
        data: { pixelIntegrationId: integration.id },
      });
      data.redirectDestinationType = 'STORE';
      data.externalRedirectUrl = storeUrl;
      data.whatsappNumber = null;
    } else if (dto.destinationType === 'EXTERNAL_URL') {
      data.redirectDestinationType = 'EXTERNAL_URL';
      data.externalRedirectUrl = this.validateExternalRedirectUrl(dto.externalRedirectUrl);
      data.whatsappNumber = null;
    } else if (dto.destinationType === 'WHATSAPP_NUMBER') {
      const phone = (dto.whatsappNumber ?? '').replace(/\D/g, '');
      if (phone.length < 8) throw new BadRequestException('Invalid WhatsApp number');
      data.redirectDestinationType = 'WHATSAPP_NUMBER';
      data.whatsappNumber = phone;
      data.externalRedirectUrl = null;
    } else if (dto.instantFormId && (integration.redirectDestinationType === 'INSTANT_FORM' || integration.externalRedirectUrl?.includes('/f/'))) {
      const form = await this.instantForms.attachFormToPixel({
        teamId,
        userId,
        pixelIntegrationId: integration.id,
        formId: dto.instantFormId,
      });
      data.redirectDestinationType = 'INSTANT_FORM';
      data.externalRedirectUrl = form.publicUrl;
      data.whatsappNumber = null;
    } else if (dto.whatsappNumber !== undefined) {
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

    if (dto.destinationType === 'INSTANT_FORM' || dto.instantFormId) {
      await this.ensureEventDefaults(
        updated.id,
        'INSTANT_FORM',
        updated.defaultOptimizationEvent,
      );
    } else if (dto.destinationType === 'STORE') {
      await this.ensureEventDefaults(updated.id, 'STORE', updated.defaultOptimizationEvent);
    }

    if (dto.enabledEvents !== undefined || dto.defaultOptimizationEvent !== undefined) {
      await this.activation.activateIntegration(updated.id, userId);
    }

    return this.toViewWithConnection(updated, this.webUrl());
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
        where: { id: integrationId, teamId },
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
      where: { teamId },
      include: { eventConfigurations: true },
      // Stable list: newest first by creation date (not last edit).
      orderBy: { createdAt: 'desc' },
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
    const integration = await this.prisma.tikTokIntegration.findUnique({
      where: { id: integrationId },
      select: {
        teamId: true,
        redirectDestinationType: true,
        externalRedirectUrl: true,
      },
    });
    const isEcommerce =
      integration?.redirectDestinationType === 'STORE'
      || integration?.redirectDestinationType === 'INSTANT_FORM'
      || Boolean(integration?.externalRedirectUrl?.includes('/s/'))
      || Boolean(integration?.externalRedirectUrl?.includes('/f/'));

    const [clicks, contactEvents, leadEvents, purchaseEvents, registrationEvents, orderEvents, formOrders, lastSent] =
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
        this.prisma.tikTokIntegrationConversion.count({
          where: {
            integrationId,
            contactSent: true,
            orderId: { not: null },
            sentAt: { gte: since },
          },
        }),
        this.prisma.instantFormOrder.count({
          where: {
            submittedAt: { gte: since },
            form: { pixelIntegrationId: integrationId },
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

    const ecommerceConversions = Math.max(purchaseEvents, leadEvents, orderEvents, formOrders);
    const primaryLeads = isEcommerce ? ecommerceConversions : contactEvents;

    return {
      since: since.toISOString(),
      days,
      clicks,
      leads: primaryLeads,
      conversions: primaryLeads,
      contactEvents,
      leadEvents,
      purchaseEvents,
      registrationEvents,
      formOrders,
      orderEvents,
      conversionRate: clicks > 0 ? Number(((primaryLeads / clicks) * 100).toFixed(2)) : 0,
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
        teamId,
        ...(options?.integrationId ? { id: options.integrationId } : {}),
      },
      select: { id: true, name: true, pixelName: true, pixelCode: true, pixelId: true },
    });
    const integrationIds = integrations.map((row) => row.id);
    const byId = new Map(integrations.map((row) => [row.id, row]));

    const [conversions, diags] = await Promise.all([
      integrationIds.length
        ? this.prisma.tikTokIntegrationConversion.findMany({
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
              messageId: true,
            },
          })
        : Promise.resolve([]),
      this.prisma.tikTokIntegrationInboundDiag.findMany({
        where: {
          teamId,
          ...(options?.integrationId ? { integrationId: options.integrationId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    return {
      rows: conversions.map((row) => {
        const integration = byId.get(row.integrationId);
        return {
          ...row,
          firstMessageAt: row.firstMessageAt?.toISOString() ?? null,
          sentAt: row.sentAt?.toISOString() ?? null,
          nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
          integrationName: integration?.name ?? integration?.pixelName ?? row.integrationId,
          pixelCode: integration?.pixelCode ?? null,
          pixelId: integration?.pixelId ?? null,
          isNewConversation: true,
          outcome: row.contactSent ? 'sent' : row.tiktokStatus,
          reason: row.tiktokError,
        };
      }),
      diagnostics: diags.map((row) => ({
        id: row.id,
        teamId: row.teamId,
        integrationId: row.integrationId,
        integrationName: row.integrationId
          ? (byId.get(row.integrationId)?.name ?? byId.get(row.integrationId)?.pixelName ?? row.integrationId)
          : null,
        channelId: row.channelId,
        conversationId: row.conversationId,
        messageId: row.messageId,
        whatsappPhone: row.whatsappPhone,
        businessPhone: row.businessPhone,
        pixelCode: row.pixelCode,
        ttclid: row.ttclid,
        isNewConversation: row.isNewConversation,
        outcome: row.outcome,
        reason: row.reason,
        tiktokStatus: row.tiktokStatus,
        tiktokResponse: row.tiktokResponse,
        errorMessage: row.errorMessage,
        createdAt: row.createdAt.toISOString(),
        contactSent: row.outcome === 'sent',
      })),
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
      en: 'Contact is sent via Events API once per new WhatsApp conversation on the Business (tracking) WhatsApp — never on link clicks, page views, or inbox/AI WhatsApp.',
      ar: 'يُرسل Contact عبر Events API مرة واحدة لكل محادثة واتساب جديدة على واتساب الأعمال (التتبع) — وليس عند الضغط على الرابط أو زيارة الصفحة أو واتساب صندوق الرسائل/الذكاء.',
    };
  }

  private async toViewWithConnection(
    integration: Parameters<TikTokIntegrationService['toView']>[0],
    webUrl: string,
  ) {
    const linkedForm = await this.resolveLinkedInstantForm(integration);
    return {
      ...this.toView(integration, webUrl),
      whatsappConnected: await this.trackingPhones.isPixelPhoneConnected(
        integration.teamId,
        integration.whatsappNumber,
      ),
      linkedFormId: linkedForm?.id ?? null,
      linkedFormName: linkedForm?.name ?? null,
      linkedFormUrl: linkedForm?.publicUrl ?? null,
      linkedFormStatus: linkedForm?.status ?? null,
    };
  }

  private async resolveLinkedInstantForm(integration: {
    id: string;
    teamId: string;
    redirectDestinationType?: string | null;
    externalRedirectUrl?: string | null;
  }) {
    const isFormDest =
      integration.redirectDestinationType === 'INSTANT_FORM'
      || Boolean(integration.externalRedirectUrl?.includes('/f/'));
    if (!isFormDest) return null;

    const codes = this.extractFormCodes(integration.externalRedirectUrl || '');
    const forms = await this.prisma.instantForm.findMany({
      where: {
        teamId: integration.teamId,
        status: { not: InstantFormStatus.ARCHIVED },
        OR: [
          { pixelIntegrationId: integration.id },
          ...(codes.length
            ? [{ shortCode: { in: codes } }, { slug: { in: codes } }]
            : []),
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    });
    if (!forms.length) return null;

    const url = integration.externalRedirectUrl || '';
    const matched =
      forms.find((f) => url.includes(f.shortCode) || url.includes(`/f/${f.slug}`))
      || forms.find((f) => f.pixelIntegrationId === integration.id)
      || forms[0]!;

    return {
      id: matched.id,
      name: matched.name,
      status: matched.status,
      publicUrl: `${this.webUrl()}/f/s/${matched.shortCode}`,
    };
  }

  private extractFormCodes(url: string): string[] {
    try {
      const path = new URL(url).pathname;
      const parts = path.split('/').filter(Boolean);
      // /f/s/CODE or /f/SLUG
      const last = parts[parts.length - 1];
      return last ? [decodeURIComponent(last)] : [];
    } catch {
      return [];
    }
  }

  private async seedEventConfigurations(integrationId: string) {
    await this.prisma.tikTokEventConfiguration.createMany({
      data: TIKTOK_OPTIMIZATION_EVENTS.map((eventName) => ({
        integrationId,
        eventName,
        enabled:
          eventName === 'Lead'
          || eventName === 'Contact'
          || eventName === 'Purchase'
          || eventName === 'CompletePayment',
      })),
      skipDuplicates: true,
    });
  }

  private webUrl() {
    return this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '');
  }

  private validateExternalRedirectUrl(value?: string | null) {
    const raw = value?.trim();
    if (!raw) throw new BadRequestException('External redirect URL is required');
    try {
      const url = new URL(raw);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('Unsupported URL');
      }
      return url.toString();
    } catch {
      throw new BadRequestException('Enter a valid external URL starting with https://');
    }
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
      redirectDestinationType?: string;
      externalRedirectUrl?: string | null;
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
      destinationType: integration.redirectDestinationType ?? 'WHATSAPP_NUMBER',
      externalRedirectUrl: integration.externalRedirectUrl ?? null,
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
