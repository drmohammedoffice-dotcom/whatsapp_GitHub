import { api, authedFetch, API_URL, getAccessToken } from '@/lib/utils';

export type SuccessReferral = {
  id: string;
  teamName: string;
  email: string | null;
  subscriptionStatus: string;
  planName: string | null;
  daysLeft: number | null;
  createdAt: string;
};

export type SuccessPayout = {
  id: string;
  amountCents: number;
  feeCents: number;
  netCents: number;
  method: string | null;
  accountName: string | null;
  accountNumber: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  hasReceiptImage: boolean;
};

export type SuccessDashboard = {
  stage: 'dashboard';
  partner: {
    id: string;
    name: string;
    email: string;
    phone: string;
    city: string | null;
    age: number | null;
    hasAvatar: boolean;
    referralCode: string | null;
    referralLink: string | null;
  };
  stats: {
    customers: number;
    activeSubscriptions: number;
    expiredSubscriptions: number;
    availablePayoutCents: number;
    pendingCents: number;
    paidCents: number;
    readyCents: number;
  };
  referrals: SuccessReferral[];
  payouts: SuccessPayout[];
};

export type SuccessState =
  | { stage: 'landing'; suggested?: { name: string; email: string; phone: string } }
  | { stage: 'verify'; email: string }
  | SuccessDashboard;

export function fetchSuccessPartner() {
  return api<SuccessState>('/success-partner');
}

export function startSuccessPartner(body: {
  name: string;
  age: number;
  city: string;
  phone: string;
  email: string;
  password: string;
  passwordConfirm: string;
}) {
  return api<{ stage: 'verify'; email: string }>('/success-partner/start', { method: 'POST', body: JSON.stringify(body) });
}

export function sendSuccessTicket(body: { email: string; subject: string; message: string }) {
  return api<{ id: string; sent: boolean }>('/success-partner/ticket', { method: 'POST', body: JSON.stringify(body) });
}

export function confirmSuccessPartner(code: string) {
  return api<SuccessState>('/success-partner/confirm', { method: 'POST', body: JSON.stringify({ code }) });
}

export function resendSuccessCode() {
  return api<{ emailed: boolean; email: string }>('/success-partner/resend', { method: 'POST', body: '{}' });
}

export function requestSuccessPayout(body: {
  amountCents: number;
  method: 'ZAIN_CASH' | 'MASTERCARD';
  accountNumber: string;
  accountName?: string;
}) {
  return api<{ id: string; email: string; netCents: number; feeCents: number }>('/success-partner/payouts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function confirmSuccessPayout(id: string, code: string) {
  return api<SuccessState>(`/success-partner/payouts/${id}/confirm`, { method: 'POST', body: JSON.stringify({ code }) });
}

export async function uploadSuccessAvatar(file: File) {
  const form = new FormData();
  form.append('file', file);
  const response = await authedFetch(`${API_URL}/api/v1/success-partner/avatar`, { method: 'POST', body: form });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? 'تعذر رفع الصورة');
  }
  return response.json();
}

export async function successAvatarUrl() {
  const token = getAccessToken();
  const response = await fetch(`${API_URL}/api/v1/success-partner/avatar`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) return '';
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function successReceiptUrl(id: string) {
  const token = getAccessToken();
  const response = await fetch(`${API_URL}/api/v1/success-partner/payouts/${id}/receipt`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('لا توجد صورة تحويل');
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
