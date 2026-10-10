import { API_URL, authedFetch } from '@/lib/utils';

export type TikTokOptimizationEvent =
  | 'PageView'
  | 'ViewContent'
  | 'Lead'
  | 'CompleteRegistration'
  | 'Contact'
  | 'SubmitForm'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'CompletePayment'
  | 'Custom';

export type TikTokTrackingPhone = {
  channelId: string;
  sessionId: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  status: string;
  connectedAt: string | null;
  integrationId: string | null;
  pixelName?: string | null;
  pixelCode?: string | null;
};

export type TikTokTrackingPhoneStatus = {
  sessionId: string;
  status: string;
  displayName?: string | null;
  phoneNumber?: string | null;
  connectedAt?: string | null;
  failureReason?: string | null;
  isLive?: boolean;
};

export type TikTokTrackingPhoneQr = {
  sessionId: string;
  qrCode: string;
  status: string;
};

export type TikTokIntegrationView = {
  id: string;
  name: string | null;
  advertiserId: string | null;
  advertiserName: string | null;
  pixelId: string | null;
  pixelName: string | null;
  pixelStatus: string;
  pixelStatusMessage: string | null;
  manualSetupRequired: boolean;
  whatsappNumber: string | null;
  destinationType: 'WHATSAPP_NUMBER' | 'EXTERNAL_URL' | 'INSTANT_FORM' | 'STORE';
  externalRedirectUrl: string | null;
  whatsappConnected?: boolean;
  linkedFormId?: string | null;
  linkedFormName?: string | null;
  linkedFormUrl?: string | null;
  linkedFormStatus?: string | null;
  redirectSlug: string;
  trackingUrl: string;
  eventBuilderUrl?: string | null;
  setupPageUrl: string | null;
  tiktokEventsManagerUrl: string | null;
  pixelCode: string | null;
  eventsApiConnected?: boolean;
  eventsApiStatus?: string;
  eventsApiStatusMessage?: string | null;
  eventsApiTokenHint?: string | null;
  hasEventsApiToken?: boolean;
  lastEventsApiVerificationAt?: string | null;
  lastEventSentAt?: string | null;
  lastEventName?: string | null;
  lastApiHttpStatus?: number | null;
  lastApiError?: string | null;
  createdAt?: string | null;
  defaultOptimizationEvent: TikTokOptimizationEvent;
  customEventName: string | null;
  redirectMessage: string | null;
  wizardStep: number;
  wizardCompleted: boolean;
  updatedAt: string;
  eventConfigurations: Array<{ eventName: TikTokOptimizationEvent; enabled: boolean }>;
};

export type TikTokIntegrationStats = {
  since: string;
  days: number;
  clicks: number;
  leads: number;
  conversions?: number;
  conversionRate: number;
  contactEvents?: number;
  leadEvents?: number;
  purchaseEvents?: number;
  registrationEvents?: number;
  formOrders?: number;
  orderEvents?: number;
  lastEventSent?: string | null;
  lastEventName?: string | null;
  lastApiResponse?: unknown;
  lastError?: string | null;
};

export type TikTokIntegrationWizardState = {
  integration: TikTokIntegrationView;
  marketingConnected: boolean;
  advertisers: Array<{
    advertiserId: string;
    name: string | null;
    currency: string | null;
    status: string | null;
  }>;
  optimizationEvents: Array<{ eventName: TikTokOptimizationEvent; enabled: boolean }>;
};

export type TikTokIntegrationDashboardItem = {
  integration: TikTokIntegrationView;
  stats: TikTokIntegrationStats;
};

export type TikTokIntegrationDashboard = {
  configured: boolean;
  integration?: TikTokIntegrationView | null;
  integrations?: TikTokIntegrationDashboardItem[];
  stats?: TikTokIntegrationStats | null;
  disclaimer: { en: string; ar: string };
};

