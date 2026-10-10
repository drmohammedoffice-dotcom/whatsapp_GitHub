import { API_URL, authedFetch } from '@/lib/utils';
import type { InstantFormDocument } from './document';

export type InstantFormAdPlatform =
  | 'TIKTOK'
  | 'FACEBOOK'
  | 'INSTAGRAM'
  | 'GOOGLE'
  | 'SNAPCHAT'
  | 'OTHER';

export type InstantFormStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type InstantFormOrderStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'CONFIRMED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'SPAM';

export type InstantFormView = {
  id: string;
  name: string;
  slug: string;
  shortCode: string;
  adPlatform: InstantFormAdPlatform;
  adAccountLabel: string | null;
  status: InstantFormStatus;
  templateKey: string | null;
  draftDocument: InstantFormDocument;
  publishedDocument: InstantFormDocument | null;
  publishedAt: string | null;
  whatsappNumber: string | null;
  pixelIntegrationId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
  ordersCount: number;
  publicUrl: string;
  shortUrl: string;
  qrUrl: string;
};

export type InstantFormTemplateMeta = {
  key: string;
  nameAr: string;
  nameEn: string;
  category: string;
  descriptionAr: string;
};

export type InstantFormOrder = {
  id: string;
  orderNumber: string;
  status: InstantFormOrderStatus;
  customerName: string | null;
  customerPhone: string | null;
  customerWhatsapp: string | null;
  customerEmail: string | null;
  city: string | null;
  governorate: string | null;
  address: string | null;
  productName: string | null;
  quantity: number;
  unitPrice: string | null;
  totalPrice: string | null;
  currency: string;
  answers: Record<string, unknown>;
  notes: string | null;
  internalNotes: string | null;
  adPlatform: InstantFormAdPlatform | null;
  adAccountLabel: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  deviceType: string | null;
  browser: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  ttclid: string | null;
  fbclid: string | null;
  gclid: string | null;
  submittedAt: string;
  form?: { id: string; name: string; slug: string };
};

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const err = new Error(
      Array.isArray(json?.message)
        ? (json.message as string[]).join(', ')
        : typeof json?.message === 'string'
          ? json.message
          : text || res.statusText,
    ) as Error & { errors?: Array<{ fieldId: string; message: string }> };
    if (json && Array.isArray(json.errors)) {
      err.errors = json.errors as Array<{ fieldId: string; message: string }>;
    }
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (json ?? {}) as T;
}

export async function listInstantForms(params?: { status?: InstantFormStatus; q?: string }) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.q) qs.set('q', params.q);
  const res = await authedFetch(`${API_URL}/api/v1/instant-forms?${qs}`);
  return parse<InstantFormView[]>(res);
}

export async function listInstantFormTemplates() {
  const res = await authedFetch(`${API_URL}/api/v1/instant-forms/templates`);
  return parse<InstantFormTemplateMeta[]>(res);
}

export async function getInstantForm(id: string) {
  const res = await authedFetch(`${API_URL}/api/v1/instant-forms/${id}`);
  return parse<InstantFormView>(res);
}

