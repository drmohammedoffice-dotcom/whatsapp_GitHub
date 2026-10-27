'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, ChevronDown, Copy, Loader2, Pencil, Plus, RefreshCw, Search, Sparkles, Trash2, X } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  estimateTikTokAudience,
  fetchTikTokAdCreateOptions,
  fetchTikTokBusinessAdvertisers,
  fetchTikTokCampaignDraft,
  fetchTikTokIdentityVideos,
  fetchTikTokTargetingExtras,
  fetchTikTokTipSdkToken,
  previewTikTokSparkCode,
  publishTikTokAdBundle,
  type TikTokAdCreateOptions,
  type TikTokAudienceEstimate,
  type TikTokInstantForm,
  type TikTokSparkVideo,
} from '@/lib/tiktok-business';
import { ENGAGEMENT_OBJECTIVE_CONFIG, type EngagementOptimizationGoal } from '@/lib/tiktok-objective-engagement';
import { REACH_OBJECTIVE_CONFIG } from '@/lib/tiktok-objective-reach';
import { TRAFFIC_OBJECTIVE_CONFIG, type TrafficDestination, type TrafficOptimizationGoal } from '@/lib/tiktok-objective-traffic';
import { VIDEO_VIEWS_OBJECTIVE_CONFIG, type VideoViewsFrequencyMode, type VideoViewsOptimizationGoal } from '@/lib/tiktok-objective-video-views';
import { WEB_CONVERSIONS_OBJECTIVE_CONFIG } from '@/lib/tiktok-objective-web-conversions';
import {
  LEAD_GENERATION_OBJECTIVE_CONFIG,
  defaultCampaignName,
  defaultLeadCampaignName,
} from '@/lib/tiktok-objective-lead-generation';
import { InteractiveAddonsPanel } from '@/components/tiktok/interactive-addons-panel';
import { InstantFormLibraryModal } from '@/components/tiktok/instant-form-library-modal';
import { openTikTokInstantFormEditor } from '@/lib/tiktok-instant-page-sdk';
import { parseApiError } from '@/lib/utils';

const AGE_LABELS: Record<string, string> = {
  AGE_13_17: '13–17',
  AGE_18_24: '18–24',
  AGE_25_34: '25–34',
  AGE_35_44: '35–44',
  AGE_45_54: '45–54',
  AGE_55_100: '55+',
};
const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: 'اعرف المزيد', SHOP_NOW: 'تسوق الآن', SIGN_UP: 'سجّل', ORDER_NOW: 'اطلب الآن',
  BOOK_NOW: 'احجز الآن', DOWNLOAD_NOW: 'حمّل الآن', APPLY_NOW: 'قدّم الآن', SUBSCRIBE: 'اشترك',
  CONTACT_US: 'تواصل معنا', GET_QUOTE: 'اطلب عرض سعر', WATCH_NOW: 'شاهد الآن',
};
const SMART_PLUS_CTA_IDS = ['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'ORDER_NOW', 'BOOK_NOW', 'DOWNLOAD_NOW', 'APPLY_NOW', 'SUBSCRIBE', 'GET_QUOTE', 'WATCH_NOW'] as const;
const OBJECTIVE_LABELS: Record<string, string> = {
  REACH: 'الوصول',
  TRAFFIC: 'الزيارات',
  VIDEO_VIEWS: 'مشاهدات الفيديو',
  ENGAGEMENT: 'تفاعل المجتمع',
  INSTANT_GROWTH: 'النمو الفوري على TikTok',
  APP_PROMOTION: 'الترويج للتطبيق',
  LEAD_GENERATION: 'إنشاء عميل محتمل',
  WEB_CONVERSIONS: 'تحويلات موقع الويب',
  PRODUCT_SALES: 'مبيعات المنتجات',
};
const OBJECTIVE_GROUPS: Array<{ title: string; ids: string[] }> = [
  { title: 'زيادة الوعي بالعلامة التجارية', ids: ['REACH'] },
  { title: 'الاهتمام بالعلامة التجارية', ids: ['TRAFFIC', 'VIDEO_VIEWS', 'ENGAGEMENT'] },
  { title: 'التحويلات', ids: ['INSTANT_GROWTH', 'APP_PROMOTION', 'LEAD_GENERATION', 'WEB_CONVERSIONS', 'PRODUCT_SALES'] },
];
const OBJECTIVE_HINTS: Record<string, string> = {
  REACH: 'اعرض إعلانك أمام أقصى عدد من الأشخاص.',
  TRAFFIC: 'وجّه المزيد من الأشخاص إلى موقعك على الويب، أو تطبيقك، أو متجر TikTok Shop الخاص بك.',
  VIDEO_VIEWS: 'احصل على المزيد من المشاهدات والتفاعل لإعلانات الفيديو الخاصة بك.',
  ENGAGEMENT: 'احصل على المزيد من المتابعين أو الزيارات لصفحة TikTok.',
  INSTANT_GROWTH: 'وصّل جمهورك بمحتواك على الفور عبر TikTok.',
  APP_PROMOTION: 'الطريقة الفعالة من حيث التكلفة لزيادة تثبيت التطبيق والإجراءات داخله.',
  LEAD_GENERATION: LEAD_GENERATION_OBJECTIVE_CONFIG.hintAr,
  WEB_CONVERSIONS: WEB_CONVERSIONS_OBJECTIVE_CONFIG.hintAr,
  PRODUCT_SALES: 'مبيعات عبر موقع الويب (Smart+) — منفصلة عن تحويلات موقع الويب اليدوية.',
};
const OBJECTIVE_BENEFITS: Record<string, string[]> = {
  REACH: ['اعرض إعلانك لأكبر عدد ممكن من الأشخاص.', 'اختر مزاد الوصول أو الظهور في صدارة البحث.'],
  TRAFFIC: [
    'ابدأ بسرعة دون الحاجة إلى بكسل، وتواصل مع جمهور واسع على الفور.',
    'حقّق نقرات وعمليات عرض صفحة الهبوط عالية الجودة بتكلفة فعّالة لكل نقرة (CPC).',
    'فعّل رحلة تحويل مدعومة سلسة وميسّرة لزيادة الأداء.',
  ],
  VIDEO_VIEWS: [
    'زيادة مرات تشغيل إعلانات الفيديو الخاصة بك إلى أقصى حد.',
    'جذب الانتباه عن طريق عرض إعلاناتك للمستخدمين الذين يتفاعلون بشكل أكثر فعالية.',
  ],
  ENGAGEMENT: [
    'ادفع المزيد من الأشخاص لمتابعة حسابك على TikTok.',
    'ادفع المزيد من الأشخاص لزيارة ملفك التعريفي على TikTok.',
    'الترويج للبث المباشر الخاص بك.',
  ],
  INSTANT_GROWTH: [
    'حقق تفاعلاً فورياً داخل TikTok.',
    'وسّع نطاق التحويلات عبر رحلات مستخدم سلسة داخل المنصة.',
    'حقق نمواً تدريجياً في جمهورك وأقصى تأثير تجاري شامل.',
  ],
  APP_PROMOTION: [
    'شجّع الأشخاص على تثبيت واستخدام تطبيقك.',
    'أعد استهداف مستخدمي التطبيق الحاليين لاتخاذ إجراء داخله.',
  ],
  LEAD_GENERATION: [...LEAD_GENERATION_OBJECTIVE_CONFIG.benefitsAr],
  WEB_CONVERSIONS: [...WEB_CONVERSIONS_OBJECTIVE_CONFIG.benefitsAr],
  PRODUCT_SALES: [
    'حملة مبيعات → موقع ويب (Smart+) مع البكسل وحدث التحسين.',
    'منفصلة تماماً عن هدف تحويلات موقع الويب اليدوي.',
  ],
};
const OPTIMIZATION_GOAL_LABELS: Record<string, string> = {
  REACH: 'الوصول',
  CLICK: 'النقرة',
  ENGAGED_VIEW: 'مشاهدة مركّزة 6 ثوان',
  ENGAGED_VIEW_FIFTEEN: 'مشاهدة مركّزة 15 ثانية',
  FOLLOWERS: 'المتابعون',
  PAGE_VISIT: 'زيارات صفحة TikTok',
  INSTALL: 'تثبيت التطبيق',
  LEAD_GENERATION: LEAD_GENERATION_OBJECTIVE_CONFIG.optimizationGoalLabelAr,
  CONVERT: 'التحويل',
  TRAFFIC_LANDING_PAGE_VIEW: 'مشاهدة الصفحة المقصودة',
  ENGAGED_SESSION: 'الجلسة المتفاعلة',
};
const IDENTITY_LABELS: Record<string, string> = {
  AUTH_CODE: 'كود إعلان', TT_USER: 'حساب تيك توك', BC_AUTH_TT: 'حساب مركز الأعمال', CUSTOMIZED_USER: 'هوية مخصصة',
};
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', IQD: 'د.ع', SAR: 'ر.س', AED: 'د.إ', KWD: 'د.ك', QAR: 'ر.ق', BHD: 'د.ب', OMR: 'ر.ع', EGP: 'ج.م', JOD: 'د.أ',
};
const COUNTRY_TIMEZONES: Record<string, string> = {
  IQ: 'Asia/Baghdad', SA: 'Asia/Riyadh', AE: 'Asia/Dubai', KW: 'Asia/Kuwait', QA: 'Asia/Qatar', BH: 'Asia/Bahrain',
  OM: 'Asia/Muscat', EG: 'Africa/Cairo', JO: 'Asia/Amman', LB: 'Asia/Beirut', TR: 'Europe/Istanbul', GB: 'Europe/London', US: 'America/New_York',
};
function AccountAvatar({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const letter = name.trim().slice(0, 1) || 'ت';
  if (!src || failed) {
    return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{letter}</span>;
  }
  return <img src={src} alt="" referrerPolicy="no-referrer" className="h-9 w-9 shrink-0 rounded-full object-cover" onError={() => setFailed(true)} />;
}

const TIMEZONE_LABELS: Record<string, string> = {
  'Asia/Baghdad': 'بغداد (UTC+3)',
  'Asia/Riyadh': 'الرياض (UTC+3)',
  'Asia/Dubai': 'دبي (UTC+4)',
  'Asia/Kuwait': 'الكويت (UTC+3)',
  'Asia/Qatar': 'قطر (UTC+3)',
  'Asia/Bahrain': 'البحرين (UTC+3)',
  'Asia/Muscat': 'مسقط (UTC+4)',
  'Africa/Cairo': 'القاهرة (UTC+2)',
  'Asia/Amman': 'عمّان',
  'Asia/Beirut': 'بيروت',
  'Europe/Istanbul': 'إسطنبول',
  'Europe/London': 'لندن',
  'America/New_York': 'نيويورك / الولايات المتحدة (UTC−5)',
  'America/Chicago': 'شيكاغو (UTC−6)',
  'America/Los_Angeles': 'لوس أنجلوس (UTC−8)',
  'Etc/GMT+5': 'الولايات المتحدة (UTC−5)',
  'Etc/GMT+4': 'الولايات المتحدة (UTC−4)',
  'Etc/GMT-3': 'بغداد / الرياض (UTC+3)',
};

function timezoneLabel(zone?: string | null) {
  if (!zone) return 'غير معروف';
  return TIMEZONE_LABELS[zone] || zone;
}

type AdvertiserRow = { advertiserId: string; name: string | null; currency: string | null; timezone?: string | null };
type DraftVideo = TikTokSparkVideo & { key: string };
type Preview = { text: string; posterUrl: string; videoUrl?: string; previewLink?: string };
type MenuObjective = 'REACH' | 'TRAFFIC' | 'VIDEO_VIEWS' | 'ENGAGEMENT' | 'INSTANT_GROWTH' | 'APP_PROMOTION' | 'LEAD_GENERATION' | 'WEB_CONVERSIONS' | 'PRODUCT_SALES';
type WizardStep = 1 | 2 | 3;

function menuFromApiObjective(objective: string): MenuObjective {
  if (objective === 'LEAD_GENERATION') return 'LEAD_GENERATION';
  if (objective === 'WEB_CONVERSIONS') return 'WEB_CONVERSIONS';
  if (objective === 'PRODUCT_SALES') return 'PRODUCT_SALES';
  if (objective === 'REACH' || objective === 'TRAFFIC' || objective === 'VIDEO_VIEWS' || objective === 'ENGAGEMENT' || objective === 'APP_PROMOTION') {
    return objective;
  }
  return 'TRAFFIC';
}

function apiObjectiveFromMenu(
  menu: MenuObjective,
  _salesDestination?: 'WEBSITE' | 'APP' | 'WEB_AND_APP' | 'STORE',
): string {
  if (menu === 'INSTANT_GROWTH') return 'ENGAGEMENT';
  if (menu === 'LEAD_GENERATION') return 'LEAD_GENERATION';
  if (menu === 'WEB_CONVERSIONS') return 'WEB_CONVERSIONS';
  if (menu === 'PRODUCT_SALES') return 'PRODUCT_SALES';
  return menu;
}

type WizardGroup = {
  id: string;
  name: string;
  adGroupId: string;
  destination: 'PIXEL' | 'WHATSAPP' | 'INSTANT_PAGE';
  whatsappNumber: string;
  pageId: string;
  pixelId: string;
  optimizationEvent: string;
  clickAttributionWindow: string;
  viewAttributionWindow: string;
  attributionEventCount: string;
  appId: string;
  usePlatformLink: boolean;
  landingPageUrl: string;
  locationIds: string[];
  gender: string;
  ageGroups: string[];
  interestIds: string[];
  languageCodes: string[];
  spendingPower: 'ALL' | 'HIGH';
  audienceIds: string[];
  excludedAudienceIds: string[];
  smartInterestBehavior: boolean;
  placementMode: 'AUTOMATIC' | 'MANUAL';
  placements: string[];
  includeSearchResult: boolean;
  tiktokSubplacements: string[];
  frequencyMode: 'TARGET' | 'CAP';
  frequency: string;
  frequencySchedule: string;
  ctaEnabled: boolean;
  budgetMode: 'BUDGET_MODE_DAY' | 'BUDGET_MODE_TOTAL';
  budget: string;
  budgetIncreaseEnabled: boolean;
  budgetIncreaseAmount: string;
  budgetIncreaseMaxTimes: string;
  bidStrategy: 'HIGHEST' | 'TARGET';
  targetCost: string;
  acceleratedDelivery: boolean;
  scheduleMode: 'CONTINUOUS' | 'RANGE';
  scheduleStartDate: string;
  scheduleEndDate: string;
  devices: 'ALL' | 'ANDROID' | 'IOS';
  minAndroidVersion: string;
  minIosVersion: string;
  networkTypes: string[];
  carrierIds: string[];
  ispIds: string[];
  devicePriceMode: 'ALL' | 'RANGE';
  devicePriceMin: string;
  devicePriceMax: string;
  week: boolean[][];
  timezone: string;
  identityKey: string;
  selected: DraftVideo[];
  authCodes: string;
  callToAction: string;
  allowComments: boolean;
  allowDownload: boolean;
  allowShare: boolean;
  interactiveAddonsEnabled?: boolean;
  cardId?: string;
  cardPreviewUrl?: string;
};

function newGroupId() {
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function localIso(date: Date) {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 10);
}

const DAY_LABELS = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];

function fullWeek(on = true): boolean[][] {
  return Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => on));
}

function weekFromDayparting(value?: string) {
  const week = fullWeek(true);
  if (!value || !/^[01]{336}$/.test(value)) return week;
  for (let day = 0; day < 7; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const index = day * 48 + hour * 2;
      week[day][hour] = value[index] === '1' || value[index + 1] === '1';
    }
  }
  return week;
}

function weekToDayparting(week: boolean[][]) {
  let out = '';
  for (let day = 0; day < 7; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const bit = week[day]?.[hour] ? '1' : '0';
      out += bit + bit;
    }
  }
  return out;
}

const CAMPAIGN_DRAFT_KEY = 'chatloora-tiktok-new-campaign';

type StoredCampaignDraft = {
  advertiserId: string;
  campaignName: string;
  objective: string;
  smartPlus: boolean;
  searchCampaign: boolean;
  menuObjective?: MenuObjective;
  reachType?: 'AUCTION' | 'TOP_SEARCH';
  appPromotionType?: 'APP_INSTALL' | 'APP_RETARGETING';
  salesDestination?: 'WEBSITE' | 'APP' | 'WEB_AND_APP' | 'STORE';
  trafficDestination?: TrafficDestination;
  trafficOptimizationGoal?: TrafficOptimizationGoal;
  videoViewsGoal?: VideoViewsOptimizationGoal;
  videoFrequencyMode?: VideoViewsFrequencyMode;
  engagementGoal?: EngagementOptimizationGoal;
  destination: 'PIXEL' | 'WHATSAPP' | 'INSTANT_PAGE';
  whatsappNumber: string;
  pageId: string;
  pixelId: string;
  optimizationEvent: string;
  clickAttributionWindow?: string;
  viewAttributionWindow?: string;
  attributionEventCount?: string;
  appId: string;
  usePlatformLink: boolean;
  landingPageUrl: string;
  locationIds: string[];
  gender: string;
  ageGroups: string[];
  interestIds: string[];
  languageCodes: string[];
  spendingPower: 'ALL' | 'HIGH';
  audienceIds: string[];
  excludedAudienceIds: string[];
  smartInterestBehavior: boolean;
  placementMode: 'AUTOMATIC' | 'MANUAL';
  placements: string[];
  includeSearchResult: boolean;
  tiktokSubplacements?: string[];
  frequencyMode?: 'TARGET' | 'CAP';
  frequency?: string;
  frequencySchedule?: string;
  ctaEnabled?: boolean;
  budgetMode: 'BUDGET_MODE_DAY' | 'BUDGET_MODE_TOTAL';
  budget: string;
  budgetIncreaseEnabled: boolean;
  budgetIncreaseAmount: string;
  budgetIncreaseMaxTimes: string;
  bidStrategy: 'HIGHEST' | 'TARGET';
  targetCost: string;
  acceleratedDelivery: boolean;
  scheduleMode: 'CONTINUOUS' | 'RANGE';
  scheduleStartDate: string;
  scheduleEndDate: string;
  devices: 'ALL' | 'ANDROID' | 'IOS';
  minAndroidVersion: string;
  minIosVersion: string;
  networkTypes: string[];
  carrierIds: string[];
  ispIds: string[];
  devicePriceMode: 'ALL' | 'RANGE';
  devicePriceMin: string;
  devicePriceMax: string;
  week: boolean[][];
  timezone: string;
  identityKey: string;
  selected: DraftVideo[];
  authCodes: string;
  callToAction: string;
  allowComments: boolean;
  allowDownload: boolean;
  allowShare: boolean;
  interactiveAddonsEnabled?: boolean;
  cardId?: string;
  cardPreviewUrl?: string;
  step?: WizardStep;
  unlockedStep?: WizardStep;
  groupName?: string;
  adName?: string;
  activeGroupId?: string;
  groups?: WizardGroup[];
};

