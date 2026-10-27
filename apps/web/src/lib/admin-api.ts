import { API_URL, getAccessToken, setAdminImpersonation } from './utils';

const ADMIN_TOKEN_KEY = 'chatlooraAdminToken';
const STAFF_TOKEN_KEY = 'chatlooraStaffToken';

export const EMPLOYEE_ROLES = ['STAFF', 'ACCOUNTANT', 'MAILBOX_CREATOR'] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export function isEmployeeRole(role: string | null | undefined): role is EmployeeRole {
  return !!role && (EMPLOYEE_ROLES as readonly string[]).includes(role);
}

export function staffHasRole(me: { role?: string; roles?: string[] } | null | undefined, required: string | string[]) {
  if (!me) return false;
  const effective = me.roles?.length ? me.roles : me.role ? [me.role] : [];
  const needed = Array.isArray(required) ? required : [required];
  return needed.some((r) => effective.includes(r));
}

export function isEmployeeAccount(me: { role?: string; roles?: string[] } | null | undefined) {
  if (!me) return false;
  if (isEmployeeRole(me.role)) return true;
  return (me.roles ?? []).some((r) => isEmployeeRole(r));
}

/** توكن لوحة الأدمن فقط — منفصل عن توكن الموظفين */
export function getAdminToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string) {
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}

/** توكن بوابة الموظفين — لا يخلط مع جلسة الأدمن */
export function getStaffToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STAFF_TOKEN_KEY);
}

export function setStaffToken(token: string) {
  window.localStorage.setItem(STAFF_TOKEN_KEY, token);
}

export function clearStaffToken() {
  window.localStorage.removeItem(STAFF_TOKEN_KEY);
}

function portalToken() {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname || '';
  if (path.startsWith('/staff')) return getStaffToken() || getAdminToken();
  return getAdminToken() || getStaffToken();
}

async function adminApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = portalToken();
  const response = await fetch(`${API_URL}/api/v1/admin${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export type AdminDashboardStats = {
  totalUsers: number;
  activeSubscriptions: number;
  trialUsers: number;
  monthlyRevenueMrrCents: number;
  newUsersToday: number;
  activeWorkspaces: number;
  connectedWhatsAppNumbers: number;
  connectedTikTokAccounts: number;
  connectedMetaAccounts: number;
  systemHealth: { database: string; api: string; timestamp: string };
};

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  suspendedAt: string | null;
  createdAt: string;
  teamMembers: Array<{
    team: { id: string; name: string; slug: string; subscription?: AdminSubscriptionRow | null };
  }>;
  subscriptionsOwned?: AdminSubscriptionRow[];
};

export type AdminOfferRow = {
  id: string;
  title: string;
  titleAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  badgeText?: string | null;
  badgeTextAr?: string | null;
  ctaLabel?: string | null;
  ctaLabelAr?: string | null;
  ctaUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminPlanEntitlement = {
  key: string;
  category: string;
  valueType: 'BOOLEAN' | 'LIMIT';
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  enabled: boolean;
  limitValue: number | null;
};

export type AdminPlanRow = {
  id: string;
  slug: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  priceCents: number;
  yearlyPriceCents?: number | null;
  currency: string;
  interval: string;
  trialDays?: number;
  sortOrder?: number;
  features?: string[];
  isActive: boolean;
  isRecommended?: boolean;
  accentColor?: string | null;
  entitlements?: AdminPlanEntitlement[];
  limits?: Record<string, unknown>;
};

export type AdminSubscriptionReferral = {
  id: string;
  codeUsed: string | null;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  partnerReferralCode: string | null;
};

export type AdminSubscriptionRow = {
  id: string;
  teamId: string;
  status: string;
  billingCycle?: string;
  mrrCents: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt?: string | null;
  team?: { id: string; name: string; slug: string };
  plan?: AdminPlanRow;
  owner?: { id: string; email: string; name: string } | null;
  referral?: AdminSubscriptionReferral | null;
};

export type AdminMe = {
  id: string;
  role: string;
  roles?: string[];
  residence?: string | null;
  hasAvatar?: boolean;
  isActive: boolean;
  user: { id: string; email: string; name: string };
};

export type AdminStaffRow = {
  id: string;
  role: string;
  roles?: string[];
  residence: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  user: { id: string; email: string; name: string; createdAt: string };
};

export type AdminStaffActivityRow = {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  adminUser?: {
    id: string;
    user?: { email: string; name: string } | null;
  } | null;
};

export function adminLogin(email: string, password: string, portal: 'admin' | 'staff' = 'admin') {
  return fetch(`${API_URL}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, portal }),
  }).then(async (res) => {
    if (!res.ok) {
      if (res.status === 429) {
        throw new Error('تم تجاوز عدد محاولات الدخول. انتظر دقيقة ثم أعد المحاولة.');
      }
      const body = await res.json().catch(() => ({}));
      const message = (body as { message?: string }).message;
      if (message === 'Staff must sign in at /staff/login') {
        throw new Error('حساب الموظف يدخل من رابط الموظفين فقط: /staff/login');
      }
      if (message === 'Use the admin login page for this account') {
        throw new Error('هذا الحساب أدمن — استخدم صفحة دخول الأدمن.');
      }
      throw new Error(
        message === 'Invalid admin credentials'
          ? 'بيانات الدخول غير صحيحة، أو هذا الحساب غير مسموح له هنا.'
          : (message ?? 'Login failed'),
      );
    }
    return res.json() as Promise<{ accessToken: string; admin: AdminMe }>;
  });
}

