/** Browser pixel events that may run client-side. Purchase/CompletePayment/Lead must only go via Events API. */
const BROWSER_SAFE_PIXEL_EVENTS = new Set(['PageView', 'ViewContent', 'InitiateCheckout']);

function whitelistBrowserPixelEvents(events: string[]): string[] {
  const allowed = events
    .map((e) => e.trim())
    .filter((e) => e && BROWSER_SAFE_PIXEL_EVENTS.has(e));
  return allowed.length > 0 ? allowed : ['PageView'];
}

/** Inline TikTok Pixel base code — must appear in HTML for TikTok setup verification. */
export function tiktokPixelInlineScript(pixelCode: string, extraEvents: string[] = []) {
  const safeCode = pixelCode.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const events = whitelistBrowserPixelEvents(extraEvents).filter((e) => e !== 'PageView');
  const trackCalls = events
    .map((e, i) => `setTimeout(function(){ttq.track('${e.replace(/'/g, "\\'")}');},${400 + i * 400});`)
    .join('');

  return `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=d.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=d.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${safeCode}');ttq.page();${trackCalls}}(window,document,'ttq');`;
}