function readCampaignDraft(): StoredCampaignDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CAMPAIGN_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCampaignDraft>;
    if (!parsed || typeof parsed !== 'object') return null;
    const week = Array.isArray(parsed.week) && parsed.week.length === 7
      ? parsed.week.map((row) => {
        const hours = Array.isArray(row) ? row.slice(0, 24).map(Boolean) : [];
        while (hours.length < 24) hours.push(true);
        return hours;
      })
      : fullWeek(true);
    const selected = (Array.isArray(parsed.selected)
      ? parsed.selected.filter((video) => video && typeof video.itemId === 'string' && video.itemId)
      : []) as DraftVideo[];
    return {
      advertiserId: typeof parsed.advertiserId === 'string' ? parsed.advertiserId : '',
      campaignName: typeof parsed.campaignName === 'string' ? parsed.campaignName : '',
      objective: typeof parsed.objective === 'string' ? parsed.objective : 'WEB_CONVERSIONS',
      smartPlus: parsed.smartPlus === true,
      searchCampaign: parsed.searchCampaign === true,
      menuObjective: (() => {
        const m = parsed.menuObjective;
        if (m === 'REACH' || m === 'TRAFFIC' || m === 'VIDEO_VIEWS' || m === 'ENGAGEMENT' || m === 'INSTANT_GROWTH' || m === 'APP_PROMOTION' || m === 'LEAD_GENERATION' || m === 'WEB_CONVERSIONS' || m === 'PRODUCT_SALES') return m;
        if (m === 'SALES') return parsed.salesDestination === 'STORE' || parsed.objective === 'PRODUCT_SALES' ? 'PRODUCT_SALES' : 'WEB_CONVERSIONS';
        return undefined;
      })(),
      reachType: parsed.reachType === 'TOP_SEARCH' ? 'TOP_SEARCH' : 'AUCTION',
      appPromotionType: parsed.appPromotionType === 'APP_RETARGETING' ? 'APP_RETARGETING' : 'APP_INSTALL',
      salesDestination: parsed.salesDestination === 'APP' || parsed.salesDestination === 'WEB_AND_APP' || parsed.salesDestination === 'STORE'
        ? parsed.salesDestination
        : 'WEBSITE',
      trafficDestination: parsed.trafficDestination === 'APP' || parsed.trafficDestination === 'TIKTOK_SHOP' ? parsed.trafficDestination : 'WEBSITE',
      trafficOptimizationGoal: parsed.trafficOptimizationGoal === 'TRAFFIC_LANDING_PAGE_VIEW' || parsed.trafficOptimizationGoal === 'ENGAGED_SESSION'
        ? parsed.trafficOptimizationGoal
        : 'CLICK',
      videoViewsGoal: parsed.videoViewsGoal === 'ENGAGED_VIEW_FIFTEEN' ? 'ENGAGED_VIEW_FIFTEEN' : 'ENGAGED_VIEW',
      videoFrequencyMode: parsed.videoFrequencyMode === 'CAP' ? 'CAP' : 'NONE',
      engagementGoal: parsed.engagementGoal === 'PAGE_VISIT' ? 'PAGE_VISIT' : 'FOLLOWERS',
      destination: parsed.destination === 'WHATSAPP' ? 'WHATSAPP' : parsed.destination === 'INSTANT_PAGE' ? 'INSTANT_PAGE' : 'PIXEL',
      whatsappNumber: typeof parsed.whatsappNumber === 'string' ? parsed.whatsappNumber : '',
      pageId: typeof parsed.pageId === 'string' ? parsed.pageId : '',
      pixelId: typeof parsed.pixelId === 'string' ? parsed.pixelId : '',
      optimizationEvent: (() => {
        const raw = typeof parsed.optimizationEvent === 'string' ? parsed.optimizationEvent : 'SHOPPING';
        if (raw === 'ON_WEB_ORDER' || raw === 'Purchase' || raw === 'CompletePayment') return 'SHOPPING';
        if (raw === 'SubmitForm' || raw === 'Lead') return 'FORM';
        return raw;
      })(),
      clickAttributionWindow: typeof parsed.clickAttributionWindow === 'string' ? parsed.clickAttributionWindow : WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.clickWindowDefault,
      viewAttributionWindow: typeof parsed.viewAttributionWindow === 'string' ? parsed.viewAttributionWindow : WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.viewWindowDefault,
      attributionEventCount: typeof parsed.attributionEventCount === 'string' ? parsed.attributionEventCount : WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.eventCountDefault,
      appId: typeof parsed.appId === 'string' ? parsed.appId : '',
      usePlatformLink: parsed.usePlatformLink !== false,
      landingPageUrl: typeof parsed.landingPageUrl === 'string' ? parsed.landingPageUrl : '',
      locationIds: Array.isArray(parsed.locationIds) ? parsed.locationIds.map(String) : [],
      gender: typeof parsed.gender === 'string' ? parsed.gender : 'GENDER_UNLIMITED',
      ageGroups: Array.isArray(parsed.ageGroups) ? parsed.ageGroups.map(String) : [],
      interestIds: Array.isArray(parsed.interestIds) ? parsed.interestIds.map(String) : [],
      languageCodes: Array.isArray(parsed.languageCodes) ? parsed.languageCodes.map(String) : [],
      spendingPower: parsed.spendingPower === 'HIGH' ? 'HIGH' : 'ALL',
      audienceIds: Array.isArray(parsed.audienceIds) ? parsed.audienceIds.map(String) : [],
      excludedAudienceIds: Array.isArray(parsed.excludedAudienceIds) ? parsed.excludedAudienceIds.map(String) : [],
      smartInterestBehavior: parsed.smartInterestBehavior === true,
      placementMode: parsed.placementMode === 'AUTOMATIC' ? 'AUTOMATIC' : 'MANUAL',
      placements: Array.isArray(parsed.placements) ? parsed.placements.map(String) : ['PLACEMENT_TIKTOK'],
      includeSearchResult: parsed.includeSearchResult !== false,
      tiktokSubplacements: Array.isArray(parsed.tiktokSubplacements)
        ? parsed.tiktokSubplacements.filter((item): item is string => typeof item === 'string')
        : ['IN_FEED', 'SEARCH_FEED'],
      frequencyMode: parsed.frequencyMode === 'TARGET' ? 'TARGET' : 'CAP',
      frequency: typeof parsed.frequency === 'string' ? parsed.frequency : String(REACH_OBJECTIVE_CONFIG.frequency.defaultCap.frequency),
      frequencySchedule: typeof parsed.frequencySchedule === 'string' ? parsed.frequencySchedule : String(REACH_OBJECTIVE_CONFIG.frequency.defaultCap.frequencySchedule),
      ctaEnabled: parsed.ctaEnabled !== false,
      budgetMode: parsed.budgetMode === 'BUDGET_MODE_TOTAL' ? 'BUDGET_MODE_TOTAL' : 'BUDGET_MODE_DAY',
      budget: typeof parsed.budget === 'string' ? parsed.budget : '20',
      budgetIncreaseEnabled: parsed.budgetIncreaseEnabled === true,
      budgetIncreaseAmount: typeof parsed.budgetIncreaseAmount === 'string' ? parsed.budgetIncreaseAmount : '',
      budgetIncreaseMaxTimes: typeof parsed.budgetIncreaseMaxTimes === 'string' ? parsed.budgetIncreaseMaxTimes : '10',
      bidStrategy: parsed.bidStrategy === 'TARGET' ? 'TARGET' : 'HIGHEST',
      targetCost: typeof parsed.targetCost === 'string' ? parsed.targetCost : '',
      acceleratedDelivery: parsed.acceleratedDelivery === true,
      scheduleMode: parsed.scheduleMode === 'RANGE' ? 'RANGE' : 'CONTINUOUS',
      scheduleStartDate: typeof parsed.scheduleStartDate === 'string' ? parsed.scheduleStartDate : localIso(new Date()),
      scheduleEndDate: typeof parsed.scheduleEndDate === 'string' ? parsed.scheduleEndDate : '',
      devices: parsed.devices === 'ANDROID' || parsed.devices === 'IOS' ? parsed.devices : 'ALL',
      minAndroidVersion: typeof parsed.minAndroidVersion === 'string' ? parsed.minAndroidVersion : '',
      minIosVersion: typeof parsed.minIosVersion === 'string' ? parsed.minIosVersion : '',
      networkTypes: Array.isArray(parsed.networkTypes) ? parsed.networkTypes.map(String) : ['WIFI', '2G', '3G', '4G', '5G'],
      carrierIds: Array.isArray(parsed.carrierIds) ? parsed.carrierIds.map(String) : [],
      ispIds: Array.isArray(parsed.ispIds) ? parsed.ispIds.map(String) : [],
      devicePriceMode: parsed.devicePriceMode === 'RANGE' ? 'RANGE' : 'ALL',
      devicePriceMin: typeof parsed.devicePriceMin === 'string' ? parsed.devicePriceMin : '',
      devicePriceMax: typeof parsed.devicePriceMax === 'string' ? parsed.devicePriceMax : '',
      week,
      timezone: typeof parsed.timezone === 'string' ? parsed.timezone : 'Asia/Baghdad',
      identityKey: typeof parsed.identityKey === 'string' ? parsed.identityKey : '',
      selected,
      authCodes: typeof parsed.authCodes === 'string' ? parsed.authCodes : '',
      callToAction: typeof parsed.callToAction === 'string' ? parsed.callToAction : 'LEARN_MORE',
      allowComments: parsed.allowComments !== false,
      allowDownload: parsed.allowDownload === true,
      allowShare: parsed.allowShare !== false,
      interactiveAddonsEnabled: parsed.interactiveAddonsEnabled === true,
      cardId: typeof parsed.cardId === 'string' ? parsed.cardId : '',
      cardPreviewUrl: typeof parsed.cardPreviewUrl === 'string' ? parsed.cardPreviewUrl : '',
      step: parsed.step === 2 || parsed.step === 3 ? parsed.step : 1,
      unlockedStep: parsed.unlockedStep === 3 || parsed.step === 3 ? 3 : parsed.unlockedStep === 2 || parsed.step === 2 ? 2 : 1,
      groupName: typeof parsed.groupName === 'string' ? parsed.groupName : 'المجموعة 1',
      adName: typeof parsed.adName === 'string' ? parsed.adName : '',
      activeGroupId: typeof parsed.activeGroupId === 'string' ? parsed.activeGroupId : '',
      groups: Array.isArray(parsed.groups) ? parsed.groups.filter((group) => group && typeof group.id === 'string') : [],
    };
  } catch {
    return null;
  }
}

function draftHasProgress(draft: StoredCampaignDraft): boolean {
  if ((draft.step ?? 1) > 1 || (draft.unlockedStep ?? 1) > 1) return true;
  if (draft.selected?.length) return true;
  if ((draft.pageId || '').trim() || (draft.whatsappNumber || '').trim() || (draft.landingPageUrl || '').trim()) return true;
  if (draft.groups?.length) return true;
  if (draft.interestIds?.length || draft.ageGroups?.length || draft.audienceIds?.length) return true;
  if (draft.menuObjective && draft.menuObjective !== 'WEB_CONVERSIONS') return true;
  if (draft.objective && draft.objective !== 'WEB_CONVERSIONS') return true;
  if (draft.destination && draft.destination !== 'PIXEL') return true;
  if (draft.smartPlus || draft.searchCampaign) return true;
  if ((draft.authCodes || '').trim()) return true;
  if (draft.budget && draft.budget !== '20' && draft.budget !== '50000') return true;
  return false;
}

function isPageReload(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === 'reload') return true;
    // Safari / older
    const legacy = (performance as Performance & { navigation?: { type?: number } }).navigation;
    return legacy?.type === 1;
  } catch {
    return false;
  }
}

function applyHours(from: number, to: number) {
  return fullWeek(false).map((row) => row.map((_, hour) => {
    if (from === to) return true;
    if (from < to) return hour >= from && hour < to;
    return hour >= from || hour < to;
  }));
}

