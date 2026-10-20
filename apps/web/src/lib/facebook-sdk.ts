/** Meta Graph + Facebook JS SDK helpers (client-side). */

export const META_GRAPH_VERSION = 'v21.0';

export type FacebookSdkConfig = {
  enabled: boolean;
  appId?: string;
  graphVersion?: string;
};

export type FacebookSdkInitOptions = {
  appId: string;
  graphVersion?: string;
  locale?: string;
};

declare global {
  interface Window {
    FB?: {
      init: (params: {
        appId: string;
        cookie?: boolean;
        xfbml?: boolean;
        version: string;
      }) => void;
      AppEvents: {
        logPageView: () => void;
      };
      getLoginStatus: (callback: (response: unknown) => void) => void;
      login: (
        callback: (response: unknown) => void,
        options?: {
          scope?: string;
          auth_type?: string;
          return_scopes?: boolean;
          config_id?: string;
          response_type?: string;
          override_default_response_type?: boolean;
          extras?: Record<string, unknown>;
        },
      ) => void;
    };
    fbAsyncInit?: () => void;
    __facebookSdkReady?: boolean;
    __facebookSdkInitPromise?: Promise<void>;
  }
}

function sdkLocale(locale?: string) {
  return locale === 'ar' ? 'ar_AR' : 'en_US';
}

export function getFacebookSdkScriptUrl(locale?: string) {
  return `https://connect.facebook.net/${sdkLocale(locale)}/sdk.js`;
}

let configPromise: Promise<FacebookSdkConfig | null> | null = null;

/** Resolve Meta app id from env or public API (no secrets). */
export async function fetchFacebookSdkConfig(apiBase: string): Promise<FacebookSdkConfig | null> {
  const fromEnv = process.env.NEXT_PUBLIC_META_APP_ID?.trim();
  if (fromEnv) {
    return { enabled: true, appId: fromEnv, graphVersion: META_GRAPH_VERSION };
  }

  if (!configPromise) {
    configPromise = fetch(`${apiBase.replace(/\/$/, '')}/api/meta/sdk-config`, {
      credentials: 'omit',
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = (await res.json()) as FacebookSdkConfig;
        return body?.enabled && body.appId ? body : null;
      })
      .catch(() => null);
  }
  return configPromise;
}

/** Load connect.facebook.net/sdk.js once and call FB.init. */
export function initFacebookSdk(options: FacebookSdkInitOptions): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.__facebookSdkReady && window.FB) return Promise.resolve();
  if (window.__facebookSdkInitPromise) return window.__facebookSdkInitPromise;

  const graphVersion = options.graphVersion ?? META_GRAPH_VERSION;
  const scriptUrl = getFacebookSdkScriptUrl(options.locale);

  window.__facebookSdkInitPromise = new Promise<void>((resolve, reject) => {
    window.fbAsyncInit = () => {
      try {
        window.FB?.init({
          appId: options.appId,
          cookie: true,
          xfbml: true,
          version: graphVersion,
        });
        window.FB?.AppEvents.logPageView();
        window.__facebookSdkReady = true;
        resolve();
      } catch (error) {
        reject(error);
      }
    };

    if (document.getElementById('facebook-jssdk')) {
      if (window.FB) {
        window.fbAsyncInit?.();
        return;
      }
      const poll = setInterval(() => {
        if (window.FB) {
          clearInterval(poll);
          window.fbAsyncInit?.();
        }
      }, 50);
      setTimeout(() => clearInterval(poll), 15000);
      return;
    }

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.src = scriptUrl;
    script.onerror = () => reject(new Error('Failed to load Facebook SDK'));
    const first = document.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(script, first);
  });

  return window.__facebookSdkInitPromise;
}
