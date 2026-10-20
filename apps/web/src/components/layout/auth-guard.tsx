'use client';

import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from '@/components/providers/locale-provider';
import { LoadingBlock } from '@/components/shared/loading-block';
import { fetchSubscriptionStatus } from '@/lib/billing';
import { setAuthCookie, setSubscriptionCookie } from '@/lib/subscription-cookie';
import { ensureValidSession, getAccessToken } from '@/lib/utils';

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (getAccessToken()) {
      setAuthCookie();
      setReady(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const valid = await ensureValidSession();
      if (cancelled) return;
      if (!valid) {
        router.replace('/login');
        return;
      }
      setAuthCookie();
      setReady(true);
      void fetchSubscriptionStatus()
        .then((sub) => setSubscriptionCookie(sub.isActive))
        .catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) return <LoadingBlock label={t('guard.checking')} className="min-h-[50vh]" />;
  return <>{children}</>;
}
