/**
 * Official TikTok Ads Manager billing destinations.
 * Payment happens on TikTok — Chatloora only deep-links into Ads Manager.
 *
 * Documented account context uses `aadvid` on ads.tiktok.com.
 * Billing UI path: Tools → Settings → Billing / Payment → Add Balance.
 */

export const TIKTOK_ADS_BILLING_ALLOWED_HOSTS = new Set([
  'ads.tiktok.com',
  'business.tiktok.com',
]);

const ADVERTISER_ID_RE = /^\d{5,32}$/;

export function isValidTikTokAdvertiserId(advertiserId: string): boolean {
  return ADVERTISER_ID_RE.test(String(advertiserId ?? '').trim());
}

export function isAllowedTikTokBillingUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return false;
    return TIKTOK_ADS_BILLING_ALLOWED_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Primary deep-link into Ads Manager payment / billing for an advertiser. */
export function buildTikTokAdsBillingUrl(advertiserId: string): string {
  const id = String(advertiserId).trim();
  if (!isValidTikTokAdvertiserId(id)) {
    throw new Error('Invalid TikTok advertiser id');
  }
  const url = new URL('https://ads.tiktok.com/i18n/account/payment');
  url.searchParams.set('aadvid', id);
  if (!isAllowedTikTokBillingUrl(url.toString())) {
    throw new Error('Generated billing URL failed allowlist check');
  }
  return url.toString();
}

/** Fallback: open Ads Manager dashboard for the advertiser (user opens Billing from Tools). */
export function buildTikTokAdsManagerUrl(advertiserId: string): string {
  const id = String(advertiserId).trim();
  if (!isValidTikTokAdvertiserId(id)) {
    throw new Error('Invalid TikTok advertiser id');
  }
  const url = new URL('https://ads.tiktok.com/i18n/dashboard');
  url.searchParams.set('aadvid', id);
  if (!isAllowedTikTokBillingUrl(url.toString())) {
    throw new Error('Generated Ads Manager URL failed allowlist check');
  }
  return url.toString();
}
