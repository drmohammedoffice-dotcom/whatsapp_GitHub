import { ForbiddenException, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelProvider, ChannelPurpose, ChannelStatus, WhatsAppSessionStatus } from '@watsapp/database';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { GRACE_PERIOD_MS } from './plan-limits';
import {
  FEATURE_REGISTRY,
  canCreateWithLimit,
  entitlementsFromLimits,
  isOverLimit,
  limitsFromEntitlements,
  seedLimitsForSlug,
  type PlanLimits,
  type StoredEntitlement,
} from './feature-registry';

export type PlanFeature =
  | 'tracking_phone'
  | 'whatsapp'
  | 'whatsapp_api'
  | 'tiktok'
  | 'tiktok_pixel'
  | 'facebook'
  | 'instagram'
  | 'telegram'
  | 'social_integrations'
  | 'ai'
  | 'appointments'
  | 'team_members'
  | 'voice_ai'
  | 'creative_studio'
  | 'instant_forms'
  | 'online_store'
  | 'ai_campaign_review';

export type TeamEntitlements = {
  planId: string | null;
  planSlug: string;
  planName: string | null;
  limits: PlanLimits;
  trackingPhoneCount: number;
  whatsappInboxCount: number;
  tiktokPixelCount: number;
  teamMemberCount: number;
  canAddTrackingPhone: boolean;
  canAddWhatsappNumber: boolean;
  canAddTiktokPixel: boolean;
  canAddTeamMember: boolean;
  overLimit: {
    trackingPhones: boolean;
    whatsappNumbers: boolean;
    tiktokPixels: boolean;
    teamMembers: boolean;
  };
};

const CACHE_TTL_SEC = 45;

