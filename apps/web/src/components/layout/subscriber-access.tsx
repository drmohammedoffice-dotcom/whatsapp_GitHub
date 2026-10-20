'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { LoadingBlock } from '@/components/shared/loading-block';
import { useTranslation } from '@/components/providers/locale-provider';
import { isAdminOnlyStudioPath, isHiddenSubscriberPath, SUBSCRIBER_HOME } from '@/lib/subscription-routes';
import { api } from '@/lib/utils';

const PlatformAdminContext = createContext(false);

export function useIsPlatformAdmin() {
  return useContext(PlatformAdminContext);
}

export function SubscriberAccess({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { t } = useTranslation();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const hidden = isHiddenSubscriberPath(pathname);
  const studio = isAdminOnlyStudioPath(pathname);
  const studioLocked = studio && (!ready || !isPlatformAdmin);

  useEffect(() => {
    let cancelled = false;
    api<{ isPlatformAdmin?: boolean }>('/auth/me')
      .then((user) => {
        if (!cancelled) setIsPlatformAdmin(Boolean(user.isPlatformAdmin));
      })
      .catch(() => {
        if (!cancelled) setIsPlatformAdmin(false);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (hidden || (isAdminOnlyStudioPath(pathname) && !isPlatformAdmin)) {
      router.replace(SUBSCRIBER_HOME);
    }
  }, [ready, hidden, pathname, isPlatformAdmin, router]);

  if (hidden || studioLocked) {
    return <LoadingBlock label={t('guard.checking')} className="min-h-[50vh]" />;
  }

  return <PlatformAdminContext.Provider value={isPlatformAdmin}>{children}</PlatformAdminContext.Provider>;
}