export function fetchAdminMe() {
  return adminApi<AdminMe>('/auth/me');
}

export async function fetchStaffAvatarObjectUrl() {
  const token = getStaffToken() || getAdminToken();
  const response = await fetch(`${API_URL}/api/v1/admin/auth/me/avatar`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Avatar not found');
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function uploadStaffAvatar(file: File) {
  const token = getStaffToken() || getAdminToken();
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`${API_URL}/api/v1/admin/auth/me/avatar`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? 'تعذر رفع الصورة');
  }
  return response.json() as Promise<{ updated: boolean; hasAvatar: boolean }>;
}

export function fetchAdminStaff() {
  return adminApi<AdminStaffRow[]>('/staff');
}

export type StaffRole = 'STAFF' | 'ACCOUNTANT' | 'MAILBOX_CREATOR';

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  ACCOUNTANT: 'محاسب (تفعيل الاشتراكات)',
  MAILBOX_CREATOR: 'إنشاء الحسابات (البريد)',
  STAFF: 'موظف عام (اشتراكات)',
};

export function createAdminStaff(input: {
  email: string;
  name: string;
  password: string;
  residence?: string;
  role?: StaffRole;
  roles?: StaffRole[];
}) {
  return adminApi<AdminStaffRow>('/staff', { method: 'POST', body: JSON.stringify(input) });
}

export function updateAdminStaff(
  id: string,
  input: {
    name?: string;
    email?: string;
    password?: string;
    residence?: string;
    isActive?: boolean;
    role?: StaffRole;
    roles?: StaffRole[];
  },
) {
  return adminApi<AdminStaffRow>(`/staff/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deactivateAdminStaff(id: string) {
  return adminApi<AdminStaffRow>(`/staff/${id}/deactivate`, { method: 'POST', body: '{}' });
}

export function fetchAdminStaffActivity(params?: { staffId?: string; skip?: number; take?: number }) {
  const sp = new URLSearchParams();
  if (params?.staffId) sp.set('staffId', params.staffId);
  if (params?.skip) sp.set('skip', String(params.skip));
  if (params?.take) sp.set('take', String(params.take));
  const qs = sp.toString();
  return adminApi<AdminStaffActivityRow[]>(`/staff/activity${qs ? `?${qs}` : ''}`);
}

export function fetchAdminDashboard() {
  return adminApi<AdminDashboardStats>('/dashboard');
}

export function fetchAdminUsers(params?: { q?: string; skip?: number; take?: number }) {
  const sp = new URLSearchParams();
  if (params?.q) sp.set('q', params.q);
  if (params?.skip) sp.set('skip', String(params.skip));
  if (params?.take) sp.set('take', String(params.take));
  const qs = sp.toString();
  return adminApi<{ users: AdminUserRow[]; total: number }>(`/users${qs ? `?${qs}` : ''}`);
}

export function fetchAdminUser(id: string) {
  return adminApi<Record<string, unknown>>(`/users/${id}`);
}

export function createAdminUser(input: { email: string; name: string; password: string; teamName?: string }) {
  return adminApi<AdminUserRow>('/users', { method: 'POST', body: JSON.stringify(input) });
}

export function updateAdminUser(id: string, input: { email?: string; name?: string; password?: string }) {
  return adminApi<AdminUserRow>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteAdminUser(id: string) {
  return adminApi<unknown>(`/users/${id}`, { method: 'DELETE' });
}

export function suspendAdminUser(id: string, reason?: string) {
  return adminApi<unknown>(`/users/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) });
}

export function activateAdminUser(id: string) {
  return adminApi<unknown>(`/users/${id}/activate`, { method: 'POST', body: JSON.stringify({}) });
}

export function resetAdminUserPassword(id: string, password: string) {
  return adminApi<unknown>(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) });
}