export async function createInstantForm(body: {
  name: string;
  adPlatform: InstantFormAdPlatform;
  adAccountLabel?: string;
  templateKey?: string;
  whatsappNumber?: string;
  pixelIntegrationId?: string | null;
  draftDocument?: InstantFormDocument;
}) {
  const res = await authedFetch(`${API_URL}/api/v1/instant-forms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parse<InstantFormView>(res);
}

export async function generateInstantFormDocument(body: {
  brief: string;
  productName?: string;
  productDescription?: string;
  price?: number;
  compareAtPrice?: number;
  currency?: string;
  features?: string[];
  images?: string[];
  platform?: string;
  offerBadge?: string;
  extraNotes?: string;
}) {
  const res = await authedFetch(`${API_URL}/api/v1/instant-forms/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parse<InstantFormDocument>(res);
}

export async function uploadInstantFormMedia(file: File) {
  const form = new FormData();
  form.append('file', file);
  const res = await authedFetch(`${API_URL}/api/v1/instant-forms/media`, {
    method: 'POST',
    body: form,
  });
  return parse<{
    url: string;
    storageKey: string;
    sizeBytes: number;
    mimeType: string;
    fileName: string;
  }>(res);
}

export async function saveInstantFormDraft(id: string, draftDocument: InstantFormDocument) {
  const res = await authedFetch(`${API_URL}/api/v1/instant-forms/${id}/save-draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftDocument }),
  });
  return parse<InstantFormView>(res);
}

export async function publishInstantForm(id: string) {
  const res = await authedFetch(`${API_URL}/api/v1/instant-forms/${id}/publish`, { method: 'POST' });
  return parse<InstantFormView>(res);
}

export async function duplicateInstantForm(id: string) {
  const res = await authedFetch(`${API_URL}/api/v1/instant-forms/${id}/duplicate`, { method: 'POST' });
  return parse<InstantFormView>(res);
}

export async function archiveInstantForm(id: string) {
  const res = await authedFetch(`${API_URL}/api/v1/instant-forms/${id}/archive`, { method: 'POST' });
  return parse<InstantFormView>(res);
}

export async function deleteInstantForm(id: string) {
  const res = await authedFetch(`${API_URL}/api/v1/instant-forms/${id}`, { method: 'DELETE' });
  return parse<{ ok: boolean }>(res);
}

export async function listInstantFormOrders(params?: {
  formId?: string;
  status?: InstantFormOrderStatus;
  q?: string;
  page?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.formId) qs.set('formId', params.formId);
  if (params?.status) qs.set('status', params.status);
  if (params?.q) qs.set('q', params.q);
  if (params?.page) qs.set('page', String(params.page));
  const res = await authedFetch(`${API_URL}/api/v1/instant-forms/orders?${qs}`);
  return parse<{ total: number; page: number; pageSize: number; items: InstantFormOrder[] }>(res);
}

export async function updateInstantFormOrder(
  orderId: string,
  body: Partial<{ status: InstantFormOrderStatus; internalNotes: string }>,
) {
  const res = await authedFetch(`${API_URL}/api/v1/instant-forms/orders/${orderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parse<InstantFormOrder>(res);
}

export async function deleteInstantFormOrder(orderId: string) {
  const res = await authedFetch(`${API_URL}/api/v1/instant-forms/orders/${orderId}`, {
    method: 'DELETE',
  });
  return parse<{ ok: boolean }>(res);
}

export async function fetchPublicInstantForm(slug: string) {
  const normalized = normalizePublicSlug(slug);
  const res = await fetch(
    `${API_URL}/api/v1/instant-forms/public/${encodeURIComponent(normalized)}`,
    { cache: 'no-store' },
  );
  return parse<{
    id: string;
    name: string;
    slug: string;
    shortCode: string;
    adPlatform: InstantFormAdPlatform;
    whatsappNumber: string | null;
    seoTitle: string;
    seoDescription: string | null;
    document: InstantFormDocument;
    tiktokPixelCode?: string | null;
  }>(res);
}

function normalizePublicSlug(slug: string) {
  const raw = String(slug || '').trim();
  if (!raw) return raw;
  try {
    // useParams sometimes yields an already-encoded value; decode once safely.
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function submitPublicInstantForm(
  slug: string,
  body: {
    answers: Record<string, unknown>;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    ttclid?: string;
    fbclid?: string;
    gclid?: string;
    eventId?: string;
    deviceType?: string;
    browser?: string;
  },
) {
  const res = await fetch(
    `${API_URL}/api/v1/instant-forms/public/${encodeURIComponent(normalizePublicSlug(slug))}/submit`,
    {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  },
  );
  return parse<{
    ok: boolean;
    orderId: string;
    orderNumber: string;
    thankYou: InstantFormDocument['thankYou'];
    whatsappNumber: string | null;
    formName: string;
    errors?: Array<{ fieldId: string; message: string }>;
  }>(res);
}

export const AD_PLATFORM_OPTIONS: Array<{ value: InstantFormAdPlatform; labelAr: string; labelEn: string }> = [
  { value: 'TIKTOK', labelAr: 'TikTok', labelEn: 'TikTok' },
  { value: 'FACEBOOK', labelAr: 'Facebook', labelEn: 'Facebook' },
  { value: 'INSTAGRAM', labelAr: 'Instagram', labelEn: 'Instagram' },
  { value: 'GOOGLE', labelAr: 'Google', labelEn: 'Google' },
  { value: 'SNAPCHAT', labelAr: 'Snapchat', labelEn: 'Snapchat' },
  { value: 'OTHER', labelAr: 'أخرى', labelEn: 'Other' },
];
