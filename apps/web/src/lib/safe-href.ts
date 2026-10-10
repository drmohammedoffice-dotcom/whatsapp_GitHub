export function safeHref(href: string | null | undefined, fallback = '/register') {
  const raw = (href || fallback).trim() || fallback;
  if (/^https?:\/\//i.test(raw)) return { href: raw, external: true as const };
  if (raw.startsWith('/')) return { href: raw, external: false as const };
  return { href: `/${raw}`, external: false as const };
}

export function normalizeList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
