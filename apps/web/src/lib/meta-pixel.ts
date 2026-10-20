declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

type FbqFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: FbqFn;
  loaded: boolean;
  version: string;
};

const inited = new Set<string>();

export function sanitizeBrowserMetaPixelId(raw: unknown): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (/^\d{10,20}$/.test(value)) return value;
  const fromInit = value.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{10,20})['"]/i);
  if (fromInit?.[1]) return fromInit[1];
  const fromTracker = value.match(/facebook\.com\/tr\?id=(\d{10,20})/i);
  if (fromTracker?.[1]) return fromTracker[1];
  return null;
}

function installOfficialStub() {
  if (typeof window === 'undefined' || window.fbq) return;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as FbqFn;
  window.fbq = fbq;
  if (!window._fbq) window._fbq = fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  const first = document.getElementsByTagName('script')[0];
  first?.parentNode?.insertBefore(script, first);
}

export function initMetaPixel(pixelId: string | null | undefined) {
  if (typeof window === 'undefined') return;
  const id = sanitizeBrowserMetaPixelId(pixelId);
  if (!id) return;
  installOfficialStub();
  if (!inited.has(id)) {
    window.fbq?.('init', id);
    inited.add(id);
  }
}

export function trackMeta(event: string, params?: Record<string, unknown>, eventId?: string) {
  if (typeof window === 'undefined' || !window.fbq) return;
  if (eventId) window.fbq('track', event, params || {}, { eventID: eventId });
  else window.fbq('track', event, params || {});
}
