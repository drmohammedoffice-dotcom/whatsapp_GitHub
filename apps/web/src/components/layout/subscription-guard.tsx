'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { SubscriptionRequired } from '@/components/billing/subscription-required';
import { useSubscription } from '@/components/providers/subscription-provider';
import { useTranslation } from '@/components/providers/locale-provider';
import { LoadingBlock } from '@/components/shared/loading-block';
import { isSubscriptionExemptPath } from '@/lib/subscription-routes';

export function SubscriptionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { status, loading } = useSubscription();

  const exempt = isSubscriptionExemptPath(pathname);
  const blocked = !!status && !status.isActive;

  useEffect(() => {
    if (loading || exempt || !blocked) return;
    router.replace('/pricing');
  }, [blocked, exempt, loading, router]);

  if (loading) {
    return <LoadingBlock label={t('billing.checkingSubscription')} className="min-h-[50vh]" />;
  }

  if (!exempt && blocked) {
    return <SubscriptionRequired />;
  }

  return <>{children}</>;
}
