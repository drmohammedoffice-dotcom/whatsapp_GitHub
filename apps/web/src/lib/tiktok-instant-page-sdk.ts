/** TikTok Instant Page Editor SDK (Tip) — استمارة فورية داخل تيك توك */

const SDK_SRC = 'https://sf-unpkg.tiktokcdn.com/obj/unpkg-va/latest/byted/instant_page_sdk/dist/index.js';

export type TipSdkActionType = 'create' | 'edit' | 'copy';

export type TipSdkStartResult = {
  pageId?: string;
  status?: number;
  accountId?: string;
  [key: string]: unknown;
};

type InstantPageApi = {
  init: (opts: { appId: string; version: string }) => void;
  start: (
    opts: {
      accountId: string;
      appId: string;
      ixAccessToken: string;
      businessType?: number;
      display?: 'popup';
      actionType: TipSdkActionType;
      language?: string;
      pageId?: string;
    },
    cb: (response: TipSdkStartResult) => void,
  ) => void;
};

declare global {
  interface Window {
    InstantPage?: InstantPageApi;
    InstantPageAsyncInit?: (val?: unknown) => void;
  }
}

let loadPromise: Promise<InstantPageApi> | null = null;
let initAppId: string | null = null;

function getApi(): InstantPageApi | null {
  return typeof window !== 'undefined' ? window.InstantPage ?? null : null;
}

export function loadTikTokInstantPageSdk(appId: string): Promise<InstantPageApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Instant Page SDK متاح في المتصفح فقط'));
  }
  const existing = getApi();
  if (existing && initAppId === appId) return Promise.resolve(existing);

  if (loadPromise && initAppId === appId) return loadPromise;

  initAppId = appId;
  loadPromise = new Promise<InstantPageApi>((resolve, reject) => {
    const finish = () => {
      const api = getApi();
      if (!api) {
        reject(new Error('تعذّر تحميل محرر الاستمارة الفورية من تيك توك'));
        return;
      }
      try {
        api.init({ appId, version: 'v1.0' });
      } catch (err) {
        // init مرة واحدة فقط — تجاهل إن كان مُهيأ مسبقاً
        const msg = err instanceof Error ? err.message : String(err);
        if (!/initialized/i.test(msg)) {
          reject(err instanceof Error ? err : new Error(msg));
          return;
        }
      }
      resolve(api);
    };

    window.InstantPageAsyncInit = () => finish();

    const prev = document.querySelector<HTMLScriptElement>(`script[data-tiktok-instant-page-sdk="1"]`);
    if (prev && getApi()) {
      finish();
      return;
    }
    if (prev) {
      prev.addEventListener('load', () => finish(), { once: true });
      prev.addEventListener('error', () => reject(new Error('فشل تحميل سكربت محرر الاستمارة')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.src = SDK_SRC;
    script.dataset.tiktokInstantPageSdk = '1';
    script.onload = () => {
      // بعض الإصدارات تستدعي InstantPageAsyncInit تلقائياً؛ وإلا نهيّئ يدوياً
      if (getApi()) finish();
      else setTimeout(() => finish(), 50);
    };
    script.onerror = () => reject(new Error('فشل تحميل سكربت محرر الاستمارة الفورية'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

export async function openTikTokInstantFormEditor(input: {
  appId: string;
  advertiserId: string;
  ixAccessToken: string;
  actionType: TipSdkActionType;
  pageId?: string;
  language?: string;
}): Promise<TipSdkStartResult> {
  const api = await loadTikTokInstantPageSdk(input.appId);
  return new Promise((resolve, reject) => {
    try {
      api.start(
        {
          accountId: input.advertiserId,
          appId: input.appId,
          ixAccessToken: input.ixAccessToken,
          businessType: 1,
          display: 'popup',
          actionType: input.actionType,
          language: input.language || 'ar',
          ...(input.pageId ? { pageId: input.pageId } : {}),
        },
        (response) => resolve(response || {}),
      );
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
