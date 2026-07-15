import { TikTokOptimizationEvent } from '@watsapp/database';

export const TIKTOK_OPTIMIZATION_EVENTS: TikTokOptimizationEvent[] = [
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

export const DEFAULT_REDIRECT_MESSAGE = 'مرحبا، أريد الاستفسار عن الخدمة.';

export const TIKTOK_CONVERSION_DEDUP_HOURS = 24;
export const TIKTOK_CONVERSION_ATTRIBUTION_DAYS = 7;
/** After a tracking-link click, link the next inbound WhatsApp message to that pixel. */
export const TIKTOK_CLICK_TO_MESSAGE_MINUTES = 24 * 60;

export const TIKTOK_CONTACT_EVENT = 'Contact';
export const TIKTOK_LEAD_EVENT = 'Lead';
export const TIKTOK_COMPLETE_REGISTRATION_EVENT = 'CompleteRegistration';
export const TIKTOK_PURCHASE_EVENT = 'Purchase';

/** Max TikTok Events API send attempts (initial + retries). */
export const TIKTOK_CONTACT_MAX_RETRIES = 5;

/** Pixel activation warmup only — never used as ad conversions. */
export function warmupEventsOnly(): string[] {
  return ['PageView'];
}

/**
 * Conversion event fired on first real inbound WhatsApp message.
 * Purchase is sent as CompletePayment (TikTok website purchase optimization).
 */
export function conversionEventName(input: {
  defaultOptimizationEvent: TikTokOptimizationEvent;
  customEventName?: string | null;
}): string {
  return optimizationEventApiName(input.defaultOptimizationEvent, input.customEventName);
}

export function optimizationEventApiName(
  event: TikTokOptimizationEvent,
  customEventName?: string | null,
): string {
  if (event === 'Custom') return customEventName?.trim() || 'Custom';
  // TikTok Ads Manager website purchase optimization uses CompletePayment.
  if (event === 'Purchase') return 'CompletePayment';
  return event;
}

export function optimizationEventProperties(eventName: string): Record<string, string> | undefined {
  if (eventName === 'CompletePayment' || eventName === 'Purchase') {
    return { value: '1', currency: 'USD' };
  }
  return undefined;
}

/** Events Manager registration during wizard — include PageView + selected conversion. */
export function eventsToActivate(input: {
  defaultOptimizationEvent: TikTokOptimizationEvent;
  customEventName?: string | null;
  eventConfigurations?: Array<{ eventName: TikTokOptimizationEvent; enabled: boolean }>;
}): string[] {
  const conversion = conversionEventName({
    defaultOptimizationEvent: input.defaultOptimizationEvent,
    customEventName: input.customEventName,
  });
  const events = new Set<string>(['PageView', conversion]);
  const enabled = (input.eventConfigurations ?? []).filter((c) => c.enabled);
  for (const cfg of enabled) {
    const name = optimizationEventApiName(
      cfg.eventName,
      cfg.eventName === 'Custom' ? input.customEventName : null,
    );
    if (name && name !== 'ViewContent') events.add(name);
  }
  return Array.from(events);
}

/** Browser/server fire during activation — no fake conversions. */
export function activationTrackEvents(): string[] {
  return ['PageView'];
}

export function generateRedirectSlug(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function contactRetryDelayMs(retryCount: number): number {
  const minutes = Math.min(60, Math.pow(2, Math.max(0, retryCount)));
  return minutes * 60 * 1000;
}

/** Destination URL for TikTok Ads — selected conversion event + click-id macro. */
export function buildConversionTrackingUrl(
  webUrl: string,
  redirectSlug: string,
  eventName: string,
): string {
  const base = `${webUrl.replace(/\/$/, '')}/r/${redirectSlug}`;
  const params = new URLSearchParams({
    event: eventName || TIKTOK_CONTACT_EVENT,
    ttclid: '__CLICKID__',
  });
  return `${base}?${params.toString()}`;
}

/** @deprecated Use buildConversionTrackingUrl */
export function buildContactTrackingUrl(webUrl: string, redirectSlug: string): string {
  return buildConversionTrackingUrl(webUrl, redirectSlug, TIKTOK_CONTACT_EVENT);
}

/** URL for TikTok Events Manager Event Builder (stays on page with pixel base code). */
export function buildConversionEventBuilderUrl(
  webUrl: string,
  redirectSlug: string,
  eventName: string,
): string {
  const base = `${webUrl.replace(/\/$/, '')}/r/${redirectSlug}`;
  const params = new URLSearchParams({
    event: eventName || TIKTOK_CONTACT_EVENT,
    setup: '1',
  });
  return `${base}?${params.toString()}`;
}

/** @deprecated Use buildConversionEventBuilderUrl */
export function buildContactEventBuilderUrl(webUrl: string, redirectSlug: string): string {
  return buildConversionEventBuilderUrl(webUrl, redirectSlug, TIKTOK_CONTACT_EVENT);
}

/** Reject empty / unsubstituted TikTok macros so we never store fake ttclid. */
export function sanitizeTtclid(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (/^__CLICK_?ID__$/i.test(v)) return null;
  if (/^\{+\s*click_?id\s*\}+$/i.test(v)) return null;
  if (/^\{\{\s*ttclid\s*\}\}$/i.test(v)) return null;
  return v;
}
