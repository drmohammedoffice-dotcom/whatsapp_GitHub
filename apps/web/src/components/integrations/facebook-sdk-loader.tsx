'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/components/providers/locale-provider';
import { fetchFacebookSdkConfig, initFacebookSdk } from '@/lib/facebook-sdk';
import { API_URL } from '@/lib/utils';

/**
 * Loads Meta Facebook JS SDK only on pages that need Embedded Signup / Meta connect.
 */
export function FacebookSdkLoader() {
  const { locale } = useTranslation();
  const pathname = usePathname() || '/';
  const needed = /^\/(whatsapp|integrations|settings\/integrations)(\/|$)/.test(pathname);

  useEffect(() => {
    if (!needed) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;
    const run = () => {
      void (async () => {
        const config = await fetchFacebookSdkConfig(API_URL);
        if (cancelled || !config?.appId) return;
        await initFacebookSdk({
          appId: config.appId,
          graphVersion: config.graphVersion,
          locale,
        });
      })().catch((error) => {
        if (!cancelled) console.warn('[Facebook SDK] init failed', error);
      });
    };
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(run, { timeout: 2500 });
    } else {
      timer = setTimeout(run, 1200);
    }
    return () => {
      cancelled = true;
      if (idleId != null && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
      if (timer != null) clearTimeout(timer);
    };
  }, [locale, needed]);

  return null;
}
