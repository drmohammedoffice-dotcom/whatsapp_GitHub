import { API_URL } from './utils';

const KEY = 'chatlooraPartnerToken';

export function getPartnerToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(KEY);
}

export function setPartnerToken(token: string) {
  window.localStorage.setItem(KEY, token);
}

export function clearPartnerToken() {
  window.localStorage.removeItem(KEY);
}

async function partnerApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getPartnerToken();
  const response = await fetch(`${API_URL}/api/v1/sales-partners${path}`, {
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

export function applyAsPartner(body: { name: string; email: string; phone: string; country: string; reason: string }) {
  return partnerApi<{ id: string }>('/apply', { method: 'POST', body: JSON.stringify(body) });
}

export function partnerLogin(email: string, password: string) {
  return partnerApi<{ accessToken: string }>('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export type PartnerDashboard = {
  partner: {
    id: string;
    name: string;
    email: string;
    referralCode: string | null;
    referralLink: string | null;
  };
  stats: {
    customers: number;
    activeSubscriptions: number;
    expiredSubscriptions: number;
    salesCents: number;
    pendingCents: number;
    readyCents: number;
    paidCents: number;
    availablePayoutCents: number;
    daily: { customers: number; salesCents: number; commissionsCents: number };
    monthly: { customers: number; salesCents: number; commissionsCents: number };
  };
  commissions: Array<{
    id: string;
    kind: string;
    status: string;
    amountCents: number;
    saleCents: number;
    currency: string;
    createdAt: string;
  }>;
  referrals: Array<{
    id: string;
    teamName: string;
    email?: string | null;
    source: string;
    createdAt: string;
    subscriptionStatus: string | null;
    planName?: string | null;
    daysLeft?: number | null;
  }>;
  payouts: Array<{
    id: string;
    amountCents: number;
    feeCents?: number;
    netCents?: number;
    method?: string | null;
    accountName?: string | null;
    accountNumber: string;
    hasAccountImage: boolean;
    hasReceiptImage: boolean;
    status: string;
    adminNote?: string | null;
    createdAt: string;
    paidAt: string | null;
  }>;
};

export function fetchPartnerMe() {
  return partnerApi<PartnerDashboard>('/me');
}

export function changePartnerPassword(currentPassword: string, newPassword: string) {
  return partnerApi('/me/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

async function partnerUpload<T>(path: string, form: FormData): Promise<T> {
  const token = getPartnerToken();
  const response = await fetch(`${API_URL}/api/v1/sales-partners${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = (body as { message?: string | string[] }).message;
    throw new Error(Array.isArray(message) ? message.join(', ') : message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function createPartnerPayout(input: {
  amountCents: number;
  accountNumber: string;
  withdrawAll?: boolean;
  file?: File;
  method?: 'ZAIN_CASH' | 'MASTERCARD' | 'SUPERQI';
  accountName?: string;
}) {
  const form = new FormData();
  form.append('amountCents', String(input.amountCents));
  form.append('accountNumber', input.accountNumber);
  form.append('withdrawAll', input.withdrawAll ? 'true' : 'false');
  if (input.method) form.append('method', input.method);
  if (input.accountName) form.append('accountName', input.accountName);
  if (input.file) form.append('file', input.file);
  return partnerUpload<{ id: string; emailed: boolean; netCents?: number; feeCents?: number }>('/me/payouts', form);
}

export function confirmPartnerPayout(id: string, code: string) {
  return partnerApi(`/me/payouts/${id}/confirm`, { method: 'POST', body: JSON.stringify({ code }) });
}

export function resendPartnerPayoutCode(id: string) {
  return partnerApi(`/me/payouts/${id}/resend`, { method: 'POST', body: '{}' });
}

export function cancelPartnerPayoutDraft(id: string) {
  return partnerApi<{ cancelled: boolean }>(`/me/payouts/${id}/cancel`, { method: 'POST', body: '{}' });
}

export async function fetchPartnerPayoutImageUrl(id: string, kind: 'account' | 'receipt') {
  const token = getPartnerToken();
  const response = await fetch(`${API_URL}/api/v1/sales-partners/me/payouts/${id}/file/${kind}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Image not found');
  return URL.createObjectURL(await response.blob());
}

export function formatIqd(cents: number) {
  return `${cents.toLocaleString('en-US')} IQD`;
}
