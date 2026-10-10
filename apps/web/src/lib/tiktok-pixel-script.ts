/** Browser pixel events that may run client-side. Purchase/CompletePayment stay server-side only. */
const BROWSER_SAFE_PIXEL_EVENTS = new Set(['PageView', 'ViewContent', 'InitiateCheckout']);

export function whitelistBrowserPixelEvents(events: string[]): string[] {
  const allowed = events
    .map((e) => e.trim())
    .filter((e) => e && BROWSER_SAFE_PIXEL_EVENTS.has(e));
  return allowed.length > 0 ? allowed : ['PageView'];
}

/** Inline TikTok Pixel base code — must appear in HTML for TikTok setup verification. */
export function tiktokPixelInlineScript(pixelCode: string, extraEvents: string[] = []) {
  const safeCode = pixelCode.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  // Hard deny conversion events even if a caller passes them.
  const events = whitelistBrowserPixelEvents(extraEvents).filter((e) => e !== 'PageView');
  const trackCalls = events
    .map((e, i) => `setTimeout(function(){ttq.track('${e.replace(/'/g, "\\'")}');},${400 + i * 400});`)
    .join('');

  return `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=d.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=d.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${safeCode}');ttq.page();${trackCalls}}(window,document,'ttq');`;
}

type Ttq = {
  track?: (event: string, props?: Record<string, unknown>, options?: { event_id?: string }) => void;
  page?: () => void;
};

/** Client-side track with optional event_id for Events API dedupe. Never send Purchase from browser. */
export function trackTikTokBrowser(
  event: string,
  props?: Record<string, unknown>,
  eventId?: string,
) {
  if (typeof window === 'undefined') return;
  if (!BROWSER_SAFE_PIXEL_EVENTS.has(event) && event !== 'PageView') return;
  const ttq = (window as unknown as { ttq?: Ttq }).ttq;
  if (!ttq?.track) return;
  if (eventId) ttq.track(event, props || {}, { event_id: eventId });
  else ttq.track(event, props || {});
}

export function newTikTokEventId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
