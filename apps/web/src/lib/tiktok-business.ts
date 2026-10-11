import { API_URL, api, getAccessToken } from '@/lib/utils';

export type TikTokBusinessStatus = {
  loginConnected: boolean;
  marketingConnected: boolean;
  marketingApiConfigured: boolean;
  hasBusinessAccess: boolean;
  businessCenter: { id: string; name: string | null } | null;
  advertisers: Array<{
    advertiserId: string;
    name: string | null;
    currency: string | null;
    status: string | null;
  }>;
  lastSyncAt: string | null;
  syncMessage: string | null;
  marketingExpiresAt: string | null;
  loginProfile: {
    openId: string;
    displayName: string | null;
    avatar: string | null;
    expiresAt: string;
  } | null;
};

export type TikTokBusinessCampaign = {
  advertiserId: string;
  campaignId: string;
  name: string | null;
  objective: string | null;
  status: string | null;
  budget: number | null;
  spend: number;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  conversions: number;
  syncedAt?: string;
};

export type TikTokBusinessAdGroup = {
  advertiserId: string;
  adGroupId: string;
  campaignId: string | null;
  name: string | null;
  status: string | null;
  billingEvent: string | null;
  budget: number | null;
  syncedAt?: string;
};

export type TikTokBusinessAd = {
  advertiserId: string;
  adId: string;
  adGroupId: string | null;
  campaignId: string | null;
  name: string | null;
  status: string | null;
  syncedAt?: string;
};

export type TikTokBusinessAnalytics = {
  totals: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    conversations: number;
    costPerConversation: number;
    ctr: number;
    avgCpc: number;
    avgCpm: number;
  };
  counts: {
    advertisers: number;
    campaigns: number;
    activeCampaigns: number;
    adgroups: number;
    ads: number;
  };
  topCampaigns: Array<{
    advertiserId: string;
    campaignId: string;
    name: string | null;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
  }>;
  topWhatsAppNumbers: Array<{
    whatsappNumber: string;
    mappings: number;
  }>;
};

export type TikTokWhatsAppMapping = {
  id: string;
  advertiserId: string | null;
  externalCampaignId: string | null;
  externalAdGroupId: string | null;
  externalAdId: string | null;
  eventSetId: string | null;
  whatsappNumber: string;
  isActive: boolean;
  updatedAt: string;
};

export type TikTokWhatsAppNumber = {
  id: string;
  phoneNumber: string;
  label: string;
  source: 'session' | 'cloud';
  connected: boolean;
};

export type MessageEventSetStatus =
  | 'PENDING'
  | 'CREATING'
  | 'CREATED'
  | 'FAILED'
  | 'PERMISSION_ERROR'
  | 'TOKEN_EXPIRED'
  | 'UNSUPPORTED_ADVERTISER';

export type TikTokEventSet = {
  id: string;
  workspaceId?: string;
  advertiserId: string;
  whatsappNumber: string;
  eventSetId: string | null;
  eventSetName: string | null;
  status: MessageEventSetStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  message?: string | null;
  updatedAt: string;
};

export type TikTokEventSetDiagnostics = {
  advertiserId: string;
  connected: boolean;
  tokenExpired: boolean;
  requiresReconnect: boolean;
  reconnectReason: string | null;
  oauthScope: string | null;
  connectedAt: string | null;
  permissions: string[];
  availableApis: {
    message: { available: boolean; reason?: string; count?: number };
    crm: { available: boolean; reason?: string; count?: number };
    ctx: { available: boolean; reason?: string; count?: number };
  };
  messageEventSets: Array<Record<string, unknown>>;
  crmEventSets: Array<Record<string, unknown>>;
  ctxEventSets: Array<Record<string, unknown>>;
  localEventSets: TikTokEventSet[];
  lastErrors: Array<{
    endpoint: string;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: string;
  }>;
};

