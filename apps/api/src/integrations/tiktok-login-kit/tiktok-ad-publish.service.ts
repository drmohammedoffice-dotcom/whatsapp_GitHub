import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@watsapp/database';
import { AxiosError } from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { readTikTokMedia, TikTokAdsService } from './tiktok-ads.service';
import { TikTokMarketingOAuthService } from './tiktok-marketing-oauth.service';
import { BillingAccessService } from '../../billing/billing-access.service';
import { PlanEntitlementsService } from '../../billing/plan-entitlements.service';
import { WaylService } from '../../billing/wayl.service';
import { AiProviderService, type AiMessage } from '../../ai/ai-provider.service';
import { buildConversionTrackingUrl, conversionEventName } from '../../tiktok-integration/tiktok-integration.constants';

const OBJECTIVE_SPECS = {
  REACH: { promotionType: 'WEBSITE', optimizationGoal: 'REACH', billingEvent: 'CPM', needsPixel: false, needsApp: false, allowsPixel: false, allowsInstantPage: true, allowsSmartPlus: false, requiresFrequency: true },
  TRAFFIC: { promotionType: 'WEBSITE', optimizationGoal: 'CLICK', billingEvent: 'CPC', needsPixel: false, needsApp: false, allowsPixel: true, allowsInstantPage: true, allowsSmartPlus: false, requiresFrequency: false },
  VIDEO_VIEWS: { promotionType: 'WEBSITE', optimizationGoal: 'ENGAGED_VIEW', billingEvent: 'CPV', needsPixel: false, needsApp: false, allowsPixel: false, allowsInstantPage: false, allowsSmartPlus: false, requiresFrequency: false },
  LEAD_GENERATION: { promotionType: 'LEAD_GENERATION', optimizationGoal: 'CONVERT', billingEvent: 'OCPM', needsPixel: false, needsApp: false, allowsPixel: true, allowsInstantPage: true, allowsSmartPlus: false, requiresFrequency: false },
  ENGAGEMENT: { promotionType: 'WEBSITE', optimizationGoal: 'FOLLOWERS', billingEvent: 'OCPM', needsPixel: false, needsApp: false, allowsPixel: false, allowsInstantPage: false, allowsSmartPlus: false, requiresFrequency: false },
  APP_PROMOTION: { promotionType: 'APP_ANDROID', optimizationGoal: 'INSTALL', billingEvent: 'OCPM', needsPixel: false, needsApp: true, allowsPixel: false, allowsInstantPage: false, allowsSmartPlus: true, requiresFrequency: false },
  // Smart+ معطّل عمداً: Smart+ Web يفرض sales_destination=WEBSITE فيظهر في تيك توك كمبيعات وليس تحويلات موقع
  WEB_CONVERSIONS: { promotionType: 'WEBSITE', optimizationGoal: 'CONVERT', billingEvent: 'OCPM', needsPixel: true, needsApp: false, allowsPixel: true, allowsInstantPage: true, allowsSmartPlus: false, requiresFrequency: false },
  // متجر تيك توك: تيك توك يعطّل Smart+ لمبيعات المنتجات (PRODUCT_SALES / STORE)
  PRODUCT_SALES: { promotionType: 'WEBSITE', optimizationGoal: 'CONVERT', billingEvent: 'OCPM', needsPixel: false, needsApp: false, allowsPixel: true, allowsInstantPage: false, allowsSmartPlus: false, requiresFrequency: false },
} as const;

/** تسمية الهدف كما تُنشر فعلياً (منفصلة: تحويلات الموقع ≠ مبيعات المنتجات) */
function tikTokAdsManagerLabel(input: {
  objective: string;
  smartPlus?: boolean;
  salesDestination?: string;
}): string {
  if (input.objective === 'WEB_CONVERSIONS') {
    // Smart+ Web في تيك توك = مبيعات → موقع ويب
    return input.smartPlus ? 'مبيعات → موقع ويب (Smart+)' : 'تحويلات موقع الويب';
  }
  if (input.objective === 'PRODUCT_SALES') {
    return input.salesDestination === 'STORE' || !input.salesDestination
      ? 'مبيعات المنتجات · متجر تيك توك'
      : 'مبيعات المنتجات · كتالوج';
  }
  if (input.objective === 'LEAD_GENERATION') {
    return input.smartPlus ? 'إنشاء عميل محتمل (Smart+)' : 'إنشاء عميل محتمل';
  }
  if (input.objective === 'APP_PROMOTION') {
    return input.smartPlus ? 'الترويج للتطبيق (Smart+)' : 'الترويج للتطبيق';
  }
  const labels: Record<string, string> = {
    REACH: 'الوصول',
    TRAFFIC: 'الزيارات',
    VIDEO_VIEWS: 'مشاهدات الفيديو',
    ENGAGEMENT: 'تفاعل المجتمع',
  };
  return labels[input.objective] || input.objective;
}
const OBJECTIVES = Object.keys(OBJECTIVE_SPECS) as Array<keyof typeof OBJECTIVE_SPECS>;
const GENDERS = ['GENDER_UNLIMITED', 'GENDER_MALE', 'GENDER_FEMALE'] as const;
const AGE_GROUPS = ['AGE_13_17', 'AGE_18_24', 'AGE_25_34', 'AGE_35_44', 'AGE_45_54', 'AGE_55_100'] as const;
const BUDGET_MODES = ['BUDGET_MODE_DAY', 'BUDGET_MODE_TOTAL'] as const;
const NETWORK_TYPES = ['WIFI', '2G', '3G', '4G', '5G'] as const;
const SPENDING_POWER = ['ALL', 'HIGH'] as const;
const CTA = [
  'LEARN_MORE',
  'SHOP_NOW',
  'SIGN_UP',
  'ORDER_NOW',
  'BOOK_NOW',
  'DOWNLOAD_NOW',
  'APPLY_NOW',
  'SUBSCRIBE',
  'CONTACT_US',
  'GET_QUOTE',
  'WATCH_NOW',
] as const;
const SMART_PLUS_CTAS = [
  'LEARN_MORE',
  'SHOP_NOW',
  'SIGN_UP',
  'ORDER_NOW',
  'BOOK_NOW',
  'DOWNLOAD_NOW',
  'APPLY_NOW',
  'SUBSCRIBE',
  'GET_QUOTE',
  'WATCH_NOW',
] as const;
const OPTIMIZATION_EVENTS = [
  'BUTTON',
  'SHOPPING',
  'ON_WEB_ORDER', // legacy alias → normalized to SHOPPING (Purchase / Complete Payment)
  'ON_WEB_CART',
  'ON_WEB_DETAIL',
  'ON_WEB_SEARCH',
  'ON_WEB_SUBSCRIBE',
  'ON_WEB_REGISTER',
  'CONSULT',
  'FORM',
  'LANDING_PAGE_VIEW',
  'ENGAGED_SESSION',
] as const;

/** TikTok Ads: ON_WEB_ORDER = Place an Order (deprecated/inactive). SHOPPING = Purchase/Complete Payment. FORM = Submit Form. */
function normalizeOptimizationEvent(event?: string | null, objective?: string): string | undefined {
  const raw = String(event || '').trim().toUpperCase();
  if (!raw) {
    if (objective === 'LEAD_GENERATION') return 'FORM';
    if (objective === 'WEB_CONVERSIONS' || objective === 'PRODUCT_SALES') return 'SHOPPING';
    return undefined;
  }
  if (raw === 'ON_WEB_ORDER' || raw === 'PURCHASE' || raw === 'COMPLETE_PAYMENT' || raw === 'COMPLETEPAYMENT') {
    return 'SHOPPING';
  }
  if (raw === 'SUBMIT_FORM' || raw === 'SUBMITFORM' || raw === 'LEAD') {
    return 'FORM';
  }
  // Contact (واتساب) في Ads Manager = CONSULT
  if (raw === 'CONTACT' || raw === 'WHATSAPP' || raw === 'MESSAGE' || raw === 'CONSULTATION') {
    return 'CONSULT';
  }
  return raw;
}

const TRAFFIC_GOAL_SPECS = {
  CLICK: { billingEvent: 'CPC', needsPixel: false },
  TRAFFIC_LANDING_PAGE_VIEW: { billingEvent: 'OCPM', needsPixel: true },
  ENGAGED_SESSION: { billingEvent: 'OCPM', needsPixel: true },
} as const;

const VIDEO_VIEWS_GOAL_SPECS = {
  ENGAGED_VIEW: { billingEvent: 'CPV', cpvVideoDuration: 'SIX_SECONDS' },
  ENGAGED_VIEW_FIFTEEN: { billingEvent: 'CPV', cpvVideoDuration: 'FIFTEEN_SECONDS' },
} as const;

const ENGAGEMENT_GOAL_SPECS = {
  FOLLOWERS: { billingEvent: 'OCPM' },
  PAGE_VISIT: { billingEvent: 'OCPM' },
} as const;

export type SparkCreativeInput = {
  name?: string;
  authCode?: string;
  itemId?: string;
  identityId?: string;
  identityType?: string;
  identityAuthorizedBcId?: string;
  adId?: string;
};

export type PublishTikTokAdInput = {
  advertiserId: string;
  campaignId?: string;
  adGroupId?: string;
  adGroupName?: string;
  /** اسم الإعلان الواحد (Smart+ يدمج كل الفيديوهات داخله) */
  adName?: string;
  campaignName: string;
  objective: (typeof OBJECTIVES)[number];
  smartPlus?: boolean;
  searchCampaign?: boolean;
  appPromotionType?: 'APP_INSTALL' | 'APP_RETARGETING';
  salesDestination?: 'WEBSITE' | 'APP' | 'WEB_AND_APP' | 'STORE';
  trafficDestination?: 'WEBSITE' | 'APP' | 'TIKTOK_SHOP';
  optimizationGoal?: 'CLICK' | 'TRAFFIC_LANDING_PAGE_VIEW' | 'ENGAGED_SESSION' | 'REACH' | 'ENGAGED_VIEW' | 'ENGAGED_VIEW_FIFTEEN' | 'FOLLOWERS' | 'PAGE_VISIT' | 'INSTALL' | 'LEAD_GENERATION' | 'CONVERT';
  cpvVideoDuration?: 'SIX_SECONDS' | 'FIFTEEN_SECONDS' | 'TWO_SECONDS';
  frequency?: number;
  frequencySchedule?: number;
  tiktokSubplacements?: string[];
  destination?: 'PIXEL' | 'WHATSAPP' | 'INSTANT_PAGE';
  whatsappNumber?: string;
  appId?: string;
  pageId?: string;
  scheduleMode?: 'CONTINUOUS' | 'RANGE';
  scheduleStartDate?: string;
  timezone?: string;
  pixelId?: string;
  optimizationEvent?: (typeof OPTIMIZATION_EVENTS)[number];
  clickAttributionWindow?: 'ONE_DAY' | 'SEVEN_DAYS' | 'FOURTEEN_DAYS' | 'TWENTY_EIGHT_DAYS';
  viewAttributionWindow?: 'OFF' | 'ONE_DAY' | 'SEVEN_DAYS' | 'FOURTEEN_DAYS' | 'TWENTY_EIGHT_DAYS';
  attributionEventCount?: 'EVERY' | 'ONCE';
  landingPageUrl?: string;
  usePlatformTrackingLink?: boolean;
  locationIds: string[];
  gender?: (typeof GENDERS)[number];
  ageGroups?: string[];
  interestCategoryIds?: string[];
  languageCodes?: string[];
  spendingPower?: (typeof SPENDING_POWER)[number];
  audienceIds?: string[];
  excludedAudienceIds?: string[];
  smartInterestBehavior?: boolean;
  placementMode?: 'AUTOMATIC' | 'MANUAL';
  placements?: string[];
  includeSearchResult?: boolean;
  devices?: 'ALL' | 'ANDROID' | 'IOS';
  minAndroidVersion?: string;
  minIosVersion?: string;
  networkTypes?: string[];
  carrierIds?: string[];
  ispIds?: string[];
  devicePriceMode?: 'ALL' | 'RANGE';
  devicePriceMin?: number;
  devicePriceMax?: number;
  dayparting?: string;
  budgetMode: (typeof BUDGET_MODES)[number];
  budget: number;
  bidStrategy?: 'HIGHEST' | 'TARGET';
  targetCost?: number;
  acceleratedDelivery?: boolean;
  scheduleEndDate?: string;
  allowComments?: boolean;
  allowDownload?: boolean;
  allowShare?: boolean;
  callToAction: (typeof CTA)[number];
  /** بطاقة العرض التفاعلية (اختيارية) — creative portfolio CARD */
  cardId?: string;
  creatives: SparkCreativeInput[];
};

@Injectable()
export class TikTokAdPublishService {
  private readonly logger = new Logger(TikTokAdPublishService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ads: TikTokAdsService,
    private readonly marketingOAuth: TikTokMarketingOAuthService,
    private readonly wayl: WaylService,
    private readonly entitlements: PlanEntitlementsService,
    private readonly access: BillingAccessService,
    @Inject(forwardRef(() => AiProviderService)) private readonly ai: AiProviderService,
  ) {}

  async options(userId: string, advertiserId: string, teamId?: string) {
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    const [pixels, regions, interests, identities, languages, customAudiences, instantPages, profile] = await Promise.all([
      this.ads.listPixels(token, advertiserId).catch((err) => {
        throw new BadRequestException(this.message(err));
      }),
      this.ads.listTargetingRegions(token, advertiserId, 'TRAFFIC').catch((err) => {
        throw new BadRequestException(this.message(err));
      }),
      this.ads.listInterestCategories(token, advertiserId).catch(() => []),
      this.ads.listIdentities(token, advertiserId).catch(() => []),
      this.ads.listLanguages(token, advertiserId).catch(() => []),
      this.ads.listCustomAudiences(token, advertiserId).catch(() => []),
      this.ads.listInstantPages(token, advertiserId, { status: 'ALL' }).catch(() => []),
      this.ads.getAdvertiserProfile(token, advertiserId).catch(() => null),
    ]);
    const tipAppId = this.ads.resolveBusinessAppCredentials()?.appId ?? null;
    if (profile?.currency || profile?.timezone) {
      await this.prisma.tikTokMarketingAdvertiser.update({
        where: { userId_advertiserId: { userId, advertiserId } },
        data: {
          currency: profile.currency ?? undefined,
          timezone: profile.timezone ?? undefined,
          name: profile.name ?? undefined,
        },
      }).catch(() => undefined);
    }
    const trackingByPixel = await this.trackingUrlsForAdvertiser(teamId, advertiserId, pixels);
    return {
      pixels: pixels
        .map((pixel) => ({
          pixelId: pixel.pixel_id,
          pixelCode: pixel.pixel_code,
          name: pixel.pixel_name ?? pixel.pixel_code,
          trackingUrl: trackingByPixel.get(pixel.pixel_id) ?? trackingByPixel.get(pixel.pixel_code) ?? null,
        }))
        .sort((a, b) => Number(Boolean(b.trackingUrl)) - Number(Boolean(a.trackingUrl))),
      regions,
      interests,
      identities,
      languages,
      customAudiences,
      instantPages,
      tipAppId,
      carriers: [] as Array<{ id: string; name: string }>,
      isps: [] as Array<{ id: string; name: string }>,
      ageGroups: [...AGE_GROUPS],
      callToActions: [...CTA],
      optimizationEvents: [...OPTIMIZATION_EVENTS],
      networkTypes: [...NETWORK_TYPES],
      spendingPowerOptions: [...SPENDING_POWER],
      objectives: OBJECTIVES,
      objectiveSpecs: OBJECTIVES.reduce((acc, key) => {
        acc[key] = OBJECTIVE_SPECS[key];
        return acc;
      }, {} as Record<string, (typeof OBJECTIVE_SPECS)[keyof typeof OBJECTIVE_SPECS]>),
      advertiser: profile,
    };
  }

