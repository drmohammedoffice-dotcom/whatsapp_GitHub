/** Helpers to format instant-form order answers for the merchant orders UI. */

const SKIP_DISPLAY_TYPES = new Set([
  'name',
  'phone',
  'whatsapp',
  'email',
  'address',
  'area',
  'city',
  'governorate',
  'notes',
  'landmark',
  'image_upload',
  'file_upload',
  'quantity',
]);

export type OrderFieldMeta = {
  id: string;
  type: string;
  label: string;
};

export type OrderSelectionLine = {
  label: string;
  value: string;
};

export type OrderDisplay = {
  product?: string;
  unitPrice?: number | null;
  quantity?: number | null;
  totalPrice?: number | null;
  currency?: string;
  lines: OrderSelectionLine[];
  summary: string;
};

export function formatChoiceAnswer(raw: unknown): string {
  if (raw == null || raw === '') return '';
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object' && 'label' in item) {
          const obj = item as { label: unknown; qty?: unknown; sizes?: unknown };
          const label = String(obj.label || '').trim();
          if (!label) return '';
          const qty = Math.max(1, Number(obj.qty) || 1);
          const sizes = Array.isArray(obj.sizes)
            ? obj.sizes.map((s) => String(s ?? '').trim()).filter(Boolean)
            : [];
          const sizePart = sizes.length ? ` (قياس: ${sizes.join('، ')})` : '';
          return qty > 1 ? `${label} × ${qty}${sizePart}` : `${label}${sizePart}`;
        }
        return String(item ?? '');
      })
      .filter(Boolean)
      .join('، ');
  }
  if (typeof raw === 'object' && raw && 'label' in raw) {
    const obj = raw as { label: unknown; qty?: unknown; sizes?: unknown };
    const label = String(obj.label || '').trim();
    const qty = Math.max(1, Number(obj.qty) || 1);
    const sizes = Array.isArray(obj.sizes)
      ? obj.sizes.map((s) => String(s ?? '').trim()).filter(Boolean)
      : [];
    const sizePart = sizes.length ? ` (قياس: ${sizes.join('، ')})` : '';
    return qty > 1 ? `${label} × ${qty}${sizePart}` : `${label}${sizePart}`;
  }
  return String(raw).trim();
}

export function countChoiceUnits(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  if (Array.isArray(raw)) {
    return raw.reduce((sum: number, item) => {
      if (typeof item === 'string' && item.trim()) return sum + 1;
      if (item && typeof item === 'object' && 'label' in item) {
        return sum + Math.max(1, Number((item as { qty?: unknown }).qty) || 1);
      }
      return sum;
    }, 0);
  }
  if (typeof raw === 'string' && raw.trim()) return 1;
  if (typeof raw === 'object' && raw && 'label' in raw) {
    return Math.max(1, Number((raw as { qty?: unknown }).qty) || 1);
  }
  return 0;
}

export function buildOrderDisplay(
  answers: Record<string, unknown> | null | undefined,
  fields?: OrderFieldMeta[] | null,
  fallback?: {
    productName?: string | null;
    quantity?: number | null;
    unitPrice?: string | number | null;
    totalPrice?: string | number | null;
    currency?: string | null;
  },
): OrderDisplay {
  const stored = answers?._display as OrderDisplay | undefined;
  if (stored && Array.isArray(stored.lines) && stored.lines.length) {
    return {
      product: stored.product || fallback?.productName || undefined,
      unitPrice: stored.unitPrice ?? (fallback?.unitPrice != null ? Number(fallback.unitPrice) : null),
      quantity: stored.quantity ?? fallback?.quantity ?? null,
      totalPrice: stored.totalPrice ?? (fallback?.totalPrice != null ? Number(fallback.totalPrice) : null),
      currency: stored.currency || fallback?.currency || 'IQD',
      lines: stored.lines,
      summary:
        stored.summary ||
        stored.lines.map((l) => `${l.label}: ${l.value}`).filter(Boolean).join(' | '),
    };
  }

  const lines: OrderSelectionLine[] = [];
  const ans = answers || {};

  if (fields?.length) {
    for (const field of fields) {
      if (SKIP_DISPLAY_TYPES.has(field.type)) continue;
      if (field.id.startsWith('_')) continue;
      const value = formatChoiceAnswer(ans[field.id] ?? ans[field.type]);
      if (!value) continue;
      lines.push({ label: field.label || field.type, value });
    }
  } else {
    for (const [key, raw] of Object.entries(ans)) {
      if (key.startsWith('_')) continue;
      const value = formatChoiceAnswer(raw);
      if (!value) continue;
      if (typeof raw === 'string' && raw.length > 40 && !Array.isArray(raw)) continue;
      lines.push({ label: key, value });
    }
  }

  return {
    product: fallback?.productName || undefined,
    unitPrice: fallback?.unitPrice != null ? Number(fallback.unitPrice) : null,
    quantity: fallback?.quantity ?? null,
    totalPrice: fallback?.totalPrice != null ? Number(fallback.totalPrice) : null,
    currency: fallback?.currency || 'IQD',
    lines,
    summary: lines.map((l) => `${l.label}: ${l.value}`).join(' | '),
  };
}

export function formatMoney(amount: string | number | null | undefined, currency = 'IQD') {
  if (amount == null || amount === '') return '—';
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  return `${n.toLocaleString('en-IQ')} ${currency}`;
}