@Injectable()
export class PlanEntitlementsService implements OnModuleDestroy {
  private readonly logger = new Logger(PlanEntitlementsService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.redis = new Redis(config.getOrThrow<string>('REDIS_URL'), { maxRetriesPerRequest: 1, lazyConnect: true });
    this.redis.connect().catch(() => undefined);
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  async invalidatePlan(planId: string) {
    try {
      await this.redis.del(this.cacheKey(planId));
    } catch {
      /* ignore */
    }
  }

  async getTeamEntitlements(teamId: string): Promise<TeamEntitlements> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { teamId },
      include: { plan: true },
    });
    const planSlug = subscription?.plan.slug ?? 'basic';
    const limits = subscription?.planId
      ? await this.getPlanLimits(subscription.planId, planSlug)
      : seedLimitsForSlug(planSlug);

    const [trackingPhoneCount, whatsappInboxCount, tiktokPixelCount, teamMemberCount] = await Promise.all([
      this.countTrackingPhones(teamId),
      this.countInboxWhatsapp(teamId),
      this.countTiktokPixels(teamId),
      this.prisma.teamMember.count({ where: { teamId } }),
    ]);

    return {
      planId: subscription?.planId ?? null,
      planSlug,
      planName: subscription?.plan.nameAr ?? subscription?.plan.name ?? null,
      limits,
      trackingPhoneCount,
      whatsappInboxCount,
      tiktokPixelCount,
      teamMemberCount,
      canAddTrackingPhone: Boolean(limits.tiktokEnabled) && canCreateWithLimit(trackingPhoneCount, limits.maxTiktokWhatsappNumbers),
      canAddWhatsappNumber: Boolean(limits.whatsappEnabled) && canCreateWithLimit(whatsappInboxCount, limits.maxWhatsappNumbers),
      canAddTiktokPixel:
        Boolean(limits.tiktokEnabled) &&
        canCreateWithLimit(tiktokPixelCount, limits.maxTiktokPixels) &&
        canCreateWithLimit(tiktokPixelCount, limits.maxPixels),
      canAddTeamMember: canCreateWithLimit(teamMemberCount, limits.maxTeamMembers),
      overLimit: {
        trackingPhones: isOverLimit(trackingPhoneCount, limits.maxTiktokWhatsappNumbers),
        whatsappNumbers: isOverLimit(whatsappInboxCount, limits.maxWhatsappNumbers),
        tiktokPixels: isOverLimit(tiktokPixelCount, Math.min(
          limits.maxTiktokPixels < 0 ? Number.MAX_SAFE_INTEGER : limits.maxTiktokPixels,
          limits.maxPixels < 0 ? Number.MAX_SAFE_INTEGER : limits.maxPixels,
        )),
        teamMembers: isOverLimit(teamMemberCount, limits.maxTeamMembers),
      },
    };
  }

  async getPlanLimits(planId: string, slug?: string): Promise<PlanLimits> {
    const cached = await this.readCache(planId);
    if (cached) return cached;
    const fallback = seedLimitsForSlug(slug);
    const rows = await this.prisma.planEntitlement.findMany({ where: { planId } });
    if (rows.length === 0) {
      await this.ensurePlanEntitlements(planId, slug);
      const seeded = await this.prisma.planEntitlement.findMany({ where: { planId } });
      const limits = limitsFromEntitlements(seeded, fallback);
      await this.writeCache(planId, limits);
      return limits;
    }
    const limits = limitsFromEntitlements(rows, fallback);
    await this.writeCache(planId, limits);
    return limits;
  }

  async ensurePlanEntitlements(planId: string, slug?: string) {
    const existing = await this.prisma.planEntitlement.count({ where: { planId } });
    if (existing > 0) return;
    await this.syncFeatureCatalog();
    const seeds = entitlementsFromLimits(seedLimitsForSlug(slug));
    await this.prisma.planEntitlement.createMany({
      data: seeds.map((row) => ({
        planId,
        featureKey: row.featureKey,
        enabled: row.enabled,
        limitValue: row.limitValue,
      })),
      skipDuplicates: true,
    });
  }

  async syncFeatureCatalog() {
    for (const feature of FEATURE_REGISTRY) {
      await this.prisma.featureDefinition.upsert({
        where: { key: feature.key },
        update: {
          category: feature.category,
          valueType: feature.valueType,
          nameAr: feature.nameAr,
          nameEn: feature.nameEn,
          descriptionAr: feature.descriptionAr,
          descriptionEn: feature.descriptionEn,
          sortOrder: feature.sortOrder,
        },
        create: {
          key: feature.key,
          category: feature.category,
          valueType: feature.valueType,
          nameAr: feature.nameAr,
          nameEn: feature.nameEn,
          descriptionAr: feature.descriptionAr,
          descriptionEn: feature.descriptionEn,
          sortOrder: feature.sortOrder,
        },
      });
    }
  }

  async replacePlanEntitlements(planId: string, rows: StoredEntitlement[]) {
    await this.syncFeatureCatalog();
    const known = new Set(FEATURE_REGISTRY.map((f) => f.key));
    await this.prisma.$transaction(async (tx) => {
      await tx.planEntitlement.deleteMany({ where: { planId } });
      await tx.planEntitlement.createMany({
        data: rows
          .filter((row) => known.has(row.featureKey))
          .map((row) => ({
            planId,
            featureKey: row.featureKey,
            enabled: row.enabled,
            limitValue: row.limitValue,
          })),
      });
    });
    await this.invalidatePlan(planId);
  }

  async countTrackingPhones(teamId: string): Promise<number> {
    // يُحسب فقط الرقم المتصل فعلياً — المنفصل لا يستهلك من حصة الباقة.
    return this.prisma.channel.count({
      where: {
        teamId,
        provider: ChannelProvider.WHATSAPP_BAILEYS,
        purpose: ChannelPurpose.TRACKING,
        whatsAppSessionId: { not: null },
        OR: [
          { status: ChannelStatus.CONNECTED },
          { whatsAppSession: { status: WhatsAppSessionStatus.CONNECTED } },
        ],
      },
    });
  }

  async countInboxWhatsapp(teamId: string): Promise<number> {
    // يُحسب فقط الرقم المتصل بشكل صحيح بالمنصة.
    return this.prisma.channel.count({
      where: {
        teamId,
        provider: ChannelProvider.WHATSAPP_BAILEYS,
        purpose: ChannelPurpose.INBOX,
        OR: [
          { status: ChannelStatus.CONNECTED },
          { whatsAppSession: { status: WhatsAppSessionStatus.CONNECTED } },
        ],
      },
    });
  }

  async countTiktokPixels(teamId: string): Promise<number> {
    return this.prisma.tikTokIntegration.count({
      where: { teamId },
    });
  }

  planUpgradeError(feature: PlanFeature, entitlements: TeamEntitlements) {
    const ar: Record<PlanFeature, string> = {
      tracking_phone: `وصلت للحد الأقصى لأرقام واتساب المرتبطة بـ TikTok في باقتك (${entitlements.limits.maxTiktokWhatsappNumbers}). قم بترقية باقتك لإضافة المزيد.`,
      whatsapp: `وصلت للحد الأقصى لأرقام واتساب في باقتك الحالية (${entitlements.limits.maxWhatsappNumbers}). قم بترقية باقتك لإضافة المزيد.`,
      whatsapp_api: 'ميزة WhatsApp API غير متاحة في باقتك الحالية. قم بترقية باقتك.',
      tiktok: 'تكامل TikTok غير متاح في باقتك الحالية. قم بترقية باقتك.',
      tiktok_pixel: `وصلت للحد الأقصى لعدد البكسلات في باقتك الحالية. قم بترقية باقتك لإضافة المزيد.`,
      facebook: 'ربط فيسبوك غير متاح في باقتك الحالية. قم بترقية باقتك.',
      instagram: 'ربط إنستغرام غير متاح في باقتك الحالية. قم بترقية باقتك.',
      telegram: 'ربط تيليغرام غير متاح في باقتك الحالية. قم بترقية باقتك.',
      social_integrations: 'ربط منصات التواصل غير متاح في باقتك الحالية. قم بترقية باقتك.',
      ai: 'الرد الذكي بالذكاء الاصطناعي غير متاح في باقتك الحالية. قم بترقية باقتك.',
      appointments: 'نظام المواعيد غير متاح في باقتك الحالية. قم بترقية باقتك.',
      team_members: `وصلت للحد الأقصى لأعضاء الفريق في باقتك الحالية (${entitlements.limits.maxTeamMembers}). قم بترقية باقتك.`,
      voice_ai: 'المساعد الصوتي غير متاح في باقتك الحالية. قم بترقية باقتك.',
      creative_studio: 'الاستوديو الإبداعي غير متاح في باقتك الحالية. قم بترقية باقتك.',
      instant_forms: 'الاستمارات الفورية متاحة من الباقة الثانية. قم بترقية باقتك.',
      online_store: 'المتجر الإلكتروني متاح في الباقة المفضلة. قم بترقية باقتك.',
      ai_campaign_review: 'تحليل الحملات بالذكاء الاصطناعي متاح في الباقة المفضلة. قم بترقية باقتك.',
    };
    const en: Record<PlanFeature, string> = {
      tracking_phone: `You have reached the maximum number of TikTok WhatsApp numbers on your current plan (${entitlements.limits.maxTiktokWhatsappNumbers}). Upgrade your plan to add more.`,
      whatsapp: `You have reached the maximum number of WhatsApp numbers allowed on your current plan (${entitlements.limits.maxWhatsappNumbers}). Upgrade your plan to add more.`,
      whatsapp_api: 'WhatsApp API is not available on your current plan. Upgrade your plan.',
      tiktok: 'TikTok integration is not available on your current plan. Upgrade your plan.',
      tiktok_pixel: 'You have reached the maximum number of pixels on your current plan. Upgrade your plan to add more.',
      facebook: 'Facebook integration is not available on your current plan. Upgrade your plan.',
      instagram: 'Instagram integration is not available on your current plan. Upgrade your plan.',
      telegram: 'Telegram integration is not available on your current plan. Upgrade your plan.',
      social_integrations: 'Social integrations are not available on your current plan. Upgrade your plan.',
      ai: 'AI auto reply is not available on your current plan. Upgrade your plan.',
      appointments: 'Appointments are not available on your current plan. Upgrade your plan.',
      team_members: `You have reached the maximum number of team members on your current plan (${entitlements.limits.maxTeamMembers}). Upgrade your plan.`,
      voice_ai: 'Voice AI is not available on your current plan. Upgrade your plan.',
      creative_studio: 'Creative Studio is not available on your current plan. Upgrade your plan.',
      instant_forms: 'Instant forms are available from the Professional plan. Upgrade your plan.',
      online_store: 'The online store is available on the Business plan. Upgrade your plan.',
      ai_campaign_review: 'AI campaign analytics are available on the Business plan. Upgrade your plan.',
    };

    return new ForbiddenException({
      message: ar[feature],
      messageEn: en[feature],
      code: 'PLAN_UPGRADE_REQUIRED',
      feature,
      planSlug: entitlements.planSlug,
      limits: entitlements.limits,
      upgradePath: '/plans',
    });
  }

  async assertTrackingPhoneConnect(teamId: string) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.canAddTrackingPhone) throw this.planUpgradeError('tracking_phone', entitlements);
    return entitlements;
  }

  async assertWhatsappInboxConnect(teamId: string) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.canAddWhatsappNumber) throw this.planUpgradeError('whatsapp', entitlements);
    return entitlements;
  }

  async assertWhatsappApi(teamId: string) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.limits.whatsappApiEnabled) throw this.planUpgradeError('whatsapp_api', entitlements);
    return entitlements;
  }

  async assertWhatsappCloudConnect(teamId: string) {
    const entitlements = await this.assertWhatsappApi(teamId);
    const count = await this.prisma.whatsAppCloudAccount.count({
      where: { teamId, status: 'CONNECTED' },
    });
    if (!canCreateWithLimit(count, entitlements.limits.maxWhatsappNumbers)) {
      throw this.planUpgradeError('whatsapp', entitlements);
    }
    return entitlements;
  }

  async assertTiktokEnabled(teamId: string) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.limits.tiktokEnabled) throw this.planUpgradeError('tiktok', entitlements);
    return entitlements;
  }

  async assertTiktokPixel(teamId: string) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.canAddTiktokPixel) throw this.planUpgradeError('tiktok_pixel', entitlements);
    return entitlements;
  }

  async assertFacebook(teamId: string) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.limits.facebookEnabled) throw this.planUpgradeError('facebook', entitlements);
    return entitlements;
  }

  async assertInstagram(teamId: string) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.limits.instagramEnabled) throw this.planUpgradeError('instagram', entitlements);
    return entitlements;
  }

  async assertTelegram(teamId: string) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.limits.telegramEnabled) throw this.planUpgradeError('telegram', entitlements);
    return entitlements;
  }

  async assertSocialIntegrations(teamId: string) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.limits.socialIntegrations && !entitlements.limits.whatsappEnabled) {
      throw this.planUpgradeError('social_integrations', entitlements);
    }
    return entitlements;
  }

  async assertAiEnabled(teamId: string) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.limits.aiEnabled) throw this.planUpgradeError('ai', entitlements);
    return entitlements;
  }

  async assertAppointmentsEnabled(teamId: string) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.limits.appointmentsEnabled) throw this.planUpgradeError('appointments', entitlements);
    return entitlements;
  }

  async assertVoiceAiEnabled(teamId: string) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.limits.voiceAiEnabled) throw this.planUpgradeError('voice_ai', entitlements);
    return entitlements;
  }

  async assertCreativeStudioEnabled(teamId: string) {
    await this.assertAiEnabled(teamId);
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.limits.creativeStudioEnabled) throw this.planUpgradeError('creative_studio', entitlements);
    return entitlements;
  }

  async assertInstantFormsEnabled(teamId: string) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.limits.instantFormsEnabled) throw this.planUpgradeError('instant_forms', entitlements);
    return entitlements;
  }

  async assertOnlineStoreEnabled(teamId: string) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.limits.onlineStoreEnabled) throw this.planUpgradeError('online_store', entitlements);
    return entitlements;
  }

  async assertAiCampaignReviewEnabled(teamId: string) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.limits.aiCampaignReviewEnabled) throw this.planUpgradeError('ai_campaign_review', entitlements);
    return entitlements;
  }

  async assertTeamMember(teamId: string) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.canAddTeamMember) throw this.planUpgradeError('team_members', entitlements);
    return entitlements;
  }

  async canUseFeature(teamId: string, feature: PlanFeature) {
    const entitlements = await this.getTeamEntitlements(teamId);
    return this.hasFeature(entitlements.limits, feature);
  }

  async canCreateResource(teamId: string, feature: PlanFeature) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (feature === 'whatsapp') return entitlements.canAddWhatsappNumber;
    if (feature === 'tracking_phone') return entitlements.canAddTrackingPhone;
    if (feature === 'tiktok_pixel') return entitlements.canAddTiktokPixel;
    if (feature === 'team_members') return entitlements.canAddTeamMember;
    return this.hasFeature(entitlements.limits, feature);
  }

  async getFeatureLimit(teamId: string, feature: PlanFeature) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (feature === 'whatsapp') return entitlements.limits.maxWhatsappNumbers;
    if (feature === 'tracking_phone') return entitlements.limits.maxTiktokWhatsappNumbers;
    if (feature === 'tiktok_pixel') return Math.min(
      entitlements.limits.maxTiktokPixels < 0 ? Number.MAX_SAFE_INTEGER : entitlements.limits.maxTiktokPixels,
      entitlements.limits.maxPixels < 0 ? Number.MAX_SAFE_INTEGER : entitlements.limits.maxPixels,
    );
    if (feature === 'team_members') return entitlements.limits.maxTeamMembers;
    return this.hasFeature(entitlements.limits, feature) ? -1 : 0;
  }

  listFeatureDefinitions() {
    return FEATURE_REGISTRY;
  }

  hasFeature(limits: PlanLimits, feature: PlanFeature) {
    if (feature === 'tracking_phone') return limits.tiktokEnabled && limits.maxTiktokWhatsappNumbers !== 0;
    if (feature === 'whatsapp') return limits.whatsappEnabled && limits.maxWhatsappNumbers !== 0;
    if (feature === 'whatsapp_api') return limits.whatsappApiEnabled;
    if (feature === 'tiktok' || feature === 'tiktok_pixel') return limits.tiktokEnabled;
    if (feature === 'facebook') return limits.facebookEnabled;
    if (feature === 'instagram') return limits.instagramEnabled;
    if (feature === 'telegram') return limits.telegramEnabled;
    if (feature === 'social_integrations') return limits.socialIntegrations;
    if (feature === 'appointments') return limits.appointmentsEnabled;
    if (feature === 'team_members') return limits.maxTeamMembers !== 0;
    if (feature === 'voice_ai') return limits.voiceAiEnabled;
    if (feature === 'creative_studio') return limits.creativeStudioEnabled;
    if (feature === 'instant_forms') return limits.instantFormsEnabled;
    if (feature === 'online_store') return limits.onlineStoreEnabled;
    if (feature === 'ai_campaign_review') return limits.aiCampaignReviewEnabled;
    return limits.aiEnabled;
  }

  graceDeadline(expiredAt: Date | null | undefined): Date | null {
    if (!expiredAt) return null;
    return new Date(expiredAt.getTime() + GRACE_PERIOD_MS);
  }

  graceHoursRemaining(expiredAt: Date | null | undefined, now = new Date()): number | null {
    const deadline = this.graceDeadline(expiredAt);
    if (!deadline) return null;
    const ms = deadline.getTime() - now.getTime();
    if (ms <= 0) return 0;
    return Math.ceil(ms / (60 * 60 * 1000));
  }

  graceDaysRemaining(expiredAt: Date | null | undefined, now = new Date()): number | null {
    const hours = this.graceHoursRemaining(expiredAt, now);
    if (hours === null) return null;
    if (hours <= 0) return 0;
    return Math.max(1, Math.ceil(hours / 24));
  }

  isWithinGracePeriod(expiredAt: Date | null | undefined, gracePurgedAt: Date | null | undefined, now = new Date()) {
    if (!expiredAt || gracePurgedAt) return false;
    const deadline = this.graceDeadline(expiredAt);
    return !!deadline && now < deadline;
  }

  private cacheKey(planId: string) {
    return `plan-entitlements:${planId}`;
  }

  private async readCache(planId: string): Promise<PlanLimits | null> {
    try {
      const raw = await this.redis.get(this.cacheKey(planId));
      if (!raw) return null;
      return JSON.parse(raw) as PlanLimits;
    } catch {
      return null;
    }
  }

  private async writeCache(planId: string, limits: PlanLimits) {
    try {
      await this.redis.set(this.cacheKey(planId), JSON.stringify(limits), 'EX', CACHE_TTL_SEC);
    } catch (err) {
      this.logger.warn(`Entitlement cache write failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
