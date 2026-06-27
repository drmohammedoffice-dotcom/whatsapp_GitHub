'use client';

import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from '@/components/providers/locale-provider';
import { LoadingBlock } from '@/components/shared/loading-block';
import { ensureValidSession } from '@/lib/utils';

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ensureValidSession().then((valid) => {
      if (cancelled) return;
      if (valid) setReady(true);
      else router.replace('/login');
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) return <LoadingBlock label={t('guard.checking')} className="min-h-[50vh]" />;
  return <>{children}</>;
}
