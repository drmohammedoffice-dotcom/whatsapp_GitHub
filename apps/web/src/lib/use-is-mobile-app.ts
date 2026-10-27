'use client';

import { useSyncExternalStore } from 'react';
import { isMobileAppClient } from '@/lib/app-mode';

const noopSubscribe = () => () => undefined;

/**
 * True when the page runs inside the ChatLoora native app WebView.
 * SSR-safe: renders `false` on the server / during hydration, then the real value.
 */
export function useIsMobileApp(): boolean {
  return useSyncExternalStore(noopSubscribe, isMobileAppClient, () => false);
}