export function activateAdminSubscription(input: {
  teamId: string;
  planId: string;
  ownerUserId?: string;
  billingCycle?: 'MONTHLY' | 'YEARLY';
  durationDays?: number;
  addRemainingDays?: boolean;
}) {
  return adminApi<AdminSubscriptionRow>('/subscriptions/activate', { method: 'POST', body: JSON.stringify(input) });
}

export function updateAdminSubscriptionPeriod(
  id: string,
  input: {
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    extendDays?: number;
    reduceDays?: number;
    setDaysRemaining?: number;
    trialEndsAt?: string | null;
  },
) {
  return adminApi<AdminSubscriptionRow>(`/subscriptions/${id}/period`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function updateAdminSubscriptionStatus(id: string, status: string) {
  return adminApi<AdminSubscriptionRow>(`/subscriptions/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export function changeAdminSubscriptionPlan(id: string, planId: string) {
  return adminApi<AdminSubscriptionRow>(`/subscriptions/${id}/change-plan`, { method: 'POST', body: JSON.stringify({ planId }) });
}

export function deleteAdminSubscription(id: string) {
  return adminApi<unknown>(`/subscriptions/${id}`, { method: 'DELETE' });
}

export function fetchAdminWorkspaces(params?: { q?: string }) {
  const qs = params?.q ? `?q=${encodeURIComponent(params.q)}` : '';
  return adminApi<{ workspaces: unknown[]; total: number }>(`/workspaces${qs}`);
}

export function fetchAdminPlans() {
  return adminApi<AdminPlanRow[]>('/plans');
}

export function fetchAdminFeatureDefinitions() {
  return adminApi<Array<{
    key: string;
    category: string;
    valueType: 'BOOLEAN' | 'LIMIT';
    nameAr: string;
    nameEn: string;
    descriptionAr: string;
    descriptionEn: string;
  }>>('/feature-definitions');
}

export type AdminPlanPayload = {
  slug: string;
  name?: string;
  nameAr?: string;
  nameEn?: string;
  description?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  priceCents: number;
  yearlyPriceCents?: number;
  currency?: string;
  trialDays?: number;
  sortOrder?: number;
  isActive?: boolean;
  isRecommended?: boolean;
  accentColor?: string;
  features?: string[];
  entitlements?: Array<{
    featureKey: string;
    enabled: boolean;
    limitValue: number | null;
    mode?: 'disabled' | 'limited' | 'unlimited';
  }>;
};

export function createAdminPlan(input: AdminPlanPayload) {
  return adminApi<AdminPlanRow>('/plans', { method: 'POST', body: JSON.stringify(input) });
}

export function updateAdminPlan(id: string, input: Partial<AdminPlanPayload>) {
  return adminApi<AdminPlanRow>(`/plans/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteAdminPlan(id: string) {
  return adminApi<unknown>(`/plans/${id}`, { method: 'DELETE' });
}

export function fetchAdminOffers() {
  return adminApi<AdminOfferRow[]>('/offers');
}

export function createAdminOffer(input: {
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  badgeText?: string;
  badgeTextAr?: string;
  ctaLabel?: string;
  ctaLabelAr?: string;
  ctaUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}) {
  return adminApi<AdminOfferRow>('/offers', { method: 'POST', body: JSON.stringify(input) });
}

export function updateAdminOffer(
  id: string,
  input: Partial<{
    title: string;
    titleAr: string;
    description: string;
    descriptionAr: string;
    badgeText: string;
    badgeTextAr: string;
    ctaLabel: string;
    ctaLabelAr: string;
    ctaUrl: string;
    sortOrder: number;
    isActive: boolean;
    startsAt: string | null;
    endsAt: string | null;
  }>,
) {
  return adminApi<AdminOfferRow>(`/offers/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteAdminOffer(id: string) {
  return adminApi<unknown>(`/offers/${id}`, { method: 'DELETE' });
}

export function fetchAdminSubscriptions(params?: { status?: string }) {
  const qs = params?.status ? `?status=${encodeURIComponent(params.status)}` : '';
  return adminApi<AdminSubscriptionRow[]>(`/subscriptions${qs}`);
}

export function pauseAdminSubscription(id: string) {
  return adminApi<AdminSubscriptionRow>(`/subscriptions/${id}/pause`, { method: 'POST', body: JSON.stringify({}) });
}

export function cancelAdminSubscription(id: string) {
  return adminApi<AdminSubscriptionRow>(`/subscriptions/${id}/cancel`, { method: 'POST', body: JSON.stringify({}) });
}

export function fetchAdminPayments() {
  return adminApi<unknown[]>('/payments');
}

export function fetchAdminTickets() {
  return adminApi<unknown[]>('/support/tickets');
}

export function fetchAdminWhatsApp() {
  return adminApi<unknown[]>('/whatsapp');
}

export function fetchOfficialWhatsApp() {
  return adminApi<Record<string, unknown>>('/whatsapp-system');
}

export function saveOfficialWhatsAppSender(body: Record<string, unknown>) {
  return adminApi('/whatsapp-system/sender', { method: 'PATCH', body: JSON.stringify(body) });
}

export function testOfficialWhatsApp(to?: string) {
  return adminApi('/whatsapp-system/sender/test', { method: 'POST', body: JSON.stringify({ to }) });
}

export function disconnectOfficialWhatsApp() {
  return adminApi('/whatsapp-system/sender/disconnect', { method: 'POST', body: '{}' });
}

export function fetchOfficialWhatsAppOtp() {
  return adminApi<Record<string, unknown>>('/whatsapp-system/otp');
}

export function saveOfficialWhatsAppOtp(body: Record<string, unknown>) {
  return adminApi('/whatsapp-system/otp', { method: 'PATCH', body: JSON.stringify(body) });
}

export function fetchOfficialWhatsAppNotify() {
  return adminApi<Record<string, unknown>>('/whatsapp-system/subscription-notifications');
}

export function saveOfficialWhatsAppNotify(body: Record<string, unknown>) {
  return adminApi('/whatsapp-system/subscription-notifications', { method: 'PATCH', body: JSON.stringify(body) });
}

export function fetchOfficialWhatsAppTemplates() {
  return adminApi<Array<Record<string, unknown>>>('/whatsapp-system/templates');
}

export function saveOfficialWhatsAppTemplate(body: Record<string, unknown>) {
  return adminApi('/whatsapp-system/templates', { method: 'PATCH', body: JSON.stringify(body) });
}

export function fetchOfficialWhatsAppLogs(skip = 0, take = 50) {
  return adminApi<{ items: Array<Record<string, unknown>>; total: number }>(`/whatsapp-system/logs?skip=${skip}&take=${take}`);
}

export function fetchAdminTikTok() {
  return adminApi<Record<string, unknown>>('/tiktok');
}

export function fetchAdminMeta() {
  return adminApi<Record<string, unknown>>('/meta');
}

export function fetchAdminAnalytics() {
  return adminApi<Record<string, unknown>>('/analytics');
}

export function fetchAdminAuditLogs() {
  return adminApi<unknown[]>('/audit-logs');
}

export function fetchAdminSettings() {
  return adminApi<unknown[]>('/settings');
}

export type AdminAiGatewayKeyRow = {
  id: string;
  label: string;
  index: number;
  status:
    | 'healthy'
    | 'busy'
    | 'rate_limited'
    | 'offline'
    | 'slow'
    | 'cooling_down'
    | 'disabled'
    | 'testing'
    | 'unavailable';
  requests: number;
  successes: number;
  errors: number;
  rateLimited: number;
  avgLatencyMs: number;
  successRate?: number;
  failureRate?: number;
  requestsToday?: number;
  requestsLastMinute?: number;
  requestsLastHour?: number;
  lastSuccessAt?: string | null;
  lastUsedAt: string | null;
  lastErrorAt: string | null;
  lastErrorLabel: string | null;
  circuitOpenUntil: string | null;
  cooldownUntil?: string | null;
  cooldownRemainingMs?: number;
  consecutiveFailures: number;
};

export type AdminAiGatewayDashboard = {
  enabled: boolean;
  baseUrl: string;
  strategy?: string;
  keyCount: number;
  preferredKeyId: string | null;
  updatedAt: string;
  keys: AdminAiGatewayKeyRow[];
  totals: {
    requests: number;
    successes: number;
    errors: number;
    failovers: number;
    retriesScheduled: number;
    queuedWaits?: number;
  };
};

export function fetchAdminAiGateway() {
  return adminApi<AdminAiGatewayDashboard>('/ai-gateway');
}

export function probeAdminAiGateway() {
  return adminApi<AdminAiGatewayDashboard>('/ai-gateway/probe', { method: 'POST', body: JSON.stringify({}) });
}

export type AdminAssistantSettings = {
  enabled: boolean;
  model: string;
  systemPrompt: string;
  welcomeAr: string;
  welcomeEn: string;
  dailyLimit: number;
  supportPhone: string;
  supportWhatsApp: string;
};

export type AdminAssistantArticle = {
  id: string;
  slug: string;
  category: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  keywords: string[];
  isActive: boolean;
  sortOrder: number;
};

export function fetchAdminAssistantSettings() {
  return adminApi<AdminAssistantSettings>('/assistant/settings');
}

export function updateAdminAssistantSettings(input: Partial<AdminAssistantSettings>) {
  return adminApi<AdminAssistantSettings>('/assistant/settings', { method: 'PATCH', body: JSON.stringify(input) });
}

export function fetchAdminAssistantArticles() {
  return adminApi<AdminAssistantArticle[]>('/assistant/articles');
}

export function createAdminAssistantArticle(input: Partial<AdminAssistantArticle> & { slug: string; category: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string }) {
  return adminApi<AdminAssistantArticle>('/assistant/articles', { method: 'POST', body: JSON.stringify(input) });
}

export function updateAdminAssistantArticle(id: string, input: Partial<AdminAssistantArticle>) {
  return adminApi<AdminAssistantArticle>(`/assistant/articles/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteAdminAssistantArticle(id: string) {
  return adminApi<unknown>(`/assistant/articles/${id}`, { method: 'DELETE' });
}

export function fetchAdminAssistantStats() {
  return adminApi<{
    conversations: number;
    messages: number;
    unanswered: number;
    downvotes: number;
    topQuestions: Array<{ question: string; count: number }>;
  }>('/assistant/stats');
}

export type AdminVoiceSettings = {
  enabled: boolean;
  provider: string;
  defaultLanguage: string;
  defaultVoice: string;
  humanHandoffEnabled: boolean;
  humanHandoffNumber: string;
  recordingEnabled: boolean;
  inAppRealtimeEnabled: boolean;
  realtimeProvider: string;
  realtimeModel: string;
  maleVoice: string;
  femaleVoice: string;
  defaultInAppVoice: string;
  languages: string;
  maxInAppCallSec: number;
  inAppTranscriptEnabled: boolean;
  inAppRecordingEnabled: boolean;
};

export type AdminVoiceAgent = {
  id: string;
  name: string;
  enabled: boolean;
  language: string;
  voiceName: string;
  greeting: string;
  unclearMessage: string;
  holdMessage: string;
  handoffMessage: string;
  maxDurationSec: number;
  recordingEnabled: boolean;
  transcriptEnabled: boolean;
  summaryEnabled: boolean;
  phoneNumbers?: Array<{ id: string; e164: string; isActive: boolean }>;
};

export type AdminVoiceStats = {
  total: number;
  today: number;
  month: number;
  completed: number;
  failed: number;
  aiHandled: number;
  handedOff: number;
  averageDurationSec: number;
  costCents: number;
  totalCalls?: number;
  totalMinutes?: number;
  inAppTotal?: number;
  inAppToday?: number;
  inAppMonth?: number;
  inAppFailed?: number;
  inAppHandoff?: number;
  inAppAverageDurationSec?: number;
  inAppMinutes?: number;
  inAppCostMillis?: number;
};

export type AdminVoiceCall = {
  id: string;
  callerE164: string;
  calledE164: string;
  status: string;
  handledBy: string;
  durationSec?: number | null;
  summary?: string | null;
  startedAt: string;
  outcome?: string | null;
};

export function fetchAdminVoiceSettings() {
  return adminApi<AdminVoiceSettings>('/voice-ai/settings');
}

export function updateAdminVoiceSettings(input: Partial<AdminVoiceSettings>) {
  return adminApi<AdminVoiceSettings>('/voice-ai/settings', { method: 'PATCH', body: JSON.stringify(input) });
}

export function fetchAdminVoiceAgent() {
  return adminApi<AdminVoiceAgent | null>('/voice-ai/agent');
}

export function updateAdminVoiceAgent(input: Partial<AdminVoiceAgent>) {
  return adminApi<AdminVoiceAgent>('/voice-ai/agent', { method: 'PATCH', body: JSON.stringify(input) });
}

export function fetchAdminVoiceStats() {
  return adminApi<AdminVoiceStats>('/voice-ai/stats');
}

export function fetchAdminVoiceCalls() {
  return adminApi<AdminVoiceCall[]>('/voice-ai/calls');
}

export function fetchAdminInAppVoiceSessions() {
  return adminApi<
    Array<{
      id: string;
      status: string;
      voice: string;
      language: string;
      durationSec: number | null;
      handoffRequested: boolean;
      summary: string | null;
      startedAt: string;
      costMillis: number | null;
    }>
  >('/voice-ai/in-app-sessions');
}

export function addAdminVoiceNumber(e164: string) {
  return adminApi<{ id: string; e164: string }>('/voice-ai/numbers', { method: 'POST', body: JSON.stringify({ e164 }) });
}

export function fetchAdminNotifications() {
  return adminApi<Array<{ id: string; title: string; body?: string; channel: string; sentAt: string | null; user?: { email: string } }>>('/notifications');
}

export type SubscriberNoticeTemplate = {
  kind: string;
  title: string;
  body: string;
  enabled: boolean;
  daysBefore: number;
};

export function fetchNoticeProgram() {
  return adminApi<{ templates: SubscriberNoticeTemplate[] }>('/notifications/program');
}

export function saveNoticeProgram(templates: SubscriberNoticeTemplate[]) {
  return adminApi<{ templates: SubscriberNoticeTemplate[] }>('/notifications/program', {
    method: 'POST',
    body: JSON.stringify({ templates }),
  });
}

export function sendNoticeProgram(input: { kind: string; audience: string; title: string; body: string }) {
  return adminApi<{ sent: number }>('/notifications/program/send', { method: 'POST', body: JSON.stringify(input) });
}

export function askNoticeExpert(brief: string, kind: string) {
  return adminApi<{ title: string; body: string; advice: string }>('/notifications/expert', {
    method: 'POST',
    body: JSON.stringify({ brief, kind }),
  });
}

export function impersonateUser(userId: string) {
  return adminApi<{ accessToken: string; refreshToken: string; teamId: string }>(`/auth/impersonate/${userId}`, {
    method: 'POST',
  }).then((tokens) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('accessToken', tokens.accessToken);
      window.localStorage.setItem('refreshToken', tokens.refreshToken);
      window.localStorage.setItem('teamId', tokens.teamId);
      setAdminImpersonation(true);
    }
    return tokens;
  });
}

export type AdminSalesPartnerRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  referralCode: string | null;
  createdAt: string;
  reviewedAt: string | null;
  _count?: { referrals: number; commissions: number };
  index?: number;
  customers?: number;
  activeSubscriptions?: number;
  expiredSubscriptions?: number;
  profitCents?: number;
  readyCents?: number;
};

export type AdminPayoutRow = {
  id: string;
  amountCents: number;
  feeCents?: number;
  netCents?: number;
  currency: string;
  method?: string | null;
  accountName?: string | null;
  accountNumber: string;
  hasAccountImage: boolean;
  hasReceiptImage: boolean;
  status: string;
  adminNote: string | null;
  paidAt: string | null;
  createdAt: string;
  partner?: { id: string; name: string; email: string; phone: string; referralCode: string | null; city?: string | null; age?: number | null; country?: string };
};

export type AdminPartnerDetail = {
  partner: AdminSalesPartnerRow & { currentPassword?: string | null };
  stats: {
    customers: number;
    activeSubscriptions: number;
    expiredSubscriptions: number;
    salesCents: number;
    pendingCents: number;
    readyCents: number;
    paidCents: number;
    availablePayoutCents: number;
  };
  commissions: Array<{ id: string; kind: string; status: string; amountCents: number; saleCents: number; createdAt: string }>;
  referrals: Array<{
    id: string;
    teamId: string;
    teamName: string;
    email?: string | null;
    source: string;
    codeUsed?: string | null;
    subscriptionStatus: string | null;
    createdAt: string;
  }>;
  payouts: AdminPayoutRow[];
};

export type AdminCommissionRule = {
  id: string;
  planId: string;
  mode: 'PERCENT' | 'FIXED';
  percent: string | number;
  fixedCents: number;
  plan: { id: string; slug: string; name: string };
};

export type AdminCommissionRow = {
  id: string;
  kind: string;
  status: string;
  amountCents: number;
  saleCents: number;
  currency: string;
  createdAt: string;
  partner: { id: string; name: string; email: string; referralCode: string | null };
  referral: { team: { name: string } };
};

export type AdminWallet = {
  pendingCents: number;
  approvedCents: number;
  paidCents: number;
  pendingCount: number;
  approvedCount: number;
  paidCount: number;
};

export function fetchAdminSalesPartners(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return adminApi<AdminSalesPartnerRow[]>(`/sales-partners${q}`);
}

export function fetchAdminPartnerDirectory(search?: string) {
  const q = search?.trim() ? `?q=${encodeURIComponent(search.trim())}` : '';
  return adminApi<AdminSalesPartnerRow[]>(`/sales-partners/directory${q}`);
}

export function fetchAdminPartner(id: string) {
  return adminApi<AdminPartnerDetail>(`/sales-partners/${id}`);
}

export function setAdminPartnerPassword(id: string, password: string) {
  return adminApi(`/sales-partners/${id}/password`, { method: 'POST', body: JSON.stringify({ password }) });
}

export function updateAdminPartnerEmail(id: string, email: string) {
  return adminApi<{ id: string; email: string }>(`/sales-partners/${id}/email`, {
    method: 'PATCH',
    body: JSON.stringify({ email }),
  });
}

export function deleteAdminPartner(id: string) {
  return adminApi<{ deleted: boolean }>(`/sales-partners/${id}`, { method: 'DELETE' });
}

export function fetchAdminPayout(id: string) {
  return adminApi<AdminPayoutRow>(`/sales-partners/payouts/${id}`);
}

export function fetchAdminPayouts() {
  return adminApi<AdminPayoutRow[]>('/sales-partners/payouts');
}

export function setAdminPayoutStatus(id: string, status: string, note?: string) {
  return adminApi(`/sales-partners/payouts/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, note }),
  });
}

async function adminUpload<T>(path: string, form: FormData): Promise<T> {
  const token = getAdminToken();
  const response = await fetch(`${API_URL}/api/v1/admin${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function payAdminPayout(id: string, file?: File, note?: string) {
  const form = new FormData();
  if (file) form.append('file', file);
  if (note) form.append('note', note);
  return adminUpload(`/sales-partners/payouts/${id}/pay`, form);
}

export async function fetchAdminPayoutImageUrl(id: string, kind: 'account' | 'receipt') {
  const token = getAdminToken();
  const response = await fetch(`${API_URL}/api/v1/admin/sales-partners/payouts/${id}/file/${kind}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Image not found');
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export function approveAdminPartner(id: string) {
  return adminApi<{ partner: AdminSalesPartnerRow; temporaryPassword: string | null; referralLink: string }>(
    `/sales-partners/${id}/approve`,
    { method: 'POST', body: '{}' },
  );
}

export type EligibleStaffForPartner = {
  id: string;
  userId: string;
  role: string;
  roles: string[];
  residence: string | null;
  email: string;
  name: string;
  phone: string | null;
};

export function fetchEligibleStaffForPartner() {
  return adminApi<EligibleStaffForPartner[]>('/sales-partners/eligible-staff');
}

export function createAdminPartnerFromStaff(staffId: string) {
  return adminApi<{
    partner: AdminSalesPartnerRow;
    temporaryPassword: string | null;
    referralLink: string;
    alreadyPartner?: boolean;
  }>('/sales-partners/from-staff', {
    method: 'POST',
    body: JSON.stringify({ staffId }),
  });
}

export function createAdminPartnerManual(input: {
  name: string;
  email: string;
  phone?: string;
  country?: string;
  password?: string;
}) {
  return adminApi<{
    partner: AdminSalesPartnerRow;
    temporaryPassword: string;
    referralLink: string;
  }>('/sales-partners/manual', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function rejectAdminPartner(id: string, notes?: string) {
  return adminApi<AdminSalesPartnerRow>(`/sales-partners/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export function resetAdminPartnerPassword(id: string) {
  return adminApi<{ temporaryPassword: string }>(`/sales-partners/${id}/reset-password`, {
    method: 'POST',
    body: '{}',
  });
}

export function fetchAdminPartnerRules() {
  return adminApi<AdminCommissionRule[]>('/sales-partners/rules');
}

export function saveAdminPartnerRule(body: { planId: string; mode: 'PERCENT' | 'FIXED'; percent?: number; fixedCents?: number }) {
  return adminApi<AdminCommissionRule>('/sales-partners/rules', { method: 'PATCH', body: JSON.stringify(body) });
}

export function fetchAdminPartnerWallet() {
  return adminApi<AdminWallet>('/sales-partners/wallet');
}

export function fetchAdminPartnerCommissions(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return adminApi<AdminCommissionRow[]>(`/sales-partners/commissions${q}`);
}

export function setAdminCommissionStatus(id: string, status: string) {
  return adminApi(`/sales-partners/commissions/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export function assignAdminTeamReferral(teamId: string, referralCode: string | null) {
  return adminApi<{
    cleared: boolean;
    referral: {
      id: string;
      teamId: string;
      codeUsed: string | null;
      partnerId: string;
      partnerName: string;
      partnerEmail: string;
      partnerReferralCode: string | null;
    } | null;
  }>(`/sales-partners/referrals/by-team/${teamId}`, {
    method: 'PATCH',
    body: JSON.stringify({ referralCode }),
  });
}

export function updateAdminPartnerReferralCode(id: string, referralCode: string) {
  return adminApi<{ id: string; referralCode: string; referralLink: string }>(
    `/sales-partners/${id}/referral-code`,
    { method: 'PATCH', body: JSON.stringify({ referralCode }) },
  );
}

export type AdminMailbox = {
  id: string;
  localPart: string;
  email: string;
  displayName: string | null;
  isActive: boolean;
  notes: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  webmailUrl: string;
  setupHint: string;
};

export type AdminMailboxCredentials = {
  email: string;
  password: string;
  webmailUrl: string;
};

export function fetchAdminMailboxes(q?: string) {
  const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  return adminApi<AdminMailbox[]>(`/mailboxes${qs}`);
}

export function createAdminMailbox(body: {
  localPart?: string;
  password?: string;
  displayName?: string;
  notes?: string;
  autoGenerate?: boolean;
}) {
  return adminApi<{ mailbox: AdminMailbox; credentials: AdminMailboxCredentials }>('/mailboxes', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type AdminMailboxProvisionResult = {
  mailbox: AdminMailbox;
  credentials: AdminMailboxCredentials & { platformLoginUrl?: string };
  subscriber?: {
    userId: string;
    teamId: string | null;
    email: string;
    name: string;
    emailVerified: boolean;
    trialDays: number;
    trialEndsAt: string | null;
    planSlug: string | null;
    fullAccess: boolean;
  };
};

export function createAdminMailboxAuto(body?: { displayName?: string; notes?: string }) {
  return adminApi<AdminMailboxProvisionResult>('/mailboxes/auto', {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function updateAdminMailbox(
  id: string,
  body: {
    displayName?: string | null;
    notes?: string | null;
    isActive?: boolean;
    password?: string;
    rotatePassword?: boolean;
  },
) {
  return adminApi<{ mailbox: AdminMailbox; credentials?: AdminMailboxCredentials }>(`/mailboxes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function revealAdminMailboxPassword(id: string) {
  return adminApi<AdminMailboxCredentials>(`/mailboxes/${id}/password`);
}

export function deleteAdminMailbox(id: string) {
  return adminApi<{ ok: boolean; email: string }>(`/mailboxes/${id}`, { method: 'DELETE' });
}

export function openAdminMailboxSession(id: string) {
  return adminApi<{
    accessToken: string;
    mailbox: { id: string; email: string; displayName: string | null };
  }>(`/mailboxes/${id}/session`, { method: 'POST', body: '{}' });
}

export type AdminLandingPayload = {
  contentEn: Record<string, unknown> | null;
  contentAr: Record<string, unknown> | null;
  visibility: Record<string, boolean>;
  updatedAt: string | null;
};

export function fetchAdminLanding() {
  return adminApi<AdminLandingPayload>('/landing');
}

export function saveAdminLanding(input: {
  contentEn?: Record<string, unknown>;
  contentAr?: Record<string, unknown>;
  visibility?: Record<string, boolean>;
}) {
  return adminApi<AdminLandingPayload>('/landing', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function resetAdminLanding() {
  return adminApi<AdminLandingPayload>('/landing/reset', { method: 'POST', body: '{}' });
}

export const ADMIN_NAV = [
  { href: '/admin', labelKey: 'admin.nav.dashboard' },
  { href: '/admin/users', labelKey: 'admin.nav.subscribers' },
  { href: '/admin/subscriptions', labelKey: 'admin.nav.subscriptions' },
  { href: '/admin/staff', labelKey: 'admin.nav.staff', superAdminOnly: true },
  { href: '/admin/landing', labelKey: 'admin.nav.landing' },
  { href: '/admin/offers', labelKey: 'admin.nav.offers' },
  { href: '/admin/partners', labelKey: 'admin.nav.partners' },
  { href: '/admin/workspaces', labelKey: 'admin.nav.workspaces' },
  { href: '/admin/payments', labelKey: 'admin.nav.payments' },
  { href: '/admin/support', labelKey: 'admin.nav.support' },
  { href: '/admin/mail', labelKey: 'admin.nav.mail' },
  { href: '/admin/whatsapp', labelKey: 'admin.nav.whatsapp' },
  { href: '/admin/whatsapp-system', labelKey: 'admin.nav.whatsappSystem' },
  { href: '/admin/tiktok', labelKey: 'admin.nav.tiktok' },
  { href: '/admin/meta', labelKey: 'admin.nav.meta' },
  { href: '/admin/ai-gateway', labelKey: 'admin.nav.aiGateway' },
  { href: '/admin/assistant', labelKey: 'admin.nav.assistant' },
  { href: '/admin/voice-ai', labelKey: 'admin.nav.voiceAi' },
  { href: '/admin/creative', labelKey: 'admin.nav.creative' },
  { href: '/admin/analytics', labelKey: 'admin.nav.analytics' },
  { href: '/admin/notifications', labelKey: 'admin.nav.notifications' },
  { href: '/admin/settings', labelKey: 'admin.nav.settings' },
  { href: '/admin/audit', labelKey: 'admin.nav.audit' },
] as const;

export const STAFF_NAV = [
  { href: '/staff', labelKey: 'staff.nav.subscribers', roles: ['STAFF', 'ACCOUNTANT'] as const },
  { href: '/staff/mail', labelKey: 'staff.nav.mail', roles: ['MAILBOX_CREATOR'] as const },
  {
    href: '/staff/partner-earnings',
    labelKey: 'staff.nav.partnerEarnings',
    roles: ['STAFF', 'ACCOUNTANT', 'MAILBOX_CREATOR'] as const,
  },
] as const;