  async targetingExtras(userId: string, advertiserId: string, locationIds: string[]) {
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    const [carriers, isps] = await Promise.all([
      this.ads.listCarriers(token, advertiserId, locationIds),
      this.ads.listIsps(token, advertiserId, locationIds),
    ]);
    return { carriers, isps };
  }

  async estimateAudience(userId: string, input: {
    advertiserId: string;
    objective: string;
    locationIds: string[];
    gender?: string;
    ageGroups?: string[];
    interestCategoryIds?: string[];
    languageCodes?: string[];
    devices?: 'ALL' | 'ANDROID' | 'IOS';
    placementMode?: 'AUTOMATIC' | 'MANUAL';
    placements?: string[];
  }) {
    if (!OBJECTIVES.includes(input.objective as (typeof OBJECTIVES)[number])) {
      throw new BadRequestException('هدف الحملة غير مدعوم');
    }
    const objective = input.objective as (typeof OBJECTIVES)[number];
    const token = await this.tokenForAdvertiser(userId, input.advertiserId);
    const body: Record<string, unknown> = {
      advertiser_id: input.advertiserId,
      objective_type: objective,
      optimization_goal: OBJECTIVE_SPECS[objective].optimizationGoal,
      placement_type: input.placementMode === 'AUTOMATIC' ? 'PLACEMENT_TYPE_AUTOMATIC' : 'PLACEMENT_TYPE_NORMAL',
      location_ids: input.locationIds,
    };
    if (input.placementMode !== 'AUTOMATIC') {
      body.placements = input.placements?.length ? input.placements : ['PLACEMENT_TIKTOK'];
    }
    if (input.gender && input.gender !== 'GENDER_UNLIMITED') body.gender = input.gender;
    const ages = (input.ageGroups ?? []).filter((age) => (AGE_GROUPS as readonly string[]).includes(age));
    if (ages.length) body.age_groups = ages;
    if (input.interestCategoryIds?.length) body.interest_category_ids = input.interestCategoryIds;
    if (input.languageCodes?.length) body.languages = input.languageCodes;
    if (input.devices === 'ANDROID') body.operating_systems = ['ANDROID'];
    else if (input.devices === 'IOS') body.operating_systems = ['IOS'];
    try {
      return await this.ads.estimateAudienceSize(token, body);
    } catch (err) {
      throw new BadRequestException(this.message(err));
    }
  }

  async videos(userId: string, advertiserId: string, identityId: string, identityType: string, cursor?: string) {
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    try {
      return await this.ads.listIdentityVideos(token, advertiserId, identityId, identityType, cursor);
    } catch (err) {
      throw new BadRequestException(this.message(err));
    }
  }

