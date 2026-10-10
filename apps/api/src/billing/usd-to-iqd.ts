/** Default USD → IQD rate used for Wayl and ad-topup conversions. */
export const DEFAULT_USD_TO_IQD_RATE = 1520;

export function resolveUsdToIqdRate(raw?: string | number | null): number {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());
  if (Number.isFinite(n) && n > 0) return n;
  const fromEnv = Number(String(process.env.USD_TO_IQD_RATE ?? '').trim());
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return DEFAULT_USD_TO_IQD_RATE;
}

/** Convert USD cents (or IQD whole units) to Wayl IQD total. */
export function toWaylIqd(amount: number, currency: string, rate?: number): number {
  const cur = (currency || 'IQD').toUpperCase();
  if (cur === 'IQD') return Math.max(1000, Math.round(amount));
  const usd = amount / 100;
  return Math.max(1000, Math.round(usd * resolveUsdToIqdRate(rate)));
}