async function integrationApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authedFetch(`${API_URL}/api/tiktok-integration${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const raw = await response.text();
  let body: unknown = {};
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = { message: raw.slice(0, 300) };
    }
  }
  if (!response.ok) {
    const message =
      (body as { message?: string | string[] }).message ?? `Request failed (${response.status})`;
    throw new Error(Array.isArray(message) ? message.join(' · ') : String(message));
  }
  return (body || {}) as T;
}

export function fetchTikTokIntegrations() {
  return integrationApi<{ integrations: TikTokIntegrationView[] }>('/integrations');
}

export function createTikTokIntegration() {
  return integrationApi<TikTokIntegrationView>('/integrations', { method: 'POST', body: '{}' });
}

export function fetchTikTokIntegrationWizard(integrationId?: string, createNew = false) {
  const params = new URLSearchParams();
  if (integrationId) params.set('integrationId', integrationId);
  if (createNew) params.set('new', '1');
  const qs = params.toString();
  return integrationApi<TikTokIntegrationWizardState>(`/wizard${qs ? `?${qs}` : ''}`);
}

export function startTikTokIntegrationOAuth(integrationId?: string) {
  return integrationApi<{ authUrl: string }>('/oauth/start', {
    method: 'POST',
    body: JSON.stringify({
      integrationId,
      returnOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
    }),
  });
}

export function saveTikTokIntegrationAdvertiser(
  advertiserId: string,
  options?: {
    advertiserName?: string;
    integrationId?: string;
    pixelName?: string;
    useExistingPixelId?: string;
    createNewPixel?: boolean;
  },
) {
  return integrationApi<TikTokIntegrationView>('/wizard/advertiser', {
    method: 'POST',
    body: JSON.stringify({
      advertiserId,
      advertiserName: options?.advertiserName,
      integrationId: options?.integrationId,
      pixelName: options?.pixelName,
      useExistingPixelId: options?.useExistingPixelId,
      createNewPixel: options?.createNewPixel,
    }),
  });
}

export function fetchTikTokAdvertiserPixels(integrationId: string) {
  return integrationApi<{
    pixels: Array<{
      pixelId: string;
      pixelCode: string;
      pixelName?: string;
      activityStatus: unknown;
    }>;
  }>(`/wizard/advertiser-pixels?integrationId=${encodeURIComponent(integrationId)}`);
}

export function refreshTikTokPixelStatus(integrationId: string) {
  return integrationApi<TikTokIntegrationView>(`/integrations/${integrationId}/refresh-pixel-status`, {
    method: 'POST',
    body: '{}',
  });
}

export function resyncTikTokEcommerceEvents(integrationId: string) {
  return integrationApi<TikTokIntegrationView & { resync?: { resent?: number; events?: string[]; kind?: string | null } }>(
    `/integrations/${integrationId}/resync-ecommerce-events`,
    {
      method: 'POST',
      body: '{}',
    },
  );
}

export function updateTikTokIntegration(
  integrationId: string,
  input: {
    name?: string;
    whatsappNumber?: string;
    destinationType?: 'WHATSAPP_NUMBER' | 'EXTERNAL_URL' | 'INSTANT_FORM' | 'STORE';
    externalRedirectUrl?: string;
    instantFormId?: string;
    defaultOptimizationEvent?: TikTokOptimizationEvent;
    customEventName?: string;
    enabledEvents?: TikTokOptimizationEvent[];
    redirectMessage?: string;
  },
) {
  return integrationApi<TikTokIntegrationView>(`/integrations/${integrationId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteTikTokIntegration(integrationId: string) {
  return integrationApi<{ deleted: boolean; id: string }>(`/integrations/${integrationId}`, {
    method: 'DELETE',
  });
}

export function saveTikTokIntegrationWhatsapp(
  input: {
    destinationType: 'WHATSAPP_NUMBER' | 'EXTERNAL_URL' | 'INSTANT_FORM' | 'STORE';
    whatsappNumber?: string;
    externalRedirectUrl?: string;
    instantFormId?: string;
  },
  integrationId?: string,
) {
  return integrationApi<TikTokIntegrationView & {
    linkedFormId?: string;
    linkedFormUrl?: string;
    linkedFormName?: string;
  }>('/wizard/whatsapp', {
    method: 'POST',
    body: JSON.stringify({ ...input, integrationId }),
  });
}

export function createTikTokIntegrationPixel(pixelName?: string, integrationId?: string) {
  return integrationApi<TikTokIntegrationView>('/wizard/pixel', {
    method: 'POST',
    body: JSON.stringify({ pixelName, integrationId }),
  });
}

export function saveTikTokIntegrationOptimizationEvent(input: {
  defaultOptimizationEvent: TikTokOptimizationEvent;
  customEventName?: string;
  enabledEvents?: TikTokOptimizationEvent[];
  redirectMessage?: string;
  integrationId?: string;
}) {
  return integrationApi<TikTokIntegrationView>('/wizard/optimization-event', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchTikTokIntegrationDashboard(days = 30, integrationId?: string) {
  const params = new URLSearchParams({ days: String(days) });
  if (integrationId) params.set('integrationId', integrationId);
  return integrationApi<TikTokIntegrationDashboard>(`/dashboard?${params}`);
}

export const OPTIMIZATION_EVENT_OPTIONS: TikTokOptimizationEvent[] = [
  'PageView',
  'ViewContent',
  'Lead',
  'CompleteRegistration',
  'Contact',
  'SubmitForm',
  'AddToCart',
  'InitiateCheckout',
  'Purchase',
  'CompletePayment',
  'Custom',
];

export const tiktokIntegrationNavItems = [
  { href: '/tiktok/integration', labelKey: 'tiktokIntegration.nav.dashboard' },
  { href: '/tiktok/integration/forms', labelKey: 'tiktokIntegration.nav.forms' },
  { href: '/tiktok/integration/forms/orders', labelKey: 'tiktokIntegration.nav.orders' },
  { href: '/ai/store', labelKey: 'tiktokIntegration.nav.store' },
  { href: '/tiktok/integration/phones', labelKey: 'tiktokIntegration.nav.trackingPhones' },
] as const;

export type TikTokContactDebugRow = {
  id: string;
  integrationId: string;
  integrationName: string;
  whatsappPhone: string | null;
  ttclid: string | null;
  eventId?: string;
  eventName?: string;
  firstMessageAt?: string | null;
  contactSent: boolean;
  tiktokStatus: string | null;
  tiktokResponse: unknown;
  tiktokError?: string | null;
  retryCount?: number;
  nextRetryAt?: string | null;
  sentAt?: string | null;
  createdAt: string;
  pageUrl?: string | null;
  conversationId: string | null;
  messageId?: string | null;
  pixelCode?: string | null;
  pixelId?: string | null;
  isNewConversation?: boolean | null;
  outcome?: string;
  reason?: string | null;
};

export type TikTokContactDiagnosticRow = {
  id: string;
  teamId: string;
  integrationId: string | null;
  integrationName: string | null;
  channelId: string | null;
  conversationId: string | null;
  messageId: string | null;
  whatsappPhone: string | null;
  businessPhone: string | null;
  pixelCode: string | null;
  ttclid: string | null;
  isNewConversation: boolean | null;
  outcome: string;
  reason: string | null;
  tiktokStatus: string | null;
  tiktokResponse: unknown;
  errorMessage: string | null;
  createdAt: string;
  contactSent: boolean;
};

export function fetchTikTokContactDebug(integrationId?: string, limit = 100) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (integrationId) params.set('integrationId', integrationId);
  return integrationApi<{ rows: TikTokContactDebugRow[]; diagnostics: TikTokContactDiagnosticRow[] }>(
    `/debug/contacts?${params}`,
  );
}

export function saveTikTokEventsApiCredentials(
  integrationId: string,
  input: { pixelCode: string; accessToken: string; pixelId?: string; pixelName?: string },
) {
  return integrationApi<{
    ok: true;
    message: string;
    pixelName: string | null;
    pixelId: string | null;
    pixelCode: string | null;
    status: string;
    createdAt: string;
    lastVerificationTime: string | null;
    eventsApiTokenHint: string | null;
  }>(`/integrations/${integrationId}/events-api-credentials`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function testTikTokEventsApiConnection(integrationId: string) {
  return integrationApi<{
    ok: boolean;
    status: string;
    message: string;
    pixelName?: string | null;
    pixelId?: string | null;
    pixelCode?: string | null;
    lastVerificationTime?: string;
    createdAt?: string;
  }>(`/integrations/${integrationId}/test-connection`, {
    method: 'POST',
    body: '{}',
  });
}

export function markTikTokQualifiedLead(conversationId: string) {
  return integrationApi<{ id?: string } | null>('/qualified-lead', {
    method: 'POST',
    body: JSON.stringify({ conversationId }),
  });
}

export function fetchTikTokTrackingPhones() {
  return integrationApi<TikTokTrackingPhone[]>('/tracking-phones');
}

export function connectTikTokTrackingPhone(input?: { displayName?: string; integrationId?: string }) {
  return integrationApi<TikTokTrackingPhoneStatus>('/tracking-phones/connect', {
    method: 'POST',
    body: JSON.stringify(input ?? {}),
  });
}

export function linkTikTokTrackingPhone(channelId: string, integrationId: string) {
  return integrationApi<TikTokTrackingPhone>('/tracking-phones/link', {
    method: 'POST',
    body: JSON.stringify({ channelId, integrationId }),
  });
}

export function fetchTikTokTrackingPhoneQr(sessionId: string) {
  return integrationApi<TikTokTrackingPhoneQr>(`/tracking-phones/qr?sessionId=${encodeURIComponent(sessionId)}`);
}

export function fetchTikTokTrackingPhoneStatus(sessionId: string) {
  return integrationApi<TikTokTrackingPhoneStatus>(
    `/tracking-phones/status?sessionId=${encodeURIComponent(sessionId)}`,
  );
}

export function disconnectTikTokTrackingPhone(sessionId: string) {
  return integrationApi<{ ok: boolean }>('/tracking-phones/disconnect', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export function deleteTikTokTrackingPhone(sessionId: string) {
  return integrationApi<{ ok: boolean }>('/tracking-phones/session', {
    method: 'DELETE',
    body: JSON.stringify({ sessionId }),
  });
}