function DaypartEditor({ week, onChange }: { week: boolean[][]; onChange: (week: boolean[][]) => void }) {
  const [from, setFrom] = useState(9);
  const [to, setTo] = useState(21);
  const paint = useRef<boolean | null>(null);
  const weekRef = useRef(week);
  weekRef.current = week;

  useEffect(() => {
    const stop = () => { paint.current = null; };
    window.addEventListener('pointerup', stop);
    return () => window.removeEventListener('pointerup', stop);
  }, []);

  function setCell(day: number, hour: number, value: boolean) {
    const next = weekRef.current.map((row, dayIndex) => (
      dayIndex === day ? row.map((on, hourIndex) => (hourIndex === hour ? value : on)) : row
    ));
    weekRef.current = next;
    onChange(next);
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <Label>من الساعة</Label>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={from} onChange={(event) => setFrom(Number(event.target.value))}>
            {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{`${String(hour).padStart(2, '0')}:00`}</option>)}
          </select>
        </div>
        <div className="grid gap-1">
          <Label>إلى الساعة</Label>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={to} onChange={(event) => setTo(Number(event.target.value))}>
            {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{`${String(hour).padStart(2, '0')}:00`}</option>)}
          </select>
        </div>
        <Button type="button" variant="outline" onClick={() => onChange(applyHours(from, to))}>تطبيق على كل الأيام</Button>
        <Button type="button" variant="outline" onClick={() => onChange(fullWeek(true))}>طوال اليوم</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        الخانة البنفسجية = ساعة ظهور الإعلان حسب «توقيت جدولة الحملة» أعلاه (مثل بغداد).
        عند النشر نحوّلها تلقائياً لتوقيت حساب تيك توك. الأسبوع يبدأ بالاثنين.
      </p>
      <div dir="ltr" className="overflow-x-auto rounded-xl border p-2">
        <div className="grid min-w-[680px] grid-cols-[92px_repeat(24,minmax(0,1fr))] items-center gap-1">
          <span />
          {Array.from({ length: 24 }, (_, hour) => (
            <span key={hour} className="text-center text-[10px] text-muted-foreground">{hour % 3 === 0 ? hour : ''}</span>
          ))}
          {DAY_LABELS.map((label, day) => (
            <div key={label} className="contents">
              <button
                type="button"
                className="px-1 text-right text-xs"
                onClick={() => {
                  const enable = !week[day]?.every(Boolean);
                  onChange(week.map((row, index) => (index === day ? row.map(() => enable) : row)));
                }}
              >
                {label}
              </button>
              {(week[day] ?? []).map((on, hour) => (
                <button
                  key={`${day}-${hour}`}
                  type="button"
                  aria-label={`${label} ${String(hour).padStart(2, '0')}:00`}
                  className={`h-6 rounded-sm ${on ? 'bg-violet-600' : 'bg-muted'}`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    paint.current = !on;
                    setCell(day, hour, !on);
                  }}
                  onPointerEnter={() => {
                    if (paint.current === null) return;
                    setCell(day, hour, paint.current);
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VideoThumb({ video, onOpen }: { video: { posterUrl?: string; videoUrl?: string; text?: string }; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
      {video.posterUrl ? (
        <img src={video.posterUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      ) : video.videoUrl ? (
        <video src={video.videoUrl} muted preload="metadata" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-muted-foreground">{video.text || 'فيديو'}</span>
      )}
    </button>
  );
}

export default function NewTikTokCampaignPage() {
  return (
    <Suspense fallback={<AppShell><div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>}>
      <NewTikTokCampaignForm />
    </Suspense>
  );
}

function NewTikTokCampaignForm() {
  const [editingId, setEditingId] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  const [adGroupId, setAdGroupId] = useState('');
  const [advertisers, setAdvertisers] = useState<AdvertiserRow[]>([]);
  const [accountQuery, setAccountQuery] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [languageQuery, setLanguageQuery] = useState('');
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const [advertiserId, setAdvertiserId] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [options, setOptions] = useState<TikTokAdCreateOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [campaignName, setCampaignName] = useState(() => defaultCampaignName());
  const [objective, setObjective] = useState('WEB_CONVERSIONS');
  const [destination, setDestination] = useState<'PIXEL' | 'WHATSAPP' | 'INSTANT_PAGE'>('PIXEL');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [pageId, setPageId] = useState('');
  const [instantFormLibraryOpen, setInstantFormLibraryOpen] = useState(false);
  const [instantFormBusy, setInstantFormBusy] = useState(false);
  const iraqDefaultApplied = useRef(false);
  const [pixelId, setPixelId] = useState('');
  const [optimizationEvent, setOptimizationEvent] = useState('SHOPPING');
  const [clickAttributionWindow, setClickAttributionWindow] = useState(WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.clickWindowDefault as string);
  const [viewAttributionWindow, setViewAttributionWindow] = useState(WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.viewWindowDefault as string);
  const [attributionEventCount, setAttributionEventCount] = useState(WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.eventCountDefault as string);
  const [appId, setAppId] = useState('');
  const [usePlatformLink, setUsePlatformLink] = useState(true);
  const [landingPageUrl, setLandingPageUrl] = useState('');
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [countryQuery, setCountryQuery] = useState('');
  const [gender, setGender] = useState('GENDER_UNLIMITED');
  const [ageGroups, setAgeGroups] = useState<string[]>([]);
  const [interestIds, setInterestIds] = useState<string[]>([]);
  const [interestQuery, setInterestQuery] = useState('');
  const [languageCodes, setLanguageCodes] = useState<string[]>([]);
  const [languagesAll, setLanguagesAll] = useState(true);
  const [spendingPower, setSpendingPower] = useState<'ALL' | 'HIGH'>('ALL');
  const [audienceIds, setAudienceIds] = useState<string[]>([]);
  const [excludedAudienceIds, setExcludedAudienceIds] = useState<string[]>([]);
  const [smartInterestBehavior, setSmartInterestBehavior] = useState(false);
  const [placementMode, setPlacementMode] = useState<'AUTOMATIC' | 'MANUAL'>('MANUAL');
  const [placements, setPlacements] = useState<string[]>(['PLACEMENT_TIKTOK']);
  const [includeSearchResult, setIncludeSearchResult] = useState(true);
  const [tiktokSubplacements, setTiktokSubplacements] = useState<string[]>(['IN_FEED', 'SEARCH_FEED']);
  const [frequencyMode, setFrequencyMode] = useState('CAP' as 'TARGET' | 'CAP');
  const [frequency, setFrequency] = useState(String(REACH_OBJECTIVE_CONFIG.frequency.defaultCap.frequency));
  const [frequencySchedule, setFrequencySchedule] = useState(String(REACH_OBJECTIVE_CONFIG.frequency.defaultCap.frequencySchedule));
  const [ctaEnabled, setCtaEnabled] = useState(true);
  const [trafficDestination, setTrafficDestination] = useState('WEBSITE' as TrafficDestination);
  const [trafficOptimizationGoal, setTrafficOptimizationGoal] = useState('CLICK' as TrafficOptimizationGoal);
  const [videoViewsGoal, setVideoViewsGoal] = useState('ENGAGED_VIEW' as VideoViewsOptimizationGoal);
  const [videoFrequencyMode, setVideoFrequencyMode] = useState('NONE' as VideoViewsFrequencyMode);
  const [engagementGoal, setEngagementGoal] = useState('FOLLOWERS' as EngagementOptimizationGoal);
  const [budgetMode, setBudgetMode] = useState<'BUDGET_MODE_DAY' | 'BUDGET_MODE_TOTAL'>('BUDGET_MODE_DAY');
  const [budget, setBudget] = useState('20');
  const [budgetIncreaseEnabled, setBudgetIncreaseEnabled] = useState(false);
  const [budgetIncreaseAmount, setBudgetIncreaseAmount] = useState('');
  const [budgetIncreaseMaxTimes, setBudgetIncreaseMaxTimes] = useState('10');
  const [bidStrategy, setBidStrategy] = useState<'HIGHEST' | 'TARGET'>('HIGHEST');
  const [targetCost, setTargetCost] = useState('');
  const [acceleratedDelivery, setAcceleratedDelivery] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<'CONTINUOUS' | 'RANGE'>('CONTINUOUS');
  const [scheduleStartDate, setScheduleStartDate] = useState(localIso(new Date()));
  const [scheduleEndDate, setScheduleEndDate] = useState('');
  const [devices, setDevices] = useState<'ALL' | 'ANDROID' | 'IOS'>('ALL');
  const [minAndroidVersion, setMinAndroidVersion] = useState('');
  const [minIosVersion, setMinIosVersion] = useState('');
  const [networkTypes, setNetworkTypes] = useState<string[]>(['WIFI', '2G', '3G', '4G', '5G']);
  const [carrierIds, setCarrierIds] = useState<string[]>([]);
  const [ispIds, setIspIds] = useState<string[]>([]);
  const [devicePriceMode, setDevicePriceMode] = useState<'ALL' | 'RANGE'>('ALL');
  const [devicePriceMin, setDevicePriceMin] = useState('');
  const [devicePriceMax, setDevicePriceMax] = useState('');
  const [week, setWeek] = useState<boolean[][]>(() => fullWeek(true));
  const [timezone, setTimezone] = useState('Asia/Baghdad');
  const [identityKey, setIdentityKey] = useState('');
  const [videoSource, setVideoSource] = useState<'IDENTITY' | 'AUTH_CODE'>('IDENTITY');
  const [videoSearch, setVideoSearch] = useState('');
  const [identityOpen, setIdentityOpen] = useState(false);
  const [videos, setVideos] = useState<TikTokSparkVideo[]>([]);
  const [videoCursor, setVideoCursor] = useState('');
  const [hasMoreVideos, setHasMoreVideos] = useState(false);
  const loadingVideos = useRef(false);
  const [selected, setSelected] = useState<DraftVideo[]>([]);
  const [authCodes, setAuthCodes] = useState('');
  const [callToAction, setCallToAction] = useState('LEARN_MORE');
  const [allowComments, setAllowComments] = useState(true);
  const [allowDownload, setAllowDownload] = useState(false);
  const [allowShare, setAllowShare] = useState(true);
  const [interactiveAddonsEnabled, setInteractiveAddonsEnabled] = useState(false);
  const [cardId, setCardId] = useState('');
  const [cardPreviewUrl, setCardPreviewUrl] = useState('');
  const [smartPlus, setSmartPlus] = useState(false);
  const [searchCampaign, setSearchCampaign] = useState(false);
  const [menuObjective, setMenuObjective] = useState('WEB_CONVERSIONS' as MenuObjective);
  const [reachType, setReachType] = useState('AUCTION' as 'AUCTION' | 'TOP_SEARCH');
  const [appPromotionType, setAppPromotionType] = useState('APP_INSTALL' as 'APP_INSTALL' | 'APP_RETARGETING');
  const [salesDestination, setSalesDestination] = useState('WEBSITE' as 'WEBSITE' | 'APP' | 'WEB_AND_APP' | 'STORE');
  const [step, setStep] = useState(1 as WizardStep);
  const [unlockedStep, setUnlockedStep] = useState(1 as WizardStep);
  const [groupName, setGroupName] = useState('المجموعة 1');
  const [adName, setAdName] = useState(() => {
    const stamp = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `اسم الإعلان ${pad(stamp.getDate())}-${pad(stamp.getMonth() + 1)}-${stamp.getFullYear()} ${pad(stamp.getHours())}:${pad(stamp.getMinutes())}:${pad(stamp.getSeconds())}`;
  });
  const [adAssetsOpen, setAdAssetsOpen] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState('primary');
  const [groups, setGroups] = useState([] as WizardGroup[]);
  const [renaming, setRenaming] = useState<null | { kind: 'group' | 'ad'; id: string }>(null);
  const [renameValue, setRenameValue] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    campaignId: string;
    landingPageUrl: string;
    campaignName?: string;
    tikTokAdsManagerLabel?: string;
  } | null>(null);
  const [showPublishSuccess, setShowPublishSuccess] = useState(false);
  const [carriers, setCarriers] = useState([] as Array<{ id: string; name: string }>);
  const [isps, setIsps] = useState([] as Array<{ id: string; name: string }>);
  const [audienceEstimate, setAudienceEstimate] = useState(null as TikTokAudienceEstimate | null);
  const [estimateError, setEstimateError] = useState(null as string | null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const campaignFromUrl = searchParams.get('campaignId') ?? '';
  const advertiserFromUrl = searchParams.get('advertiserId') ?? '';
  const copyFromUrl = searchParams.get('copyFrom') ?? '';
  const draftReady = useRef(false);
  const keepRestoredOptions = useRef(false);
  const restoredBudget = useRef(false);
  const keepRestoredIdentity = useRef(false);
  const discardDraft = useRef(false);
  const [persistReady, setPersistReady] = useState(false);
  const [draftLoading, setDraftLoading] = useState(Boolean(campaignFromUrl || copyFromUrl));
  const [draftPrompt, setDraftPrompt] = useState<StoredCampaignDraft | null>(null);
  const pendingDraftAdvertiser = useRef('');

  const selectedAdvertiser = advertisers.find((row) => row.advertiserId === advertiserId) ?? null;
  const currency = selectedAdvertiser?.currency || null;
  const symbol = currency ? CURRENCY_SYMBOLS[currency] ?? currency : '';

  function applyStoredDraft(saved: StoredCampaignDraft) {
    if (!advertiserFromUrl && saved.advertiserId) setAdvertiserId(saved.advertiserId);
    setCampaignName(saved.campaignName || defaultCampaignName());
    const restoredMenu = saved.menuObjective || menuFromApiObjective(saved.objective);
    const restoredObjective = apiObjectiveFromMenu(
      restoredMenu,
      saved.salesDestination || (saved.objective === 'PRODUCT_SALES' ? 'STORE' : 'WEBSITE'),
    );
    setObjective(restoredObjective);
    setSmartPlus(saved.smartPlus);
    setSearchCampaign(saved.searchCampaign);
    setMenuObjective(restoredMenu);
    setReachType(saved.reachType || 'AUCTION');
    setAppPromotionType(saved.appPromotionType || 'APP_INSTALL');
    setSalesDestination(
      restoredMenu === 'PRODUCT_SALES'
        ? 'STORE'
        : (saved.salesDestination || (saved.objective === 'PRODUCT_SALES' ? 'STORE' : 'WEBSITE')),
    );
    setTrafficDestination(saved.trafficDestination || 'WEBSITE');
    setTrafficOptimizationGoal(saved.trafficOptimizationGoal || 'CLICK');
    setVideoViewsGoal(saved.videoViewsGoal || 'ENGAGED_VIEW');
    setVideoFrequencyMode(saved.videoFrequencyMode || 'NONE');
    setEngagementGoal(saved.engagementGoal || 'FOLLOWERS');
    setDestination(saved.destination);
    setWhatsappNumber(saved.whatsappNumber);
    setPageId(saved.pageId);
    setPixelId(saved.pixelId);
    setOptimizationEvent(saved.optimizationEvent);
    setClickAttributionWindow(saved.clickAttributionWindow || WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.clickWindowDefault);
    setViewAttributionWindow(saved.viewAttributionWindow || WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.viewWindowDefault);
    setAttributionEventCount(saved.attributionEventCount || WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.eventCountDefault);
    setAppId(saved.appId);
    setUsePlatformLink(saved.usePlatformLink);
    setLandingPageUrl(saved.landingPageUrl);
    setLocationIds(saved.locationIds);
    setGender(saved.gender);
    setAgeGroups(saved.ageGroups);
    setInterestIds(saved.interestIds);
    setLanguageCodes(saved.languageCodes);
    setLanguagesAll(!saved.languageCodes?.length);
    setSpendingPower(saved.spendingPower);
    setAudienceIds(saved.audienceIds);
    setExcludedAudienceIds(saved.excludedAudienceIds);
    setSmartInterestBehavior(saved.smartInterestBehavior);
    setPlacementMode(saved.placementMode);
    setPlacements(saved.placements?.length ? saved.placements : ['PLACEMENT_TIKTOK']);
    setIncludeSearchResult(saved.includeSearchResult);
    setTiktokSubplacements(saved.tiktokSubplacements?.length ? saved.tiktokSubplacements : ['IN_FEED', 'SEARCH_FEED']);
    setFrequencyMode(saved.frequencyMode || 'CAP');
    setFrequency(saved.frequency || String(REACH_OBJECTIVE_CONFIG.frequency.defaultCap.frequency));
    setFrequencySchedule(saved.frequencySchedule || String(REACH_OBJECTIVE_CONFIG.frequency.defaultCap.frequencySchedule));
    setCtaEnabled(saved.ctaEnabled !== false);
    setBudgetMode(saved.budgetMode);
    setBudget(saved.budget);
    setBudgetIncreaseEnabled(saved.budgetIncreaseEnabled);
    setBudgetIncreaseAmount(saved.budgetIncreaseAmount);
    setBudgetIncreaseMaxTimes(saved.budgetIncreaseMaxTimes || '10');
    setBidStrategy(saved.bidStrategy);
    setTargetCost(saved.targetCost);
    setAcceleratedDelivery(saved.acceleratedDelivery);
    setScheduleMode(saved.scheduleMode);
    setScheduleStartDate(saved.scheduleStartDate);
    setScheduleEndDate(saved.scheduleEndDate);
    setDevices(saved.devices);
    setMinAndroidVersion(saved.minAndroidVersion);
    setMinIosVersion(saved.minIosVersion);
    setNetworkTypes(saved.networkTypes?.length ? saved.networkTypes : ['WIFI', '2G', '3G', '4G', '5G']);
    setCarrierIds(saved.carrierIds);
    setIspIds(saved.ispIds);
    setDevicePriceMode(saved.devicePriceMode);
    setDevicePriceMin(saved.devicePriceMin);
    setDevicePriceMax(saved.devicePriceMax);
    setWeek(saved.week);
    setTimezone(saved.timezone);
    setIdentityKey(saved.identityKey);
    setSelected(saved.selected);
    setAuthCodes(saved.authCodes);
    setCallToAction(saved.callToAction);
    setAllowComments(saved.allowComments);
    setAllowDownload(saved.allowDownload);
    setAllowShare(saved.allowShare);
    setInteractiveAddonsEnabled(saved.interactiveAddonsEnabled === true);
    setCardId(saved.cardId || '');
    setCardPreviewUrl(saved.cardPreviewUrl || '');
    setStep(saved.step === 2 || saved.step === 3 ? saved.step : 1);
    setUnlockedStep(
      saved.unlockedStep === 3 || saved.step === 3
        ? 3
        : saved.unlockedStep === 2 || saved.step === 2
          ? 2
          : 1,
    );
    setGroupName(saved.groupName || 'المجموعة 1');
    if (saved.adName) setAdName(saved.adName);
    setActiveGroupId(saved.activeGroupId || 'primary');
    if (saved.groups?.length) setGroups(saved.groups);
    draftReady.current = true;
    keepRestoredOptions.current = true;
    restoredBudget.current = true;
    keepRestoredIdentity.current = Boolean(saved.identityKey);
    discardDraft.current = false;
  }

  useEffect(() => {
    if (advertiserFromUrl) setAdvertiserId(advertiserFromUrl);
    setEditingId(campaignFromUrl);
    setCopyFrom(campaignFromUrl ? '' : copyFromUrl);
    const creating = !campaignFromUrl && !copyFromUrl;
    let savedForPreferred: StoredCampaignDraft | null = null;
    if (creating) {
      const saved = readCampaignDraft();
      if (saved && draftHasProgress(saved)) {
        savedForPreferred = saved;
        pendingDraftAdvertiser.current = saved.advertiserId || '';
        if (isPageReload()) {
          applyStoredDraft(saved);
          setDraftPrompt(null);
          setPersistReady(true);
        } else {
          setDraftPrompt(saved);
          // لا نحفظ الافتراضيات فوق المسودة حتى يختار المستخدم
          setPersistReady(false);
        }
      } else {
        if (saved) {
          try { sessionStorage.removeItem(CAMPAIGN_DRAFT_KEY); } catch { /* ignore */ }
        }
        pendingDraftAdvertiser.current = '';
        setDraftPrompt(null);
        setPersistReady(true);
      }
    } else {
      pendingDraftAdvertiser.current = '';
      setDraftPrompt(null);
      setPersistReady(true);
    }
    let cancelled = false;
    setLoadingAccounts(true);
    fetchTikTokBusinessAdvertisers()
      .then((data) => {
        if (cancelled) return;
        setAdvertisers(data.advertisers);
        if (advertiserFromUrl) return;
        const preferred = savedForPreferred?.advertiserId || pendingDraftAdvertiser.current;
        setAdvertiserId((current) => {
          if (preferred && data.advertisers.some((row) => row.advertiserId === preferred)) return preferred;
          if (current && data.advertisers.some((row) => row.advertiserId === current)) return current;
          return data.advertisers[0]?.advertiserId ?? '';
        });
      })
      .catch((err) => setError(parseApiError(err)))
      .finally(() => { if (!cancelled) setLoadingAccounts(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore only on URL identity change
  }, [advertiserFromUrl, campaignFromUrl, copyFromUrl]);

  function refreshAdvertisers() {
    setLoadingAccounts(true);
    fetchTikTokBusinessAdvertisers()
      .then((data) => {
        setAdvertisers(data.advertisers);
        setAdvertiserId((current) => {
          if (current && data.advertisers.some((row) => row.advertiserId === current)) return current;
          return data.advertisers[0]?.advertiserId ?? '';
        });
      })
      .catch((err) => setError(parseApiError(err)))
      .finally(() => setLoadingAccounts(false));
  }

  function advanceTo(next: WizardStep) {
    setUnlockedStep((current) => (current < next ? next : current));
    setStep(next);
  }

  useEffect(() => {
    if (editingId || copyFrom || restoredBudget.current) return;
    if (currency === 'IQD') setBudget((current) => (current === '20' ? '50000' : current));
    else if (currency) setBudget((current) => (current === '50000' ? '20' : current));
  }, [currency, editingId, copyFrom]);

  useEffect(() => {
    if (!advertiserId) return;
    iraqDefaultApplied.current = false;
    setLoadingOptions(true);
    setOptionsError(null);
    fetchTikTokAdCreateOptions(advertiserId)
      .then((data) => {
        setOptions(data);
        if (keepRestoredIdentity.current) keepRestoredIdentity.current = false;
        else {
          setIdentityKey('');
          setVideos([]);
          setIdentityOpen(false);
        }
        const linked = data.pixels.find((pixel) => pixel.trackingUrl) ?? data.pixels[0];
        const keepOptions = keepRestoredOptions.current;
        keepRestoredOptions.current = false;
        setPixelId((current) => {
          if (keepOptions && current) return current;
          if (current && (draftReady.current || data.pixels.some((pixel) => pixel.pixelId === current))) return current;
          return linked?.pixelId ?? '';
        });
        if (!keepOptions) {
          const autoPixel = linked;
          if (autoPixel?.trackingUrl) setUsePlatformLink(true);
        } else {
          const currentPixel = data.pixels.find((pixel) => pixel.pixelId === pixelId) ?? linked;
          if (currentPixel?.trackingUrl) setUsePlatformLink(true);
        }
        // العراق افتراضياً عند إنشاء حملة جديدة
        if (!keepOptions && !draftReady.current && !editingId && !copyFrom && !iraqDefaultApplied.current) {
          const iraq = (data.regions ?? []).find((region) => {
            const code = (region.regionCode || '').toUpperCase();
            const name = (region.name || '').toLowerCase();
            return code === 'IQ' || name.includes('iraq') || name.includes('العراق');
          });
          if (iraq?.locationId) {
            iraqDefaultApplied.current = true;
            setLocationIds((current) => (current.length ? current : [iraq.locationId]));
          }
        }
        if (data.advertiser?.currency || data.advertiser?.timezone) {
          setAdvertisers((current) => current.map((row) => row.advertiserId === advertiserId ? { ...row, currency: data.advertiser?.currency || row.currency, timezone: data.advertiser?.timezone || row.timezone, name: data.advertiser?.name || row.name } : row));
          // لا نفرض توقيت الحساب على «توقيت الجدولة» — المستخدم يختار بغداد لمعنى التواريخ
        }
      })
      .catch((err) => setOptionsError(parseApiError(err)))
      .finally(() => setLoadingOptions(false));
  }, [advertiserId]);

  const sourceId = editingId || copyFrom;
  useEffect(() => {
    if (!sourceId || !advertiserId) {
      if (!sourceId) setDraftLoading(false);
      return;
    }
    const copying = !editingId;
    setDraftLoading(true);
    draftReady.current = false;
    fetchTikTokCampaignDraft(advertiserId, sourceId)
      .then((draft) => {
        setAdGroupId(copying ? '' : draft.adGroupId);
        setCampaignName(copying ? (draft.name.includes('نسخة') ? `${draft.name} 2` : `${draft.name} نسخة`) : draft.name);
        setObjective(draft.objective || 'TRAFFIC');
        setMenuObjective(menuFromApiObjective(draft.objective || 'TRAFFIC'));
        setSalesDestination('WEBSITE');
        if (draft.objective === 'PRODUCT_SALES' || menuFromApiObjective(draft.objective || '') === 'PRODUCT_SALES') {
          setSmartPlus(true);
        }
        if (draft.objective === 'LEAD_GENERATION' || draft.objective === 'WEB_CONVERSIONS') {
          setSmartPlus(false);
        }
        if (draft.objective === 'WEB_CONVERSIONS') setSearchCampaign(false);
        setDestination(draft.destination);
        setWhatsappNumber(draft.whatsappNumber);
        setPixelId(draft.pixelId);
        setOptimizationEvent((() => {
          const raw = draft.optimizationEvent || 'SHOPPING';
          if (raw === 'ON_WEB_ORDER') return 'SHOPPING';
          return raw;
        })());
        if (draft.appId) setAppId(draft.appId);
        setLocationIds(draft.locationIds);
        setGender(draft.gender || 'GENDER_UNLIMITED');
        setAgeGroups(draft.ageGroups);
        setInterestIds(draft.interestCategoryIds);
        setBudgetMode(draft.budgetMode === 'BUDGET_MODE_TOTAL' ? 'BUDGET_MODE_TOTAL' : 'BUDGET_MODE_DAY');
        if (draft.budget) setBudget(String(draft.budget));
        setBidStrategy(draft.bidStrategy === 'TARGET' ? 'TARGET' : 'HIGHEST');
        setTargetCost(draft.bidStrategy === 'TARGET' && draft.targetCost ? String(draft.targetCost) : '');
        setScheduleMode(draft.scheduleMode);
        if (draft.scheduleStartDate) setScheduleStartDate(draft.scheduleStartDate);
        if (draft.scheduleEndDate) setScheduleEndDate(draft.scheduleEndDate);
        setDevices(draft.devices || 'ALL');
        setWeek(weekFromDayparting(draft.dayparting));
        setCallToAction(draft.callToAction || 'LEARN_MORE');
        setLandingPageUrl(draft.landingPageUrl);
        setUsePlatformLink(draft.destination !== 'WHATSAPP' && (!draft.landingPageUrl || draft.landingPageUrl.includes('/r/')));
        const loadedVideos = draft.creatives.map((video) => ({
          ...video,
          adId: copying ? undefined : video.adId,
          key: copying ? `copy:${video.identityType}:${video.itemId}` : video.adId || `${video.identityType}:${video.itemId}`,
        }));
        setSelected(loadedVideos);
        const loadedGroup: WizardGroup = {
          id: 'primary',
          name: 'المجموعة 1',
          adGroupId: copying ? '' : draft.adGroupId,
          destination: draft.destination,
          whatsappNumber: draft.whatsappNumber,
          pageId: '',
          pixelId: draft.pixelId,
          optimizationEvent: draft.optimizationEvent === 'ON_WEB_ORDER'
            ? 'SHOPPING'
            : (draft.optimizationEvent || 'SHOPPING'),
          clickAttributionWindow: WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.clickWindowDefault,
          viewAttributionWindow: WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.viewWindowDefault,
          attributionEventCount: WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.eventCountDefault,
          appId: draft.appId || '',
          usePlatformLink: draft.destination !== 'WHATSAPP' && (!draft.landingPageUrl || draft.landingPageUrl.includes('/r/')),
          landingPageUrl: draft.landingPageUrl,
          locationIds: draft.locationIds,
          gender: draft.gender || 'GENDER_UNLIMITED',
          ageGroups: draft.ageGroups,
          interestIds: draft.interestCategoryIds,
          languageCodes: [],
          spendingPower: 'ALL',
          audienceIds: [],
          excludedAudienceIds: [],
          smartInterestBehavior: false,
          placementMode: 'MANUAL',
          placements: ['PLACEMENT_TIKTOK'],
          includeSearchResult: true,
          tiktokSubplacements: ['IN_FEED', 'SEARCH_FEED'],
          frequencyMode: 'CAP',
          frequency: String(REACH_OBJECTIVE_CONFIG.frequency.defaultCap.frequency),
          frequencySchedule: String(REACH_OBJECTIVE_CONFIG.frequency.defaultCap.frequencySchedule),
          ctaEnabled: true,
          budgetMode: draft.budgetMode === 'BUDGET_MODE_TOTAL' ? 'BUDGET_MODE_TOTAL' : 'BUDGET_MODE_DAY',
          budget: draft.budget ? String(draft.budget) : '20',
          budgetIncreaseEnabled: false,
          budgetIncreaseAmount: '',
          budgetIncreaseMaxTimes: '10',
          bidStrategy: draft.bidStrategy === 'TARGET' ? 'TARGET' : 'HIGHEST',
          targetCost: draft.bidStrategy === 'TARGET' && draft.targetCost ? String(draft.targetCost) : '',
          acceleratedDelivery: false,
          scheduleMode: draft.scheduleMode,
          scheduleStartDate: draft.scheduleStartDate || localIso(new Date()),
          scheduleEndDate: draft.scheduleEndDate || '',
          devices: draft.devices || 'ALL',
          minAndroidVersion: '',
          minIosVersion: '',
          networkTypes: ['WIFI', '2G', '3G', '4G', '5G'],
          carrierIds: [],
          ispIds: [],
          devicePriceMode: 'ALL',
          devicePriceMin: '',
          devicePriceMax: '',
          week: weekFromDayparting(draft.dayparting),
          timezone: timezone || 'Asia/Baghdad',
          identityKey: '',
          selected: loadedVideos,
          authCodes: '',
          callToAction: draft.callToAction || 'LEARN_MORE',
          allowComments: true,
          allowDownload: false,
          allowShare: true,
          interactiveAddonsEnabled: false,
          cardId: '',
          cardPreviewUrl: '',
        };
        setGroupName(loadedGroup.name);
        setActiveGroupId(loadedGroup.id);
        setGroups([loadedGroup]);
        setStep(1);
        setUnlockedStep(3);
        draftReady.current = true;
      })
      .catch((err) => setError(parseApiError(err)))
      .finally(() => setDraftLoading(false));
  }, [sourceId, advertiserId, editingId]);

  const filteredAdvertisers = useMemo(() => {
    const query = accountQuery.trim().toLowerCase();
    return advertisers.filter((row) => !query || (row.name ?? '').toLowerCase().includes(query) || row.advertiserId.includes(query));
  }, [advertisers, accountQuery]);
  const filteredLanguages = useMemo(() => {
    const query = languageQuery.trim().toLowerCase();
    const all = options?.languages ?? [];
    if (!query) return all;
    return all.filter((lang) => lang.name.toLowerCase().includes(query) || lang.code.toLowerCase().includes(query));
  }, [options?.languages, languageQuery]);
  const countries = useMemo(() => {
    const query = countryQuery.trim().toLowerCase();
    const all = options?.regions ?? [];
    const selected = all.filter((region) => locationIds.includes(region.locationId));
    const rest = all.filter((region) => !locationIds.includes(region.locationId) && (!query || region.name.toLowerCase().includes(query) || region.regionCode.toLowerCase().includes(query))).slice(0, 40);
    return [...selected, ...rest];
  }, [options, countryQuery, locationIds]);
  const interests = useMemo(() => {
    const query = interestQuery.trim().toLowerCase();
    const all = options?.interests ?? [];
    const selectedItems = all.filter((item) => interestIds.includes(item.id));
    const rest = all.filter((item) => !interestIds.includes(item.id) && (!query || item.name.toLowerCase().includes(query))).slice(0, 40);
    return [...selectedItems, ...rest];
  }, [options, interestQuery, interestIds]);
  const filteredVideos = useMemo(() => {
    const query = videoSearch.trim().toLowerCase();
    if (!query) return videos;
    return videos.filter((video) =>
      (video.text || '').toLowerCase().includes(query)
      || video.itemId.toLowerCase().includes(query),
    );
  }, [videos, videoSearch]);

  async function loadIdentityVideos(value: string, cursor = '', clearSelected = false) {
    if (!cursor && clearSelected) setSelected([]);
    if (!cursor) setVideoSearch('');
    setIdentityKey(value);
    if (!value || !advertiserId || loadingVideos.current) return;
    const [identityId, identityType] = value.split('|');
    loadingVideos.current = true;
    setBusy(true);
    setError(null);
    try {
      const data = await fetchTikTokIdentityVideos(advertiserId, identityId, identityType, cursor || undefined);
      setVideos((current) => (cursor ? [...current, ...data.videos] : data.videos));
      setVideoCursor(data.nextCursor || '');
      setHasMoreVideos(Boolean(data.hasMore));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      loadingVideos.current = false;
      setBusy(false);
    }
  }

  function selectIdentityAccount(key: string) {
    const switching = Boolean(identityKey && identityKey !== key);
    setIdentityOpen(false);
    setVideos([]);
    setHasMoreVideos(false);
    setVideoCursor('');
    void loadIdentityVideos(key, '', switching);
  }

  function selectVideoSource(source: 'IDENTITY' | 'AUTH_CODE') {
    setVideoSource(source);
    if (source === 'AUTH_CODE') {
      setIdentityOpen(false);
    }
  }

  function onVideoScroll(event: React.UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    if (!hasMoreVideos || !videoCursor || loadingVideos.current) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) void loadIdentityVideos(identityKey, videoCursor);
  }

  function addSelected(video: TikTokSparkVideo, key: string) {
    setSelected((current) => (current.some((item) => item.key === key) ? current : [...current, { ...video, key }]));
  }

  async function addAuthCodes() {
    const codes = authCodes.split(/[\n,]+/).map((code) => code.trim()).filter(Boolean);
    if (!advertiserId || !codes.length) return;
    setBusy(true);
    setError(null);
    try {
      let last: TikTokSparkVideo | null = null;
      for (const code of codes) {
        const video = await previewTikTokSparkCode(advertiserId, code);
        addSelected(video, `code:${video.itemId}`);
        last = video;
      }
      setAuthCodes('');
      if (last) {
        const embed = last.itemId ? `https://www.tiktok.com/embed/v2/${last.itemId}` : '';
        setPreview({
          text: last.text,
          posterUrl: last.posterUrl,
          videoUrl: last.videoUrl,
          previewLink: last.previewLink || embed || undefined,
        });
      }
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  }

  function toggleCountry(region: { locationId: string; regionCode: string }) {
    const exists = locationIds.includes(region.locationId);
    setLocationIds(exists ? locationIds.filter((item) => item !== region.locationId) : [...locationIds, region.locationId]);
    // لا نغيّر توقيت الجدولة عند اختيار الدولة — تيك توك يعتمد توقيت الحساب الإعلاني.
  }

  function applySelectedInstantForm(form: TikTokInstantForm) {
    setDestination('INSTANT_PAGE');
    setPageId(form.pageId);
    setUsePlatformLink(false);
    setOptions((current) => {
      if (!current) return current;
      const exists = (current.instantPages ?? []).some((row) => row.pageId === form.pageId);
      if (exists) {
        return {
          ...current,
          instantPages: (current.instantPages ?? []).map((row) => (
            row.pageId === form.pageId ? { ...row, ...form } : row
          )),
        };
      }
      return { ...current, instantPages: [form, ...(current.instantPages ?? [])] };
    });
  }

  async function openLeadInstantFormEditor(actionType: 'create' | 'copy' | 'edit', formPageId?: string) {
    if (!advertiserId) {
      setError('اختر الحساب الإعلاني أولاً');
      return;
    }
    setInstantFormBusy(true);
    setError(null);
    try {
      const token = await fetchTikTokTipSdkToken(advertiserId);
      const appId = options?.tipAppId || token.appId;
      const result = await openTikTokInstantFormEditor({
        appId,
        advertiserId,
        ixAccessToken: token.tipSdkAccessToken,
        actionType,
        pageId: formPageId,
        language: 'ar',
      });
      const nextId = String(result.pageId || formPageId || '').trim();
      if (nextId) {
        applySelectedInstantForm({
          pageId: nextId,
          name: (options?.instantPages ?? []).find((row) => row.pageId === nextId)?.name || `استمارة ${nextId}`,
        });
      }
      // حدّث قائمة المكتبة
      const refreshed = await fetchTikTokAdCreateOptions(advertiserId).catch(() => null);
      if (refreshed) {
        setOptions(refreshed);
        if (nextId) {
          const match = (refreshed.instantPages ?? []).find((row) => row.pageId === nextId);
          if (match) applySelectedInstantForm(match);
        }
      }
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setInstantFormBusy(false);
    }
  }

  function cloneWeek(week: boolean[][]) {
    return week.map((day) => [...day]);
  }

  function cloneSelected(videos: DraftVideo[], keyPrefix = 'sel') {
    return videos.map((video) => ({
      ...video,
      adId: undefined,
      key: `${keyPrefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}:${video.itemId}`,
    }));
  }

  function snapshotGroup(): WizardGroup {
    return {
      id: activeGroupId,
      name: groupName.trim() || 'مجموعة إعلانية',
      adGroupId,
      destination,
      whatsappNumber,
      pageId,
      pixelId,
      optimizationEvent,
      clickAttributionWindow,
      viewAttributionWindow,
      attributionEventCount,
      appId,
      usePlatformLink,
      landingPageUrl,
      locationIds: [...locationIds],
      gender,
      ageGroups: [...ageGroups],
      interestIds: [...interestIds],
      languageCodes: [...languageCodes],
      spendingPower,
      audienceIds: [...audienceIds],
      excludedAudienceIds: [...excludedAudienceIds],
      smartInterestBehavior,
      placementMode,
      placements: [...placements],
      includeSearchResult,
      tiktokSubplacements: [...tiktokSubplacements],
      frequencyMode,
      frequency,
      frequencySchedule,
      ctaEnabled,
      budgetMode,
      budget,
      budgetIncreaseEnabled,
      budgetIncreaseAmount,
      budgetIncreaseMaxTimes,
      bidStrategy,
      targetCost,
      acceleratedDelivery,
      scheduleMode,
      scheduleStartDate,
      scheduleEndDate,
      devices,
      minAndroidVersion,
      minIosVersion,
      networkTypes: [...networkTypes],
      carrierIds: [...carrierIds],
      ispIds: [...ispIds],
      devicePriceMode,
      devicePriceMin,
      devicePriceMax,
      week: cloneWeek(week),
      timezone,
      identityKey,
      selected: selected.map((video) => ({ ...video })),
      authCodes,
      callToAction,
      allowComments,
      allowDownload,
      allowShare,
      interactiveAddonsEnabled,
      cardId,
      cardPreviewUrl,
    };
  }

  function loadGroup(group: WizardGroup) {
    setGroupName(group.name);
    setAdGroupId(group.adGroupId);
    setDestination(group.destination);
    setWhatsappNumber(group.whatsappNumber);
    setPageId(group.pageId || '');
    setPixelId(group.pixelId);
    setOptimizationEvent(group.optimizationEvent);
    setClickAttributionWindow(group.clickAttributionWindow || WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.clickWindowDefault);
    setViewAttributionWindow(group.viewAttributionWindow || WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.viewWindowDefault);
    setAttributionEventCount(group.attributionEventCount || WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.eventCountDefault);
    setAppId(group.appId);
    setUsePlatformLink(group.usePlatformLink);
    setLandingPageUrl(group.landingPageUrl);
    setLocationIds([...(group.locationIds ?? [])]);
    setGender(group.gender);
    setAgeGroups([...(group.ageGroups ?? [])]);
    setInterestIds([...(group.interestIds ?? [])]);
    setLanguageCodes([...(group.languageCodes ?? [])]);
    setSpendingPower(group.spendingPower || 'ALL');
    setAudienceIds([...(group.audienceIds ?? [])]);
    setExcludedAudienceIds([...(group.excludedAudienceIds ?? [])]);
    setSmartInterestBehavior(Boolean(group.smartInterestBehavior));
    setPlacementMode(group.placementMode || 'MANUAL');
    setPlacements(group.placements?.length ? [...group.placements] : ['PLACEMENT_TIKTOK']);
    setIncludeSearchResult(group.includeSearchResult !== false);
    setTiktokSubplacements(group.tiktokSubplacements?.length ? [...group.tiktokSubplacements] : ['IN_FEED', 'SEARCH_FEED']);
    setFrequencyMode(group.frequencyMode === 'TARGET' ? 'TARGET' : 'CAP');
    setFrequency(group.frequency || String(REACH_OBJECTIVE_CONFIG.frequency.defaultCap.frequency));
    setFrequencySchedule(group.frequencySchedule || String(REACH_OBJECTIVE_CONFIG.frequency.defaultCap.frequencySchedule));
    setCtaEnabled(group.ctaEnabled !== false);
    setBudgetMode(group.budgetMode);
    setBudget(group.budget);
    setBudgetIncreaseEnabled(Boolean(group.budgetIncreaseEnabled));
    setBudgetIncreaseAmount(group.budgetIncreaseAmount || '');
    setBudgetIncreaseMaxTimes(group.budgetIncreaseMaxTimes || '10');
    setBidStrategy(group.bidStrategy);
    setTargetCost(group.targetCost);
    setAcceleratedDelivery(Boolean(group.acceleratedDelivery));
    setScheduleMode(group.scheduleMode);
    setScheduleStartDate(group.scheduleStartDate);
    setScheduleEndDate(group.scheduleEndDate);
    setDevices(group.devices);
    setMinAndroidVersion(group.minAndroidVersion || '');
    setMinIosVersion(group.minIosVersion || '');
    setNetworkTypes(group.networkTypes?.length ? [...group.networkTypes] : ['WIFI', '2G', '3G', '4G', '5G']);
    setCarrierIds([...(group.carrierIds || [])]);
    setIspIds([...(group.ispIds || [])]);
    setDevicePriceMode(group.devicePriceMode || 'ALL');
    setDevicePriceMin(group.devicePriceMin || '');
    setDevicePriceMax(group.devicePriceMax || '');
    setWeek(cloneWeek(group.week ?? fullWeek(true)));
    setTimezone(group.timezone);
    setIdentityKey(group.identityKey);
    setSelected((group.selected ?? []).map((video) => ({ ...video })));
    setAuthCodes(group.authCodes);
    setCallToAction(group.callToAction);
    setAllowComments(group.allowComments !== false);
    setAllowDownload(Boolean(group.allowDownload));
    setAllowShare(group.allowShare !== false);
    setInteractiveAddonsEnabled(Boolean(group.interactiveAddonsEnabled && group.cardId));
    setCardId(group.cardId || '');
    setCardPreviewUrl(group.cardPreviewUrl || '');
    setVideos([]);
    setHasMoreVideos(false);
  }

  function listedGroups() {
    const live = snapshotGroup();
    if (!groups.length) return [live];
    return groups.map((group) => (group.id === activeGroupId ? live : group));
  }

  function selectGroup(id: string) {
    if (id === activeGroupId) return;
    const all = listedGroups();
    const target = all.find((group) => group.id === id);
    if (!target) return;
    setGroups(all);
    loadGroup(target);
    setActiveGroupId(id);
  }

  function duplicateGroup(sourceId?: string) {
    const all = listedGroups();
    const source = sourceId ? all.find((group) => group.id === sourceId) : all.find((group) => group.id === activeGroupId) ?? all[0];
    if (!source) return;
    const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const copy: WizardGroup = {
      ...source,
      id: newGroupId(),
      name: `${source.name} نسخة`,
      adGroupId: '',
      locationIds: [...(source.locationIds ?? [])],
      ageGroups: [...(source.ageGroups ?? [])],
      interestIds: [...(source.interestIds ?? [])],
      languageCodes: [...(source.languageCodes ?? [])],
      audienceIds: [...(source.audienceIds ?? [])],
      excludedAudienceIds: [...(source.excludedAudienceIds ?? [])],
      placements: [...(source.placements ?? [])],
      tiktokSubplacements: [...(source.tiktokSubplacements ?? [])],
      networkTypes: [...(source.networkTypes ?? [])],
      carrierIds: [...(source.carrierIds ?? [])],
      ispIds: [...(source.ispIds ?? [])],
      week: cloneWeek(source.week ?? fullWeek(true)),
      // إعلانات مستقلة لكل مجموعة مكررة — لا تشارك نفس المراجع
      selected: cloneSelected(source.selected ?? [], `gcopy:${stamp}`),
      authCodes: source.authCodes || '',
    };
    const next = [...all.map((group) => (group.id === activeGroupId ? snapshotGroup() : group)), copy];
    setGroups(next);
    loadGroup(copy);
    setActiveGroupId(copy.id);
    setStep(2);
  }

  function removeGroup(id: string) {
    const all = listedGroups().filter((group) => group.id !== id);
    if (!all.length) return;
    setGroups(all);
    if (id === activeGroupId) {
      loadGroup(all[0]);
      setActiveGroupId(all[0].id);
    }
  }

  function renameGroup(id: string, name: string) {
    const next = name.trim();
    if (!next) return;
    if (id === activeGroupId) setGroupName(next);
    setGroups(listedGroups().map((group) => (group.id === id ? { ...group, name: next } : group)));
    setRenaming(null);
  }

  function startRenameGroup(group: WizardGroup) {
    setRenaming({ kind: 'group', id: group.id });
    setRenameValue(group.name);
  }

  function duplicateAd(videoKey: string) {
    setSelected((current) => {
      const source = current.find((video) => video.key === videoKey);
      if (!source) return current;
      const copy: DraftVideo = {
        ...source,
        adId: undefined,
        key: `copy-ad:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 6)}:${source.itemId}`,
        text: source.text ? `${source.text} نسخة` : source.text,
      };
      return [...current, copy];
    });
    advanceTo(3);
  }

  function removeAd(videoKey: string) {
    setSelected((current) => current.filter((video) => video.key !== videoKey));
  }

  function renameAd(videoKey: string, name: string) {
    const next = name.trim();
    if (!next) return;
    setSelected((current) => current.map((video) => (video.key === videoKey ? { ...video, text: next } : video)));
    setRenaming(null);
  }

  function startRenameAd(video: DraftVideo) {
    setRenaming({ kind: 'ad', id: video.key });
    setRenameValue(video.text || video.itemId);
  }

  /** phase=adgroup: خطوة المجموعة — لا نطلب الاستمارة الفورية لعميل محتمل (تُختار في خطوة الإعلان) */
  function groupProblem(group: WizardGroup, phase: 'adgroup' | 'publish' = 'publish') {
    if (!group.locationIds.length) return 'اختر دولة واحدة على الأقل';
    if (!(Number(group.budget) > 0)) return 'أدخل ميزانية أكبر من صفر';
    if (group.scheduleMode === 'RANGE' && !group.scheduleEndDate) return 'حدد تاريخ نهاية الحملة';
    if (group.scheduleMode === 'RANGE' && group.scheduleStartDate && group.scheduleEndDate && group.scheduleEndDate < group.scheduleStartDate) {
      return 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية';
    }
    if (group.bidStrategy === 'TARGET' && !(Number(group.targetCost) > 0)) return 'أدخل التكلفة المستهدفة لكل نتيجة';
    const whatsappDigits = group.whatsappNumber.replace(/\D/g, '');
    if (group.destination === 'WHATSAPP' && !(whatsappDigits.length >= 8)) return 'أدخل رقم واتساب مع مفتاح الدولة';
    if (group.destination === 'INSTANT_PAGE' && !group.pageId) {
      // عميل محتمل: اختيار الاستمارة في خطوة الإعلان فقط
      if (objective === 'LEAD_GENERATION' && phase === 'adgroup') {
        /* ok — continue */
      } else if (objective === 'LEAD_GENERATION') {
        return 'اختر الاستمارة الفورية من المكتبة';
      } else {
        return 'اختر صفحة TikTok الفورية';
      }
    }
    const pixelNeeded = (objective === 'WEB_CONVERSIONS' || objective === 'LEAD_GENERATION') && group.destination === 'PIXEL';
    if (pixelNeeded && !group.pixelId) return 'اختر البكسل';
    if (objective === 'LEAD_GENERATION' && group.destination !== 'PIXEL' && group.destination !== 'INSTANT_PAGE') {
      return 'إنشاء عميل محتمل يدعم موقع الويب أو الاستمارة الفورية فقط';
    }
    if (objective === 'LEAD_GENERATION' && group.destination === 'PIXEL' && !/^https:\/\//i.test(group.landingPageUrl.trim()) && !group.usePlatformLink) {
      return 'أدخل رابط موقع بصيغة https:// أو استخدم رابط تتبع البكسل';
    }
    if (
      objective === 'PRODUCT_SALES'
      && (salesDestination === 'WEBSITE' || smartPlus)
      && !group.pixelId
    ) {
      return 'اختر البكسل لحملة مبيعات موقع ويب (Smart+)';
    }
    if (
      (objective === 'LEAD_GENERATION'
        || objective === 'WEB_CONVERSIONS'
        || (objective === 'PRODUCT_SALES' && (salesDestination === 'WEBSITE' || smartPlus)))
      && group.destination === 'PIXEL'
      && !group.optimizationEvent
    ) {
      return 'حدّد حدث التحسين (مثل Contact / الاتصال)';
    }
    if (objective === 'APP_PROMOTION' && !group.appId.trim()) return 'أدخل معرّف التطبيق';
    if (objective === 'TRAFFIC' && trafficDestination === 'APP' && !group.appId.trim()) return 'أدخل معرّف التطبيق لوجهة التطبيق';
    if (objective === 'TRAFFIC' && (trafficOptimizationGoal === 'TRAFFIC_LANDING_PAGE_VIEW' || trafficOptimizationGoal === 'ENGAGED_SESSION') && group.destination === 'PIXEL' && !group.pixelId) {
      return 'اختر اتصال البيانات / البكسل لهذا هدف التحسين';
    }
    if (objective === 'TRAFFIC' && trafficDestination === 'WEBSITE' && group.destination === 'PIXEL' && !group.pixelId && !/^https:\/\//i.test(group.landingPageUrl.trim()) && !group.usePlatformLink) {
      return 'أدخل رابط موقع بصيغة https:// أو اختر بكسل';
    }
    if (objective === 'REACH') {
      const freq = Number(group.frequency || frequency);
      const sched = Number(group.frequencySchedule || frequencySchedule);
      if (!(freq >= 1) || !(sched >= freq) || sched > 30) return 'اضبط التكرار: مرات الظهور ≤ الأيام وبحد أقصى 30 يوماً';
      if (group.destination === 'PIXEL' && !group.pixelId && !/^https:\/\//i.test(group.landingPageUrl.trim())) {
        return 'أدخل رابط موقع بصيغة https://';
      }
    }
    if (objective === 'VIDEO_VIEWS' && videoFrequencyMode === 'CAP') {
      const freq = Number(group.frequency || frequency);
      const sched = Number(group.frequencySchedule || frequencySchedule);
      if (!(freq >= 1) || !(sched >= freq) || sched > 30) return 'اضبط الحد الأقصى لمرات الظهور بشكل صالح';
    }
    if (!group.selected.length) return 'اختر فيديو واحداً على الأقل أو أدخل كود إعلان';
    return '';
  }

  function selectMenuObjective(id: MenuObjective) {
    setMenuObjective(id);
    const api = apiObjectiveFromMenu(id, salesDestination);
    setObjective(api);
    if (id === 'INSTANT_GROWTH') {
      setSmartPlus(false);
      setSearchCampaign(false);
    }
    if (id === 'LEAD_GENERATION') {
      setDestination('PIXEL');
      setPageId('');
      setOptimizationEvent('FORM');
      setSmartPlus(false);
      setSearchCampaign(false);
      setPlacementMode('MANUAL');
      setPlacements(['PLACEMENT_TIKTOK']);
      setIncludeSearchResult(false);
      setTiktokSubplacements([]);
      setBidStrategy('HIGHEST');
      setUsePlatformLink(true);
      setCampaignName((current) => (current.trim() ? current : defaultLeadCampaignName()));
    }
    if (id === 'WEB_CONVERSIONS') {
      setSalesDestination('WEBSITE');
      setDestination('PIXEL');
      setOptimizationEvent('SHOPPING');
      setClickAttributionWindow(WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.clickWindowDefault);
      setViewAttributionWindow(WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.viewWindowDefault);
      setAttributionEventCount(WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.eventCountDefault);
      setSmartPlus(false);
      setSearchCampaign(false);
      setPlacementMode('MANUAL');
      setPlacements(['PLACEMENT_TIKTOK']);
      setIncludeSearchResult(false);
      setTiktokSubplacements([]);
      setBidStrategy('HIGHEST');
      setUsePlatformLink(true);
    }
    if (id === 'PRODUCT_SALES') {
      // متجر تيك توك مخفي — مسار المبيعات الوحيد: موقع ويب Smart+
      setSalesDestination('WEBSITE');
      setDestination('PIXEL');
      setOptimizationEvent('CONSULT');
      setSmartPlus(true);
      setSearchCampaign(false);
      setPlacementMode('MANUAL');
      setPlacements(['PLACEMENT_TIKTOK']);
      setIncludeSearchResult(false);
      setTiktokSubplacements([]);
      setBidStrategy('HIGHEST');
      setUsePlatformLink(true);
    }
    if (id === 'REACH') {
      setPlacementMode('MANUAL');
      setPlacements(['PLACEMENT_TIKTOK']);
      setTiktokSubplacements(['IN_FEED', 'SEARCH_FEED']);
      setIncludeSearchResult(true);
      setFrequencyMode('CAP');
      setFrequency(String(REACH_OBJECTIVE_CONFIG.frequency.defaultCap.frequency));
      setFrequencySchedule(String(REACH_OBJECTIVE_CONFIG.frequency.defaultCap.frequencySchedule));
      setDestination('PIXEL');
      setUsePlatformLink(false);
      if (reachType === 'TOP_SEARCH') setSearchCampaign(true);
    }
    if (id === 'TRAFFIC') {
      setTrafficDestination('WEBSITE');
      setTrafficOptimizationGoal('CLICK');
      setDestination('PIXEL');
      setUsePlatformLink(false);
      setPlacementMode('MANUAL');
      setPlacements(['PLACEMENT_TIKTOK']);
      setTiktokSubplacements(['IN_FEED', 'SEARCH_FEED']);
    }
    if (id === 'VIDEO_VIEWS') {
      setVideoViewsGoal('ENGAGED_VIEW');
      setVideoFrequencyMode('NONE');
      setPlacementMode('MANUAL');
      setPlacements(['PLACEMENT_TIKTOK']);
      setTiktokSubplacements(['IN_FEED']);
      setIncludeSearchResult(false);
      setBidStrategy('HIGHEST');
    }
    if (id === 'ENGAGEMENT') {
      setEngagementGoal('FOLLOWERS');
      setPlacementMode('MANUAL');
      setPlacements(['PLACEMENT_TIKTOK']);
      setTiktokSubplacements(['IN_FEED']);
      setIncludeSearchResult(false);
      setBidStrategy('HIGHEST');
    }
    if (id === 'REACH' && reachType === 'TOP_SEARCH') setSearchCampaign(true);
    if (id !== 'REACH' && id !== 'TRAFFIC' && id !== 'APP_PROMOTION' && id !== 'WEB_CONVERSIONS' && id !== 'PRODUCT_SALES') {
      setSearchCampaign(false);
    }
    if (id === 'APP_PROMOTION' && appPromotionType === 'APP_RETARGETING') setSearchCampaign(false);
  }

  function selectSalesDestination(value: 'WEBSITE' | 'APP' | 'WEB_AND_APP' | 'STORE') {
    if (menuObjective === 'PRODUCT_SALES') {
      if (value === 'WEBSITE') {
        setSalesDestination('WEBSITE');
        setSmartPlus(true);
        setSearchCampaign(false);
        setDestination('PIXEL');
        return;
      }
      setSalesDestination('STORE');
      setSmartPlus(false);
      setObjective('PRODUCT_SALES');
      return;
    }
    setSalesDestination(value);
    if (value !== 'STORE') setSmartPlus(false);
  }

  function selectReachType(value: 'AUCTION' | 'TOP_SEARCH') {
    setReachType(value);
    setSearchCampaign(value === 'TOP_SEARCH');
  }

  async function publish() {
    const all = listedGroups();
    const publishObjective = apiObjectiveFromMenu(menuObjective, salesDestination);
    if (publishObjective !== objective) setObjective(publishObjective);
    for (const group of all) {
      const problem = groupProblem(group);
      if (!problem) continue;
      selectGroup(group.id);
      setStep(problem.includes('فيديو') || problem.includes('كود') ? 3 : 2);
      setError(`${group.name}: ${problem}`);
      return;
    }
    setBusy(true);
    setError(null);
    setPublishStatus(`جاري نشر ${all.length} مجموعة إعلانية وكل الإعلانات بالتسلسل...`);
    try {
      const payloads = all.map((group) => ({
        advertiserId,
        campaignId: editingId || undefined,
        adGroupId: group.adGroupId || undefined,
        adGroupName: group.name,
        adName: adName.trim() || undefined,
        campaignName,
        // مبيعات → WEB_CONVERSIONS + WEBSITE Smart+. تحويلات الموقع يدوي فقط. عميل محتمل يدوي فقط.
        objective: menuObjective === 'PRODUCT_SALES'
          ? 'WEB_CONVERSIONS'
          : publishObjective,
        smartPlus: menuObjective === 'WEB_CONVERSIONS' || menuObjective === 'LEAD_GENERATION'
          ? false
          : menuObjective === 'PRODUCT_SALES'
            ? true
            : smartPlus,
        searchCampaign: menuObjective === 'WEB_CONVERSIONS'
          ? false
          : menuObjective === 'REACH'
            ? reachType === 'TOP_SEARCH' || searchCampaign
            : searchCampaign,
        appPromotionType: menuObjective === 'APP_PROMOTION' ? appPromotionType : undefined,
        salesDestination: menuObjective === 'PRODUCT_SALES' ? 'WEBSITE' : undefined,
        trafficDestination: publishObjective === 'TRAFFIC' ? trafficDestination : undefined,
        optimizationGoal: publishObjective === 'TRAFFIC'
          ? trafficOptimizationGoal
          : publishObjective === 'VIDEO_VIEWS'
            ? videoViewsGoal
            : publishObjective === 'ENGAGEMENT'
              ? engagementGoal
              : publishObjective === 'LEAD_GENERATION'
                ? (group.destination === 'INSTANT_PAGE' ? 'LEAD_GENERATION' : 'CONVERT')
              : publishObjective === 'WEB_CONVERSIONS' || publishObjective === 'PRODUCT_SALES'
                ? 'CONVERT'
                : undefined,
        cpvVideoDuration: publishObjective === 'VIDEO_VIEWS'
          ? (VIDEO_VIEWS_OBJECTIVE_CONFIG.optimizationGoals.find((g) => g.id === videoViewsGoal)?.api.cpvVideoDuration || 'SIX_SECONDS')
          : undefined,
        destination: group.destination,
        whatsappNumber: group.destination === 'WHATSAPP' ? group.whatsappNumber : undefined,
        pageId: group.destination === 'INSTANT_PAGE' ? group.pageId : undefined,
        appId: publishObjective === 'APP_PROMOTION' || (publishObjective === 'TRAFFIC' && trafficDestination === 'APP') ? group.appId : undefined,
        pixelId: publishObjective === 'PRODUCT_SALES' && salesDestination !== 'WEBSITE' && !smartPlus
          ? undefined
          : (
            (publishObjective === 'LEAD_GENERATION' && group.destination === 'PIXEL')
            || publishObjective === 'WEB_CONVERSIONS'
            || group.destination === 'PIXEL'
            || (publishObjective === 'PRODUCT_SALES' && (smartPlus || salesDestination === 'WEBSITE'))
          )
            ? group.pixelId
            : undefined,
        optimizationEvent: publishObjective === 'PRODUCT_SALES' && salesDestination !== 'WEBSITE' && !smartPlus
          ? 'SHOPPING'
          : publishObjective === 'LEAD_GENERATION' && group.destination === 'INSTANT_PAGE'
            ? undefined
          : (
            (publishObjective === 'LEAD_GENERATION' && group.destination === 'PIXEL')
            || publishObjective === 'WEB_CONVERSIONS'
            || group.destination === 'PIXEL'
            || (publishObjective === 'PRODUCT_SALES' && (smartPlus || salesDestination === 'WEBSITE'))
          )
            ? (group.optimizationEvent || 'SHOPPING')
            : undefined,
        clickAttributionWindow: publishObjective === 'WEB_CONVERSIONS' || publishObjective === 'PRODUCT_SALES'
          ? (group.clickAttributionWindow || clickAttributionWindow)
          : undefined,
        viewAttributionWindow: publishObjective === 'WEB_CONVERSIONS' || publishObjective === 'PRODUCT_SALES'
          ? (group.viewAttributionWindow || viewAttributionWindow)
          : undefined,
        attributionEventCount: publishObjective === 'WEB_CONVERSIONS' || publishObjective === 'PRODUCT_SALES'
          ? (group.attributionEventCount || attributionEventCount)
          : undefined,
        usePlatformTrackingLink: group.destination === 'WHATSAPP' || group.destination === 'INSTANT_PAGE' ? false : group.usePlatformLink,
        landingPageUrl: group.destination === 'WHATSAPP' || group.destination === 'INSTANT_PAGE' || group.usePlatformLink ? undefined : group.landingPageUrl,
        locationIds: group.locationIds,
        gender: group.gender,
        ageGroups: group.ageGroups,
        interestCategoryIds: group.interestIds,
        languageCodes: languagesAll || !group.languageCodes.length ? [] : group.languageCodes,
        spendingPower: group.spendingPower,
        audienceIds: [],
        excludedAudienceIds: [],
        smartInterestBehavior: group.smartInterestBehavior,
        // Lead/Web/Sales: لا تُرسل tiktok_subplacements (تيك توك يرفضها → Invalid selection)
        placementMode: publishObjective === 'LEAD_GENERATION' && smartPlus
          ? 'AUTOMATIC'
          : (publishObjective === 'LEAD_GENERATION' || publishObjective === 'WEB_CONVERSIONS' || publishObjective === 'PRODUCT_SALES')
            ? 'MANUAL'
            : group.placementMode,
        placements: (publishObjective === 'LEAD_GENERATION' && smartPlus)
          ? undefined
          : (publishObjective === 'LEAD_GENERATION' || publishObjective === 'WEB_CONVERSIONS' || publishObjective === 'PRODUCT_SALES')
            ? ['PLACEMENT_TIKTOK']
            : group.placements,
        includeSearchResult: group.includeSearchResult,
        tiktokSubplacements: publishObjective === 'REACH' || publishObjective === 'VIDEO_VIEWS' || publishObjective === 'ENGAGEMENT'
          ? (group.tiktokSubplacements?.length ? group.tiktokSubplacements : tiktokSubplacements)
          : undefined,
        frequency: publishObjective === 'REACH' || (publishObjective === 'VIDEO_VIEWS' && videoFrequencyMode === 'CAP')
          ? Number(group.frequency || frequency)
          : undefined,
        frequencySchedule: publishObjective === 'REACH' || (publishObjective === 'VIDEO_VIEWS' && videoFrequencyMode === 'CAP')
          ? Number(group.frequencySchedule || frequencySchedule)
          : undefined,
        budgetMode: group.scheduleMode === 'CONTINUOUS' && group.budgetMode === 'BUDGET_MODE_TOTAL'
          ? 'BUDGET_MODE_DAY'
          : group.budgetMode,
        budget: Number(group.budget),
        bidStrategy: group.bidStrategy,
        targetCost: group.bidStrategy === 'TARGET' ? Number(group.targetCost) : undefined,
        acceleratedDelivery: group.acceleratedDelivery,
        scheduleMode: group.scheduleMode === 'RANGE' ? 'RANGE' : 'CONTINUOUS',
        scheduleStartDate: group.scheduleMode === 'RANGE' ? group.scheduleStartDate : undefined,
        scheduleEndDate: group.scheduleMode === 'RANGE' ? group.scheduleEndDate : undefined,
        // توقيت معنى التواريخ (مثلاً بغداد) — السيرفر يحوّله لتوقيت الحساب قبل إرساله لتيك توك
        timezone: group.timezone || timezone || 'Asia/Baghdad',
        devices: group.devices,
        minAndroidVersion: undefined,
        minIosVersion: undefined,
        networkTypes: undefined,
        carrierIds: [],
        ispIds: [],
        devicePriceMode: 'ALL' as const,
        devicePriceMin: undefined,
        devicePriceMax: undefined,
        dayparting: weekToDayparting(group.week),
        allowComments: group.allowComments,
        allowDownload: group.allowDownload,
        allowShare: group.allowShare,
        callToAction: smartPlus && !(SMART_PLUS_CTA_IDS as readonly string[]).includes(group.callToAction)
          ? 'LEARN_MORE'
          : group.callToAction,
        cardId: group.interactiveAddonsEnabled && group.cardId ? group.cardId : undefined,
        creatives: group.selected.map((video, index) => ({
          adId: video.adId,
          name: smartPlus
            ? (adName.trim() || campaignName.trim() || `إعلان ${index + 1}`)
            : ((video.text || '').trim().slice(0, 80) || `${campaignName.trim() || 'إعلان'} ${index + 1}`),
          authCode: video.authCode,
          itemId: video.itemId,
          identityId: video.identityId,
          identityType: video.identityType,
          identityAuthorizedBcId: video.identityAuthorizedBcId
            || options?.identities.find((row) => row.identityId === video.identityId && row.identityType === video.identityType)?.identityAuthorizedBcId,
        })),
      }));

      const last = await publishTikTokAdBundle(payloads);
      setResult(last);
      setShowPublishSuccess(true);
      setPublishStatus(null);
      if (!editingId) {
        discardDraft.current = true;
        sessionStorage.removeItem(CAMPAIGN_DRAFT_KEY);
      }
    } catch (err) {
      const message = parseApiError(err);
      const campaignMatch = message.match(/الحملة\s+(\d+)/);
      if (campaignMatch?.[1]) setEditingId(campaignMatch[1]);
      setError(message);
      setPublishStatus(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!showPublishSuccess) return;
    const handle = window.setTimeout(() => {
      router.push('/tiktok/ads/create');
    }, 1400);
    return () => window.clearTimeout(handle);
  }, [showPublishSuccess, router]);

  useEffect(() => {
    if (!persistReady || editingId || copyFrom || discardDraft.current || draftPrompt) return;
    const snapshot: StoredCampaignDraft = {
      advertiserId,
      campaignName,
      objective,
      smartPlus,
      searchCampaign,
      menuObjective,
      reachType,
      appPromotionType,
      salesDestination,
      trafficDestination,
      trafficOptimizationGoal,
      videoViewsGoal,
      videoFrequencyMode,
      engagementGoal,
      destination,
      whatsappNumber,
      pageId,
      pixelId,
      optimizationEvent,
      clickAttributionWindow,
      viewAttributionWindow,
      attributionEventCount,
      appId,
      usePlatformLink,
      landingPageUrl,
      locationIds,
      gender,
      ageGroups,
      interestIds,
      languageCodes,
      spendingPower,
      audienceIds,
      excludedAudienceIds,
      smartInterestBehavior,
      placementMode,
      placements,
      includeSearchResult,
      tiktokSubplacements,
      frequencyMode,
      frequency,
      frequencySchedule,
      ctaEnabled,
      budgetMode,
      budget,
      budgetIncreaseEnabled,
      budgetIncreaseAmount,
      budgetIncreaseMaxTimes,
      bidStrategy,
      targetCost,
      acceleratedDelivery,
      scheduleMode,
      scheduleStartDate,
      scheduleEndDate,
      devices,
      minAndroidVersion,
      minIosVersion,
      networkTypes,
      carrierIds,
      ispIds,
      devicePriceMode,
      devicePriceMin,
      devicePriceMax,
      week,
      timezone,
      identityKey,
      selected,
      authCodes,
      callToAction,
      allowComments,
      allowDownload,
      allowShare,
      interactiveAddonsEnabled,
      cardId,
      cardPreviewUrl,
      step,
      unlockedStep,
      groupName,
      adName,
      activeGroupId,
      groups: listedGroups(),
    };
    const handle = window.setTimeout(() => {
      try {
        sessionStorage.setItem(CAMPAIGN_DRAFT_KEY, JSON.stringify(snapshot));
      } catch {
        /* ignore quota / private mode */
      }
    }, 200);
    return () => window.clearTimeout(handle);
  }, [
    persistReady, editingId, copyFrom, draftPrompt, advertiserId, campaignName, objective, smartPlus, searchCampaign, menuObjective, reachType, appPromotionType, salesDestination, trafficDestination, trafficOptimizationGoal, videoViewsGoal, videoFrequencyMode, engagementGoal, destination, whatsappNumber,
    pageId, pixelId, optimizationEvent, clickAttributionWindow, viewAttributionWindow, attributionEventCount, appId, usePlatformLink, landingPageUrl, locationIds, gender, ageGroups,
    interestIds, languageCodes, spendingPower, audienceIds, excludedAudienceIds, smartInterestBehavior, placementMode, placements,
    includeSearchResult, tiktokSubplacements, frequencyMode, frequency, frequencySchedule, ctaEnabled, budgetMode, budget, budgetIncreaseEnabled, budgetIncreaseAmount, budgetIncreaseMaxTimes, bidStrategy, targetCost, acceleratedDelivery, scheduleMode, scheduleStartDate, scheduleEndDate,
    devices, minAndroidVersion, minIosVersion, networkTypes, carrierIds, ispIds, devicePriceMode, devicePriceMin, devicePriceMax,
    week, timezone, identityKey, selected, authCodes, callToAction, allowComments, allowDownload, allowShare, interactiveAddonsEnabled, cardId, cardPreviewUrl, step, unlockedStep, groupName, adName, activeGroupId, groups,
  ]);

  function continueDraftPrompt() {
    if (!draftPrompt) return;
    applyStoredDraft(draftPrompt);
    setDraftPrompt(null);
    setPersistReady(true);
  }

  function startNewFromDraftPrompt() {
    try {
      sessionStorage.removeItem(CAMPAIGN_DRAFT_KEY);
    } catch {
      /* ignore */
    }
    discardDraft.current = false;
    pendingDraftAdvertiser.current = '';
    setDraftPrompt(null);
    setPersistReady(true);
  }

  const objectiveSpec = options?.objectiveSpecs?.[objective];
  const allowsPixelUi = Boolean(objectiveSpec?.allowsPixel || objectiveSpec?.needsPixel);
  const allowsInstantPage = Boolean(objectiveSpec?.allowsInstantPage);
  // Smart+ عام: App فقط — Lead يدوي فقط؛ WEB/مبيعات لها مسارات خاصة
  const localAllowsSmartPlus = objective === 'APP_PROMOTION' || menuObjective === 'APP_PROMOTION';
  const allowsSmartPlus = options
    ? Boolean(objectiveSpec?.allowsSmartPlus)
      && menuObjective !== 'PRODUCT_SALES'
      && menuObjective !== 'WEB_CONVERSIONS'
      && menuObjective !== 'LEAD_GENERATION'
    : localAllowsSmartPlus;
  const salesSmartPlus = menuObjective === 'PRODUCT_SALES' && (smartPlus || salesDestination === 'WEBSITE');
  const isProductSalesStore = menuObjective === 'PRODUCT_SALES' && !salesSmartPlus;
  // لا تعتمد فقط على objectiveSpecs من الـ API — تحويلات الموقع / مبيعات الموقع يجب أن تُظهر حدث Contact دائماً
  const needsPixel = destination === 'PIXEL' && (
    salesSmartPlus
    || objective === 'WEB_CONVERSIONS'
    || objective === 'LEAD_GENERATION'
    || menuObjective === 'WEB_CONVERSIONS'
    || Boolean(objectiveSpec?.needsPixel)
  );
  const selectedPixel = (options?.pixels ?? []).find((pixel) => pixel.pixelId === pixelId) ?? null;
  const selectedPixelTrackingUrl = selectedPixel?.trackingUrl?.trim() || '';
  const selectedIdentity = (options?.identities ?? []).find((identity) => `${identity.identityId}|${identity.identityType}` === identityKey) ?? null;

  useEffect(() => {
    if (pixelId && selectedPixelTrackingUrl) setUsePlatformLink(true);
  }, [pixelId, selectedPixelTrackingUrl]);

  useEffect(() => {
    if (!options) return;
    // مبيعات Smart+ تبقى مفعّلة؛ عميل محتمل / تحويلات موقع = بدون Smart+
    if (menuObjective === 'LEAD_GENERATION' && smartPlus) {
      setSmartPlus(false);
      return;
    }
    if (!allowsSmartPlus && smartPlus && !(menuObjective === 'PRODUCT_SALES' && salesDestination === 'WEBSITE')) {
      setSmartPlus(false);
    }
  }, [allowsSmartPlus, smartPlus, options, menuObjective, salesDestination]);

  useEffect(() => {
    if (menuObjective === 'WEB_CONVERSIONS' && searchCampaign) setSearchCampaign(false);
  }, [menuObjective, searchCampaign]);

  useEffect(() => {
    // مبيعات: متجر تيك توك مخفي — أجبر موقع ويب Smart+
    if (menuObjective !== 'PRODUCT_SALES') return;
    if (salesDestination !== 'WEBSITE' || !smartPlus) {
      setSalesDestination('WEBSITE');
      setSmartPlus(true);
      setDestination('PIXEL');
    }
  }, [menuObjective, salesDestination, smartPlus]);

  useEffect(() => {
    if (!smartPlus) return;
    if (!(SMART_PLUS_CTA_IDS as readonly string[]).includes(callToAction)) {
      setCallToAction('LEARN_MORE');
      setGroups((current) => current.map((group) => (
        (SMART_PLUS_CTA_IDS as readonly string[]).includes(group.callToAction)
          ? group
          : { ...group, callToAction: 'LEARN_MORE' }
      )));
    }
  }, [smartPlus, callToAction]);

  useEffect(() => {
    if (!accountMenuOpen && !languageMenuOpen) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (accountMenuOpen && accountMenuRef.current && !accountMenuRef.current.contains(target)) setAccountMenuOpen(false);
      if (languageMenuOpen && languageMenuRef.current && !languageMenuRef.current.contains(target)) setLanguageMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [accountMenuOpen, languageMenuOpen]);

  useEffect(() => {
    const next = apiObjectiveFromMenu(menuObjective, salesDestination);
    setObjective((current) => (current === next ? current : next));
  }, [menuObjective, salesDestination, smartPlus]);

  useEffect(() => {
    if (objective !== 'TRAFFIC') return;
    if (trafficOptimizationGoal === 'ENGAGED_SESSION') setOptimizationEvent('ENGAGED_SESSION');
    else if (trafficOptimizationGoal === 'TRAFFIC_LANDING_PAGE_VIEW') setOptimizationEvent('LANDING_PAGE_VIEW');
  }, [objective, trafficOptimizationGoal]);

  useEffect(() => {
    if (!allowsInstantPage && destination === 'INSTANT_PAGE' && objective !== 'LEAD_GENERATION') {
      setDestination('PIXEL');
    }
  }, [allowsInstantPage, destination, objective]);

  useEffect(() => {
    if (objective !== 'LEAD_GENERATION') return;
    if (destination !== 'PIXEL' && destination !== 'INSTANT_PAGE') setDestination('PIXEL');
  }, [objective, destination]);

  useEffect(() => {
    if (!advertiserId || !locationIds.length) {
      setCarriers([]);
      setIsps([]);
      return;
    }
    let cancelled = false;
    fetchTikTokTargetingExtras(advertiserId, locationIds)
      .then((data) => {
        if (cancelled) return;
        setCarriers(data.carriers);
        setIsps(data.isps);
      })
      .catch(() => {
        if (cancelled) return;
        setCarriers([]);
        setIsps([]);
      });
    return () => { cancelled = true; };
  }, [advertiserId, locationIds]);

  useEffect(() => {
    if (!advertiserId || !locationIds.length || step === 1) return;
    const handle = window.setTimeout(() => {
      estimateTikTokAudience({
        advertiserId,
        objective,
        locationIds,
        gender,
        ageGroups,
        interestCategoryIds: interestIds,
        languageCodes,
        devices,
        placementMode,
        placements,
      }).then((data) => {
        setAudienceEstimate(data);
        setEstimateError(null);
      }).catch((err) => {
        setAudienceEstimate(null);
        setEstimateError(parseApiError(err));
      });
    }, 500);
    return () => window.clearTimeout(handle);
  }, [advertiserId, objective, locationIds, gender, ageGroups, interestIds, languageCodes, devices, placementMode, placements, step]);

  const hidePixelForObjective = objective === 'VIDEO_VIEWS' || objective === 'ENGAGEMENT';
  const isReachObjective = objective === 'REACH';
  const isTrafficObjective = objective === 'TRAFFIC';
  const isVideoViewsObjective = objective === 'VIDEO_VIEWS';
  const isEngagementObjective = objective === 'ENGAGEMENT';
  const isLeadObjective = objective === 'LEAD_GENERATION' || menuObjective === 'LEAD_GENERATION';
  const isWebConversionsObjective = objective === 'WEB_CONVERSIONS' || menuObjective === 'WEB_CONVERSIONS';
  const isProductSalesObjective = objective === 'PRODUCT_SALES' || menuObjective === 'PRODUCT_SALES';
  const isTikTokOnlyPlacementObjective = isLeadObjective || isWebConversionsObjective || isProductSalesObjective;

  useEffect(() => {
    if (!isTikTokOnlyPlacementObjective) return;
    if (isLeadObjective && smartPlus) {
      // Lead Smart+: مواضع تلقائية
      setPlacementMode('AUTOMATIC');
      setPlacements(['PLACEMENT_TIKTOK']);
      setTiktokSubplacements([]);
      return;
    }
    // Web Smart+/يدوي + Sales + Lead يدوي: تيك توك فقط (NORMAL)
    setPlacementMode('MANUAL');
    setPlacements(['PLACEMENT_TIKTOK']);
    setTiktokSubplacements([]);
  }, [isTikTokOnlyPlacementObjective, isLeadObjective, smartPlus]);
  const showOptimizationLocation = !hidePixelForObjective;
  const videoViewsGoalMeta = VIDEO_VIEWS_OBJECTIVE_CONFIG.optimizationGoals.find((item) => item.id === videoViewsGoal)
    ?? VIDEO_VIEWS_OBJECTIVE_CONFIG.optimizationGoals[0];
  const engagementGoalMeta = ENGAGEMENT_OBJECTIVE_CONFIG.optimizationGoals.find((item) => item.id === engagementGoal)
    ?? ENGAGEMENT_OBJECTIVE_CONFIG.optimizationGoals[0];
  const trafficGoalMeta = TRAFFIC_OBJECTIVE_CONFIG.optimizationGoals.find((item) => item.id === trafficOptimizationGoal)
    ?? TRAFFIC_OBJECTIVE_CONFIG.optimizationGoals[0];
  const trafficNeedsPixel = isTrafficObjective && trafficGoalMeta.needsPixel;
  const reachDestinationOptions = [
    { id: 'PIXEL' as const, title: 'موقع الويب', desc: 'عنوان URL لموقعك (بدون بكسل إلزامي).' },
    ...(allowsInstantPage ? [{ id: 'INSTANT_PAGE' as const, title: 'صفحة TikTok الفورية', desc: 'صفحة مخصصة داخل تيك توك.' }] : []),
  ];
  const leadDestinationOptions = LEAD_GENERATION_OBJECTIVE_CONFIG.optimizationLocations.map((item) => ({
    id: item.destination,
    title: item.titleAr,
    desc: item.descAr,
  }));
  const standardDestinationOptions = [
    { id: 'PIXEL' as const, title: 'موقع الويب', desc: 'وجّه المستخدمين إلى موقعك عبر بكسل أو رابط.' },
    ...(allowsInstantPage ? [{ id: 'INSTANT_PAGE' as const, title: 'صفحة TikTok الفورية', desc: 'صفحة تفاعلية داخل تيك توك.' }] : []),
    { id: 'WHATSAPP' as const, title: 'رسائل واتساب مباشرة', desc: 'افتح محادثة واتساب مباشرة.' },
  ];
  const activeDestinationOptions = isLeadObjective
    ? leadDestinationOptions
    : isReachObjective
      ? reachDestinationOptions
      : standardDestinationOptions;
  const budgetDailyCap = (() => {
    const base = Number(budget) || 0;
    const amount = Number(budgetIncreaseAmount) || 0;
    const times = Math.max(0, Math.floor(Number(budgetIncreaseMaxTimes) || 0));
    if (!budgetIncreaseEnabled || !(amount > 0) || !(times > 0)) return null;
    return base + amount * times;
  })();

  return (
    <AppShell>
      <PageHeader
        title={editingId ? 'تعديل الحملة' : copyFrom ? 'إنشاء نسخة من الحملة' : 'إنشاء حملة'}
        description="نفس خطوات تيك توك: هدف الحملة، ثم المجموعة الإعلانية، ثم الإعلان. تحديث الصفحة يبقي تقدّمك."
        actions={<Link className="text-sm underline" href="/tiktok/ads/create">العودة إلى الحملات</Link>}
      />
      <Dialog
        open={Boolean(draftPrompt)}
        onOpenChange={(open) => {
          if (!open && draftPrompt) continueDraftPrompt();
        }}
      >
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>مسودة حملة غير مكتملة</DialogTitle>
            <DialogDescription className="text-right">
              لديك إعدادات حملة سابقة لم تُنشَر بعد
              {draftPrompt?.campaignName ? (
                <>
                  {' '}
                  (<span className="font-medium text-foreground">{draftPrompt.campaignName}</span>)
                </>
              ) : null}
              . هل تريد استكمالها أم البدء من جديد؟
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button type="button" className="w-full" onClick={continueDraftPrompt}>
              استكمال الحملة السابقة
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={startNewFromDraftPrompt}>
              بدء حملة جديدة من الصفر
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {error && <AlertBanner className="mt-4" variant="error">{error}</AlertBanner>}
      {publishStatus && (
        <AlertBanner className="mt-4" variant="info">
          {publishStatus}
        </AlertBanner>
      )}
      {showPublishSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="status" aria-live="polite">
          <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl bg-white px-6 py-8 text-center shadow-xl">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-8 w-8" strokeWidth={2.5} />
            </span>
            <p className="text-base font-semibold text-emerald-800">تم النشر بنجاح</p>
            {result?.tikTokAdsManagerLabel ? (
              <p className="text-xs text-emerald-700">في تيك توك: {result.tikTokAdsManagerLabel}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">جاري فتح صفحة الحملات…</p>
          </div>
        </div>
      )}
      {result && !showPublishSuccess && (
        <AlertBanner className="mt-4" variant="success">
          تم حفظ الحملة{result.campaignName ? `: ${result.campaignName}` : ''}.
          <span className="mt-1 block break-all">{result.landingPageUrl}</span>
        </AlertBanner>
      )}
      {draftLoading ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          جاري تحميل إعدادات الحملة…
        </div>
      ) : (
      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        <aside className="relative z-20 w-full shrink-0 overflow-hidden lg:sticky lg:top-4 lg:w-[210px]">
          <nav className="rounded-2xl border bg-background p-2 shadow-sm">
            <p className="px-2 pb-2 text-[11px] font-medium text-muted-foreground">خطوات الإنشاء</p>
            <div className="grid gap-1">
              {/* الحملة = اسم الحملة الحقيقي */}
              <div className={`rounded-lg p-1.5 ${step === 1 ? 'bg-primary text-primary-foreground' : ''}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 text-right text-xs"
                  onClick={() => setStep(1)}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                    step === 1 ? 'bg-white/25 text-primary-foreground'
                      : unlockedStep > 1 ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {unlockedStep > 1 && step !== 1 ? <Check className="h-3 w-3" /> : '1'}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium" title={campaignName || 'الحملة'}>
                    {campaignName.trim() || 'الحملة'}
                  </span>
                </button>
              </div>

              {/* كل مجموعة حقيقية — الاسم هو المجموعة نفسها + أيقونات صغيرة تحتها، والإعلانات متداخلة */}
              {unlockedStep >= 2 && listedGroups().map((group, groupIndex) => {
                const active = group.id === activeGroupId;
                const renamingThis = renaming?.kind === 'group' && renaming.id === group.id;
                const groupAds = active ? selected : (group.selected || []);
                const groupActiveStep = active && step === 2;
                return (
                  <div key={group.id} className="space-y-0.5 border-t border-border/60 pt-1">
                    <div className={`rounded-lg p-1.5 ${groupActiveStep ? 'bg-primary text-primary-foreground' : active ? 'bg-primary/5' : ''}`}>
                      {renamingThis ? (
                        <form
                          className="flex items-center gap-1"
                          onSubmit={(event) => {
                            event.preventDefault();
                            renameGroup(group.id, renameValue);
                          }}
                        >
                          <Input className="h-7 text-xs" value={renameValue} autoFocus onChange={(event) => setRenameValue(event.target.value)} />
                          <Button type="submit" size="icon" variant="ghost" className="h-7 w-7 shrink-0"><Check className="h-3 w-3" /></Button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 text-right text-xs"
                          onClick={() => { selectGroup(group.id); setStep(2); }}
                        >
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                            groupActiveStep ? 'bg-white/25 text-primary-foreground'
                              : unlockedStep > 2 && active ? 'bg-primary/15 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {unlockedStep > 2 && !groupActiveStep && active ? <Check className="h-3 w-3" /> : String(groupIndex + 2)}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium" title={group.name}>{group.name}</span>
                        </button>
                      )}
                      <div className={`mt-1 flex items-center gap-0.5 ps-7 ${groupActiveStep ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        <button
                          type="button"
                          className={`rounded p-0.5 hover:bg-black/10 disabled:opacity-30 ${groupActiveStep ? 'hover:bg-white/20' : 'hover:bg-muted hover:text-foreground'}`}
                          title="تكرار المجموعة"
                          onClick={(event) => { event.stopPropagation(); duplicateGroup(group.id); }}
                        >
                          <Copy className="h-2.5 w-2.5" />
                        </button>
                        <button
                          type="button"
                          className={`rounded p-0.5 hover:bg-black/10 ${groupActiveStep ? 'hover:bg-white/20' : 'hover:bg-muted hover:text-foreground'}`}
                          title="إعادة تسمية"
                          onClick={(event) => { event.stopPropagation(); startRenameGroup(group); }}
                        >
                          <Pencil className="h-2.5 w-2.5" />
                        </button>
                        <button
                          type="button"
                          className={`rounded p-0.5 disabled:opacity-30 ${groupActiveStep ? 'hover:bg-white/20' : 'hover:bg-destructive/10 hover:text-destructive'}`}
                          title="حذف المجموعة مع إعلاناتها"
                          disabled={listedGroups().length <= 1}
                          onClick={(event) => { event.stopPropagation(); removeGroup(group.id); }}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>

                    {unlockedStep >= 3 && active && (
                      <div className="ms-3 space-y-0.5 border-s border-border/50 ps-2">
                        {groupAds.length === 0 ? (
                          <p className="px-1 py-1 text-[10px] text-muted-foreground">أضف فيديو من خطوة الإعلان</p>
                        ) : smartPlus ? (
                          <div className={`rounded-lg p-1.5 ${step === 3 ? 'bg-primary/10' : ''}`}>
                            <div className="flex w-full items-center gap-1 text-right text-[11px]">
                              <button
                                type="button"
                                className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                                title={adAssetsOpen ? 'طي الفيديوهات' : 'عرض الفيديوهات'}
                                onClick={(event) => { event.stopPropagation(); setAdAssetsOpen((open) => !open); }}
                              >
                                <ChevronDown className={`h-3 w-3 transition ${adAssetsOpen ? 'rotate-0' : '-rotate-90'}`} />
                              </button>
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 items-center gap-1.5"
                                onClick={() => { selectGroup(group.id); setStep(3); }}
                              >
                                <Sparkles className="h-3 w-3 shrink-0 text-violet-500" />
                                <span className="min-w-0 flex-1 truncate font-medium" title={adName}>{adName.trim() || 'اسم الإعلان'}</span>
                                <span className="shrink-0 text-[9px] text-muted-foreground">{groupAds.length} فيديو</span>
                              </button>
                            </div>
                            {adAssetsOpen && (
                              <div className="mt-1 space-y-0.5 border-s border-border/40 ps-2 ms-2">
                                {groupAds.map((video, index) => {
                                  const label = (video.text || '').trim() || `فيديو ${index + 1}`;
                                  return (
                                    <div key={video.key} className="flex items-center gap-2 rounded px-1 py-1 text-[10px]">
                                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[9px]">{index + 1}</span>
                                      <span className="min-w-0 flex-1 truncate" title={label}>{label}</span>
                                      <button
                                        type="button"
                                        className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                        title="إزالة الفيديو"
                                        onClick={(event) => { event.stopPropagation(); removeAd(video.key); }}
                                      >
                                        <Trash2 className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : groupAds.map((video, index) => {
                          const renamingAd = renaming?.kind === 'ad' && renaming.id === video.key;
                          const label = (video.text || '').trim() || `إعلان ${index + 1}`;
                          const adActive = step === 3;
                          return (
                            <div
                              key={video.key}
                              className={`rounded-lg p-1.5 ${adActive ? 'bg-primary/10' : ''}`}
                            >
                              {renamingAd ? (
                                <form
                                  className="flex items-center gap-1"
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    renameAd(video.key, renameValue);
                                  }}
                                >
                                  <Input className="h-7 text-xs" value={renameValue} autoFocus onChange={(event) => setRenameValue(event.target.value)} />
                                  <Button type="submit" size="icon" variant="ghost" className="h-7 w-7 shrink-0"><Check className="h-3 w-3" /></Button>
                                </form>
                              ) : (
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 text-right text-[11px]"
                                  onClick={() => { selectGroup(group.id); setStep(3); }}
                                >
                                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${
                                    adActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                  }`}>
                                    {index + 1}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate font-medium" title={label}>{label}</span>
                                </button>
                              )}
                              <div className="mt-1 flex items-center gap-0.5 ps-6 text-muted-foreground">
                                <button
                                  type="button"
                                  className="rounded p-0.5 hover:bg-muted hover:text-foreground"
                                  title="تكرار الإعلان"
                                  onClick={(event) => { event.stopPropagation(); selectGroup(group.id); duplicateAd(video.key); }}
                                >
                                  <Copy className="h-2.5 w-2.5" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded p-0.5 hover:bg-muted hover:text-foreground"
                                  title="إعادة تسمية"
                                  onClick={(event) => { event.stopPropagation(); startRenameAd(video); }}
                                >
                                  <Pencil className="h-2.5 w-2.5" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded p-0.5 hover:bg-destructive/10 hover:text-destructive"
                                  title="حذف الإعلان"
                                  onClick={(event) => { event.stopPropagation(); selectGroup(group.id); removeAd(video.key); }}
                                >
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {unlockedStep >= 2 && (
                <button
                  type="button"
                  className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-muted/40"
                  onClick={() => { duplicateGroup(); advanceTo(2); }}
                >
                  <Plus className="h-3 w-3" /> إضافة مجموعة
                </button>
              )}
            </div>
          </nav>
        </aside>

        <div className="relative z-10 min-w-0 flex-1 grid gap-4">
        {step === 1 && (
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>الحملة</CardTitle>
            <CardDescription>{currency ? `عملة الحساب: ${symbol}` : 'اختر الحساب والهدف كما في تيك توك'}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label>الحساب الإعلاني</Label>
              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  className="flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl border bg-background px-3 text-sm shadow-sm hover:border-primary"
                  onClick={() => setAccountMenuOpen((open) => !open)}
                >
                  <span className="truncate font-medium">{selectedAdvertiser?.name || (loadingAccounts ? 'جاري تحميل الحسابات…' : 'اختر حساباً إعلانياً')}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition ${accountMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {accountMenuOpen && (
                  <div className="absolute inset-x-0 z-40 mt-2 rounded-2xl border bg-background p-3 shadow-xl">
                    {selectedAdvertiser && (
                      <div className="mb-3 flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-500 text-sm font-semibold text-white">
                          {(selectedAdvertiser.name || 'ت').trim().slice(0, 1)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{selectedAdvertiser.name || 'حساب إعلاني'}</span>
                          <span dir="ltr" className="mt-0.5 block truncate text-xs text-muted-foreground">{selectedAdvertiser.advertiserId}</span>
                        </span>
                      </div>
                    )}
                    <div className="mb-3 flex items-center gap-2">
                      <Button type="button" size="icon" variant="outline" aria-label="تحديث الحسابات" onClick={() => refreshAdvertisers()} disabled={loadingAccounts}>
                        <RefreshCw className={`h-4 w-4 ${loadingAccounts ? 'animate-spin' : ''}`} />
                      </Button>
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="ps-9" value={accountQuery} onChange={(event) => setAccountQuery(event.target.value)} placeholder="اسم الحساب أو المعرّف" />
                      </div>
                    </div>
                    <div className="max-h-72 space-y-2 overflow-auto">
                      {filteredAdvertisers.map((row) => (
                        <label key={row.advertiserId} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm hover:bg-muted/40 ${advertiserId === row.advertiserId ? 'border-primary bg-primary/5' : ''}`}>
                          <input
                            type="radio"
                            name="advertiser"
                            checked={advertiserId === row.advertiserId}
                            onChange={() => {
                              setAdvertiserId(row.advertiserId);
                              // لا نغيّر توقيت جدولة الحملة (بغداد) عند اختيار الحساب
                              setAccountMenuOpen(false);
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{row.name || 'حساب إعلاني'}</span>
                            <span dir="ltr" className="mt-0.5 block truncate text-xs text-muted-foreground">{row.advertiserId}</span>
                          </span>
                          <span dir="ltr" className="shrink-0 text-xs text-muted-foreground">{row.currency ? CURRENCY_SYMBOLS[row.currency] ?? row.currency : ''}</span>
                        </label>
                      ))}
                      {filteredAdvertisers.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">لا توجد حسابات مطابقة.</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="grid gap-2"><Label>اسم الحملة</Label><Input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} /></div>
            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <div className="space-y-4 rounded-xl border p-3">
                <p className="text-sm font-semibold">هدف الإعلان</p>
                {OBJECTIVE_GROUPS.map((group) => (
                  <div key={group.title} className="grid gap-2">
                    <p className="text-xs font-medium text-muted-foreground">{group.title}</p>
                    {group.ids.map((id) => {
                      const menuId = id as MenuObjective;
                      const selected = menuObjective === menuId;
                      const hasSub = menuId === 'REACH' || menuId === 'TRAFFIC' || menuId === 'APP_PROMOTION' || menuId === 'LEAD_GENERATION' || menuId === 'WEB_CONVERSIONS' || menuId === 'PRODUCT_SALES';
                      return (
                        <button
                          key={id}
                          type="button"
                          className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-right text-sm ${selected ? 'border-teal-500 bg-teal-50' : 'hover:bg-muted'}`}
                          onClick={() => selectMenuObjective(menuId)}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${selected ? 'border-teal-600 bg-teal-600' : 'border-muted-foreground/40'}`}>
                              {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                            </span>
                            {OBJECTIVE_LABELS[id]}
                          </span>
                          {hasSub ? <span className="text-muted-foreground">‹</span> : null}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="space-y-4 rounded-xl border p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{OBJECTIVE_LABELS[menuObjective]}</h3>
                    {menuObjective === 'INSTANT_GROWTH' && (
                      <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-800">TikTok Growth Max</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{OBJECTIVE_HINTS[menuObjective]}</p>
                </div>

                {(OBJECTIVE_BENEFITS[menuObjective] ?? []).length > 0 && menuObjective !== 'REACH' && menuObjective !== 'APP_PROMOTION' && menuObjective !== 'WEB_CONVERSIONS' && menuObjective !== 'LEAD_GENERATION' && menuObjective !== 'PRODUCT_SALES' && (
                  <div className="grid gap-2">
                    <p className="text-sm font-medium">اختر هذا الهدف من أجل:</p>
                    <ul className="grid gap-2">
                      {(OBJECTIVE_BENEFITS[menuObjective] ?? []).map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="mt-0.5 text-teal-600">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {menuObjective === 'REACH' && (
                  <div className="grid gap-3">
                    <p className="text-sm font-medium">نوع الحملة</p>
                    {([
                      { id: 'AUCTION' as const, title: 'الوصول إلى المزاد', desc: 'الإعلانات بمعدل الوصول الأكثر فعالية.' },
                      { id: 'TOP_SEARCH' as const, title: 'TopSearch', desc: 'اعرض إعلانك في صدارة نتائج البحث لزيادة الظهور وحصة الصوت إلى أقصى حد.', badge: 'جديد' },
                    ]).map((item) => (
                      <label key={item.id} className={`rounded-xl border p-3 text-sm ${reachType === item.id ? 'border-teal-500 bg-teal-50' : ''}`}>
                        <span className="flex items-center gap-2 font-medium">
                          <input type="radio" checked={reachType === item.id} onChange={() => selectReachType(item.id)} />
                          {item.title}
                          {item.badge ? <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">{item.badge}</span> : null}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">{item.desc}</span>
                      </label>
                    ))}
                  </div>
                )}

                {menuObjective === 'TRAFFIC' && (
                  <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                    <span>
                      <span className="font-medium">الحملة الإعلانية للبحث</span>
                      <span className="mt-1 block text-xs text-muted-foreground">اضبط حملتك لاستهداف الإعلانات في نتائج بحث تيك توك.</span>
                    </span>
                    <input type="checkbox" checked={searchCampaign} onChange={(event) => setSearchCampaign(event.target.checked)} />
                  </label>
                )}

                {menuObjective === 'APP_PROMOTION' && (
                  <div className="grid gap-3">
                    <p className="text-sm font-medium">أنواع الترويج</p>
                    {([
                      { id: 'APP_INSTALL' as const, title: 'عمليات تثبيت التطبيق', desc: 'شجّع الأشخاص على تثبيت واستخدام تطبيقك.' },
                      { id: 'APP_RETARGETING' as const, title: 'إعادة الاستهداف من التطبيق', desc: 'أعد إشراك مستخدمي التطبيق الحاليين لاتخاذ إجراء داخله.' },
                    ]).map((item) => (
                      <label key={item.id} className={`rounded-xl border p-3 text-sm ${appPromotionType === item.id ? 'border-teal-500 bg-teal-50' : ''}`}>
                        <span className="flex items-center gap-2 font-medium">
                          <input
                            type="radio"
                            checked={appPromotionType === item.id}
                            onChange={() => {
                              setAppPromotionType(item.id);
                              if (item.id === 'APP_RETARGETING') setSearchCampaign(false);
                            }}
                          />
                          {item.title}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">{item.desc}</span>
                        {item.id === 'APP_INSTALL' && appPromotionType === 'APP_INSTALL' && (
                          <span className="mt-3 flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
                            <span>
                              <span className="flex items-center gap-2 font-medium">
                                الحملة الإعلانية للبحث
                                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">جديد</span>
                              </span>
                              <span className="mt-1 block text-xs text-muted-foreground">استهدف الإعلانات في نتائج بحث تيك توك.</span>
                            </span>
                            <input type="checkbox" checked={searchCampaign} onChange={(event) => setSearchCampaign(event.target.checked)} />
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}

                {menuObjective === 'WEB_CONVERSIONS' && (
                  <div className="grid gap-4">
                    <div>
                      <p className="text-sm font-medium">اختر هذا الهدف من أجل:</p>
                      <ul className="mt-2 grid gap-2">
                        {WEB_CONVERSIONS_OBJECTIVE_CONFIG.benefitsAr.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="mt-0.5 text-teal-600">✓</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="grid gap-3">
                      <p className="text-sm font-medium">نوع الحملة</p>
                      {WEB_CONVERSIONS_OBJECTIVE_CONFIG.campaignModes.map((mode) => (
                        <label
                          key={mode.id}
                          className="rounded-xl border border-teal-500 bg-teal-50 p-3 text-sm"
                        >
                          <span className="flex items-center gap-2 font-medium">
                            <input type="radio" checked readOnly />
                            {mode.titleAr}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">{mode.descAr}</span>
                        </label>
                      ))}
                      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        Smart+ غير متاح هنا: تيك توك ينشر Smart+ Web كـ «مبيعات → موقع ويب». للحفاظ على هدف «تحويلات موقع الويب» نستخدم الحملة اليدوية فقط.
                      </p>
                    </div>
                  </div>
                )}

                {menuObjective === 'LEAD_GENERATION' && (
                  <div className="grid gap-4">
                    <div>
                      <p className="text-sm font-medium">اختر هذا الهدف من أجل:</p>
                      <ul className="mt-2 grid gap-2">
                        {LEAD_GENERATION_OBJECTIVE_CONFIG.benefitsAr.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="mt-0.5 text-teal-600">✓</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="grid gap-3">
                      <p className="text-sm font-medium">نوع الحملة</p>
                      {LEAD_GENERATION_OBJECTIVE_CONFIG.campaignModes.map((mode) => (
                        <label
                          key={mode.id}
                          className="rounded-xl border border-teal-500 bg-teal-50 p-3 text-sm"
                        >
                          <span className="flex items-center gap-2 font-medium">
                            <input type="radio" checked readOnly />
                            {mode.titleAr}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">{mode.descAr}</span>
                        </label>
                      ))}
                    </div>
                    <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                      <span>
                        <span className="flex items-center gap-2 font-medium">
                          {LEAD_GENERATION_OBJECTIVE_CONFIG.searchCampaign.labelAr}
                          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">{LEAD_GENERATION_OBJECTIVE_CONFIG.searchCampaign.badgeAr}</span>
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">{LEAD_GENERATION_OBJECTIVE_CONFIG.searchCampaign.descAr}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={searchCampaign}
                        onChange={(event) => setSearchCampaign(event.target.checked)}
                      />
                    </label>
                  </div>
                )}

                {menuObjective === 'PRODUCT_SALES' && (
                  <div className="grid gap-3">
                    <p className="text-sm font-medium">نوع الحملة</p>
                    <label className="rounded-xl border border-teal-500 bg-teal-50 p-3 text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <input type="radio" checked readOnly />
                        موقع ويب · حملة +Smart
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">جديد</span>
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        تُنشر كمبيعات → موقع ويب (Smart+) في مدير إعلانات تيك توك. يتطلب بكسل ورابط موقع.
                      </span>
                    </label>
                  </div>
                )}

                {(menuObjective === 'WEB_CONVERSIONS' || menuObjective === 'PRODUCT_SALES') && (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                    نوع الحملة المنشور:{' '}
                    <strong>
                      {menuObjective === 'WEB_CONVERSIONS'
                        ? 'تحويلات موقع الويب (WEB_CONVERSIONS · يدوي)'
                        : 'مبيعات → موقع ويب (Smart+)'}
                    </strong>
                  </p>
                )}

                {allowsSmartPlus && menuObjective !== 'WEB_CONVERSIONS' && menuObjective !== 'LEAD_GENERATION' && menuObjective !== 'PRODUCT_SALES' && menuObjective !== 'INSTANT_GROWTH' && (
                  <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                    <span>حملة Smart+</span>
                    <input type="checkbox" checked={smartPlus} onChange={(event) => setSmartPlus(event.target.checked)} />
                  </label>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={() => {
                if (!advertiserId) { setError('اختر الحساب الإعلاني'); return; }
                if (!campaignName.trim()) { setError('اسم الحملة مطلوب'); return; }
                setError(null);
                advanceTo(2);
              }}>متابعة</Button>
            </div>
          </CardContent>
        </Card>
        )}

        {step === 2 && (
        <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
          <div className="grid gap-4">
            <Card className="border-0 shadow-card">
              <CardHeader><CardTitle>اسم المجموعة الإعلانية</CardTitle></CardHeader>
              <CardContent>
                <Input value={groupName} onChange={(event) => setGroupName(event.target.value)} />
              </CardContent>
            </Card>

            {showOptimizationLocation && (
            <Card className="border-0 shadow-card">
              <CardHeader><CardTitle>{isReachObjective ? 'الوجهة' : isTrafficObjective || isLeadObjective ? 'التحسين والمزايدة' : 'موقع التحسين'}</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                {loadingOptions && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> جاري جلب بيانات الحساب…</p>}
                {optionsError && <p className="text-sm text-destructive">{optionsError}</p>}

                {isLeadObjective && (
                  <>
                    <p className="text-sm">هدف التحسين: <strong>{LEAD_GENERATION_OBJECTIVE_CONFIG.optimizationGoalLabelAr}</strong></p>
                    <div className="grid gap-3">
                      <Label>مواقع التحسين</Label>
                      <p className="text-xs text-muted-foreground">اختر أين تريد أن يتّخذ الجمهور إجراءً أو يُحوَّل.</p>
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700 w-fit">جديد</span>
                      {LEAD_GENERATION_OBJECTIVE_CONFIG.optimizationLocations.map((item) => {
                        const checked = destination === item.destination;
                        return (
                          <label
                            key={item.id}
                            className={`rounded-xl border p-3 text-sm ${checked ? 'border-teal-500 bg-teal-50' : ''}`}
                          >
                            <span className="flex items-center gap-2 font-medium">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setDestination(item.destination);
                                  if (item.destination === 'INSTANT_PAGE') {
                                    setUsePlatformLink(false);
                                  } else {
                                    setPageId('');
                                    if (selectedPixelTrackingUrl) setUsePlatformLink(true);
                                  }
                                }}
                              />
                              {item.titleAr}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">{item.descAr}</span>
                          </label>
                        );
                      })}
                    </div>
                    {destination === 'PIXEL' && (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="grid gap-2">
                            <Label>اتصال البيانات</Label>
                            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={pixelId} onChange={(event) => {
                              const nextId = event.target.value;
                              setPixelId(nextId);
                              setDestination('PIXEL');
                              const next = (options?.pixels ?? []).find((pixel) => pixel.pixelId === nextId);
                              if (next?.trackingUrl) setUsePlatformLink(true);
                            }}>
                              <option value="">حدّد اتصال البيانات</option>
                              {(options?.pixels ?? []).map((pixel) => <option key={pixel.pixelId} value={pixel.pixelId}>{pixel.name}</option>)}
                            </select>
                          </div>
                          <div className="grid gap-2">
                            <Label>حدث التحسين</Label>
                            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={optimizationEvent} onChange={(event) => setOptimizationEvent(event.target.value)}>
                              <option value="">حدّد حدث التحسين</option>
                              {LEAD_GENERATION_OBJECTIVE_CONFIG.optimizationEvents.map((event) => (
                                <option key={event.id} value={event.id}>{event.titleAr}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={usePlatformLink && Boolean(selectedPixelTrackingUrl)}
                            disabled={!selectedPixelTrackingUrl}
                            onChange={(event) => setUsePlatformLink(event.target.checked)}
                          />
                          استخدام رابط تتبع البكسل المختار
                        </label>
                        {selectedPixelTrackingUrl ? (
                          <code dir="ltr" className="block break-all rounded-md bg-muted px-3 py-2 text-left text-xs">{selectedPixelTrackingUrl}</code>
                        ) : pixelId ? (
                          <p className="text-xs text-amber-700">لا يوجد رابط تتبع مربوط لهذا البكسل في جات لورا بعد.</p>
                        ) : null}
                        {(!usePlatformLink || !selectedPixelTrackingUrl) && (
                          <div className="grid gap-2">
                            <Label>{LEAD_GENERATION_OBJECTIVE_CONFIG.destinationAd.websiteUrlLabelAr}</Label>
                            <Input dir="ltr" value={landingPageUrl} onChange={(event) => setLandingPageUrl(event.target.value)} placeholder="https://" />
                          </div>
                        )}
                      </>
                    )}
                    {destination === 'INSTANT_PAGE' && (
                      <p className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-xs text-teal-900">
                        في خطوة الإعلان ستختار الاستمارة الفورية من مكتبتك في تيك توك، مع إمكانية الإنشاء والتكرار والتعديل وتغيير الاسم عبر محرر تيك توك الرسمي.
                      </p>
                    )}
                  </>
                )}

                {isTrafficObjective && (
                  <>
                    <div className="grid gap-3">
                      <Label>الموقع</Label>
                      {TRAFFIC_OBJECTIVE_CONFIG.destinations.map((item) => (
                        <label key={item.id} className={`rounded-xl border p-3 text-sm ${trafficDestination === item.id ? 'border-teal-500 bg-teal-50' : ''}`}>
                          <span className="flex items-center gap-2 font-medium">
                            <input
                              type="radio"
                              checked={trafficDestination === item.id}
                              onChange={() => {
                                setTrafficDestination(item.id);
                                if (item.id === 'APP') setTrafficOptimizationGoal('CLICK');
                              }}
                            />
                            {item.titleAr}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">{item.descAr}</span>
                        </label>
                      ))}
                    </div>
                    <div className="grid gap-2">
                      <Label>هدف التحسين</Label>
                      <select
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        value={trafficOptimizationGoal}
                        onChange={(event) => setTrafficOptimizationGoal(event.target.value as TrafficOptimizationGoal)}
                      >
                        {TRAFFIC_OBJECTIVE_CONFIG.optimizationGoals
                          .filter((goal) => trafficDestination === 'WEBSITE' || goal.id === 'CLICK')
                          .map((goal) => (
                            <option key={goal.id} value={goal.id}>{goal.titleAr}</option>
                          ))}
                      </select>
                      <p className="text-xs text-muted-foreground">حدث الفوترة: {trafficGoalMeta.billingLabelAr}</p>
                    </div>
                    {trafficDestination === 'APP' && (
                      <div className="grid gap-2">
                        <Label>معرّف التطبيق</Label>
                        <Input value={appId} onChange={(event) => setAppId(event.target.value)} placeholder="app_id من تيك توك" />
                      </div>
                    )}
                    {(trafficNeedsPixel || trafficDestination === 'WEBSITE') && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>اتصال البيانات {trafficNeedsPixel ? '' : '• اختياري'}</Label>
                          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={pixelId} onChange={(event) => {
                            const nextId = event.target.value;
                            setPixelId(nextId);
                            const next = (options?.pixels ?? []).find((pixel) => pixel.pixelId === nextId);
                            if (next?.trackingUrl) setUsePlatformLink(true);
                          }}>
                            <option value="">بدون بكسل</option>
                            {(options?.pixels ?? []).map((pixel) => <option key={pixel.pixelId} value={pixel.pixelId}>{pixel.name}</option>)}
                          </select>
                        </div>
                        {trafficNeedsPixel && (
                          <div className="grid gap-2">
                            <Label>حدث التحسين</Label>
                            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={optimizationEvent} onChange={(event) => setOptimizationEvent(event.target.value)}>
                              <option value="LANDING_PAGE_VIEW">عرض صفحة الهبوط</option>
                              <option value="ENGAGED_SESSION">جلسة التفاعل</option>
                              <option value="CONSULT">تواصل / واتساب</option>
                              <option value="BUTTON">نقر الزر</option>
                              <option value="ON_WEB_REGISTER">تسجيل</option>
                              <option value="SHOPPING">شراء (Purchase)</option>
                              <option value="FORM">إرسال النموذج</option>
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                    {trafficDestination === 'WEBSITE' && (
                      <div className="grid gap-2">
                        <Label>عنوان URL لموقع الويب</Label>
                        <Input dir="ltr" value={landingPageUrl} onChange={(event) => { setLandingPageUrl(event.target.value); setUsePlatformLink(false); setDestination('PIXEL'); }} placeholder="https://" />
                        {allowsInstantPage && (
                          <label className="flex items-center gap-2 text-sm">
                            <input type="radio" checked={destination === 'INSTANT_PAGE'} onChange={() => setDestination('INSTANT_PAGE')} />
                            أو استخدم صفحة TikTok الفورية
                          </label>
                        )}
                        {destination === 'INSTANT_PAGE' && (
                          (options?.instantPages ?? []).length ? (
                            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={pageId} onChange={(event) => setPageId(event.target.value)}>
                              <option value="">اختر صفحة</option>
                              {(options?.instantPages ?? []).map((page) => <option key={page.pageId} value={page.pageId}>{page.name}</option>)}
                            </select>
                          ) : (
                            <p className="text-sm text-destructive">لا توجد صفحات فورية منشورة في هذا الحساب.</p>
                          )
                        )}
                      </div>
                    )}
                    {trafficDestination === 'TIKTOK_SHOP' && (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        سيتم إرسال `product_source=STORE` إلى تيك توك. يجب أن يكون المتجر مربوطاً بالحساب الإعلاني في تيك توك وإلا سيرفض النشر.
                      </p>
                    )}
                  </>
                )}

                {!isTrafficObjective && !isLeadObjective && (
                <>
                <div className="grid gap-3">
                  {activeDestinationOptions.map((item) => (
                    <label key={item.id} className={`rounded-xl border p-3 text-sm ${destination === item.id ? 'border-teal-500 bg-teal-50' : ''}`}>
                      <span className="flex items-center gap-2 font-medium">
                        <input type="radio" checked={destination === item.id} onChange={() => {
                          setDestination(item.id);
                          if (isReachObjective && item.id === 'PIXEL') setUsePlatformLink(false);
                        }} />
                        {item.title}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">{item.desc}</span>
                    </label>
                  ))}
                </div>
                {destination === 'WHATSAPP' && !isReachObjective && (
                  <div className="grid gap-2">
                    <Label>رقم واتساب</Label>
                    <Input dir="ltr" className="text-left" value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value)} placeholder="9647xxxxxxxxx" />
                  </div>
                )}
                {destination === 'INSTANT_PAGE' && (
                  <div className="grid gap-2">
                    <Label>صفحة TikTok الفورية</Label>
                    {(options?.instantPages ?? []).length ? (
                      <select className="h-10 rounded-md border bg-background px-3 text-sm" value={pageId} onChange={(event) => setPageId(event.target.value)}>
                        <option value="">اختر صفحة</option>
                        {(options?.instantPages ?? []).map((page) => <option key={page.pageId} value={page.pageId}>{page.name}</option>)}
                      </select>
                    ) : (
                      <p className="text-sm text-destructive">لا توجد صفحات فورية منشورة في هذا الحساب.</p>
                    )}
                  </div>
                )}
                {destination === 'PIXEL' && isReachObjective && (
                  <div className="grid gap-2">
                    <Label>عنوان URL</Label>
                    <Input dir="ltr" value={landingPageUrl} onChange={(event) => setLandingPageUrl(event.target.value)} placeholder="https://" />
                  </div>
                )}
                {destination === 'PIXEL' && !isReachObjective && isProductSalesStore && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    متجر تيك توك لا يستخدم بكسل Contact. لحدث <strong>Contact / الاتصال</strong> اختر
                    «موقع ويب · حملة +Smart» في خطوة هدف الحملة، ثم حدّد البكسل وهدف التحسين Contact.
                  </p>
                )}
                {destination === 'PIXEL' && !isReachObjective && !isProductSalesStore && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>اتصال البيانات / البكسل</Label>
                      <select className="h-10 rounded-md border bg-background px-3 text-sm" value={pixelId} onChange={(event) => {
                        const nextId = event.target.value;
                        setPixelId(nextId);
                        const next = (options?.pixels ?? []).find((pixel) => pixel.pixelId === nextId);
                        if (next?.trackingUrl) setUsePlatformLink(true);
                        // بكسل واتساب/اتصال → اقترح Contact تلقائياً
                        const name = `${next?.name || ''}`.toLowerCase();
                        if (/contact|consult|اتصال|واتس|whatsapp|wa\b/.test(name)) {
                          setOptimizationEvent('CONSULT');
                        }
                      }}>
                        <option value="">حدّد البكسل</option>
                        {(options?.pixels ?? []).map((pixel) => <option key={pixel.pixelId} value={pixel.pixelId}>{pixel.name}</option>)}
                      </select>
                    </div>
                    {needsPixel && (
                      <div className="grid gap-2">
                        <Label>حدث التحسين</Label>
                        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={optimizationEvent} onChange={(event) => setOptimizationEvent(event.target.value)}>
                          <option value="">حدّد حدث التحسين</option>
                          {(objective === 'WEB_CONVERSIONS' || objective === 'PRODUCT_SALES' || salesSmartPlus || menuObjective === 'WEB_CONVERSIONS'
                            ? WEB_CONVERSIONS_OBJECTIVE_CONFIG.optimizationEvents
                            : objective === 'LEAD_GENERATION'
                              ? LEAD_GENERATION_OBJECTIVE_CONFIG.optimizationEvents
                            : [
                              { id: 'CONSULT', titleAr: 'Contact / الاتصال (واتساب)' },
                              { id: 'SHOPPING', titleAr: 'شراء (Purchase)' },
                              { id: 'FORM', titleAr: 'إرسال النموذج' },
                              { id: 'BUTTON', titleAr: 'نقر الزر' },
                              { id: 'ON_WEB_CART', titleAr: 'إضافة إلى السلة' },
                            ]
                          ).map((event) => (
                            <option key={event.id} value={event.id}>{event.titleAr}</option>
                          ))}
                        </select>
                        {(salesSmartPlus || menuObjective === 'WEB_CONVERSIONS') && (
                          <p className="text-xs text-muted-foreground">
                            لبكسل واتساب اختر <strong>Contact / الاتصال</strong> (CONSULT).
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {objective === 'APP_PROMOTION' && <div className="grid gap-2"><Label>معرّف التطبيق</Label><Input value={appId} onChange={(event) => setAppId(event.target.value)} /></div>}
                {destination === 'PIXEL' && !isReachObjective && !isProductSalesStore && (
                  <>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={usePlatformLink && Boolean(selectedPixelTrackingUrl)}
                        disabled={!selectedPixelTrackingUrl}
                        onChange={(event) => setUsePlatformLink(event.target.checked)}
                      />
                      استخدام رابط تتبع البكسل المختار
                    </label>
                    {selectedPixelTrackingUrl ? (
                      <code dir="ltr" className="block break-all rounded-md bg-muted px-3 py-2 text-left text-xs">{selectedPixelTrackingUrl}</code>
                    ) : pixelId ? (
                      <p className="text-xs text-amber-700">لا يوجد رابط تتبع مربوط لهذا البكسل في جات لورا بعد.</p>
                    ) : null}
                    {(!usePlatformLink || !selectedPixelTrackingUrl) && (
                      <div className="grid gap-2"><Label>رابط الهبوط</Label><Input dir="ltr" value={landingPageUrl} onChange={(event) => setLandingPageUrl(event.target.value)} placeholder="https://" /></div>
                    )}
                  </>
                )}
                </>
                )}
              </CardContent>
            </Card>
            )}

            <Card className="border-0 shadow-card">
              <CardHeader><CardTitle>المواضع</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                {isTikTokOnlyPlacementObjective ? (
                  <div className="grid gap-2 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
                    {isLeadObjective && smartPlus ? (
                      <>
                        <p className="font-medium">موضع تلقائي (Smart+)</p>
                        <p className="text-xs text-teal-800">
                          عميل محتمل Smart+ يستخدم مواضع تلقائية — لا يمكن فرض تيك توك فقط.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">منصة تيك توك فقط</p>
                        <p className="text-xs text-teal-800">
                          {isProductSalesObjective
                            ? 'مبيعات المنتجات (متجر تيك توك) تدعم موضع TikTok فقط.'
                            : isWebConversionsObjective
                              ? 'تحويلات موقع الويب تُنشر على TikTok فقط (بدون مواضع فرعية).'
                              : 'حملة عميل محتمل يدوية تُنشر على TikTok فقط.'}
                        </p>
                        <label className="flex items-center gap-2 font-medium">
                          <input type="checkbox" checked disabled />
                          TikTok
                        </label>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                {/* ChatLoora runs classic campaigns on TikTok only (no automatic placement, no Pangle). */}
                {(
                  <div className="grid gap-2 text-sm">
                    <p className="text-xs text-muted-foreground">ستظهر إعلاناتك على تيك توك فقط، وكل الميزانية تُصرف هناك.</p>
                    <label className="flex items-center gap-2 font-medium">
                      <input type="checkbox" checked disabled />
                      {isTrafficObjective ? 'TikTok، بما في ذلك نتائج البحث' : 'TikTok'}
                    </label>
                    {placements.includes('PLACEMENT_TIKTOK') && isReachObjective && (
                      <div className="mt-2 grid gap-2 rounded-lg border p-3">
                        <p className="text-xs font-medium text-muted-foreground">مواضع TikTok الفرعية</p>
                        {REACH_OBJECTIVE_CONFIG.placements.subplacements.map((sub) => (
                          <label key={sub.id} className="flex items-center justify-between gap-3">
                            <span>{sub.labelAr}</span>
                            <input
                              type="checkbox"
                              checked={tiktokSubplacements.includes(sub.id)}
                              onChange={() => {
                                setTiktokSubplacements((current) => {
                                  const next = current.includes(sub.id) ? current.filter((item) => item !== sub.id) : [...current, sub.id];
                                  setIncludeSearchResult(next.includes('SEARCH_FEED'));
                                  return next.length ? next : ['IN_FEED'];
                                });
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                    {placements.includes('PLACEMENT_TIKTOK') && isTrafficObjective && (
                      <div className="mt-2 grid gap-2 rounded-lg border p-3">
                        <p className="text-xs font-medium text-muted-foreground">مواضع TikTok الفرعية</p>
                        {TRAFFIC_OBJECTIVE_CONFIG.placements.subplacements.map((sub) => (
                          <label key={sub.id} className="flex items-center justify-between gap-3">
                            <span>{sub.labelAr}</span>
                            <input
                              type="checkbox"
                              checked={tiktokSubplacements.includes(sub.id)}
                              onChange={() => {
                                setTiktokSubplacements((current) => {
                                  const next = current.includes(sub.id) ? current.filter((item) => item !== sub.id) : [...current, sub.id];
                                  setIncludeSearchResult(next.includes('SEARCH_FEED'));
                                  return next.length ? next : ['IN_FEED'];
                                });
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                    {placements.includes('PLACEMENT_TIKTOK') && isVideoViewsObjective && (
                      <div className="mt-2 grid gap-2 rounded-lg border p-3">
                        <p className="text-xs font-medium text-muted-foreground">مواضع TikTok الفرعية</p>
                        {VIDEO_VIEWS_OBJECTIVE_CONFIG.placements.subplacements.map((sub) => (
                          <label key={sub.id} className="flex items-center justify-between gap-3">
                            <span>{sub.labelAr}</span>
                            <input
                              type="checkbox"
                              checked={tiktokSubplacements.includes(sub.id)}
                              onChange={() => {
                                setTiktokSubplacements((current) => {
                                  const next = current.includes(sub.id) ? current.filter((item) => item !== sub.id) : [...current, sub.id];
                                  return next.length ? next : ['IN_FEED'];
                                });
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                    {placements.includes('PLACEMENT_TIKTOK') && isEngagementObjective && (
                      <div className="mt-2 grid gap-2 rounded-lg border p-3">
                        <p className="text-xs font-medium text-muted-foreground">مواضع TikTok الفرعية</p>
                        {ENGAGEMENT_OBJECTIVE_CONFIG.placements.subplacements.map((sub) => (
                          <label key={sub.id} className="flex items-center justify-between gap-3">
                            <span>{sub.labelAr}</span>
                            <input
                              type="checkbox"
                              checked={tiktokSubplacements.includes(sub.id)}
                              onChange={() => {
                                setTiktokSubplacements((current) => {
                                  const next = current.includes(sub.id) ? current.filter((item) => item !== sub.id) : [...current, sub.id];
                                  return next.length ? next : ['IN_FEED'];
                                });
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                    {placements.includes('PLACEMENT_TIKTOK') && !isReachObjective && !isTrafficObjective && !isVideoViewsObjective && !isEngagementObjective && (
                      <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <span>تضمين نتائج البحث</span>
                        <input type="checkbox" checked={includeSearchResult} onChange={(event) => setIncludeSearchResult(event.target.checked)} />
                      </label>
                    )}
                  </div>
                )}
                  </>
                )}
                <div className="grid gap-2 rounded-lg border p-3 text-sm">
                  <p className="font-medium">تفاعلات الجمهور</p>
                  <label className="flex items-center justify-between gap-3"><span>السماح بالتعليقات</span><input type="checkbox" checked={allowComments} onChange={(event) => setAllowComments(event.target.checked)} /></label>
                  <label className="flex items-center justify-between gap-3"><span>السماح بتنزيل الفيديو</span><input type="checkbox" checked={allowDownload} onChange={(event) => setAllowDownload(event.target.checked)} /></label>
                  <label className="flex items-center justify-between gap-3"><span>السماح بمشاركة الفيديو</span><input type="checkbox" checked={allowShare} onChange={(event) => setAllowShare(event.target.checked)} /></label>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader><CardTitle>الاستهداف</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label>المواقع</Label>
                  <Input value={countryQuery} onChange={(event) => setCountryQuery(event.target.value)} placeholder="ابحث عن دولة" />
                  <div className="max-h-40 space-y-1 overflow-auto rounded-xl border p-2">
                    {countries.map((region) => (
                      <label key={region.locationId} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={locationIds.includes(region.locationId)} onChange={() => toggleCountry(region)} />
                        {region.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>الأعمار</Label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={`rounded-lg border px-3 py-1.5 text-sm ${ageGroups.length === 0 ? 'border-teal-500 bg-teal-50' : ''}`} onClick={() => setAgeGroups([])}>دون حدود</button>
                    {(options?.ageGroups ?? Object.keys(AGE_LABELS)).map((age) => {
                      const on = ageGroups.includes(age);
                      return (
                        <button key={age} type="button" className={`rounded-lg border px-3 py-1.5 text-sm ${on ? 'border-primary bg-primary/10' : ''}`} onClick={() => setAgeGroups((current) => current.includes(age) ? current.filter((item) => item !== age) : [...current, age])}>
                          <span dir="ltr">{AGE_LABELS[age] ?? age}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>الأجناس</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ['GENDER_UNLIMITED', 'الكل'],
                      ['GENDER_MALE', 'ذكر'],
                      ['GENDER_FEMALE', 'أنثى'],
                    ].map(([id, label]) => (
                      <button key={id} type="button" className={`rounded-lg border px-3 py-1.5 text-sm ${gender === id ? 'border-primary bg-primary/10' : ''}`} onClick={() => setGender(id)}>{label}</button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>اللغات</Label>
                  <div className="relative" ref={languageMenuRef}>
                    <button
                      type="button"
                      className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-background px-3 text-sm shadow-sm hover:border-primary"
                      onClick={() => setLanguageMenuOpen((open) => !open)}
                    >
                      <span className="truncate font-medium">
                        {languagesAll || languageCodes.length === 0
                          ? 'كل اللغات'
                          : languageCodes.length === 1
                            ? ((options?.languages ?? []).find((lang) => lang.code === languageCodes[0])?.name || languageCodes[0])
                            : `${languageCodes.length} لغات محددة`}
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 transition ${languageMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {languageMenuOpen && (
                      <div className="absolute inset-x-0 z-40 mt-2 rounded-2xl border bg-background p-3 shadow-xl">
                        <div className="mb-3 relative">
                          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input className="ps-9" value={languageQuery} onChange={(event) => setLanguageQuery(event.target.value)} placeholder="بحث عن لغة" />
                        </div>
                        <div className="max-h-64 space-y-2 overflow-auto">
                          <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm hover:bg-muted/40 ${languagesAll || languageCodes.length === 0 ? 'border-primary bg-primary/5' : ''}`}>
                            <input
                              type="checkbox"
                              checked={languagesAll || languageCodes.length === 0}
                              onChange={() => {
                                setLanguagesAll(true);
                                setLanguageCodes([]);
                              }}
                            />
                            <span className="font-medium">اختيار الكل</span>
                          </label>
                          {filteredLanguages.map((lang) => (
                            <label key={lang.code} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm hover:bg-muted/40 ${!languagesAll && languageCodes.includes(lang.code) ? 'border-primary bg-primary/5' : ''}`}>
                              <input
                                type="checkbox"
                                checked={!languagesAll && languageCodes.includes(lang.code)}
                                onChange={() => {
                                  setLanguagesAll(false);
                                  setLanguageCodes((current) => {
                                    const next = current.includes(lang.code)
                                      ? current.filter((code) => code !== lang.code)
                                      : [...current, lang.code];
                                    if (!next.length) {
                                      setLanguagesAll(true);
                                      return [];
                                    }
                                    return next;
                                  });
                                }}
                              />
                              <span className="min-w-0 flex-1 truncate font-medium">{lang.name}</span>
                              <span dir="ltr" className="shrink-0 text-xs text-muted-foreground">{lang.code}</span>
                            </label>
                          ))}
                          {(options?.languages ?? []).length === 0 && <p className="py-3 text-center text-sm text-muted-foreground">كل اللغات متاحة</p>}
                          {(options?.languages ?? []).length > 0 && filteredLanguages.length === 0 && <p className="py-3 text-center text-sm text-muted-foreground">لا توجد لغات مطابقة.</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>القدرة الشرائية</Label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={`rounded-lg border px-3 py-1.5 text-sm ${spendingPower === 'ALL' ? 'border-primary bg-primary/10' : ''}`} onClick={() => setSpendingPower('ALL')}>الكل</button>
                    <button type="button" className={`rounded-lg border px-3 py-1.5 text-sm ${spendingPower === 'HIGH' ? 'border-primary bg-primary/10' : ''}`} onClick={() => setSpendingPower('HIGH')}>قدرة شرائية عالية</button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>الاهتمامات</Label>
                  <div className="flex flex-wrap gap-2">
                    {interestIds.map((id) => {
                      const name = (options?.interests ?? []).find((item) => item.id === id)?.name || id;
                      return (
                        <button key={id} type="button" className="rounded-full border bg-muted px-3 py-1 text-xs" onClick={() => setInterestIds((current) => current.filter((item) => item !== id))}>
                          {name} ×
                        </button>
                      );
                    })}
                  </div>
                  <Input value={interestQuery} onChange={(event) => setInterestQuery(event.target.value)} placeholder="ابحث في الاهتمامات" />
                  <div className="max-h-36 space-y-1 overflow-auto rounded-xl border p-2">
                    {interests.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={interestIds.includes(item.id)} onChange={() => setInterestIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} />
                        {item.name}
                      </label>
                    ))}
                  </div>
                  <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                    <span>الاهتمامات والسلوكيات الذكية</span>
                    <input type="checkbox" checked={smartInterestBehavior} onChange={(event) => setSmartInterestBehavior(event.target.checked)} />
                  </label>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader><CardTitle>الجهاز</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    ['ALL', 'الكل'],
                    ['ANDROID', 'Android'],
                    ['IOS', 'iOS'],
                  ].map(([id, label]) => (
                    <button key={id} type="button" disabled={objective === 'APP_PROMOTION'} className={`rounded-lg border px-3 py-1.5 text-sm ${devices === id ? 'border-primary bg-primary/10' : ''}`} onClick={() => setDevices(id as 'ALL' | 'ANDROID' | 'IOS')}>{label}</button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader><CardTitle>الميزانية والجدول</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>نوع الميزانية</Label>
                    <select
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                      value={budgetMode}
                      onChange={(event) => {
                        const next = event.target.value as 'BUDGET_MODE_DAY' | 'BUDGET_MODE_TOTAL';
                        setBudgetMode(next);
                        if (next === 'BUDGET_MODE_TOTAL') setScheduleMode('RANGE');
                      }}
                    >
                      <option value="BUDGET_MODE_DAY">يومية</option>
                      <option value="BUDGET_MODE_TOTAL">إجمالي مدة الحملة</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label>{budgetMode === 'BUDGET_MODE_DAY' ? 'الميزانية اليومية' : 'ميزانية مدة الحملة'}</Label>
                    <div className="flex items-center gap-2">
                      <Input dir="ltr" type="number" min="1" value={budget} onChange={(event) => setBudget(event.target.value)} />
                      <span dir="ltr" className="shrink-0 text-sm">{symbol || '—'}</span>
                    </div>
                  </div>
                </div>
                {isLeadObjective && (
                  <div className="grid gap-3 rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{LEAD_GENERATION_OBJECTIVE_CONFIG.budgetIncrease.labelAr}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{LEAD_GENERATION_OBJECTIVE_CONFIG.budgetIncrease.descAr}</p>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <span className={budgetIncreaseEnabled ? 'text-teal-700' : 'text-muted-foreground'}>
                          {budgetIncreaseEnabled ? LEAD_GENERATION_OBJECTIVE_CONFIG.budgetIncrease.enabledLabelAr : 'إيقاف'}
                        </span>
                        <input
                          type="checkbox"
                          checked={budgetIncreaseEnabled}
                          onChange={(event) => setBudgetIncreaseEnabled(event.target.checked)}
                        />
                      </label>
                    </div>
                    {budgetIncreaseEnabled && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>{LEAD_GENERATION_OBJECTIVE_CONFIG.budgetIncrease.amountLabelAr}</Label>
                          <div className="flex items-center gap-2">
                            <Input dir="ltr" type="number" min="1" value={budgetIncreaseAmount} onChange={(event) => setBudgetIncreaseAmount(event.target.value)} />
                            <span dir="ltr" className="shrink-0 text-sm">{symbol || '—'}</span>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label>{LEAD_GENERATION_OBJECTIVE_CONFIG.budgetIncrease.maxTimesLabelAr}</Label>
                          <Input dir="ltr" type="number" min="1" max="30" value={budgetIncreaseMaxTimes} onChange={(event) => setBudgetIncreaseMaxTimes(event.target.value)} />
                        </div>
                        {budgetDailyCap != null && (
                          <p className="sm:col-span-2 text-xs text-muted-foreground">
                            {LEAD_GENERATION_OBJECTIVE_CONFIG.budgetIncrease.dailyCapNoteAr} الحد التقريبي:{' '}
                            <strong dir="ltr">{budgetDailyCap.toLocaleString()} {symbol || ''}</strong>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="grid gap-3">
                  <Label>الجدول</Label>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={scheduleMode === 'CONTINUOUS'}
                        onChange={() => {
                          setScheduleMode('CONTINUOUS');
                          setScheduleEndDate('');
                          if (budgetMode === 'BUDGET_MODE_TOTAL') setBudgetMode('BUDGET_MODE_DAY');
                        }}
                      />
                      تشغيل مستمر
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={scheduleMode === 'RANGE'} onChange={() => setScheduleMode('RANGE')} />
                      تعيين وقتي البدء والانتهاء
                    </label>
                  </div>
                  {scheduleMode === 'CONTINUOUS' && (
                    <p className="text-xs text-muted-foreground">التشغيل المستمر لا يحتاج تاريخ نهاية. إن كانت الميزانية «إجمالي المدة» تُحوَّل تلقائياً إلى يومية.</p>
                  )}
                  {scheduleMode === 'RANGE' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-2"><Label>وقت البدء</Label><Input dir="ltr" className="text-left" type="date" value={scheduleStartDate} onChange={(event) => setScheduleStartDate(event.target.value)} /></div>
                      <div className="grid gap-2"><Label>وقت الانتهاء</Label><Input dir="ltr" className="text-left" type="date" value={scheduleEndDate} onChange={(event) => setScheduleEndDate(event.target.value)} /></div>
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label>توقيت جدولة الحملة (معنى التواريخ)</Label>
                    <select
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                    >
                      {Object.entries({
                        ...TIMEZONE_LABELS,
                        ...(selectedAdvertiser?.timezone && !TIMEZONE_LABELS[selectedAdvertiser.timezone]
                          ? { [selectedAdvertiser.timezone]: timezoneLabel(selectedAdvertiser.timezone) }
                          : {}),
                      }).map(([id, label]) => (
                        <option key={id} value={id}>{label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      اختر بغداد إذا كانت تواريخ البدء/الانتهاء وساعات الظهور حسب توقيت العراق (+3).
                      جات لورا تحوّل البداية والنهاية وجدول الساعات تلقائياً إلى توقيت حساب تيك توك قبل النشر.
                    </p>
                    {selectedAdvertiser?.timezone && (
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        مثال: 09:00–21:00 بغداد تظهر في مدير تيك توك تقريباً 01:00–13:00 بتوقيت الحساب
                        {' '}({timezoneLabel(selectedAdvertiser.timezone)})
                        {' '}— نفس الوقت الحقيقي بعد التحويل، وليس خطأ.
                      </p>
                    )}
                  </div>
                  <DaypartEditor week={week} onChange={setWeek} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader><CardTitle>المزايدات والتحسين</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <p className="text-sm">هدف التحسين: <strong>{
                  isTrafficObjective
                    ? trafficGoalMeta.titleAr
                    : isVideoViewsObjective
                      ? videoViewsGoalMeta.titleAr
                      : isEngagementObjective
                        ? engagementGoalMeta.titleAr
                      : isLeadObjective
                        ? LEAD_GENERATION_OBJECTIVE_CONFIG.optimizationGoalLabelAr
                      : (OPTIMIZATION_GOAL_LABELS[objectiveSpec?.optimizationGoal || ''] || objectiveSpec?.optimizationGoal || '—')
                }</strong></p>
                {isLeadObjective && (
                  <p className="text-xs text-muted-foreground">{LEAD_GENERATION_OBJECTIVE_CONFIG.billingNoteAr}</p>
                )}
                {(objective === 'WEB_CONVERSIONS' || objective === 'PRODUCT_SALES') && (
                  <p className="text-xs text-muted-foreground">{WEB_CONVERSIONS_OBJECTIVE_CONFIG.billingNoteAr}</p>
                )}
                {isTrafficObjective && (
                  <p className="text-xs text-muted-foreground">نوع العرض: قياسي (افتراضي لحملة الزيارات في تيك توك).</p>
                )}
                {isEngagementObjective && (
                  <div className="grid gap-3">
                    <Label>هدف التحسين</Label>
                    {ENGAGEMENT_OBJECTIVE_CONFIG.optimizationGoals.map((goal) => (
                      <label key={goal.id} className={`rounded-xl border p-3 text-sm ${engagementGoal === goal.id ? 'border-teal-500 bg-teal-50' : ''}`}>
                        <span className="flex items-center gap-2 font-medium">
                          <input type="radio" checked={engagementGoal === goal.id} onChange={() => setEngagementGoal(goal.id)} />
                          {goal.titleAr}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">{goal.descAr}</span>
                      </label>
                    ))}
                    <p className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                      حساب تيك توك (الهوية) يُختار في خطوة الإعلان ويُرسل مع الإبداعات إلى تيك توك. هدف المتابعة يعتمد على هذه الهوية فعلياً.
                    </p>
                  </div>
                )}
                {isVideoViewsObjective && (
                  <div className="grid gap-3">
                    <Label>هدف التحسين</Label>
                    {VIDEO_VIEWS_OBJECTIVE_CONFIG.optimizationGoals.map((goal) => (
                      <label key={goal.id} className={`rounded-xl border p-3 text-sm ${videoViewsGoal === goal.id ? 'border-teal-500 bg-teal-50' : ''}`}>
                        <span className="flex items-center gap-2 font-medium">
                          <input type="radio" checked={videoViewsGoal === goal.id} onChange={() => setVideoViewsGoal(goal.id)} />
                          {goal.titleAr}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">{goal.descAr}</span>
                      </label>
                    ))}
                    {videoViewsGoal === 'ENGAGED_VIEW' && (
                      <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                        للفيديوهات بطول 8 ثوانٍ أو أكثر نوصي باختيار مشاهدات 15 ثانية (مشاهدة مركّزة).
                        <button type="button" className="mr-2 underline" onClick={() => setVideoViewsGoal('ENGAGED_VIEW_FIFTEEN')}>تطبيق</button>
                      </p>
                    )}
                    <Label>تحديد عدد مرات الظهور</Label>
                    {VIDEO_VIEWS_OBJECTIVE_CONFIG.frequency.modes.map((mode) => (
                      <label key={mode.id} className={`rounded-xl border p-3 text-sm ${videoFrequencyMode === mode.id ? 'border-teal-500 bg-teal-50' : ''}`}>
                        <span className="flex items-center gap-2 font-medium">
                          <input type="radio" checked={videoFrequencyMode === mode.id} onChange={() => setVideoFrequencyMode(mode.id)} />
                          {mode.titleAr}
                        </span>
                      </label>
                    ))}
                    {videoFrequencyMode === 'CAP' && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>أقصى مرات ظهور</Label>
                          <Input dir="ltr" type="number" min="1" max="30" value={frequency} onChange={(event) => setFrequency(event.target.value)} />
                        </div>
                        <div className="grid gap-2">
                          <Label>خلال عدد الأيام</Label>
                          <Input dir="ltr" type="number" min="1" max="30" value={frequencySchedule} onChange={(event) => setFrequencySchedule(event.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {isReachObjective && (
                  <div className="grid gap-3">
                    <Label>التكرار</Label>
                    {REACH_OBJECTIVE_CONFIG.frequency.modes.map((mode) => (
                      <label key={mode.id} className={`rounded-xl border p-3 text-sm ${frequencyMode === mode.id ? 'border-teal-500 bg-teal-50' : ''}`}>
                        <span className="flex items-center gap-2 font-medium">
                          <input type="radio" checked={frequencyMode === mode.id} onChange={() => setFrequencyMode(mode.id)} />
                          {mode.titleAr}
                          {mode.recommended ? <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-700">موصى به</span> : null}
                        </span>
                      </label>
                    ))}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>أقصى مرات ظهور</Label>
                        <Input dir="ltr" type="number" min="1" max="30" value={frequency} onChange={(event) => setFrequency(event.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label>خلال عدد الأيام</Label>
                        <Input dir="ltr" type="number" min="1" max="30" value={frequencySchedule} onChange={(event) => setFrequencySchedule(event.target.value)} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      لا تعرض الإعلانات أكثر من {frequency || '—'} مرّات كل {frequencySchedule || '—'} من الأيام. يُرسل لتيك توك كـ frequency / frequency_schedule.
                    </p>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label>{isReachObjective || isTrafficObjective || isVideoViewsObjective || isEngagementObjective || objective === 'WEB_CONVERSIONS' || objective === 'PRODUCT_SALES' ? 'التكلفة المستهدفة لكل نتيجة (اختياري)' : 'التكلفة المستهدفة لكل نتيجة'}</Label>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2"><input type="radio" checked={bidStrategy === 'HIGHEST'} onChange={() => setBidStrategy('HIGHEST')} /> {isReachObjective ? 'أعلى وصول' : 'أعلى نتائج ضمن الميزانية'}</label>
                    <label className="flex items-center gap-2"><input type="radio" checked={bidStrategy === 'TARGET'} onChange={() => setBidStrategy('TARGET')} /> أحدد القيمة</label>
                  </div>
                  {bidStrategy === 'TARGET' && (
                    <div className="flex max-w-xs items-center gap-2">
                      <Input dir="ltr" type="number" min="0.01" step="0.01" value={targetCost} onChange={(event) => setTargetCost(event.target.value)} />
                      <span dir="ltr" className="shrink-0 text-sm">
                        {isEngagementObjective && symbol
                          ? `${symbol}/${engagementGoalMeta.unitAr}`
                          : isVideoViewsObjective && symbol
                          ? `${symbol}/${videoViewsGoalMeta.unitAr}`
                          : isTrafficObjective && symbol
                            ? `${symbol}/${trafficGoalMeta.unitAr}`
                            : isReachObjective && symbol
                              ? `${symbol}/ألف ظهور`
                              : (objective === 'WEB_CONVERSIONS' || objective === 'PRODUCT_SALES') && symbol
                                ? `${symbol}/تحويل`
                              : (symbol || '—')}
                      </span>
                    </div>
                  )}
                  {(isTrafficObjective || isVideoViewsObjective || isEngagementObjective || objective === 'WEB_CONVERSIONS' || objective === 'PRODUCT_SALES') && bidStrategy === 'HIGHEST' && (
                    <p className="text-xs text-muted-foreground">دون تكلفة مستهدفة سنسعى لإنفاق الميزانية لأكبر عدد ممكن من النتائج.</p>
                  )}
                </div>
                <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <span>
                    <span className="font-medium">العرض المُسرَّع</span>
                    <span className="mt-1 block text-xs text-muted-foreground">للمعلنين الذين يريدون إنفاق الميزانية بسرعة ويقبلون تذبذب تكلفة الإجراء.</span>
                  </span>
                  <input type="checkbox" checked={acceleratedDelivery} onChange={(event) => setAcceleratedDelivery(event.target.checked)} />
                </label>
                {(objective === 'WEB_CONVERSIONS' || objective === 'PRODUCT_SALES') ? (
                  <div className="grid gap-3 rounded-lg border p-3">
                    <p className="text-sm font-medium">إعدادات الإسناد</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="grid gap-2">
                        <Label>نافذة النقر</Label>
                        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={clickAttributionWindow} onChange={(event) => setClickAttributionWindow(event.target.value)}>
                          {WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.clickWindows.map((item) => (
                            <option key={item.id} value={item.id}>{item.titleAr}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-2">
                        <Label>نافذة المشاهدة</Label>
                        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={viewAttributionWindow} onChange={(event) => setViewAttributionWindow(event.target.value)}>
                          {WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.viewWindows.map((item) => (
                            <option key={item.id} value={item.id}>{item.titleAr}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-2">
                        <Label>عدّ الأحداث</Label>
                        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={attributionEventCount} onChange={(event) => setAttributionEventCount(event.target.value)}>
                          {WEB_CONVERSIONS_OBJECTIVE_CONFIG.attribution.eventCounts.map((item) => (
                            <option key={item.id} value={item.id}>{item.titleAr}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      الافتراضي: نقر خلال 7 أيام أو مشاهدة خلال يوم واحد — العد كل مرة.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">إعدادات الإسناد: نقر 7 أيام / مشاهدة يوم واحد — العد كل مرة.</p>
                )}
                <div className="flex justify-between gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>رجوع</Button>
                  <Button type="button" onClick={() => {
                    const problem = groupProblem(snapshotGroup(), 'adgroup');
                    if (problem && !problem.includes('فيديو') && !problem.includes('كود')) {
                      setError(problem);
                      return;
                    }
                    setError(null);
                    advanceTo(3);
                  }}>متابعة</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="h-fit rounded-2xl border bg-muted/30 p-4 xl:sticky xl:top-4">
            <h3 className="font-semibold">الجمهور المتاح</h3>
            {audienceEstimate ? (
              <>
                <p dir="ltr" className="mt-2 text-lg font-medium">{audienceEstimate.lower.toLocaleString()} - {audienceEstimate.upper.toLocaleString()}</p>
                <p className="mt-1 text-xs text-emerald-700">{audienceEstimate.suggestion || 'متوازن'}</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{estimateError || 'اختر دولة لتقدير الجمهور'}</p>
            )}
            <div className="mt-4 space-y-2 text-sm">
              <p className="font-medium">ملخص الاستهداف</p>
              <p>المواقع: {locationIds.map((id) => (options?.regions ?? []).find((row) => row.locationId === id)?.name || id).join('، ') || '—'}</p>
              <p>الأعمار: {ageGroups.map((age) => AGE_LABELS[age] || age).join('، ') || 'الكل'}</p>
              <p>أنظمة التشغيل: {devices === 'ALL' ? 'الكل' : devices}</p>
              <p>الاهتمامات: {interestIds.length ? `${interestIds.length} محدد` : '—'}</p>
            </div>
          </aside>
        </div>
        )}

        {step === 3 && (
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>الإعلان</CardTitle>
            <CardDescription>اختر مصدر الفيديو أولاً، ثم الفيديوهات وزر الدعوة، ثم انشر.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label>اسم الإعلان</Label>
              <Input
                value={adName}
                onChange={(event) => setAdName(event.target.value)}
                placeholder="اسم الإعلان"
              />
              {smartPlus && (
                <p className="text-xs text-muted-foreground">
                  مع Smart+ تُدمج كل الفيديوهات المختارة داخل إعلان واحد (أداة التصميم الإبداعي الذكي)، وتظهر في تيك توك تحت هذا الاسم مع سهم لعرض الفيديوهات.
                </p>
              )}
            </div>
            {isLeadObjective && (
              <div className="grid gap-3 rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">{LEAD_GENERATION_OBJECTIVE_CONFIG.identity.labelAr}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{LEAD_GENERATION_OBJECTIVE_CONFIG.identity.descAr}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">{LEAD_GENERATION_OBJECTIVE_CONFIG.destinationAd.labelAr}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{LEAD_GENERATION_OBJECTIVE_CONFIG.destinationAd.descAr}</p>
                  {destination === 'PIXEL' ? (
                    <p className="mt-2 text-sm">
                      {LEAD_GENERATION_OBJECTIVE_CONFIG.destinationAd.websiteUrlLabelAr}:{' '}
                      <code dir="ltr" className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {(usePlatformLink && selectedPixelTrackingUrl) || landingPageUrl || '—'}
                      </code>
                    </p>
                  ) : (
                    <div className="mt-3 grid gap-3">
                      <div>
                        <p className="text-sm font-medium">{LEAD_GENERATION_OBJECTIVE_CONFIG.destinationAd.instantFormLabelAr}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{LEAD_GENERATION_OBJECTIVE_CONFIG.destinationAd.instantFormHintAr}</p>
                      </div>
                      {pageId ? (
                        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                          <p className="font-medium">
                            {(options?.instantPages ?? []).find((row) => row.pageId === pageId)?.name || 'استمارة محددة'}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground" dir="ltr">{pageId}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => setInstantFormLibraryOpen(true)}>
                              تغيير الاستمارة
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={instantFormBusy || !advertiserId}
                              onClick={() => void openLeadInstantFormEditor('copy', pageId)}
                            >
                              تكرار وتعديل
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-700">لم تُختر استمارة بعد.</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={instantFormBusy || !advertiserId}
                          onClick={() => void openLeadInstantFormEditor('create')}
                        >
                          {LEAD_GENERATION_OBJECTIVE_CONFIG.destinationAd.createNewAr}
                        </Button>
                        <Button type="button" variant="outline" disabled={!advertiserId} onClick={() => setInstantFormLibraryOpen(true)}>
                          {LEAD_GENERATION_OBJECTIVE_CONFIG.destinationAd.selectExistingAr}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="grid gap-3">
              <Label>مصدر الفيديو</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className={`rounded-xl border p-3 text-sm ${videoSource === 'IDENTITY' ? 'border-teal-500 bg-teal-50' : ''}`}>
                  <span className="flex items-center gap-2 font-medium">
                    <input type="radio" checked={videoSource === 'IDENTITY'} onChange={() => selectVideoSource('IDENTITY')} />
                    حساب تيك توك مربوط
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">اختر حساباً مربوطاً ثم الفيديوهات منه.</span>
                </label>
                <label className={`rounded-xl border p-3 text-sm ${videoSource === 'AUTH_CODE' ? 'border-teal-500 bg-teal-50' : ''}`}>
                  <span className="flex items-center gap-2 font-medium">
                    <input type="radio" checked={videoSource === 'AUTH_CODE'} onChange={() => selectVideoSource('AUTH_CODE')} />
                    كود إعلان
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">الصق أكواد الإعلانات ثم أضفها.</span>
                </label>
              </div>
            </div>

            {videoSource === 'IDENTITY' && (
              <>
                <div className="grid gap-2">
                  <Label>حساب تيك توك المربوط</Label>
                  <button type="button" className="flex h-11 items-center gap-3 rounded-md border bg-background px-3 text-sm" onClick={() => setIdentityOpen((open) => !open)}>
                    <AccountAvatar src={selectedIdentity?.imageUrl} name={selectedIdentity?.displayName || 'ت'} />
                    <span className="truncate">{selectedIdentity ? selectedIdentity.displayName : 'اختر حساب تيك توك'}</span>
                  </button>
                  {identityOpen && (
                    <div className="max-h-64 space-y-1 overflow-auto rounded-xl border p-1">
                      {(options?.identities ?? []).map((identity) => {
                        const key = `${identity.identityId}|${identity.identityType}`;
                        return (
                          <button
                            key={`${identity.identityType}:${identity.identityId}`}
                            type="button"
                            className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-right text-sm hover:bg-muted ${identityKey === key ? 'bg-muted' : ''}`}
                            onClick={() => selectIdentityAccount(key)}
                          >
                            <AccountAvatar src={identity.imageUrl} name={identity.displayName} />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{identity.displayName}</span>
                              <span className="block text-xs text-muted-foreground">{IDENTITY_LABELS[identity.identityType] ?? 'حساب تيك توك'}</span>
                            </span>
                          </button>
                        );
                      })}
                      {(options?.identities ?? []).length === 0 && (
                        <p className="px-2 py-3 text-sm text-muted-foreground">
                          {optionsError
                            ? `تعذّر جلب الحسابات: ${optionsError}`
                            : loadingOptions
                              ? 'جاري تحميل الحسابات المرتبطة...'
                              : 'لا توجد حسابات مرتبطة لهذا الحساب الإعلاني. تأكد من ربط حساب تيك توك من Ads Manager أو مركز الأعمال.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {identityKey && (
                  <>
                    <div className="grid gap-2">
                      <Label>بحث عن فيديو</Label>
                      <Input value={videoSearch} onChange={(event) => setVideoSearch(event.target.value)} placeholder="ابحث بالنص أو معرّف الفيديو" />
                    </div>
                    <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border p-2" onScroll={onVideoScroll}>
                      {filteredVideos.map((video) => {
                        const key = `${video.identityType}:${video.itemId}`;
                        const checked = selected.some((item) => item.key === key);
                        return (
                          <div key={key} className="flex items-center gap-3 rounded-lg border p-2 text-sm">
                            <input type="checkbox" checked={checked} onChange={() => checked ? setSelected((current) => current.filter((item) => item.key !== key)) : addSelected(video, key)} />
                            <VideoThumb video={video} onOpen={() => setPreview(video)} />
                            <span className="line-clamp-2">{video.text || video.itemId}</span>
                          </div>
                        );
                      })}
                      {!filteredVideos.length && <p className="py-3 text-center text-sm text-muted-foreground">{videoSearch.trim() ? 'لا نتائج للبحث' : 'لا توجد فيديوهات'}</p>}
                      {hasMoreVideos && !videoSearch.trim() && <p className="py-2 text-center text-xs text-muted-foreground">انزل لعرض المزيد</p>}
                    </div>
                  </>
                )}
              </>
            )}

            {videoSource === 'AUTH_CODE' && (
              <div className="grid gap-2">
                <Label>أكواد الإعلانات</Label>
                <textarea className="min-h-24 rounded-md border bg-background p-3 text-sm" dir="ltr" value={authCodes} onChange={(event) => setAuthCodes(event.target.value)} placeholder={'كود في كل سطر'} />
                <Button type="button" variant="outline" onClick={() => void addAuthCodes()} disabled={busy || !authCodes.trim()}>إضافة</Button>
              </div>
            )}

            <div className="grid gap-2">
              <Label>الفيديوهات المختارة</Label>
              <div className="space-y-2 rounded-xl border p-2">
                {selected.length === 0 && <p className="text-sm text-muted-foreground">لم يُختر فيديو بعد.</p>}
                {selected.map((video) => (
                  <div key={video.key} className="flex items-center gap-3 rounded-lg bg-muted/40 p-2">
                    <VideoThumb video={video} onOpen={() => setPreview(video)} />
                    <span className="line-clamp-2 flex-1 text-sm">{video.text || video.itemId}</span>
                    <Button type="button" size="icon" variant="ghost" onClick={() => setSelected((current) => current.filter((item) => item.key !== video.key))}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:max-w-xs">
              <Label>زر دعوة العميل</Label>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={callToAction} onChange={(event) => setCallToAction(event.target.value)}>
                {(smartPlus
                  ? SMART_PLUS_CTA_IDS
                  : (options?.callToActions ?? Object.keys(CTA_LABELS))
                ).map((cta) => <option key={cta} value={cta}>{CTA_LABELS[cta] ?? 'زر الدعوة'}</option>)}
              </select>
            </div>
            <InteractiveAddonsPanel
              advertiserId={advertiserId}
              pixelId={pixelId}
              trackingUrl={selectedPixelTrackingUrl || ((usePlatformLink ? '' : landingPageUrl.trim()) || undefined)}
              enabled={interactiveAddonsEnabled}
              onEnabledChange={setInteractiveAddonsEnabled}
              selectedCardId={cardId}
              selectedPreviewUrl={cardPreviewUrl}
              onSelect={(card) => {
                if (!card) {
                  setCardId('');
                  setCardPreviewUrl('');
                  return;
                }
                setCardId(card.cardId);
                setCardPreviewUrl(card.previewUrl);
              }}
            />
            <div className="grid gap-3 rounded-xl border p-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>السماح بالتعليقات</span>
                <input type="checkbox" checked={allowComments} onChange={(event) => setAllowComments(event.target.checked)} />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>السماح بتنزيل الفيديو</span>
                <input type="checkbox" checked={allowDownload} onChange={(event) => setAllowDownload(event.target.checked)} />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>السماح بمشاركة الفيديو</span>
                <input type="checkbox" checked={allowShare} onChange={(event) => setAllowShare(event.target.checked)} />
              </label>
            </div>
            <div className="flex justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>رجوع</Button>
              <Button type="button" onClick={() => void publish()} disabled={busy || Boolean(result)}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? 'حفظ تعديل الحملة' : 'نشر كل المجموعات والإعلانات'}
              </Button>
            </div>
          </CardContent>
        </Card>
        )}
        </div>
      </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <div className="w-[420px] max-w-full overflow-hidden rounded-2xl bg-black shadow-2xl" onClick={(event) => event.stopPropagation()}>
            {preview.videoUrl ? (
              <video src={preview.videoUrl} poster={preview.posterUrl || undefined} controls autoPlay playsInline className="h-[620px] max-h-[70vh] w-full bg-black object-contain" />
            ) : preview.previewLink ? (
              <iframe src={preview.previewLink} title={preview.text || 'معاينة الإعلان'} className="h-[620px] max-h-[70vh] w-full bg-white" />
            ) : preview.posterUrl ? (
              <img src={preview.posterUrl} alt="" referrerPolicy="no-referrer" className="h-[620px] max-h-[70vh] w-full object-contain" />
            ) : (
              <div className="flex h-80 items-center justify-center text-white">لا تتوفر معاينة لهذا الفيديو</div>
            )}
            <p className="line-clamp-2 bg-black px-4 py-3 text-sm text-white">{preview.text}</p>
          </div>
        </div>
      )}

      <InstantFormLibraryModal
        open={instantFormLibraryOpen}
        advertiserId={advertiserId}
        tipAppId={options?.tipAppId}
        selectedPageId={pageId}
        onClose={() => setInstantFormLibraryOpen(false)}
        onSelect={(form) => applySelectedInstantForm(form)}
        onFormsChanged={(forms) => {
          setOptions((current) => (current ? { ...current, instantPages: forms } : current));
        }}
      />
    </AppShell>
  );
}