  async previewSpark(userId: string, advertiserId: string, authCode: string) {
    if (!authCode.trim()) throw new BadRequestException('أدخل كود الإعلان');
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    try {
      return await this.ads.previewSparkCode(token, advertiserId, authCode);
    } catch (err) {
      throw new BadRequestException(this.message(err));
    }
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private isConcurrentEntityError(message: string) {
    return /too many concurrent requests of updating entities|concurrent requests.*updating entities|rate limit|too many requests|try again later/i.test(message);
  }

  /** Publish many ad groups into one campaign, serially, with backoff between groups. */
  async publishBundle(userId: string, teamId: string, groups: PublishTikTokAdInput[]) {
    if (!Array.isArray(groups) || !groups.length) {
      throw new BadRequestException('أضف مجموعة إعلانية واحدة على الأقل قبل النشر');
    }
    let campaignId = String(groups[0]?.campaignId || '').trim();
    const results: Array<{
      campaignId: string;
      adGroupId: string;
      adIds: string[];
      landingPageUrl: string;
      campaignName?: string;
    }> = [];

    for (let index = 0; index < groups.length; index += 1) {
      if (index > 0) await this.sleep(2800);
      const input: PublishTikTokAdInput = {
        ...groups[index],
        campaignId: campaignId || groups[index].campaignId,
      };
      try {
        const result = await this.publishWithConcurrentRetry(userId, teamId, input);
        campaignId = result.campaignId;
        results.push(result);
        this.logger.log(
          `[Marketing API] publishBundle group ${index + 1}/${groups.length} ok campaign=${campaignId} adGroup=${result.adGroupId} ads=${result.adIds.length}`,
        );
      } catch (err) {
        if (!results.length) throw err;
        const first = results[0]!;
        const detail = this.message(err);
        throw new BadRequestException(
          `تم نشر ${results.length} من ${groups.length} مجموعات في الحملة ${campaignId} ثم توقف: ${detail}. افتح الحملة نفسها وأعد نشر المجموعات المتبقية.`,
        );
      }
    }

    const first = results[0]!;
    const head = groups[0]!;
    return {
      campaignId: first.campaignId,
      adGroupId: first.adGroupId,
      adIds: results.flatMap((row) => row.adIds),
      adGroupIds: results.map((row) => row.adGroupId),
      groups: results,
      landingPageUrl: first.landingPageUrl,
      campaignName: first.campaignName,
      publishedGroupCount: results.length,
      objective: head.objective,
      smartPlus: Boolean(head.smartPlus),
      salesDestination: head.salesDestination,
      tikTokAdsManagerLabel: tikTokAdsManagerLabel({
        objective: head.objective,
        smartPlus: Boolean(head.smartPlus),
        salesDestination: head.salesDestination,
      }),
    };
  }

  private async publishWithConcurrentRetry(
    userId: string,
    teamId: string,
    input: PublishTikTokAdInput,
    attempts = 4,
  ) {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await this.publish(userId, teamId, input);
      } catch (err) {
        lastErr = err;
        const msg = this.message(err);
        // Keep campaignId across retries when appending groups.
        if (input.campaignId && /rolled back|rollback/i.test(msg)) {
          throw err;
        }
        if (!this.isConcurrentEntityError(msg) || attempt >= attempts) throw err;
        const delayMs = Math.min(10_000, 2000 * (2 ** (attempt - 1)));
        this.logger.warn(`[Marketing API] publish concurrent limit (attempt ${attempt}/${attempts}); retry in ${delayMs}ms`);
        await this.sleep(delayMs);
      }
    }
    throw lastErr instanceof Error ? lastErr : new BadRequestException(this.message(lastErr));
  }

  async publish(userId: string, teamId: string, input: PublishTikTokAdInput) {
    input = this.applyWhatsAppDestination(input);
    input = this.normalizeSchedule(input);
    this.validate(input);
    if (input.campaignId && input.adGroupId) return this.updateExisting(userId, teamId, input);
    if (input.campaignId) return this.appendAdGroup(userId, teamId, input);
    const advertiser = await this.prisma.tikTokMarketingAdvertiser.findUnique({
      where: { userId_advertiserId: { userId, advertiserId: input.advertiserId } },
    });
    if (!advertiser) throw new BadRequestException('الحساب الإعلاني غير مربوط بهذا المستخدم');
    const token = await this.marketingOAuth.getValidMarketingAccessToken(userId);

    const landingPageUrl = await this.resolveLandingUrl(teamId, input);
    let campaignId = '';
    let adGroupId = '';
    try {
      // حضّر الإبداعات أولاً قبل إنشاء أي شيء على تيك توك
      const creatives = await this.resolveCreatives(token, input, landingPageUrl);
      const campaignName = await this.uniqueCampaignName(token, input.advertiserId, input.campaignName);
      input = { ...input, campaignName };
      // مسار نشر صارم لكل هدف — يمنع تحويل WEB_CONVERSIONS إلى Sales
      const plan = this.resolvePublishPlan(input);
      input = plan.input;
      const useSmartPlus = plan.useSmartPlus;
      this.logger.log(
        `[Marketing API] publish plan objective=${plan.objective}`
        + ` smartPlus=${useSmartPlus}`
        + ` salesDestination=${String(plan.salesDestination ?? '-')}`
        + ` productSource=${String(plan.campaignProductSource ?? '-')}`,
      );
      campaignId = useSmartPlus
        ? await this.ads.createSmartPlusCampaign(token, {
          advertiserId: input.advertiserId,
          name: campaignName,
          objectiveType: plan.objective,
          salesDestination: plan.salesDestination,
          budget: input.budget,
          budgetMode: input.budgetMode === 'BUDGET_MODE_TOTAL' ? 'BUDGET_MODE_TOTAL' : 'BUDGET_MODE_DAY',
        })
        : await this.ads.createMarketingCampaign(token, {
          advertiserId: input.advertiserId,
          name: campaignName,
          objectiveType: plan.objective,
          searchCampaign: Boolean(input.searchCampaign) && plan.allowsSearchCampaign,
          salesDestination: plan.salesDestination,
          campaignProductSource: plan.campaignProductSource,
        });
      await this.sleep(1200);
      const groupBody: Record<string, unknown> = {
        ...this.adGroupBody(input, input.timezone || advertiser.timezone, campaignId),
        // يساعد Smart+ على اختيار قاعدة المواضع الصحيحة لكل هدف
        objective_type: plan.objective,
      };
      adGroupId = useSmartPlus
        ? await this.ads.createSmartPlusAdGroup(token, groupBody)
        : await this.ads.createMarketingAdGroup(token, groupBody);
      await this.sleep(1200);
      const adIds = useSmartPlus
        ? await this.ads.createSmartPlusAds(token, input.advertiserId, adGroupId, creatives, {
          objectiveType: input.objective,
          promotionType: String(groupBody.promotion_type || 'WEBSITE'),
          adName: input.adName?.trim() || String(creatives[0]?.ad_name ?? '').trim() || undefined,
        })
        : await this.ads.createMarketingAds(token, input.advertiserId, adGroupId, creatives);
      try {
        await this.rememberCampaign(userId, teamId, input, campaignId, adGroupId);
      } catch (err) {
        this.logger.warn(`Saved TikTok ads but local campaign row failed: ${this.message(err)}`);
      }
      return {
        campaignId,
        adGroupId,
        adIds,
        landingPageUrl,
        campaignName: input.campaignName,
        objective: plan.objective,
        smartPlus: useSmartPlus,
        salesDestination: plan.salesDestination,
        tikTokAdsManagerLabel: tikTokAdsManagerLabel({
          objective: plan.objective,
          smartPlus: useSmartPlus,
          salesDestination: plan.salesDestination,
        }),
      };
    } catch (err) {
      if (campaignId) {
        try {
          await this.ads.deleteCampaigns(token, input.advertiserId, [campaignId]);
          this.logger.warn(`Rolled back TikTok campaign ${campaignId} after publish failure`);
        } catch (cleanupErr) {
          this.logger.error(`Failed to rollback TikTok campaign ${campaignId}: ${this.message(cleanupErr)}`);
        }
      }
      throw new BadRequestException(this.message(err));
    }
  }

  private normalizeSchedule(input: PublishTikTokAdInput): PublishTikTokAdInput {
    const mode = input.scheduleMode === 'RANGE' ? 'RANGE' : 'CONTINUOUS';
    if (mode === 'CONTINUOUS') {
      // التشغيل المستمر لا يحتاج تاريخ نهاية؛ ميزانية الإجمالي عند تيك توك تتطلب نهاية → نحوّلها ليومية
      return {
        ...input,
        scheduleMode: 'CONTINUOUS',
        scheduleEndDate: undefined,
        budgetMode: input.budgetMode === 'BUDGET_MODE_TOTAL' ? 'BUDGET_MODE_DAY' : input.budgetMode,
      };
    }
    return { ...input, scheduleMode: 'RANGE' };
  }

  private async appendAdGroup(userId: string, teamId: string, input: PublishTikTokAdInput) {
    input = this.normalizeSchedule(input);
    const advertiser = await this.prisma.tikTokMarketingAdvertiser.findUnique({
      where: { userId_advertiserId: { userId, advertiserId: input.advertiserId } },
    });
    if (!advertiser) throw new BadRequestException('الحساب الإعلاني غير مربوط بهذا المستخدم');
    const token = await this.marketingOAuth.getValidMarketingAccessToken(userId);
    const campaignId = input.campaignId!;
    const landingPageUrl = await this.resolveLandingUrl(teamId, input);
    let adGroupId = '';
    try {
      const creatives = await this.resolveCreatives(token, input, landingPageUrl);
      const useSmartPlus = Boolean(input.smartPlus && OBJECTIVE_SPECS[input.objective].allowsSmartPlus)
        || await this.ads.isUpgradedSmartPlusCampaign(token, input.advertiserId, campaignId);
      const groupBody = this.adGroupBody(input, input.timezone || advertiser.timezone, campaignId);
      if (useSmartPlus) {
        this.logger.log(`[Marketing API] appendAdGroup using Smart+ endpoints campaign=${campaignId}`);
        adGroupId = await this.ads.createSmartPlusAdGroup(token, groupBody);
        await this.sleep(1200);
        const adIds = await this.ads.createSmartPlusAds(token, input.advertiserId, adGroupId, creatives, {
          objectiveType: input.objective,
          promotionType: String(groupBody.promotion_type || 'WEBSITE'),
          adName: input.adName?.trim() || String(creatives[0]?.ad_name ?? '').trim() || undefined,
        });
        try {
          await this.rememberCampaign(userId, teamId, input, campaignId, adGroupId);
        } catch (err) {
          this.logger.warn(`Saved TikTok ads but local campaign row failed: ${this.message(err)}`);
        }
        return {
          campaignId,
          adGroupId,
          adIds,
          landingPageUrl,
          campaignName: input.campaignName,
          objective: input.objective,
          smartPlus: true,
          salesDestination: input.salesDestination,
          tikTokAdsManagerLabel: tikTokAdsManagerLabel({
            objective: input.objective,
            smartPlus: true,
            salesDestination: input.salesDestination,
          }),
        };
      }
      adGroupId = await this.ads.createMarketingAdGroup(token, groupBody);
      await this.sleep(1200);
      const adIds = await this.ads.createMarketingAds(token, input.advertiserId, adGroupId, creatives);
      try {
        await this.rememberCampaign(userId, teamId, input, campaignId, adGroupId);
      } catch (err) {
        this.logger.warn(`Saved TikTok ads but local campaign row failed: ${this.message(err)}`);
      }
      return {
        campaignId,
        adGroupId,
        adIds,
        landingPageUrl,
        campaignName: input.campaignName,
        objective: input.objective,
        smartPlus: false,
        salesDestination: input.salesDestination,
        tikTokAdsManagerLabel: tikTokAdsManagerLabel({
          objective: input.objective,
          smartPlus: false,
          salesDestination: input.salesDestination,
        }),
      };
    } catch (err) {
      if (adGroupId) {
        try {
          await this.ads.setAdGroupStatus(token, input.advertiserId, [adGroupId], 'DISABLE');
        } catch (cleanupErr) {
          this.logger.warn(`Failed to disable partial ad group ${adGroupId}: ${this.message(cleanupErr)}`);
        }
      }
      throw new BadRequestException(this.message(err));
    }
  }

  async setAdGroupDelivery(userId: string, advertiserId: string, adGroupId: string, enabled: boolean) {
    if (!adGroupId) throw new BadRequestException('المجموعة الإعلانية غير موجودة');
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    const status = enabled ? 'ENABLE' : 'DISABLE';
    try {
      const liveStatus = await this.ads.setAdGroupStatusLive(token, advertiserId, adGroupId, status);
      return { adGroupId, status: liveStatus };
    } catch (err) {
      throw new BadRequestException(this.message(err));
    }
  }

  /**
   * مصدر واحد لفصل مسارات النشر لكل هدف.
   * WEB_CONVERSIONS يدوي: بدون sales_destination (يبقى تحويلات موقع).
   * مبيعات Smart+: WEB_CONVERSIONS + Smart+ + sales_destination=WEBSITE (مبيعات→موقع ويب في تيك توك).
   * PRODUCT_SALES يدوي: STORE فقط (تيك توك لا يدعم Smart+ للمتجر).
   * Smart+ آخر: LEAD_GENERATION | APP_PROMOTION.
   */
  private resolvePublishPlan(input: PublishTikTokAdInput) {
    const objective = input.objective;
    if (!OBJECTIVES.includes(objective)) {
      throw new BadRequestException('هدف الحملة غير مدعوم');
    }
    const spec = OBJECTIVE_SPECS[objective];
    let useSmartPlus = Boolean(input.smartPlus && spec.allowsSmartPlus);
    let salesDestination: PublishTikTokAdInput['salesDestination'];
    let campaignProductSource: 'STORE' | 'CATALOG' | undefined;
    let allowsSearchCampaign = false;
    let next: PublishTikTokAdInput = { ...input, objective };
    let publishObjective: PublishTikTokAdInput['objective'] = objective;

    switch (objective) {
      case 'WEB_CONVERSIONS':
        if (input.smartPlus && input.salesDestination === 'WEBSITE') {
          // مسار مبيعات Smart+ الرسمي (من قائمة المبيعات)
          useSmartPlus = true;
          salesDestination = 'WEBSITE';
          next = { ...next, smartPlus: true, salesDestination: 'WEBSITE', destination: 'PIXEL' };
          allowsSearchCampaign = false;
        } else if (input.smartPlus) {
          throw new BadRequestException(
            'لتحويلات موقع الويب اختر الحملة اليدوية. لمبيعات الموقع Smart+ اختر «مبيعات المنتجات → موقع ويب (Smart+)».',
          );
        } else {
          useSmartPlus = false;
          salesDestination = undefined;
          next = { ...next, smartPlus: false, salesDestination: undefined };
          allowsSearchCampaign = true;
        }
        break;
      case 'PRODUCT_SALES':
        if (input.smartPlus || input.salesDestination === 'WEBSITE') {
          // تيك توك: مبيعات Smart+ = WEB_CONVERSIONS + sales_destination=WEBSITE
          publishObjective = 'WEB_CONVERSIONS';
          useSmartPlus = true;
          salesDestination = 'WEBSITE';
          campaignProductSource = undefined;
          next = {
            ...next,
            objective: 'WEB_CONVERSIONS',
            smartPlus: true,
            salesDestination: 'WEBSITE',
            destination: 'PIXEL',
          };
          allowsSearchCampaign = false;
          break;
        }
        useSmartPlus = false;
        salesDestination = 'STORE';
        campaignProductSource = 'STORE';
        next = { ...next, smartPlus: false, salesDestination: 'STORE' };
        break;
      case 'LEAD_GENERATION':
        salesDestination = undefined;
        next = { ...next, salesDestination: undefined, destination: 'PIXEL' };
        allowsSearchCampaign = !useSmartPlus;
        break;
      case 'APP_PROMOTION':
        salesDestination = undefined;
        next = { ...next, salesDestination: undefined };
        allowsSearchCampaign = !useSmartPlus && next.appPromotionType !== 'APP_RETARGETING';
        break;
      case 'REACH':
      case 'TRAFFIC':
        useSmartPlus = false;
        salesDestination = undefined;
        next = { ...next, smartPlus: false, salesDestination: undefined };
        allowsSearchCampaign = true;
        break;
      case 'VIDEO_VIEWS':
      case 'ENGAGEMENT':
        useSmartPlus = false;
        salesDestination = undefined;
        next = { ...next, smartPlus: false, salesDestination: undefined };
        allowsSearchCampaign = false;
        break;
      default:
        useSmartPlus = false;
        salesDestination = undefined;
        next = { ...next, smartPlus: false, salesDestination: undefined };
    }

    return {
      objective: publishObjective,
      useSmartPlus,
      salesDestination,
      campaignProductSource,
      allowsSearchCampaign,
      input: next,
    };
  }

  private validate(input: PublishTikTokAdInput) {
    if (!OBJECTIVES.includes(input.objective)) throw new BadRequestException('هدف الحملة غير مدعوم');
    if (!input.campaignName?.trim()) throw new BadRequestException('اسم الحملة مطلوب');
    if (!input.locationIds?.length) throw new BadRequestException('اختر دولة واحدة على الأقل');
    if (!BUDGET_MODES.includes(input.budgetMode)) throw new BadRequestException('نوع الميزانية غير مدعوم');
    if (!Number.isFinite(input.budget) || input.budget <= 0) throw new BadRequestException('أدخل ميزانية أكبر من صفر');
    if (input.scheduleMode === 'RANGE' && !input.scheduleEndDate) {
      throw new BadRequestException('حدد تاريخ نهاية الحملة');
    }
    if (input.budgetMode === 'BUDGET_MODE_TOTAL' && input.scheduleMode === 'RANGE' && !input.scheduleEndDate) {
      throw new BadRequestException('حدد تاريخ نهاية الحملة لميزانية إجمالي المدة');
    }
    if (input.scheduleMode === 'RANGE' && input.scheduleStartDate && input.scheduleEndDate && input.scheduleEndDate < input.scheduleStartDate) {
      throw new BadRequestException('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
    }
    if (!CTA.includes(input.callToAction)) throw new BadRequestException('زر الدعوة غير مدعوم');
    if (input.smartPlus) {
      const smartCta = SMART_PLUS_CTAS.includes(input.callToAction as (typeof SMART_PLUS_CTAS)[number])
        ? input.callToAction
        : 'LEARN_MORE';
      input = { ...input, callToAction: smartCta };
    }
    if (!input.creatives?.length) throw new BadRequestException('اختر فيديو واحداً على الأقل أو أدخل كود إعلان');
    const spec = OBJECTIVE_SPECS[input.objective];
    if (spec.needsPixel && input.destination !== 'WHATSAPP' && input.destination !== 'INSTANT_PAGE' && !input.pixelId) {
      throw new BadRequestException('اختر البكسل لهذا الهدف أو اختر رسائل واتساب');
    }
    if (input.objective === 'PRODUCT_SALES' && input.destination === 'PIXEL' && input.salesDestination === 'WEBSITE' && !input.pixelId) {
      throw new BadRequestException('اختر البكسل لمبيعات المنتجات عبر الموقع');
    }
    if (input.destination === 'INSTANT_PAGE' && !input.pageId?.trim()) {
      throw new BadRequestException('اختر صفحة TikTok الفورية');
    }
    if (!spec.allowsInstantPage && input.destination === 'INSTANT_PAGE') {
      throw new BadRequestException('صفحة TikTok الفورية غير متاحة لهذا الهدف');
    }
    if (input.objective === 'LEAD_GENERATION') {
      const leadDest = input.destination || 'PIXEL';
      if (leadDest !== 'PIXEL' && leadDest !== 'INSTANT_PAGE') {
        throw new BadRequestException('إنشاء عميل محتمل يدعم موقع الويب (بكسل) أو الاستمارة الفورية فقط');
      }
      if (leadDest === 'PIXEL' && !input.pixelId) {
        throw new BadRequestException('اختر البكسل لحملة إنشاء عميل محتمل عبر الموقع');
      }
      if (leadDest === 'INSTANT_PAGE' && !input.pageId?.trim()) {
        throw new BadRequestException('اختر الاستمارة الفورية من مكتبتك في تيك توك');
      }
    }
    // مبيعات Smart+: PRODUCT_SALES+Smart+/WEBSITE أو WEB_CONVERSIONS+Smart++WEBSITE
    const isSalesSmartPlus = Boolean(
      input.smartPlus
      && (
        (input.objective === 'PRODUCT_SALES' && (input.salesDestination === 'WEBSITE' || !input.salesDestination || input.salesDestination === 'STORE'))
        || (input.objective === 'WEB_CONVERSIONS' && input.salesDestination === 'WEBSITE')
      ),
    );
    // PRODUCT_SALES + Smart+ يُعاد توجيهه لمسار مبيعات الموقع — لا ترفضه هنا
    if (input.smartPlus && input.objective === 'PRODUCT_SALES') {
      if (!input.pixelId) {
        throw new BadRequestException('اختر البكسل لحملة مبيعات موقع ويب (Smart+)');
      }
    } else if (input.smartPlus && !spec.allowsSmartPlus && !isSalesSmartPlus) {
      throw new BadRequestException(
        input.objective === 'WEB_CONVERSIONS'
          ? 'لتحويلات موقع الويب استخدم الحملة اليدوية. لمبيعات Smart+ اختر «مبيعات المنتجات → موقع ويب (Smart+)».'
          : 'حملة Smart+ غير مدعومة لهذا الهدف',
      );
    }
    if (input.objective === 'WEB_CONVERSIONS' && input.smartPlus && input.salesDestination !== 'WEBSITE') {
      throw new BadRequestException(
        'تحويلات موقع الويب تُنشر يدوياً فقط. لمبيعات Smart+ استخدم قائمة المبيعات → موقع ويب.',
      );
    }
    if (input.objective === 'WEB_CONVERSIONS' && !input.smartPlus && input.salesDestination) {
      throw new BadRequestException(
        'تحويلات موقع الويب اليدوية لا تستخدم sales_destination — حتى لا تظهر كمبيعات.',
      );
    }
    if (input.smartPlus && input.searchCampaign) {
      throw new BadRequestException('لا يمكن دمج حملة Smart+ مع حملة الترويج ضمن نتائج البحث');
    }
    if (spec.needsApp && !input.appId?.trim()) {
      throw new BadRequestException('أدخل معرّف التطبيق لهذا الهدف');
    }
    if (input.objective === 'TRAFFIC' && input.trafficDestination === 'APP' && !input.appId?.trim()) {
      throw new BadRequestException('أدخل معرّف التطبيق لوجهة التطبيق في حملة الزيارات');
    }
    if (input.objective === 'TRAFFIC' && input.optimizationGoal) {
      const goal = input.optimizationGoal;
      if (!(goal in TRAFFIC_GOAL_SPECS) && goal !== 'CLICK') {
        // allow only traffic-related overrides for TRAFFIC objective
      }
      const trafficSpec = TRAFFIC_GOAL_SPECS[goal as keyof typeof TRAFFIC_GOAL_SPECS];
      if (trafficSpec?.needsPixel && input.destination === 'PIXEL' && !input.pixelId) {
        throw new BadRequestException('اختر اتصال البيانات / البكسل لهدف التحسين المحدد');
      }
    }
    if (input.destination !== 'INSTANT_PAGE' && input.landingPageUrl && !/^https:\/\//i.test(input.landingPageUrl.trim())) {
      throw new BadRequestException('رابط التتبع يجب أن يبدأ بـ https://');
    }
    if (input.dayparting && /^[01]{336}$/.test(input.dayparting) && !input.dayparting.includes('1')) {
      throw new BadRequestException('اختر ساعة عرض واحدة على الأقل خلال الأسبوع');
    }
    if (input.devices && !['ALL', 'ANDROID', 'IOS'].includes(input.devices)) {
      throw new BadRequestException('نوع الجهاز غير مدعوم');
    }
    if (input.bidStrategy === 'TARGET' && !(Number(input.targetCost) > 0)) {
      throw new BadRequestException('أدخل التكلفة المستهدفة لكل نتيجة');
    }
    if (spec.requiresFrequency) {
      const frequency = Number(input.frequency ?? 3);
      const schedule = Number(input.frequencySchedule ?? 7);
      if (!(frequency >= 1) || !(schedule >= frequency) || schedule > 30) {
        throw new BadRequestException('إعداد التكرار غير صالح لحملة الوصول (1 ≤ مرات الظهور ≤ الأيام ≤ 30)');
      }
    }
    if (input.objective === 'REACH' && input.destination === 'PIXEL' && !input.pixelId) {
      const url = input.landingPageUrl?.trim() || '';
      if (!input.usePlatformTrackingLink && !/^https:\/\//i.test(url)) {
        throw new BadRequestException('أدخل رابط موقع بصيغة https:// لحملة الوصول');
      }
    }
    if (input.devicePriceMode === 'RANGE') {
      const min = Number(input.devicePriceMin);
      const max = Number(input.devicePriceMax);
      if (!(min >= 0) || !(max > min)) throw new BadRequestException('أدخل نطاق سعر جهاز صالحاً');
    }
  }

  private applyWhatsAppDestination(input: PublishTikTokAdInput) {
    if (input.destination !== 'WHATSAPP') return input;
    const digits = (input.whatsappNumber ?? '').replace(/\D/g, '');
    if (digits.length < 8) throw new BadRequestException('أدخل رقم واتساب مع مفتاح الدولة');
    const next = {
      ...input,
      whatsappNumber: digits,
      landingPageUrl: `https://wa.me/${digits}`,
      usePlatformTrackingLink: false,
    };
    if (OBJECTIVE_SPECS[input.objective].needsPixel) next.objective = 'TRAFFIC';
    return next;
  }

  private async resolveLandingUrl(teamId: string, input: PublishTikTokAdInput) {
    if (input.destination === 'INSTANT_PAGE') {
      return input.landingPageUrl?.trim() || 'https://www.tiktok.com';
    }
    if (input.destination === 'WHATSAPP' && input.whatsappNumber) {
      return `https://wa.me/${input.whatsappNumber.replace(/\D/g, '')}`;
    }
    const custom = input.landingPageUrl?.trim();
    if (custom && !input.usePlatformTrackingLink) return custom;
    // حملة الوصول يمكنها استخدام رابط موقع بدون بكسل
    if (input.objective === 'REACH' && custom) return custom;
    if (input.pixelId) {
      const pixelUrl = await this.pixelTrackingUrl(teamId, input.advertiserId, input.pixelId);
      if (pixelUrl) return pixelUrl;
      if (input.usePlatformTrackingLink) {
        throw new BadRequestException('البكسل المختار غير مربوط في جات لورا، لذلك لا يوجد له رابط تتبع. اربطه من صفحة البكسلات أولاً.');
      }
    }
    const web = this.config.get<string>('WEB_PUBLIC_URL')?.replace(/\/$/, '') || 'https://www.chatloora.com';
    const row = await this.prisma.tikTokCampaign.create({
      data: {
        teamId,
        name: input.campaignName.trim(),
        active: true,
      },
    });
    return `${web}/t/t/${teamId}/${row.id}`;
  }

  private async resolveCreatives(token: string, input: PublishTikTokAdInput, landingPageUrl: string) {
    const creatives: Array<Record<string, unknown>> = [];
    for (const [index, creative] of input.creatives.entries()) {
      let itemId = creative.itemId?.trim() || '';
      let identityId = creative.identityId?.trim() || '';
      let identityType = creative.identityType?.trim() || '';
      let identityAuthorizedBcId = creative.identityAuthorizedBcId?.trim() || '';
      if (creative.authCode?.trim()) {
        const preview = await this.ads.previewSparkCode(token, input.advertiserId, creative.authCode);
        itemId = preview.itemId;
        identityId = preview.identityId || identityId;
        identityType = preview.identityType || identityType || 'AUTH_CODE';
        identityAuthorizedBcId = preview.identityAuthorizedBcId || identityAuthorizedBcId;
      }
      if (!itemId || !identityId || !identityType) {
        throw new Error('كل فيديو يحتاج معرّف المنشور وهوية تيك توك المصرّح بها، أو كود إعلان');
      }
      const identity = await this.identityFields(token, input.advertiserId, identityId, identityType, identityAuthorizedBcId);
      const cta = input.smartPlus && !SMART_PLUS_CTAS.includes(input.callToAction as (typeof SMART_PLUS_CTAS)[number])
        ? 'LEARN_MORE'
        : input.callToAction;
      const sharedAdName = (input.adName?.trim() || input.campaignName.trim() || 'إعلان').slice(0, 512);
      const row: Record<string, unknown> = {
        // Smart+: اسم واحد لكل الأصول داخل الإعلان. يدوي: اسم لكل فيديو.
        ad_name: input.smartPlus
          ? sharedAdName
          : (creative.name?.trim() || `${sharedAdName} ${index + 1}`).slice(0, 512),
        ad_text: (creative.name?.trim() || sharedAdName).slice(0, 100),
        ad_format: 'SINGLE_VIDEO',
        ...identity,
        tiktok_item_id: itemId,
        call_to_action: cta,
      };
      if (input.destination === 'INSTANT_PAGE' && input.pageId) {
        row.page_id = input.pageId.trim();
      } else {
        row.landing_page_url = landingPageUrl;
      }
      if (input.cardId?.trim()) row.card_id = input.cardId.trim();
      creatives.push(row);
    }
    return creatives;
  }

  async tipSdkToken(userId: string, advertiserId: string) {
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    try {
      return await this.ads.createTipSdkAccessToken(token, advertiserId);
    } catch (err) {
      throw new BadRequestException(this.message(err));
    }
  }

  async listLeadInstantForms(userId: string, advertiserId: string, page = 1) {
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    const forms = await this.ads.listInstantPages(token, advertiserId, {
      status: 'ALL',
      page,
      pageSize: 50,
    });
    return { forms, page };
  }

  async renameLeadInstantForm(userId: string, advertiserId: string, pageId: string, title: string) {
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    try {
      return await this.ads.renameInstantPage(token, advertiserId, pageId, title);
    } catch (err) {
      throw new BadRequestException(
        this.message(err) || 'تعذّر تعديل الاسم عبر الواجهة — افتح «تكرار وتعديل» وغيّر الاسم من محرر تيك توك',
      );
    }
  }

  async listDisplayCards(userId: string, advertiserId: string, page = 1) {
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    const listed = await this.ads.listDisplayCardPortfolios(token, advertiserId, page, 20);
    const needCovers = listed.cards.filter((c) => !c.previewUrl && c.imageId).map((c) => c.imageId);
    if (needCovers.length) {
      const covers = await this.ads.imageCovers(token, advertiserId, needCovers).catch(() => new Map<string, string>());
      for (const card of listed.cards) {
        if (!card.previewUrl && card.imageId) card.previewUrl = covers.get(card.imageId) || '';
      }
    }
    return listed;
  }

  async createDisplayCard(
    userId: string,
    teamId: string,
    input: {
      advertiserId: string;
      pixelId?: string;
      landingPageUrl?: string;
      title?: string;
      file: { buffer: Buffer; originalname?: string; mimetype?: string };
    },
  ) {
    if (!input.file?.buffer?.length) throw new BadRequestException('ارفع صورة بطاقة العرض');
    const token = await this.tokenForAdvertiser(userId, input.advertiserId);
    let landingPageUrl = input.landingPageUrl?.trim() || '';
    if (!landingPageUrl && input.pixelId?.trim()) {
      landingPageUrl = (await this.pixelTrackingUrl(teamId, input.advertiserId, input.pixelId.trim())) || '';
    }
    if (!landingPageUrl) {
      throw new BadRequestException('لا يوجد رابط تتبع للبكسل — اربط البكسل من صفحة البكسلات أولاً أو الصق الرابط يدوياً.');
    }
    const uploaded = await this.ads.uploadAdImage(token, input.advertiserId, input.file);
    const cardId = await this.ads.createDisplayCardPortfolio(token, input.advertiserId, {
      imageId: uploaded.imageId,
      landingPageUrl,
      title: input.title,
    });
    let previewUrl = uploaded.previewUrl;
    if (!previewUrl) {
      previewUrl = await this.ads.imageCover(token, input.advertiserId, [uploaded.imageId]).catch(() => '');
    }
    return {
      cardId,
      imageId: uploaded.imageId,
      previewUrl,
      landingPageUrl,
      title: input.title?.trim() || '',
    };
  }

  private adGroupBody(input: PublishTikTokAdInput, timezone: string | null, campaignId: string) {
    const spec = OBJECTIVE_SPECS[input.objective];
    const zone = timezone || 'Asia/Baghdad';
    const ranged = input.scheduleMode === 'RANGE';
    const start = ranged && input.scheduleStartDate
      ? `${input.scheduleStartDate} 00:05:00`
      : this.formatTikTokTime(new Date(Date.now() + 15 * 60_000), zone);
    const automatic = input.placementMode === 'AUTOMATIC';
    const placements = (input.placements?.length ? input.placements : ['PLACEMENT_TIKTOK'])
      .filter((item) => ['PLACEMENT_TIKTOK', 'PLACEMENT_PANGLE', 'PLACEMENT_GLOBAL_APP_BUNDLE'].includes(item));

    let promotionType: string = spec.promotionType;
    if (input.objective === 'TRAFFIC') {
      if (input.trafficDestination === 'APP') promotionType = 'APP_ANDROID';
      else if (input.destination === 'INSTANT_PAGE') promotionType = 'WEBSITE';
      else promotionType = 'WEBSITE';
    } else if (input.objective === 'LEAD_GENERATION') {
      promotionType = 'LEAD_GENERATION';
    } else if (input.objective === 'PRODUCT_SALES' && (input.salesDestination === 'STORE' || !input.salesDestination)) {
      promotionType = 'PSA_PRODUCT';
    }

    const trafficGoal = input.objective === 'TRAFFIC' && input.optimizationGoal && input.optimizationGoal in TRAFFIC_GOAL_SPECS
      ? (input.optimizationGoal as keyof typeof TRAFFIC_GOAL_SPECS)
      : null;
    const videoViewsGoal = input.objective === 'VIDEO_VIEWS' && input.optimizationGoal && input.optimizationGoal in VIDEO_VIEWS_GOAL_SPECS
      ? (input.optimizationGoal as keyof typeof VIDEO_VIEWS_GOAL_SPECS)
      : null;
    const engagementGoal = input.objective === 'ENGAGEMENT' && input.optimizationGoal && input.optimizationGoal in ENGAGEMENT_GOAL_SPECS
      ? (input.optimizationGoal as keyof typeof ENGAGEMENT_GOAL_SPECS)
      : null;
    // موقع ويب → CONVERT؛ استمارة فورية → LEAD_GENERATION (وثائق Instant Form)
    const leadInstantForm = input.objective === 'LEAD_GENERATION' && input.destination === 'INSTANT_PAGE';
    const optimizationGoal = input.objective === 'LEAD_GENERATION'
      ? (leadInstantForm ? 'LEAD_GENERATION' : 'CONVERT')
      : trafficGoal || videoViewsGoal || engagementGoal || spec.optimizationGoal;
    const billingEvent = input.objective === 'LEAD_GENERATION'
      ? 'OCPM'
      : trafficGoal
        ? TRAFFIC_GOAL_SPECS[trafficGoal].billingEvent
        : videoViewsGoal
          ? VIDEO_VIEWS_GOAL_SPECS[videoViewsGoal].billingEvent
          : engagementGoal
            ? ENGAGEMENT_GOAL_SPECS[engagementGoal].billingEvent
            : spec.billingEvent;

    const body: Record<string, unknown> = {
      advertiser_id: input.advertiserId,
      campaign_id: campaignId,
      adgroup_name: (input.adGroupName?.trim() || `${input.campaignName.trim()} — مجموعة`).slice(0, 512),
      promotion_type: promotionType,
      placement_type: automatic ? 'PLACEMENT_TYPE_AUTOMATIC' : 'PLACEMENT_TYPE_NORMAL',
      location_ids: input.locationIds,
      gender: input.gender && GENDERS.includes(input.gender) ? input.gender : 'GENDER_UNLIMITED',
      budget_mode: input.budgetMode,
      budget: Number(input.budget),
      schedule_type: ranged ? 'SCHEDULE_START_END' : 'SCHEDULE_FROM_NOW',
      schedule_start_time: start,
      optimization_goal: optimizationGoal,
      billing_event: billingEvent,
      ...this.bidFields(input, billingEvent, optimizationGoal),
      pacing: input.bidStrategy === 'TARGET' && input.acceleratedDelivery ? 'PACING_MODE_FAST' : 'PACING_MODE_SMOOTH',
      comment_disabled: input.allowComments === false,
      video_download_disabled: input.allowDownload !== true,
      share_disabled: input.allowShare === false,
      operation_status: 'ENABLE',
    };
    if (input.objective === 'LEAD_GENERATION') {
      if (leadInstantForm) {
        body.promotion_target_type = 'INSTANT_PAGE';
      } else {
        body.promotion_target_type = 'EXTERNAL_WEBSITE';
      }
    }
    if (input.destination === 'INSTANT_PAGE' && input.objective !== 'LEAD_GENERATION') {
      body.promotion_website_type = 'TIKTOK_NATIVE_PAGE';
    }
    if (input.objective === 'TRAFFIC' && input.trafficDestination === 'TIKTOK_SHOP') {
      body.product_source = 'STORE';
    }
    if (input.objective === 'PRODUCT_SALES') {
      const storeSales = input.salesDestination === 'STORE' || !input.salesDestination;
      body.product_source = storeSales ? 'STORE' : 'CATALOG';
      if (storeSales) {
        body.shopping_ads_type = 'PRODUCT_SHOPPING_ADS';
      }
    }
    // قواعد المواضع حسب وثائق TikTok Marketing API:
    // - tiktok_subplacements مسموح فقط لـ REACH | VIDEO_VIEWS | ENGAGEMENT
    // - إرساله مع LEAD_GENERATION / WEB_CONVERSIONS / PRODUCT_SALES → Invalid selection
    // - PRODUCT_SALES يدعم PLACEMENT_TIKTOK فقط
    // - Smart+ Lead: مواضع تلقائية فقط (لا اختيار يدوي)
    this.applyConversionPlacementRules(body, input, {
      automatic,
      placements,
    });
    if (spec.requiresFrequency || input.objective === 'REACH' || (input.objective === 'VIDEO_VIEWS' && Number(input.frequency) > 0 && Number(input.frequencySchedule) > 0)) {
      const frequency = Math.max(1, Math.floor(Number(input.frequency ?? 3)));
      const schedule = Math.max(frequency, Math.min(30, Math.floor(Number(input.frequencySchedule ?? 7))));
      body.frequency = frequency;
      body.frequency_schedule = schedule;
    }
    if (input.objective === 'VIDEO_VIEWS') {
      const duration = input.cpvVideoDuration
        || (videoViewsGoal ? VIDEO_VIEWS_GOAL_SPECS[videoViewsGoal].cpvVideoDuration : 'SIX_SECONDS');
      body.cpv_video_duration = duration;
    }
    const ages = (input.ageGroups ?? []).filter((age) => (AGE_GROUPS as readonly string[]).includes(age));
    if (ages.length) body.age_groups = ages;
    const interests = (input.interestCategoryIds ?? []).map((id) => id.trim()).filter(Boolean);
    if (interests.length) body.interest_category_ids = interests;
    const languages = (input.languageCodes ?? []).map((code) => code.trim()).filter(Boolean);
    if (languages.length) body.languages = languages;
    if (input.spendingPower === 'HIGH') body.spending_power = 'HIGH';
    const includeAudience = (input.audienceIds ?? []).map((id) => id.trim()).filter(Boolean);
    if (includeAudience.length) body.audience_ids = includeAudience;
    const excludeAudience = (input.excludedAudienceIds ?? []).map((id) => id.trim()).filter(Boolean);
    if (excludeAudience.length) body.excluded_audience_ids = excludeAudience;
    if (input.smartInterestBehavior) body.smart_interest_behavior_enabled = true;
    if (ranged && input.scheduleEndDate) body.schedule_end_time = `${input.scheduleEndDate} 23:59:00`;
    const trafficNeedsPixel = Boolean(trafficGoal && TRAFFIC_GOAL_SPECS[trafficGoal].needsPixel);
    if ((spec.needsPixel || trafficNeedsPixel) && input.destination !== 'WHATSAPP' && input.destination !== 'INSTANT_PAGE' && input.pixelId) {
      body.pixel_id = input.pixelId;
      const defaultEvent = trafficGoal === 'ENGAGED_SESSION'
        ? 'ENGAGED_SESSION'
        : trafficGoal === 'TRAFFIC_LANDING_PAGE_VIEW'
          ? 'LANDING_PAGE_VIEW'
          : input.objective === 'LEAD_GENERATION'
            ? 'FORM'
            : input.objective === 'WEB_CONVERSIONS' || input.objective === 'PRODUCT_SALES'
              ? 'SHOPPING'
              : 'SHOPPING';
      body.optimization_event = normalizeOptimizationEvent(input.optimizationEvent, input.objective) || defaultEvent;
    }
    if (input.destination === 'INSTANT_PAGE' && input.pageId && input.objective !== 'LEAD_GENERATION') {
      body.page_id = input.pageId.trim();
    }
    if (input.objective === 'LEAD_GENERATION') {
      delete body.promotion_website_type;
      if (leadInstantForm) {
        // استمارة فورية: بدون بكسل؛ page_id يُرسل على مستوى الإعلان (creative)
        delete body.pixel_id;
        delete body.optimization_event;
        delete body.page_id;
      } else {
        delete body.page_id;
        if (!body.pixel_id && input.pixelId) {
          body.pixel_id = input.pixelId;
        }
        // موقع ويب → Submit Form (FORM)
        body.optimization_event = normalizeOptimizationEvent(input.optimizationEvent, 'LEAD_GENERATION') || 'FORM';
      }
    }
    if (input.objective === 'PRODUCT_SALES' && (input.salesDestination === 'STORE' || !input.salesDestination)) {
      body.optimization_event = 'SHOPPING';
      delete body.pixel_id;
    }
    // Web conversions: Purchase/Complete Payment = SHOPPING (ليس Place an Order)
    if (input.objective === 'WEB_CONVERSIONS' && body.pixel_id) {
      body.optimization_event = normalizeOptimizationEvent(
        String(body.optimization_event ?? input.optimizationEvent ?? ''),
        'WEB_CONVERSIONS',
      ) || 'SHOPPING';
    }
    if (input.objective === 'WEB_CONVERSIONS' || input.objective === 'PRODUCT_SALES') {
      if (input.clickAttributionWindow) body.click_attribution_window = input.clickAttributionWindow;
      if (input.viewAttributionWindow) body.view_attribution_window = input.viewAttributionWindow;
      if (input.attributionEventCount) body.attribution_event_count = input.attributionEventCount;
    }
    if ((spec.needsApp || (input.objective === 'TRAFFIC' && input.trafficDestination === 'APP')) && input.appId) {
      body.app_id = input.appId.trim();
    }
    if (input.objective === 'APP_PROMOTION') {
      body.app_promotion_type = input.appPromotionType === 'APP_RETARGETING' ? 'APP_RETARGETING' : 'APP_INSTALL';
    }
    // تيك توك يقبل قيمة واحدة فقط في operating_systems (ANDROID أو IOS).
    // لاستهداف الكل: لا تُرسل الحقل إطلاقاً — إرسال ['ANDROID','IOS'] يُفسَّر كأندرويد فقط.
    if (input.objective !== 'APP_PROMOTION' && !(input.objective === 'TRAFFIC' && input.trafficDestination === 'APP')) {
      if (input.devices === 'ANDROID') body.operating_systems = ['ANDROID'];
      else if (input.devices === 'IOS') body.operating_systems = ['IOS'];
      else {
        delete body.operating_systems;
      }
    }
    if (input.minAndroidVersion && (input.devices === 'ANDROID' || input.devices === 'ALL')) {
      body.min_android_version = input.minAndroidVersion;
    }
    if (input.minIosVersion && (input.devices === 'IOS' || input.devices === 'ALL')) {
      body.min_ios_version = input.minIosVersion;
    }
    const networks = (input.networkTypes ?? []).filter((item) => (NETWORK_TYPES as readonly string[]).includes(item));
    if (networks.length && networks.length < NETWORK_TYPES.length) body.network_types = networks;
    const carriers = (input.carrierIds ?? []).map((id) => id.trim()).filter(Boolean);
    if (carriers.length) body.carrier_ids = carriers;
    const isps = (input.ispIds ?? []).map((id) => id.trim()).filter(Boolean);
    if (isps.length) body.isp_ids = isps;
    if (input.devicePriceMode === 'RANGE') {
      const min = Math.max(0, Number(input.devicePriceMin) || 0);
      const max = Math.max(min + 1, Number(input.devicePriceMax) || min + 1);
      body.device_price_ranges = [min, max];
    }
    if (input.dayparting && /^[01]{336}$/.test(input.dayparting)) body.dayparting = input.dayparting;
    return body;
  }

  /**
   * يضبط مواضع LEAD / WEB_CONVERSIONS / PRODUCT_SALES (وباقي الأهداف).
   * مهم: لا ترسل tiktok_subplacements إلا لـ REACH | VIDEO_VIEWS | ENGAGEMENT.
   */
  private applyConversionPlacementRules(
    body: Record<string, unknown>,
    input: PublishTikTokAdInput,
    opts: { automatic: boolean; placements: string[] },
  ) {
    const objective = input.objective;
    const stripSubs = () => {
      delete body.tiktok_subplacements;
    };
    const stripAllPlacementDetails = () => {
      delete body.placements;
      delete body.tiktok_subplacements;
      delete body.search_result_enabled;
    };

    if (objective === 'LEAD_GENERATION') {
      if (input.smartPlus) {
        body.placement_type = 'PLACEMENT_TYPE_AUTOMATIC';
        stripAllPlacementDetails();
        return;
      }
      // يدوي: تيك توك فقط — بدون tiktok_subplacements (غير مدعوم لهذا الهدف)
      body.placement_type = 'PLACEMENT_TYPE_NORMAL';
      body.placements = ['PLACEMENT_TIKTOK'];
      stripSubs();
      delete body.search_result_enabled;
      return;
    }

    if (objective === 'PRODUCT_SALES') {
      // وثائق API: PRODUCT_SALES = PLACEMENT_TIKTOK فقط
      body.placement_type = 'PLACEMENT_TYPE_NORMAL';
      body.placements = ['PLACEMENT_TIKTOK'];
      stripSubs();
      delete body.search_result_enabled;
      return;
    }

    if (objective === 'WEB_CONVERSIONS') {
      // Smart+ Web و اليدوي: تيك توك يقبل فقط PLACEMENT_TYPE_NORMAL لهذا الهدف
      body.placement_type = 'PLACEMENT_TYPE_NORMAL';
      body.placements = ['PLACEMENT_TIKTOK'];
      stripSubs();
      delete body.search_result_enabled;
      return;
    }

    // باقي الأهداف (REACH / TRAFFIC / VIDEO_VIEWS / ENGAGEMENT / APP…)
    if (opts.automatic) {
      body.placement_type = 'PLACEMENT_TYPE_AUTOMATIC';
      stripAllPlacementDetails();
      return;
    }
    body.placement_type = 'PLACEMENT_TYPE_NORMAL';
    body.placements = opts.placements.length ? opts.placements : ['PLACEMENT_TIKTOK'];
    const allowsSubplacements = objective === 'REACH' || objective === 'VIDEO_VIEWS' || objective === 'ENGAGEMENT';
    if (allowsSubplacements && (body.placements as string[]).includes('PLACEMENT_TIKTOK')) {
      const allowedSubs = ['IN_FEED', 'TIKTOK_LITE', 'SEARCH_FEED', 'LEMON8'] as const;
      const requested = (input.tiktokSubplacements ?? []).filter((item): item is (typeof allowedSubs)[number] =>
        (allowedSubs as readonly string[]).includes(item),
      );
      const subs = requested.length
        ? requested
        : [
            'IN_FEED' as const,
            ...(input.includeSearchResult !== false && objective === 'REACH' ? ['SEARCH_FEED' as const] : []),
          ];
      if (subs.length) body.tiktok_subplacements = Array.from(new Set(subs));
    } else {
      stripSubs();
      if (input.includeSearchResult === true && (body.placements as string[]).includes('PLACEMENT_TIKTOK')) {
        body.search_result_enabled = true;
      }
    }
  }

  private savedBid(group: Record<string, unknown> | undefined) {
    const bidType = String(group?.bid_type ?? '');
    const cost = Number(group?.conversion_bid_price ?? group?.bid_price ?? 0);
    if (bidType === 'BID_TYPE_CUSTOM' && cost > 0) return { bidStrategy: 'TARGET' as const, targetCost: cost };
    return { bidStrategy: 'HIGHEST' as const, targetCost: 0 };
  }

  private bidFields(input: PublishTikTokAdInput, billingEvent?: string, optimizationGoal?: string) {
    if (input.bidStrategy !== 'TARGET') return { bid_type: 'BID_TYPE_NO_BID' };
    const spec = OBJECTIVE_SPECS[input.objective];
    const event = billingEvent || spec.billingEvent;
    const goal = optimizationGoal || spec.optimizationGoal;
    const cost = Number(input.targetCost);
    const usesConversionBid = event === 'OCPM' && goal !== 'FOLLOWERS' && goal !== 'PAGE_VISIT';
    return usesConversionBid
      ? { bid_type: 'BID_TYPE_CUSTOM', conversion_bid_price: cost }
      : { bid_type: 'BID_TYPE_CUSTOM', bid_price: cost };
  }

  private async identityFields(
    token: string,
    advertiserId: string,
    identityId: string,
    identityType: string,
    hintedBc?: string,
  ) {
    const fields: Record<string, string> = {
      identity_id: identityId,
      identity_type: identityType,
    };
    if (identityType !== 'BC_AUTH_TT') return fields;
    let bcId = hintedBc?.trim() || '';
    if (!bcId) {
      const identities = await this.ads.listIdentities(token, advertiserId).catch(() => []);
      bcId = identities.find((row) => row.identityId === identityId && row.identityType === 'BC_AUTH_TT')?.identityAuthorizedBcId || '';
    }
    if (!bcId) {
      const center = await this.ads.resolveAdvertiserBusinessCenter(token, advertiserId).catch(() => null);
      bcId = center?.bc_id ?? '';
    }
    if (!bcId) {
      throw new BadRequestException('حساب تيك توك مرتبط بمركز أعمال، لكن معرّف المركز غير مطابق. أعد اختيار الحساب ثم انشر من جديد.');
    }
    fields.identity_authorized_bc_id = bcId;
    return fields;
  }

  private deviceChoice(value: unknown): 'ALL' | 'ANDROID' | 'IOS' {
    const systems = Array.isArray(value) ? value.map(String) : [];
    if (systems.length === 1 && systems[0] === 'ANDROID') return 'ANDROID';
    if (systems.length === 1 && systems[0] === 'IOS') return 'IOS';
    return 'ALL';
  }

  private formatTikTokTime(date: Date, timeZone: string) {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(date);
      const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
      return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
    } catch {
      return date.toISOString().slice(0, 19).replace('T', ' ');
    }
  }

  private async trackingUrlsForAdvertiser(
    teamId: string | undefined,
    advertiserId: string,
    pixels: Array<{ pixel_id: string; pixel_code: string }>,
  ) {
    const urls = new Map<string, string>();
    if (!teamId || !pixels.length) return urls;
    const ids = [...new Set(pixels.flatMap((pixel) => [pixel.pixel_id, pixel.pixel_code].filter(Boolean)))];
    const rows = await this.prisma.tikTokIntegration.findMany({
      where: {
        teamId,
        OR: [
          { advertiserId },
          ...(ids.length ? [{ pixelId: { in: ids } }, { pixelCode: { in: ids } }] : []),
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        advertiserId: true,
        pixelId: true,
        pixelCode: true,
        redirectSlug: true,
        defaultOptimizationEvent: true,
        customEventName: true,
        updatedAt: true,
      },
    });
    for (const pixel of pixels) {
      const matches = rows.filter(
        (item) =>
          item.pixelId === pixel.pixel_id ||
          item.pixelCode === pixel.pixel_id ||
          item.pixelCode === pixel.pixel_code ||
          item.pixelId === pixel.pixel_code,
      );
      const row = matches.find((item) => item.advertiserId === advertiserId) ?? matches[0];
      if (!row?.redirectSlug) continue;
      const url = this.integrationTrackingUrl(row);
      if (pixel.pixel_id) urls.set(pixel.pixel_id, url);
      if (pixel.pixel_code) urls.set(pixel.pixel_code, url);
    }
    return urls;
  }

  private async pixelTrackingUrl(teamId: string, advertiserId: string, pixelId: string) {
    const rows = await this.prisma.tikTokIntegration.findMany({
      where: {
        teamId,
        OR: [{ pixelId }, { pixelCode: pixelId }],
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        advertiserId: true,
        pixelId: true,
        pixelCode: true,
        redirectSlug: true,
        defaultOptimizationEvent: true,
        customEventName: true,
      },
    });
    const row = rows.find((item) => item.advertiserId === advertiserId) ?? rows[0];
    if (!row?.redirectSlug) return '';
    return this.integrationTrackingUrl(row);
  }

  private integrationTrackingUrl(row: {
    redirectSlug: string;
    defaultOptimizationEvent: Parameters<typeof conversionEventName>[0]['defaultOptimizationEvent'];
    customEventName: string | null;
  }) {
    const web = this.config.get<string>('WEB_PUBLIC_URL')?.replace(/\/$/, '') || 'https://www.chatloora.com';
    return buildConversionTrackingUrl(
      web,
      row.redirectSlug,
      conversionEventName({
        defaultOptimizationEvent: row.defaultOptimizationEvent,
        customEventName: row.customEventName,
      }),
    );
  }

  private async rememberCampaign(
    userId: string,
    teamId: string,
    input: PublishTikTokAdInput,
    campaignId: string,
    adGroupId: string,
  ) {
    const existing = await this.prisma.tikTokMarketingCampaign.findFirst({
      where: { userId, campaignId },
    });
    const data = {
      name: input.campaignName.trim(),
      status: 'ENABLE',
      budget: input.budget,
      objective: input.objective,
      syncedAt: new Date(),
      raw: { adGroupId, timezone: input.timezone ?? null, scheduleMode: input.scheduleMode ?? 'CONTINUOUS' },
    };
    if (existing) {
      await this.prisma.tikTokMarketingCampaign.update({ where: { id: existing.id }, data });
      return;
    }
    await this.prisma.tikTokMarketingCampaign.create({
      data: {
        userId,
        teamId,
        advertiserId: input.advertiserId,
        campaignId,
        ...data,
      },
    });
  }

  /** أغلفة خفيفة للقائمة: video info + image covers + oembed — بدون identity video info */
  private async lightPostersForAds(
    token: string,
    advertiserId: string,
    ads: Array<Record<string, unknown>>,
  ) {
    const byAd = new Map<string, { posterUrl: string; videoUrl: string }>();
    const videoIds = ads.map((row) => String(row.video_id ?? '')).filter(Boolean);
    const fileInfo = await this.ads.videoFileInfo(token, advertiserId, videoIds).catch(() => []);
    const coverByVideo = new Map<string, { posterUrl: string; videoUrl: string }>();
    for (const file of fileInfo) {
      const media = readTikTokMedia(file);
      const videoId = String(file.video_id ?? media.videoId ?? '');
      if (videoId) coverByVideo.set(videoId, { posterUrl: media.posterUrl, videoUrl: media.videoUrl });
    }
    const missingImageIds: string[] = [];
    for (const ad of ads) {
      const adId = String(ad.ad_id ?? '');
      if (!adId) continue;
      const raw = readTikTokMedia(ad);
      const file = coverByVideo.get(String(ad.video_id ?? raw.videoId ?? ''));
      const posterUrl = raw.posterUrl || file?.posterUrl || '';
      byAd.set(adId, { posterUrl, videoUrl: '' }); // light: لا نمرّر فيديو ثقيل في القائمة
      if (!posterUrl) missingImageIds.push(...imageIdsOf(ad));
    }
    if (missingImageIds.length) {
      const images = await this.ads.imageCovers(token, advertiserId, missingImageIds).catch(() => new Map<string, string>());
      for (const ad of ads) {
        const current = byAd.get(String(ad.ad_id ?? ''));
        if (!current || current.posterUrl) continue;
        for (const imageId of imageIdsOf(ad)) {
          const posterUrl = images.get(imageId);
          if (posterUrl) {
            current.posterUrl = posterUrl;
            break;
          }
        }
      }
    }
    let stillMissing = ads
      .filter((ad) => {
        const current = byAd.get(String(ad.ad_id ?? ''));
        return Boolean(current && !current.posterUrl && ad.tiktok_item_id);
      })
      .map((ad) => String(ad.tiktok_item_id ?? ''));
    if (stillMissing.length) {
      const sparks = await this.ads.listSparkMedia(token, advertiserId).catch(() => new Map<string, { posterUrl: string; videoUrl: string; text: string }>());
      for (const ad of ads) {
        const current = byAd.get(String(ad.ad_id ?? ''));
        const itemId = String(ad.tiktok_item_id ?? '');
        if (!current || current.posterUrl || !itemId) continue;
        const spark = sparks.get(itemId);
        if (spark?.posterUrl) current.posterUrl = spark.posterUrl;
      }
      stillMissing = ads
        .filter((ad) => {
          const current = byAd.get(String(ad.ad_id ?? ''));
          return Boolean(current && !current.posterUrl && ad.tiktok_item_id);
        })
        .map((ad) => String(ad.tiktok_item_id ?? ''));
    }
    if (stillMissing.length) {
      const covers = await this.ads.publicItemCovers(stillMissing).catch(() => new Map<string, string>());
      for (const ad of ads) {
        const current = byAd.get(String(ad.ad_id ?? ''));
        const itemId = String(ad.tiktok_item_id ?? '');
        if (!current || current.posterUrl || !itemId) continue;
        current.posterUrl = covers.get(itemId) || current.posterUrl;
      }
    }
    return byAd;
  }

  private async mediaForAds(
    token: string,
    advertiserId: string,
    ads: Array<Record<string, unknown>>,
    fileInfo: Array<Record<string, unknown>>,
  ) {
    const coverByVideo = new Map<string, { posterUrl: string; videoUrl: string }>();
    for (const file of fileInfo) {
      const media = readTikTokMedia(file);
      const videoId = String(file.video_id ?? media.videoId ?? '');
      if (videoId) coverByVideo.set(videoId, { posterUrl: media.posterUrl, videoUrl: media.videoUrl });
    }
    const postMedia = new Map<string, { posterUrl: string; videoUrl: string }>();
    const identityGroups = new Map<string, { identityId: string; identityType: string; itemIds: string[] }>();
    for (const ad of ads) {
      const itemId = String(ad.tiktok_item_id ?? '');
      const identityId = String(ad.identity_id ?? '');
      const identityType = String(ad.identity_type ?? '');
      if (!itemId || !identityId || !identityType) continue;
      const key = `${identityType}:${identityId}`;
      const group = identityGroups.get(key) ?? { identityId, identityType, itemIds: [] };
      if (!group.itemIds.includes(itemId)) group.itemIds.push(itemId);
      identityGroups.set(key, group);
    }
    const center = await this.ads.resolveAdvertiserBusinessCenter(token, advertiserId).catch(() => null);
    await Promise.all(
      [...identityGroups.values()].map(async (group) => {
        const rows = await this.ads
          .identityVideoInfo(token, advertiserId, group.identityId, group.identityType, group.itemIds, center?.bc_id)
          .catch(() => []);
        for (const row of rows) {
          const media = readTikTokMedia(row);
          if (media.itemId && (media.posterUrl || media.videoUrl)) {
            postMedia.set(media.itemId, { posterUrl: media.posterUrl, videoUrl: media.videoUrl });
          }
        }
      }),
    );
    const byAd = new Map<string, { posterUrl: string; videoUrl: string }>();
    const missingImageIds: string[] = [];
    for (const ad of ads) {
      const adId = String(ad.ad_id ?? '');
      const raw = readTikTokMedia(ad);
      const itemId = String(ad.tiktok_item_id ?? raw.itemId ?? '');
      const file = coverByVideo.get(String(ad.video_id ?? raw.videoId ?? ''));
      const post = postMedia.get(itemId);
      const posterUrl = post?.posterUrl || raw.posterUrl || file?.posterUrl || '';
      const videoUrl = post?.videoUrl || raw.videoUrl || file?.videoUrl || '';
      if (adId) byAd.set(adId, { posterUrl, videoUrl });
      if (!posterUrl) missingImageIds.push(...imageIdsOf(ad));
    }
    if (missingImageIds.length) {
      const images = await this.ads.imageCovers(token, advertiserId, missingImageIds).catch(() => new Map<string, string>());
      for (const ad of ads) {
        const current = byAd.get(String(ad.ad_id ?? ''));
        if (!current || current.posterUrl) continue;
        for (const imageId of imageIdsOf(ad)) {
          const posterUrl = images.get(imageId);
          if (posterUrl) {
            current.posterUrl = posterUrl;
            break;
          }
        }
      }
    }
    const needsSpark = ads.some((ad) => {
      const current = byAd.get(String(ad.ad_id ?? ''));
      return Boolean(current && !current.posterUrl && !current.videoUrl && ad.tiktok_item_id);
    });
    if (needsSpark) {
      const sparks = await this.ads.listSparkMedia(token, advertiserId).catch(() => new Map<string, { posterUrl: string; videoUrl: string; text: string }>());
      for (const ad of ads) {
        const current = byAd.get(String(ad.ad_id ?? ''));
        const itemId = String(ad.tiktok_item_id ?? '');
        if (!current || current.posterUrl || !itemId) continue;
        const spark = sparks.get(itemId);
        if (!spark) continue;
        current.posterUrl = current.posterUrl || spark.posterUrl;
        current.videoUrl = current.videoUrl || spark.videoUrl;
      }
    }
    const stillMissing = ads
      .filter((ad) => {
        const current = byAd.get(String(ad.ad_id ?? ''));
        return Boolean(current && !current.posterUrl && ad.tiktok_item_id);
      })
      .map((ad) => String(ad.tiktok_item_id ?? ''));
    if (stillMissing.length) {
      const covers = await this.ads.publicItemCovers(stillMissing).catch(() => new Map<string, string>());
      for (const ad of ads) {
        const current = byAd.get(String(ad.ad_id ?? ''));
        const itemId = String(ad.tiktok_item_id ?? '');
        if (!current || current.posterUrl || !itemId) continue;
        current.posterUrl = covers.get(itemId) || current.posterUrl;
      }
    }
    return byAd;
  }

  async performance(
    userId: string,
    advertiserId: string,
    startDate?: string,
    endDate?: string,
    options?: { light?: boolean },
  ) {
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    const end = endDate || new Date().toISOString().slice(0, 10);
    const start = startDate || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const light = Boolean(options?.light);
    const [campaigns, groups, report, profile, classicAds, smartAds, adReport] = await Promise.all([
      this.ads.listCampaignRows(token, advertiserId).catch(() => []),
      this.ads.listAdGroupRows(token, advertiserId).catch(() => []),
      this.ads.campaignReport(token, advertiserId, start, end).catch(() => []),
      this.ads.getAdvertiserProfile(token, advertiserId).catch(() => null),
      this.ads.listAdRows(token, advertiserId).catch(() => []),
      this.ads.listSmartPlusAdRows(token, advertiserId).catch(() => []),
      this.ads.adReport(token, advertiserId, start, end).catch(() => []),
    ]);
    const adsById = new Map<string, Record<string, unknown>>();
    for (const row of [...classicAds, ...smartAds]) {
      const id = String(row.ad_id ?? '');
      if (id && !adsById.has(id)) adsById.set(id, row);
    }
    const ads = [...adsById.values()];
    // light: أغلفة فقط (بدون identity/spark الثقيل) حتى تظهر معاينات الفيديو بسرعة
    const mediaByAd = light
      ? await this.lightPostersForAds(token, advertiserId, ads).catch(
          () => new Map<string, { posterUrl: string; videoUrl: string }>(),
        )
      : await this.mediaForAds(
        token,
        advertiserId,
        ads,
        await this.ads.videoFileInfo(token, advertiserId, ads.map((row) => String(row.video_id ?? ''))).catch(() => []),
      ).catch(() => new Map<string, { posterUrl: string; videoUrl: string }>());
    const videosByCampaign = new Map<string, Array<{ adId: string; adGroupId: string; itemId: string; identityId: string; identityType: string; text: string; posterUrl: string; videoUrl: string; status: string; spend: number; impressions: number; reach: number; clicks: number; conversions: number; costPerConversion: number; conversionRate: number }>>();
    const adStats = new Map<string, Record<string, unknown>>();
    for (const row of adReport) {
      const dimensions = (row.dimensions ?? {}) as Record<string, unknown>;
      const metrics = (row.metrics ?? row) as Record<string, unknown>;
      const adId = String(dimensions.ad_id ?? row.ad_id ?? '');
      if (adId) adStats.set(adId, metrics);
    }
    for (const ad of ads) {
      const campaignId = String(ad.campaign_id ?? '');
      const status = String(ad.operation_status ?? 'ENABLE');
      if (!campaignId || status === 'DELETE') continue;
      const adId = String(ad.ad_id ?? '');
      const raw = readTikTokMedia(ad);
      const stored = mediaByAd.get(adId);
      const itemId = String(ad.tiktok_item_id ?? raw.itemId ?? '');
      const metric = adStats.get(adId) ?? {};
      const spend = Number(metric.spend ?? 0);
      const conversions = Number(metric.conversion ?? 0);
      const rate = Number(metric.conversion_rate ?? 0);
      const video = {
        adId,
        adGroupId: String(ad.adgroup_id ?? ''),
        itemId,
        identityId: String(ad.identity_id ?? ''),
        identityType: String(ad.identity_type ?? ''),
        text: String(ad.ad_name ?? ad.ad_text ?? raw.text ?? ''),
        posterUrl: stored?.posterUrl || raw.posterUrl || '',
        videoUrl: stored?.videoUrl || raw.videoUrl || '',
        status,
        spend,
        impressions: Number(metric.impressions ?? 0),
        reach: Number(metric.reach ?? 0),
        clicks: Number(metric.clicks ?? 0),
        conversions,
        costPerConversion: Number(metric.cost_per_conversion ?? (conversions > 0 ? spend / conversions : 0)),
        conversionRate: rate,
      };
      const list = videosByCampaign.get(campaignId) ?? [];
      list.push(video);
      videosByCampaign.set(campaignId, list);
    }
    const groupByCampaign = new Map<string, { adGroupId: string; budget: number }>();
    const groupsByCampaign = new Map<string, Array<{ adGroupId: string; name: string; status: string; deliveryStatus: string; budget: number }>>();
    for (const group of groups) {
      const campaignId = String(group.campaign_id ?? '');
      if (!campaignId) continue;
      const status = String(group.operation_status ?? 'ENABLE');
      if (status === 'DELETE') continue;
      const row = {
        adGroupId: String(group.adgroup_id ?? ''),
        name: String(group.adgroup_name ?? 'مجموعة إعلانية'),
        status,
        deliveryStatus: String(group.secondary_status ?? status),
        budget: Number(group.budget ?? 0),
      };
      const list = groupsByCampaign.get(campaignId) ?? [];
      list.push(row);
      groupsByCampaign.set(campaignId, list);
      if (!groupByCampaign.has(campaignId)) {
        groupByCampaign.set(campaignId, { adGroupId: row.adGroupId, budget: row.budget });
      }
    }
    const stats = new Map<string, Record<string, unknown>>();
    for (const row of report) {
      const dimensions = (row.dimensions ?? {}) as Record<string, unknown>;
      const metrics = (row.metrics ?? row) as Record<string, unknown>;
      const campaignId = String(dimensions.campaign_id ?? row.campaign_id ?? '');
      if (campaignId) stats.set(campaignId, metrics);
    }
    return {
      currency: profile?.currency ?? null,
      timezone: profile?.timezone ?? null,
      startDate: start,
      endDate: end,
      campaigns: campaigns.map((row) => {
        const campaignId = String(row.campaign_id ?? '');
        const metric = stats.get(campaignId) ?? {};
        const group = groupByCampaign.get(campaignId);
        const spend = Number(metric.spend ?? 0);
        const conversions = Number(metric.conversion ?? 0);
        const rate = Number(metric.conversion_rate ?? 0);
        return {
          campaignId,
          name: String(row.campaign_name ?? ''),
          status: String(row.operation_status ?? 'ENABLE'),
          deliveryStatus: String(row.secondary_status ?? row.operation_status ?? ''),
          objective: String(row.objective_type ?? ''),
          budget: group?.budget || Number(row.budget ?? 0),
          adGroupId: group?.adGroupId ?? '',
          adGroups: groupsByCampaign.get(campaignId) ?? [],
          spend,
          impressions: Number(metric.impressions ?? 0),
          reach: Number(metric.reach ?? 0),
          clicks: Number(metric.clicks ?? 0),
          conversions,
          costPerConversion: Number(metric.cost_per_conversion ?? (conversions > 0 ? spend / conversions : 0)),
          conversionRate: rate,
          videos: videosByCampaign.get(campaignId) ?? [],
        };
      }),
    };
  }

  async campaignDetail(userId: string, advertiserId: string, campaignId: string) {
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    const adGroupFields = [
      'adgroup_id', 'campaign_id', 'adgroup_name', 'budget', 'budget_mode',
      'location_ids', 'gender', 'age_groups', 'interest_category_ids',
      'pixel_id', 'optimization_event', 'schedule_type', 'schedule_start_time', 'schedule_end_time',
      'dayparting', 'operating_systems', 'app_id',
      'bid_type', 'bid_price', 'conversion_bid_price',
    ];
    const adFields = [
      'ad_id', 'ad_name', 'ad_text', 'campaign_id', 'adgroup_id', 'video_id', 'tiktok_item_id',
      'identity_id', 'identity_type', 'identity_authorized_bc_id', 'operation_status', 'call_to_action', 'landing_page_url',
    ];
    const [campaigns, groups, ads] = await Promise.all([
      this.ads.listForCampaign(token, '/campaign/get/', advertiserId, campaignId).catch(() => this.ads.listCampaignRows(token, advertiserId)),
      this.ads.listForCampaign(token, '/adgroup/get/', advertiserId, campaignId, adGroupFields)
        .catch(() => this.ads.listForCampaign(token, '/adgroup/get/', advertiserId, campaignId))
        .catch(() => this.ads.listAdGroupRows(token, advertiserId)),
      this.ads.listForCampaign(token, '/ad/get/', advertiserId, campaignId, adFields).catch(() => this.ads.listAdRows(token, advertiserId)),
    ]);
    const campaign = campaigns.find((row) => String(row.campaign_id ?? '') === campaignId) ?? campaigns[0];
    if (!campaign) throw new BadRequestException('الحملة غير موجودة');
    const group = groups.find((row) => String(row.campaign_id ?? '') === campaignId) ?? groups[0];
    const adRows = ads.filter((row) => String(row.campaign_id ?? campaignId) === campaignId && String(row.operation_status ?? 'ENABLE') !== 'DELETE');
    const files = await this.ads.videoFileInfo(token, advertiserId, adRows.map((row) => String(row.video_id ?? ''))).catch(() => []);
    const mediaByAd = await this.mediaForAds(token, advertiserId, adRows, files).catch(() => new Map());
    const landing = String(adRows[0]?.landing_page_url ?? '');
    const whatsapp = landing.match(/wa\.me\/(\d+)/);
    const start = String(group?.schedule_start_time ?? '');
    const end = String(group?.schedule_end_time ?? '');
    const strings = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
    return {
      campaignId,
      adGroupId: String(group?.adgroup_id ?? ''),
      name: String(campaign.campaign_name ?? ''),
      objective: String(campaign.objective_type ?? 'TRAFFIC'),
      budget: Number(group?.budget ?? campaign.budget ?? 0),
      budgetMode: String(group?.budget_mode ?? 'BUDGET_MODE_DAY'),
      locationIds: strings(group?.location_ids),
      gender: String(group?.gender ?? 'GENDER_UNLIMITED'),
      ageGroups: strings(group?.age_groups),
      interestCategoryIds: strings(group?.interest_category_ids),
      pixelId: String(group?.pixel_id ?? ''),
      optimizationEvent: String(group?.optimization_event ?? 'SHOPPING'),
      scheduleMode: String(group?.schedule_type ?? '') === 'SCHEDULE_START_END' ? 'RANGE' : 'CONTINUOUS',
      scheduleStartDate: start.slice(0, 10),
      scheduleEndDate: end.slice(0, 10),
      dayparting: typeof group?.dayparting === 'string' ? group.dayparting : '',
      devices: this.deviceChoice(group?.operating_systems),
      callToAction: String(adRows[0]?.call_to_action ?? 'CONTACT_US'),
      landingPageUrl: landing,
      destination: whatsapp ? 'WHATSAPP' : 'PIXEL',
      whatsappNumber: whatsapp?.[1] ?? '',
      appId: String(group?.app_id ?? ''),
      ...this.savedBid(group),
      creatives: adRows.map((row) => {
        const media = readTikTokMedia(row);
        const stored = mediaByAd.get(String(row.ad_id ?? ''));
        return {
          adId: String(row.ad_id ?? ''),
          itemId: String(row.tiktok_item_id ?? media.itemId ?? ''),
          identityId: String(row.identity_id ?? ''),
          identityType: String(row.identity_type ?? ''),
          identityAuthorizedBcId: String(row.identity_authorized_bc_id ?? ''),
          name: String(row.ad_name ?? ''),
          text: String(row.ad_name ?? row.ad_text ?? media.text ?? ''),
          posterUrl: stored?.posterUrl || media.posterUrl || '',
          videoUrl: stored?.videoUrl || media.videoUrl || '',
        };
      }),
    };
  }

  private async updateExisting(userId: string, teamId: string, input: PublishTikTokAdInput) {
    input = this.normalizeSchedule(input);
    this.validate(input);
    const token = await this.tokenForAdvertiser(userId, input.advertiserId);
    const landingPageUrl = input.destination === 'WHATSAPP'
      ? `https://wa.me/${(input.whatsappNumber ?? '').replace(/\D/g, '')}`
      : input.landingPageUrl?.trim() || (await this.resolveLandingUrl(teamId, input));
    const campaignId = input.campaignId!;
    const adGroupId = input.adGroupId!;
    try {
      await this.ads.updateCampaignName(token, input.advertiserId, campaignId, input.campaignName.trim());
      const useSmartPlus = Boolean(input.smartPlus && OBJECTIVE_SPECS[input.objective].allowsSmartPlus)
        || await this.ads.isUpgradedSmartPlusCampaign(token, input.advertiserId, campaignId);
      const body = this.adGroupBody(input, input.timezone || null, campaignId);
      const promotionType = String(body.promotion_type || OBJECTIVE_SPECS[input.objective].promotionType || 'WEBSITE');
      delete body.promotion_type;
      delete body.optimization_goal;
      delete body.billing_event;
      delete body.placement_type;
      delete body.placements;
      delete body.pacing;
      delete body.operation_status;
      delete body.campaign_id;
      delete body.cpv_video_duration;
      body.adgroup_id = adGroupId;
      // تحديث المجموعة عبر الواجهة اليدوية يفشل على حملات Upgraded Smart+
      if (!useSmartPlus) {
        await this.ads.updateAdGroup(token, body);
      }
      const creatives = await this.resolveCreatives(token, input, landingPageUrl);
      const currentAds = (await this.ads.listAdRows(token, input.advertiserId).catch(() => [])).filter(
        (row) => String(row.campaign_id ?? '') === campaignId && String(row.adgroup_id ?? '') === adGroupId,
      );
      const kept = new Set(input.creatives.map((creative) => creative.adId).filter(Boolean));
      const disableIds = currentAds
        .map((row) => String(row.ad_id ?? ''))
        .filter((id) => id && !kept.has(id));
      const updates: Array<Record<string, unknown>> = [];
      const creates: Array<Record<string, unknown>> = [];
      creatives.forEach((creative, index) => {
        const adId = input.creatives[index]?.adId;
        if (adId) updates.push({ ...creative, ad_id: adId });
        else creates.push(creative);
      });
      if (updates.length && !useSmartPlus) {
        await this.ads.updateAds(token, input.advertiserId, adGroupId, updates);
      }
      const created = creates.length
        ? (useSmartPlus
          ? await this.ads.createSmartPlusAds(token, input.advertiserId, adGroupId, creates, {
            objectiveType: input.objective,
            promotionType,
            adName: input.adName?.trim() || String(creates[0]?.ad_name ?? '').trim() || undefined,
          })
          : await this.ads.createMarketingAds(token, input.advertiserId, adGroupId, creates))
        : [];
      if (disableIds.length) await this.ads.setAdStatus(token, input.advertiserId, disableIds, 'DISABLE');
      return {
        campaignId,
        adGroupId,
        adIds: [...updates.map((row) => String(row.ad_id)), ...created],
        landingPageUrl,
        campaignName: input.campaignName,
      };
    } catch (err) {
      throw new BadRequestException(this.message(err));
    }
  }

  async creativePreview(
    userId: string,
    input: { advertiserId: string; adId?: string; itemId?: string; identityId?: string; identityType?: string },
  ) {
    const token = await this.tokenForAdvertiser(userId, input.advertiserId);
    let posterUrl = '';
    let videoUrl = '';
    let text = '';
    let itemId = input.itemId?.trim() || '';
    let identityId = input.identityId?.trim() || '';
    let identityType = input.identityType?.trim() || '';
    let videoId = '';
    const imageIds: string[] = [];
    let callToAction = 'CONTACT_US';
    let landingPageUrl = '';
    if (input.adId) {
      const ads = await this.ads.listAdRows(token, input.advertiserId).catch(() => []);
      const ad = ads.find((row) => String(row.ad_id ?? '') === input.adId);
      if (ad) {
        const media = readTikTokMedia(ad);
        posterUrl = media.posterUrl;
        videoUrl = media.videoUrl;
        text = media.text;
        itemId = itemId || media.itemId;
        identityId = identityId || String(ad.identity_id ?? '');
        identityType = identityType || String(ad.identity_type ?? '');
        videoId = String(ad.video_id ?? '');
        callToAction = String(ad.call_to_action ?? callToAction);
        landingPageUrl = String(ad.landing_page_url ?? '');
        if (Array.isArray(ad.image_ids)) imageIds.push(...ad.image_ids.map(String));
      }
    }
    if (itemId && identityId && identityType) {
      const rows = await this.ads.identityVideoInfo(token, input.advertiserId, identityId, identityType, [itemId]).catch(() => []);
      const media = rows[0] ? readTikTokMedia(rows[0]) : null;
      posterUrl = posterUrl || media?.posterUrl || '';
      videoUrl = videoUrl || media?.videoUrl || '';
      text = text || media?.text || '';
      videoId = videoId || media?.videoId || '';
    }
    if (videoId && (!posterUrl || !videoUrl)) {
      const files = await this.ads.videoFileInfo(token, input.advertiserId, [videoId]).catch(() => []);
      const media = files[0] ? readTikTokMedia(files[0]) : null;
      posterUrl = posterUrl || media?.posterUrl || '';
      videoUrl = videoUrl || media?.videoUrl || '';
    }
    if (!posterUrl && imageIds.length) {
      posterUrl = await this.ads.imageCover(token, input.advertiserId, imageIds).catch(() => '');
    }
    if ((!posterUrl || !videoUrl) && itemId) {
      const sparks = await this.ads.listSparkMedia(token, input.advertiserId).catch(() => new Map());
      const spark = sparks.get(itemId);
      posterUrl = posterUrl || spark?.posterUrl || '';
      videoUrl = videoUrl || spark?.videoUrl || '';
      text = text || spark?.text || '';
    }
    if (!posterUrl && itemId) {
      posterUrl = await this.ads.publicItemCover(itemId);
    }
    let previewLink = '';
    if (!videoUrl && input.adId) {
      const preview = await this.ads.existingAdPreview(token, input.advertiserId, input.adId).catch(() => null);
      previewLink = preview?.previewLink ?? '';
    }
    if (!videoUrl && !previewLink && itemId && identityId && identityType) {
      const preview = await this.ads.materialPreview(token, input.advertiserId, {
        preview_type: 'ADS_CREATION',
        ad_format: 'SINGLE_VIDEO',
        identity_id: identityId,
        identity_type: identityType,
        tiktok_item_id: itemId,
        call_to_action: callToAction,
        ...(landingPageUrl ? { landing_page_url: landingPageUrl } : {}),
      }).catch(() => null);
      previewLink = preview?.previewLink ?? '';
    }
    if (!videoUrl && !previewLink && itemId) {
      previewLink = `https://www.tiktok.com/embed/v2/${itemId}`;
    }
    if (!posterUrl && !videoUrl && !previewLink) {
      throw new BadRequestException('لا تتوفر معاينة لهذا الفيديو من تيك توك');
    }
    return { posterUrl, videoUrl, previewLink, text, adId: input.adId ?? '', itemId };
  }

  async updateBudget(userId: string, advertiserId: string, adGroupId: string, budget: number) {
    if (!adGroupId) throw new BadRequestException('لا توجد مجموعة إعلانية لتعديل ميزانيتها');
    if (!Number.isFinite(budget) || budget <= 0) throw new BadRequestException('أدخل ميزانية أكبر من صفر');
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    try {
      await this.ads.updateAdGroupBudget(token, advertiserId, adGroupId, budget);
    } catch (err) {
      throw new BadRequestException(this.message(err));
    }
    return { adGroupId, budget };
  }

  async setCampaignDelivery(userId: string, advertiserId: string, campaignId: string, enabled: boolean) {
    if (!campaignId) throw new BadRequestException('الحملة غير موجودة');
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    const status = enabled ? 'ENABLE' : 'DISABLE';
    try {
      const liveStatus = await this.ads.setCampaignStatusLive(token, advertiserId, campaignId, status);
      // مزامنة المجموعات والإعلانات التابعة قدر الإمكان (كلاسيكي / Smart+)
      const [groups, ads] = await Promise.all([
        this.ads.listAdGroupRows(token, advertiserId).catch(() => []),
        this.ads.listAdRows(token, advertiserId).catch(() => []),
      ]);
      const groupIds = groups
        .filter((row) => String(row.campaign_id ?? '') === campaignId)
        .map((row) => String(row.adgroup_id ?? ''))
        .filter(Boolean);
      const adIds = ads
        .filter((row) => String(row.campaign_id ?? '') === campaignId)
        .map((row) => String(row.ad_id ?? ''))
        .filter(Boolean);
      await Promise.allSettled([
        ...groupIds.map((id) => this.ads.setAdGroupStatusLive(token, advertiserId, id, status)),
        ...adIds.map((id) => this.ads.setAdStatusLive(token, advertiserId, id, status)),
      ]);
      // Prefer requested status when TikTok readback is still stale.
      return { campaignId, status: liveStatus === status ? liveStatus : status };
    } catch (err) {
      throw new BadRequestException(this.message(err));
    }
  }

  async setCampaignVideoStatus(userId: string, advertiserId: string, adId: string, enabled: boolean) {
    if (!adId) throw new BadRequestException('الفيديو غير موجود');
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    try {
      const liveStatus = await this.ads.setAdStatusLive(
        token,
        advertiserId,
        adId,
        enabled ? 'ENABLE' : 'DISABLE',
      );
      return { adId, status: liveStatus };
    } catch (err) {
      throw new BadRequestException(this.message(err));
    }
  }

  async deleteCampaignVideo(userId: string, advertiserId: string, adId: string) {
    if (!adId) throw new BadRequestException('الفيديو غير موجود');
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    try {
      await this.ads.setAdStatusLive(token, advertiserId, adId, 'DELETE');
    } catch (err) {
      throw new BadRequestException(this.message(err));
    }
    return { adId };
  }

  async duplicateCampaignVideo(userId: string, advertiserId: string, adId: string) {
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    const ad = await this.campaignAd(token, advertiserId, adId);
    const itemId = String(ad.tiktok_item_id ?? '');
    const identityId = String(ad.identity_id ?? '');
    const identityType = String(ad.identity_type ?? '');
    const adGroupId = String(ad.adgroup_id ?? '');
    if (!itemId || !identityId || !identityType || !adGroupId) {
      throw new BadRequestException('لا يمكن تكرار هذا الفيديو لأن بياناته ناقصة على تيك توك');
    }
    const name = `${String(ad.ad_name ?? 'فيديو')} نسخة`.slice(0, 512);
    try {
      const identity = await this.identityFields(token, advertiserId, identityId, identityType, String(ad.identity_authorized_bc_id ?? ''));
      const created = await this.ads.createMarketingAds(token, advertiserId, adGroupId, [
        {
          ad_name: name,
          ad_format: 'SINGLE_VIDEO',
          ...identity,
          tiktok_item_id: itemId,
          call_to_action: String(ad.call_to_action ?? 'CONTACT_US'),
          ...(ad.landing_page_url ? { landing_page_url: String(ad.landing_page_url) } : {}),
        },
      ]);
      return {
        adId: created[0] ?? '',
        adGroupId,
        itemId,
        identityId,
        identityType,
        text: name,
        status: 'ENABLE',
      };
    } catch (err) {
      throw new BadRequestException(this.message(err));
    }
  }

  async replaceCampaignVideo(
    userId: string,
    advertiserId: string,
    adId: string,
    input: { itemId?: string; identityId?: string; identityType?: string; authCode?: string },
  ) {
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    const ad = await this.campaignAd(token, advertiserId, adId);
    let itemId = input.itemId?.trim() || '';
    let identityId = input.identityId?.trim() || String(ad.identity_id ?? '');
    let identityType = input.identityType?.trim() || String(ad.identity_type ?? '');
    let hintedBc = String(ad.identity_authorized_bc_id ?? '');
    if (input.authCode?.trim()) {
      const preview = await this.ads.previewSparkCode(token, advertiserId, input.authCode);
      itemId = preview.itemId;
      identityId = preview.identityId || identityId;
      identityType = preview.identityType || identityType || 'AUTH_CODE';
      hintedBc = preview.identityAuthorizedBcId || hintedBc;
    }
    if (!itemId || !identityId || !identityType) throw new BadRequestException('اختر فيديو بديلاً أو أدخل كود الإعلان');
    const adGroupId = String(ad.adgroup_id ?? '');
    const identity = await this.identityFields(token, advertiserId, identityId, identityType, hintedBc);
    try {
      await this.ads.updateAds(token, advertiserId, adGroupId, [
        {
          ad_id: adId,
          ad_name: String(ad.ad_name ?? 'فيديو').slice(0, 512),
          ad_format: 'SINGLE_VIDEO',
          ...identity,
          tiktok_item_id: itemId,
          call_to_action: String(ad.call_to_action ?? 'CONTACT_US'),
          ...(ad.landing_page_url ? { landing_page_url: String(ad.landing_page_url) } : {}),
        },
      ]);
    } catch (err) {
      throw new BadRequestException(this.message(err));
    }
    const rows = await this.ads.identityVideoInfo(token, advertiserId, identityId, identityType, [itemId]).catch(() => []);
    const media = rows[0] ? readTikTokMedia(rows[0]) : null;
    return {
      adId,
      adGroupId,
      itemId,
      identityId,
      identityType,
      text: String(ad.ad_name ?? media?.text ?? ''),
      posterUrl: media?.posterUrl ?? '',
      videoUrl: media?.videoUrl ?? '',
      status: String(ad.operation_status ?? 'ENABLE'),
    };
  }

  private async campaignAd(token: string, advertiserId: string, adId: string) {
    if (!adId) throw new BadRequestException('الفيديو غير موجود');
    const ads = await this.ads.listAdRows(token, advertiserId);
    const ad = ads.find((row) => String(row.ad_id ?? '') === adId);
    if (!ad || String(ad.operation_status ?? '') === 'DELETE') throw new BadRequestException('الفيديو غير موجود في هذه الحملة');
    return ad;
  }

  async renameCampaign(userId: string, advertiserId: string, campaignId: string, name: string) {
    const next = name.trim().slice(0, 512);
    if (!campaignId || !next) throw new BadRequestException('أدخل اسماً للحملة');
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    try {
      await this.ads.updateCampaignName(token, advertiserId, campaignId, next);
    } catch (err) {
      throw new BadRequestException(this.message(err));
    }
    return { campaignId, name: next };
  }

  async deleteCampaigns(userId: string, advertiserId: string, campaignIds: string[]) {
    const ids = [...new Set(campaignIds.map((id) => id.trim()).filter(Boolean))];
    if (!ids.length) throw new BadRequestException('اختر حملة واحدة على الأقل');
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    try {
      await this.ads.deleteCampaigns(token, advertiserId, ids);
    } catch (err) {
      throw new BadRequestException(this.message(err));
    }
    return { deleted: ids };
  }

  async reviewCampaign(
    userId: string,
    teamId: string,
    input: { advertiserId: string; campaignId: string; startDate?: string; endDate?: string; messages?: Array<{ role?: string; content?: string }> },
  ) {
    const teamAccess = await this.access.getTeamAccess(teamId);
    const entitlements = await this.entitlements.getTeamEntitlements(teamId);
    const pixelLimit = entitlements.limits.maxTiktokPixels;
    const allowed = teamAccess.isActive && (pixelLimit < 0 || pixelLimit >= 15);
    if (!allowed) {
      throw new ForbiddenException('تقييم الحملات بالذكاء الاصطناعي متاح في الباقة الثانية والثالثة.');
    }
    const report = await this.performance(userId, input.advertiserId, input.startDate, input.endDate);
    const campaign = report.campaigns.find((row) => row.campaignId === input.campaignId);
    if (!campaign) throw new BadRequestException('الحملة غير موجودة في هذا الحساب');
    const detail = await this.campaignDetail(userId, input.advertiserId, input.campaignId).catch(() => null);
    const { videos, ...campaignStats } = campaign;
    const snapshot = {
      currency: report.currency,
      timezone: report.timezone,
      period: { start: report.startDate, end: report.endDate },
      campaign: {
        name: campaignStats.name,
        status: campaignStats.status,
        objective: campaignStats.objective,
        budget: campaignStats.budget,
        spend: campaignStats.spend,
        impressions: campaignStats.impressions,
        reach: campaignStats.reach,
        clicks: campaignStats.clicks,
        conversions: campaignStats.conversions,
        costPerConversion: campaignStats.costPerConversion,
        conversionRate: campaignStats.conversionRate,
        ads: (videos ?? []).slice(0, 8).map((video) => ({ name: video.text })),
      },
      settings: detail
        ? {
            budgetMode: detail.budgetMode,
            gender: detail.gender,
            ageGroups: detail.ageGroups,
            locations: detail.locationIds.length,
            hasPixel: Boolean(detail.pixelId),
            optimizationEvent: detail.optimizationEvent,
            scheduleMode: detail.scheduleMode,
            scheduleStartDate: detail.scheduleStartDate,
            scheduleEndDate: detail.scheduleEndDate,
            destination: detail.destination,
            hasWhatsapp: Boolean(detail.whatsappNumber),
            adCount: detail.creatives.length,
          }
        : null,
    };
    const history = (input.messages ?? [])
      .filter((message) => message && (message.role === 'user' || message.role === 'assistant') && message.content?.trim())
      .slice(-12)
      .map((message) => ({ role: message.role as string, content: String(message.content).slice(0, 4000) }));
    if (!history.length || history[history.length - 1]?.role !== 'user') {
      history.push({ role: 'user', content: 'حلّل هذه الحملة: اكتشف الأخطاء، قيّم النتائج، واذكر طرق التحسين.' });
    }
    const messages: AiMessage[] = [
      {
        role: 'system',
        content: `أنت خبير إعلانات تيك توك داخل منصة جات لورا، وتتحدث مع صاحب الحساب بالعربية.
لديك صلاحية الاطلاع على نتائج هذه الحملة فقط، وهذه هي البيانات الحالية:
${JSON.stringify(snapshot)}
حلّل الحملة كخبير: اكتشف الأخطاء في الإعداد والميزانية والاستهداف والوجهة، قيّم النتائج بالأرقام الموجودة فقط، ثم اقترح خطوات تحسين عملية.
لا تخترع أرقاماً أو نتائج غير موجودة في البيانات. إذا نقص تفصيل فقل ذلك. اجعل الرد واضحاً وقصيراً بما يكفي ليُنفَّذ.`,
      },
      ...history.map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: message.content,
      })),
    ];
    const ask = (model?: string) =>
      this.ai.chat(teamId, messages, {
        ...(model ? { model } : {}),
        temperature: 0.4,
        maxTokens: model ? 500 : 700,
        correlationId: `tiktok-review:${input.campaignId}${model ? `:${model}` : ''}`,
      });
    let result: { content?: string } | undefined;
    try {
      result = await ask();
    } catch (err) {
      const detail = this.aiFailureText(err);
      const status = (err as { response?: { status?: number }; status?: number }).response?.status
        ?? (err as { status?: number }).status;
      this.logger.error(`TikTok campaign review failed: ${detail}`);
      if (status === 400 || /model|valid model|not found|bad request/i.test(detail)) {
        for (const model of ['gpt-4o-mini', 'openai/gpt-4o-mini']) {
          result = await ask(model).catch((retryErr) => {
            this.logger.error(`TikTok campaign review retry failed: ${this.aiFailureText(retryErr)}`);
            return undefined;
          });
          if (result?.content?.trim()) break;
        }
      }
      if (!result?.content?.trim()) throw new BadRequestException('تعذر تقييم الحملة الآن. أعد المحاولة بعد قليل.');
    }
    const reply = result.content?.trim();
    if (!reply) throw new BadRequestException('لم يصل رد من الذكاء الاصطناعي. حاول مرة أخرى.');
    return { reply };
  }

  async topupQuote(userId: string, advertiserId: string) {
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    const [profile, balance] = await Promise.all([
      this.ads.getAdvertiserProfile(token, advertiserId),
      this.ads.getAdvertiserBalance(token, advertiserId).catch(() => ({ balance: 0, currency: null })),
    ]);
    if (profile.currency) {
      await this.prisma.tikTokMarketingAdvertiser.update({
        where: { userId_advertiserId: { userId, advertiserId } },
        data: { currency: profile.currency, timezone: profile.timezone ?? undefined, name: profile.name ?? undefined },
      }).catch(() => undefined);
    }
    const currency = (profile.currency || balance.currency || 'IQD').toUpperCase();
    return {
      advertiserId,
      name: profile.name,
      currency,
      timezone: profile.timezone,
      country: profile.country,
      taxRate: profile.taxRate,
      balance: balance.balance,
      minAmount: currency === 'IQD' ? 13000 : 10,
      usdToIqd: 1520,
    };
  }

  async startTopup(userId: string, teamId: string, advertiserId: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('أدخل مبلغ التعبئة');
    const quote = await this.topupQuote(userId, advertiserId);
    const currency = (quote.currency || 'IQD').toUpperCase();
    if (currency !== 'IQD' && currency !== 'USD') {
      throw new BadRequestException('التعبئة متاحة حالياً لحسابات الدولار والدينار العراقي فقط');
    }
    const minimum = currency === 'IQD' ? 13000 : 10;
    if (amount < minimum) {
      throw new BadRequestException(
        currency === 'IQD' ? 'الحد الأدنى لتعبئة حساب الدينار هو 13000 د.ع' : 'الحد الأدنى لتعبئة حساب الدولار هو 10$',
      );
    }
    const cashAmount = currency === 'IQD' ? Math.round(amount) : Math.round(amount * 100) / 100;
    const token = await this.tokenForAdvertiser(userId, advertiserId);
    const center = await this.ads.resolveAdvertiserBusinessCenter(token, advertiserId);
    if (!center?.bc_id) {
      throw new BadRequestException('لم يُعثر على مركز أعمال يملك هذا الحساب. من تيك توك ضع الحساب الإعلاني داخل مركز الأعمال، ثم أعد ربط تيك توك وحاول مرة أخرى.');
    }
    await this.prisma.tikTokMarketingConnection.update({
      where: { userId },
      data: { businessCenterId: center.bc_id, businessCenterName: center.name ?? undefined, hasBusinessAccess: true },
    }).catch(() => undefined);
    const requestId = `tt${Date.now()}${advertiserId.replace(/\D/g, '').slice(-8)}`.slice(0, 32);
    try {
      await this.ads.rechargeAdvertiser(token, center.bc_id, advertiserId, cashAmount, requestId);
    } catch (err) {
      this.logger.error(`TikTok direct top-up failed: ${this.message(err)}`);
      throw new BadRequestException(this.topupFailure(err));
    }
    const balance = await this.ads.getAdvertiserBalance(token, advertiserId).catch(() => ({ balance: quote.balance, currency }));
    const subscription = await this.prisma.subscription.findUnique({ where: { teamId } });
    let paymentId = '';
    if (subscription) {
      const payment = await this.prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          teamId,
          amountCents: currency === 'IQD' ? cashAmount : Math.round(cashAmount * 100),
          currency,
          status: PaymentStatus.COMPLETED,
          provider: 'tiktok',
          providerRef: requestId,
          paidAt: new Date(),
          description: `إضافة رصيد تيك توك ${quote.name || advertiserId}`,
          metadata: {
            purpose: 'tiktok_ad_topup',
            userId,
            advertiserId,
            advertiserName: quote.name,
            amount: cashAmount,
            tax: 0,
            total: cashAmount,
            currency,
            businessCenterId: center.bc_id,
            tiktokTransferStatus: 'applied',
            tiktokTransferMessage: 'تمت إضافة المبلغ مباشرة إلى الحساب الإعلاني على تيك توك',
          },
        },
      }).catch((err) => {
        this.logger.error(`TikTok top-up was applied but the invoice was not saved: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      });
      paymentId = payment?.id ?? '';
    }
    return {
      paymentId,
      amount: cashAmount,
      tax: 0,
      total: cashAmount,
      currency,
      balance: balance.balance,
      applied: true,
    };
  }

  async listTopups(teamId: string) {
    const rows = await this.prisma.payment.findMany({
      where: { teamId, provider: { in: ['wayl', 'tiktok'] } },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    return {
      invoices: rows
        .map((row) => {
          const meta = (row.metadata ?? {}) as Record<string, unknown>;
          if (meta.purpose !== 'tiktok_ad_topup') return null;
          return {
            id: row.id,
            status: row.status,
            paidAt: row.paidAt?.toISOString() ?? null,
            createdAt: row.createdAt.toISOString(),
            advertiserId: String(meta.advertiserId ?? ''),
            advertiserName: String(meta.advertiserName ?? ''),
            amount: Number(meta.amount ?? 0),
            tax: Number(meta.tax ?? 0),
            total: Number(meta.total ?? row.amountCents),
            currency: String(meta.currency ?? row.currency),
            transferStatus: String(meta.tiktokTransferStatus ?? (row.status === 'COMPLETED' ? 'pending' : 'unpaid')),
          };
        })
        .filter((row) => row != null),
    };
  }

  async creditAdvertiserTopup(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status !== PaymentStatus.COMPLETED) return;
    const meta = (payment.metadata ?? {}) as Record<string, unknown>;
    if (meta.purpose !== 'tiktok_ad_topup' || meta.tiktokTransferStatus === 'applied') return;
    const userId = String(meta.userId ?? '');
    const advertiserId = String(meta.advertiserId ?? '');
    const amount = Number(meta.amount ?? 0);
    if (!userId || !advertiserId || amount <= 0) return;
    const connection = await this.prisma.tikTokMarketingConnection.findUnique({ where: { userId } });
    if (!connection?.businessCenterId) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { metadata: { ...meta, tiktokTransferStatus: 'pending', tiktokTransferMessage: 'لا يوجد رصيد في مركز الأعمال لنقله تلقائياً. تم تسجيل الفاتورة.' } as object },
      });
      return;
    }
    try {
      const token = await this.marketingOAuth.getValidMarketingAccessToken(userId);
      await this.ads.rechargeAdvertiser(token, connection.businessCenterId, advertiserId, amount);
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { metadata: { ...meta, tiktokTransferStatus: 'applied', tiktokTransferMessage: 'تمت إضافة المبلغ إلى الحساب الإعلاني' } as object },
      });
    } catch (err) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { metadata: { ...meta, tiktokTransferStatus: 'failed', tiktokTransferMessage: this.message(err) } as object },
      });
    }
  }

  private async uniqueCampaignName(token: string, advertiserId: string, name: string) {
    const base = name.trim().slice(0, 480);
    let taken = new Set<string>();
    try {
      const names = await this.ads.listCampaignNames(token, advertiserId);
      taken = new Set(names.map((item) => item.trim().toLowerCase()).filter(Boolean));
    } catch {
      taken = new Set();
    }
    if (!taken.has(base.toLowerCase())) return base;
    for (let index = 2; index < 100; index += 1) {
      const next = `${base} ${index}`.slice(0, 512);
      if (!taken.has(next.toLowerCase())) return next;
    }
    return `${base} ${Date.now()}`.slice(0, 512);
  }

  private async tokenForAdvertiser(userId: string, advertiserId: string) {
    const advertiser = await this.prisma.tikTokMarketingAdvertiser.findUnique({
      where: { userId_advertiserId: { userId, advertiserId } },
    });
    if (!advertiser) throw new BadRequestException('الحساب الإعلاني غير مربوط بهذا المستخدم');
    return this.marketingOAuth.getValidMarketingAccessToken(userId);
  }

  private topupFailure(err: unknown) {
    const text = this.message(err);
    if (/finance permission|finance role/i.test(text)) {
      return 'تيك توك رفض الإضافة لأن الحساب المتصل ليس مدير مالي في مركز الأعمال. من تيك توك للأعمال افتح الأعضاء، ثم حسابك، ثم الدور المتقدم، واختر مدير مالي. بعد الحفظ أعد المحاولة هنا.';
    }
    if (/insufficient|not enough|balance|funds/i.test(text)) {
      return 'رصيد مركز الأعمال في تيك توك لا يكفي لهذا المبلغ. أضف رصيداً إلى مركز الأعمال ثم أعد المحاولة.';
    }
    if (/scope|access token/i.test(text)) {
      return 'ربط تيك توك في المنصة لا يتضمن صلاحية الرصيد. أعد ربط الحساب من إعدادات تيك توك ثم أعد المحاولة.';
    }
    if (/permission|no permission|not authorized/i.test(text)) {
      return 'تيك توك رفض نقل المبلغ. تأكد أن حسابك في مركز الأعمال يحمل دور مدير مالي، ثم أعد المحاولة.';
    }
    return text && text.length < 180 ? text : 'تعذر إضافة المبلغ إلى تيك توك. حاول مرة أخرى.';
  }

  private aiFailureText(err: unknown) {
    const data = (err as { response?: { data?: unknown; status?: number } })?.response?.data;
    const status = (err as { response?: { status?: number } })?.response?.status;
    let body = '';
    if (typeof data === 'string') body = data;
    else if (data && typeof data === 'object') {
      const record = data as { error?: { message?: string } | string; message?: string };
      const nested = typeof record.error === 'string' ? record.error : record.error?.message;
      body = nested || record.message || JSON.stringify(data);
    }
    const fallback = err instanceof Error ? err.message : String(err);
    return `${status ?? ''} ${body || fallback}`.trim().slice(0, 500);
  }

  private message(err: unknown) {
    if (err instanceof BadRequestException) {
      const response = err.getResponse();
      if (typeof response === 'string') return response;
      if (response && typeof response === 'object' && 'message' in response) {
        const message = (response as { message?: string | string[] }).message;
        return Array.isArray(message) ? message.join(' · ') : message || err.message;
      }
    }
    if (err instanceof AxiosError && err.response?.data) {
      const body = err.response.data as { message?: string; code?: number };
      if (body.message) return body.code != null ? `${body.message} (code ${body.code})` : body.message;
    }
    return err instanceof Error ? err.message : 'تعذر نشر الإعلان على تيك توك';
  }
}

function imageIdsOf(ad: Record<string, unknown>) {
  const value = ad.image_ids;
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => (typeof item === 'string' ? item : String((item as Record<string, unknown>)?.image_id ?? '')))
    .filter(Boolean);
}