async function businessApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(`${API_URL}/api/tiktok-business${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function fetchTikTokBusinessStatus() {
  return businessApi<TikTokBusinessStatus>('/status');
}

export function fetchTikTokBusinessAdvertisers() {
  return businessApi<{
    connected: boolean;
    businessCenter: TikTokBusinessStatus['businessCenter'];
    advertisers: TikTokBusinessStatus['advertisers'];
    lastSyncAt: string | null;
  }>('/advertisers');
}

export function fetchTikTokBusinessCampaigns() {
  return businessApi<{ campaigns: TikTokBusinessCampaign[] }>('/campaigns');
}

export function fetchTikTokBusinessAdGroups() {
  return businessApi<{ adgroups: TikTokBusinessAdGroup[] }>('/adgroups');
}

export function fetchTikTokBusinessAds() {
  return businessApi<{ ads: TikTokBusinessAd[] }>('/ads');
}

export function fetchTikTokBusinessAnalytics() {
  return businessApi<TikTokBusinessAnalytics>('/analytics');
}

export function fetchTikTokWhatsAppMappings() {
  return businessApi<TikTokWhatsAppMapping[]>('/mappings');
}

export function saveTikTokWhatsAppMapping(input: {
  id?: string;
  advertiserId?: string | null;
  campaignId?: string | null;
  adGroupId?: string | null;
  adId?: string | null;
  whatsappNumber: string;
  isActive?: boolean;
}) {
  return businessApi<TikTokWhatsAppMapping>('/mappings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

async function tiktokApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(`${API_URL}/api/tiktok${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function fetchTikTokAdvertiserOptions() {
  return tiktokApi<{
    advertisers: Array<{ advertiserId: string; name: string | null; currency: string | null; status: string | null }>;
  }>('/advertisers');
}

export function fetchTikTokWhatsAppNumbers() {
  return tiktokApi<{ numbers: TikTokWhatsAppNumber[] }>('/whatsapp-numbers');
}

export function fetchTikTokEventSets() {
  return tiktokApi<TikTokEventSet[]>('/event-sets');
}

export function createTikTokEventSet(
  advertiserId: string,
  whatsappNumber: string,
  eventSetName?: string,
) {
  return tiktokApi<TikTokEventSet>('/event-sets/create', {
    method: 'POST',
    body: JSON.stringify({ advertiserId, whatsappNumber, eventSetName }),
  });
}

export function syncTikTokEventSet(
  advertiserId: string,
  whatsappNumber: string,
  eventSetName?: string,
) {
  return tiktokApi<TikTokEventSet>('/event-sets/sync', {
    method: 'POST',
    body: JSON.stringify({ advertiserId, whatsappNumber, eventSetName }),
  });
}

export function reconnectTikTokBusinessForEvents() {
  return tiktokApi<{ authUrl: string }>('/event-sets/reconnect', { method: 'POST', body: '{}' });
}

export function fetchTikTokEventSetDiagnostics(advertiserId: string) {
  return tiktokApi<TikTokEventSetDiagnostics>(
    `/event-sets/diagnostics?advertiserId=${encodeURIComponent(advertiserId)}`,
  );
}

export function saveTikTokMessagingMapping(input: {
  id?: string;
  advertiserId: string;
  whatsappNumber: string;
  eventSetName?: string;
  eventSetId?: string;
  isActive?: boolean;
}) {
  return tiktokApi<{ mapping: TikTokWhatsAppMapping; eventSet: TikTokEventSet }>('/whatsapp-mapping/save', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteTikTokMessagingMapping(id: string) {
  return tiktokApi<{ deleted: boolean }>(`/whatsapp-mapping/${id}`, { method: 'DELETE' });
}

export type TikTokAdCreateOptions = {
  pixels: Array<{ pixelId: string; pixelCode: string; name: string; trackingUrl?: string | null }>;
  regions: Array<{ locationId: string; name: string; regionCode: string; level: string }>;
  interests: Array<{ id: string; name: string }>;
  identities: Array<{ identityId: string; identityType: string; displayName: string; imageUrl: string | null; identityAuthorizedBcId?: string }>;
  languages?: Array<{ code: string; name: string }>;
  customAudiences?: Array<{ audienceId: string; name: string; audienceType: string }>;
  instantPages?: Array<{
    pageId: string;
    name: string;
    thumbnail?: string | null;
    previewUrl?: string | null;
    status?: string;
    createTime?: string | null;
    updateTime?: string | null;
    publishTime?: string | null;
  }>;
  tipAppId?: string | null;
  carriers?: Array<{ id: string; name: string }>;
  isps?: Array<{ id: string; name: string }>;
  ageGroups: string[];
  callToActions: string[];
  optimizationEvents: string[];
  networkTypes?: string[];
  spendingPowerOptions?: string[];
  objectives?: string[];
  objectiveSpecs?: Record<string, {
    promotionType: string;
    optimizationGoal: string;
    billingEvent: string;
    needsPixel: boolean;
    needsApp: boolean;
    allowsPixel: boolean;
    allowsInstantPage: boolean;
    allowsSmartPlus: boolean;
  }>;
  advertiser?: {
    advertiserId: string;
    name: string | null;
    currency: string | null;
    timezone: string | null;
    country: string | null;
    taxRate: number;
  } | null;
};

export type TikTokInstantForm = {
  pageId: string;
  name: string;
  thumbnail?: string | null;
  previewUrl?: string | null;
  status?: string;
  createTime?: string | null;
  updateTime?: string | null;
  publishTime?: string | null;
};

export type TikTokAudienceEstimate = {
  lower: number;
  upper: number;
  suggestion: string;
};

export type TikTokAdGroupStat = {
  adGroupId: string;
  name: string;
  status: string;
  deliveryStatus?: string;
  budget: number;
};

export type TikTokCampaignStat = {
  campaignId: string;
  name: string;
  status: string;
  deliveryStatus?: string;
  objective: string;
  budget: number;
  adGroupId: string;
  adGroups?: TikTokAdGroupStat[];
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  costPerConversion: number;
  conversionRate: number;
  videos?: Array<{
    adId: string;
    adGroupId?: string;
    itemId: string;
    identityId: string;
    identityType: string;
    text: string;
    posterUrl: string;
    videoUrl: string;
    status?: string;
    spend?: number;
    impressions?: number;
    reach?: number;
    clicks?: number;
    conversions?: number;
    costPerConversion?: number;
    conversionRate?: number;
  }>;
};

export function fetchTikTokCreativePreview(input: {
  advertiserId: string;
  adId?: string;
  itemId?: string;
  identityId?: string;
  identityType?: string;
}) {
  const query = new URLSearchParams({ advertiserId: input.advertiserId });
  if (input.adId) query.set('adId', input.adId);
  if (input.itemId) query.set('itemId', input.itemId);
  if (input.identityId) query.set('identityId', input.identityId);
  if (input.identityType) query.set('identityType', input.identityType);
  return businessApi<{ posterUrl: string; videoUrl: string; previewLink: string; text: string }>(
    `/ads/creative-preview?${query.toString()}`,
  );
}

export type TikTokSparkVideo = {
  itemId: string;
  text: string;
  posterUrl: string;
  videoUrl?: string;
  previewLink?: string;
  identityId: string;
  identityType: string;
  identityAuthorizedBcId?: string;
  authCode?: string;
  displayName?: string;
  adId?: string;
};

export type TikTokCampaignDraft = {
  campaignId: string;
  adGroupId: string;
  name: string;
  objective: string;
  budget: number;
  budgetMode: string;
  bidStrategy?: 'HIGHEST' | 'TARGET';
  targetCost?: number;
  locationIds: string[];
  gender: string;
  ageGroups: string[];
  interestCategoryIds: string[];
  pixelId: string;
  optimizationEvent: string;
  scheduleMode: 'CONTINUOUS' | 'RANGE';
  scheduleStartDate: string;
  scheduleEndDate: string;
  dayparting?: string;
  devices?: 'ALL' | 'ANDROID' | 'IOS';
  callToAction: string;
  landingPageUrl: string;
  destination: 'PIXEL' | 'WHATSAPP';
  whatsappNumber: string;
  appId?: string;
  creatives: TikTokSparkVideo[];
};

export function fetchTikTokCampaignDraft(advertiserId: string, campaignId: string) {
  const query = new URLSearchParams({ advertiserId, campaignId });
  return businessApi<TikTokCampaignDraft>(`/ads/campaign?${query.toString()}`);
}

export function fetchTikTokAdCreateOptions(advertiserId: string) {
  return businessApi<TikTokAdCreateOptions>(
    `/ads/create-options?advertiserId=${encodeURIComponent(advertiserId)}`,
  );
}

export function fetchTikTokTargetingExtras(advertiserId: string, locationIds: string[]) {
  const query = new URLSearchParams({
    advertiserId,
    locationIds: locationIds.join(','),
  });
  return businessApi<{ carriers: Array<{ id: string; name: string }>; isps: Array<{ id: string; name: string }> }>(
    `/ads/targeting-extras?${query.toString()}`,
  );
}

export function estimateTikTokAudience(input: {
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
  return businessApi<TikTokAudienceEstimate>('/ads/audience-estimate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchTikTokIdentityVideos(
  advertiserId: string,
  identityId: string,
  identityType: string,
  cursor?: string,
) {
  const query = new URLSearchParams({ advertiserId, identityId, identityType });
  if (cursor) query.set('cursor', cursor);
  return businessApi<{ videos: TikTokSparkVideo[]; nextCursor: string; hasMore: boolean }>(
    `/ads/videos?${query.toString()}`,
  );
}

export function fetchTikTokCampaignPerformance(
  advertiserId: string,
  startDate: string,
  endDate: string,
  opts?: { light?: boolean },
) {
  const query = new URLSearchParams({ advertiserId, startDate, endDate });
  if (opts?.light !== false) query.set('light', '1');
  return businessApi<{ currency: string | null; timezone: string | null; campaigns: TikTokCampaignStat[] }>(
    `/ads/performance?${query.toString()}`,
  );
}

export function renameTikTokCampaign(input: { advertiserId: string; campaignId: string; name: string }) {
  return businessApi<{ campaignId: string; name: string }>('/ads/rename', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteTikTokCampaigns(input: { advertiserId: string; campaignIds: string[] }) {
  return businessApi<{ deleted: string[] }>('/ads/delete', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function setTikTokAdGroupStatus(input: { advertiserId: string; adGroupId: string; enabled: boolean }) {
  return businessApi<{ adGroupId: string; status: string }>('/ads/adgroup/status', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function setTikTokCampaignStatus(input: { advertiserId: string; campaignId: string; enabled: boolean }) {
  return businessApi<{ campaignId: string; status: 'ENABLE' | 'DISABLE' }>('/ads/status', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type TikTokCampaignVideo = NonNullable<TikTokCampaignStat['videos']>[number];

export function setTikTokCampaignVideoStatus(input: { advertiserId: string; adId: string; enabled: boolean }) {
  return businessApi<{ adId: string; status: 'ENABLE' | 'DISABLE' }>('/ads/creative/status', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteTikTokCampaignVideo(input: { advertiserId: string; adId: string }) {
  return businessApi<{ adId: string }>('/ads/creative/delete', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function duplicateTikTokCampaignVideo(input: { advertiserId: string; adId: string }) {
  return businessApi<TikTokCampaignVideo>('/ads/creative/duplicate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function replaceTikTokCampaignVideo(input: {
  advertiserId: string;
  adId: string;
  itemId?: string;
  identityId?: string;
  identityType?: string;
  authCode?: string;
}) {
  return businessApi<TikTokCampaignVideo>('/ads/creative/replace', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function reviewTikTokCampaign(input: {
  advertiserId: string;
  campaignId: string;
  startDate?: string;
  endDate?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  return businessApi<{ reply: string }>('/ads/review', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTikTokAdBudget(input: { advertiserId: string; adGroupId: string; budget: number }) {
  return businessApi<{ adGroupId: string; budget: number }>('/ads/budget', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchTikTokTopupQuote(advertiserId: string) {
  return businessApi<{
    advertiserId: string;
    name: string | null;
    currency: string | null;
    timezone: string | null;
    country: string | null;
    taxRate: number;
    balance: number;
    minAmount: number;
    usdToIqd: number;
  }>(`/ads/topup-quote?advertiserId=${encodeURIComponent(advertiserId)}`);
}

export function startTikTokTopup(input: { advertiserId: string; amount: number }) {
  return businessApi<{
    paymentId: string;
    amount: number;
    tax: number;
    total: number;
    currency: string;
    balance: number;
    applied: boolean;
  }>(
    '/ads/topup',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function fetchTikTokTopupInvoices() {
  return businessApi<{
    invoices: Array<{
      id: string;
      status: string;
      paidAt: string | null;
      createdAt: string;
      advertiserId: string;
      advertiserName: string;
      amount: number;
      tax: number;
      total: number;
      currency: string;
      transferStatus: string;
    }>;
  }>('/ads/topup-invoices');
}

export function previewTikTokSparkCode(advertiserId: string, authCode: string) {
  return businessApi<TikTokSparkVideo & { authCode: string; displayName: string }>('/ads/spark-preview', {
    method: 'POST',
    body: JSON.stringify({ advertiserId, authCode }),
  });
}

export type TikTokDisplayCard = {
  cardId: string;
  cardType: string;
  imageId: string;
  previewUrl: string;
  title: string;
  createdAt: string;
  modifiedAt: string;
};

export function fetchTikTokDisplayCards(advertiserId: string, page = 1) {
  const query = new URLSearchParams({ advertiserId, page: String(page) });
  return businessApi<{ cards: TikTokDisplayCard[]; page: number; pageSize: number; total: number }>(
    `/ads/display-cards?${query.toString()}`,
  );
}

export function fetchTikTokInstantForms(advertiserId: string, page = 1) {
  const query = new URLSearchParams({ advertiserId, page: String(page) });
  return businessApi<{ forms: TikTokInstantForm[]; page: number }>(
    `/ads/instant-forms?${query.toString()}`,
  );
}

export function fetchTikTokTipSdkToken(advertiserId: string) {
  return businessApi<{ tipSdkAccessToken: string; appId: string }>('/ads/instant-forms/tip-token', {
    method: 'POST',
    body: JSON.stringify({ advertiserId }),
  });
}

export function renameTikTokInstantForm(advertiserId: string, pageId: string, title: string) {
  return businessApi<{ pageId: string; name: string }>('/ads/instant-forms/rename', {
    method: 'POST',
    body: JSON.stringify({ advertiserId, pageId, title }),
  });
}

export async function createTikTokDisplayCard(input: {
  advertiserId: string;
  file: File;
  pixelId?: string;
  landingPageUrl?: string;
  title?: string;
}) {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const form = new FormData();
  form.append('advertiserId', input.advertiserId);
  form.append('file', input.file);
  if (input.pixelId) form.append('pixelId', input.pixelId);
  if (input.landingPageUrl) form.append('landingPageUrl', input.landingPageUrl);
  if (input.title) form.append('title', input.title);
  const response = await fetch(`${API_URL}/api/tiktok-business/ads/display-cards`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
    const msg = Array.isArray(body.message)
      ? body.message.join(' · ')
      : body.message || `Request failed (${response.status})`;
    throw new Error(msg);
  }
  return response.json() as Promise<{
    cardId: string;
    imageId: string;
    previewUrl: string;
    landingPageUrl: string;
    title: string;
  }>;
}

export function publishTikTokAd(input: Record<string, unknown>) {
  return businessApi<{ campaignId: string; adGroupId: string; adIds: string[]; landingPageUrl: string; campaignName?: string }>(
    '/ads/publish',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function publishTikTokAdBundle(groups: Record<string, unknown>[]) {
  return businessApi<{
    campaignId: string;
    adGroupId: string;
    adIds: string[];
    adGroupIds?: string[];
    landingPageUrl: string;
    campaignName?: string;
    tikTokAdsManagerLabel?: string;
    objective?: string;
    smartPlus?: boolean;
    salesDestination?: string;
  }>('/ads/publish-bundle', {
    method: 'POST',
    body: JSON.stringify({ groups }),
  });
}

export function syncTikTokBusiness(advertiserId?: string | null) {
  const body = advertiserId ? { advertiserId } : {};
  return businessApi<TikTokBusinessStatus & { syncedCampaigns: number; syncedAdGroups: number; syncedAds: number }>(
    '/sync',
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function disconnectTikTokBusiness() {
  return businessApi<{ disconnected: boolean }>('/disconnect', { method: 'DELETE', body: '{}' });
}

export async function startTikTokBusinessOAuth(options?: { returnTo?: string }) {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(`${API_URL}/api/auth/tiktok-business/login`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      returnOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
      returnTo: options?.returnTo,
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? 'Failed to start TikTok authorization');
  }
  const { authUrl } = (await response.json()) as { authUrl: string };
  return authUrl;
}

export function fetchTikTokBusinessStatusLegacy() {
  return api<TikTokBusinessStatus>('/integrations/tiktok-business');
}

export const tiktokBusinessNavItems = [
  { href: '/tiktok/business', labelKey: 'tiktokBusiness.nav.dashboard' },
  { href: '/tiktok/integration/wizard', labelKey: 'tiktokBusiness.nav.pixelWizard' },
  { href: '/tiktok/integration', labelKey: 'tiktokBusiness.nav.pixelDashboard' },
  { href: '/tiktok/business/advertisers', labelKey: 'tiktokBusiness.nav.advertisers' },
  { href: '/tiktok/business/campaigns', labelKey: 'tiktokBusiness.nav.campaigns' },
  { href: '/tiktok/business/adgroups', labelKey: 'tiktokBusiness.nav.adgroups' },
  { href: '/tiktok/business/ads', labelKey: 'tiktokBusiness.nav.ads' },
  { href: '/tiktok/business/whatsapp-mapping', labelKey: 'tiktokBusiness.nav.whatsappMapping' },
  { href: '/tiktok/business/analytics', labelKey: 'tiktokBusiness.nav.analytics' },
  { href: '/tiktok/business/settings', labelKey: 'tiktokBusiness.nav.settings' },
  { href: '/tiktok/business/settings/event-set-diagnostics', labelKey: 'tiktokBusiness.nav.eventSetDiagnostics' },
] as const;
