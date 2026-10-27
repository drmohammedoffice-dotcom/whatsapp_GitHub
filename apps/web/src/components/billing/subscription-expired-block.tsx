'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import { useTranslation } from '@/components/providers/locale-provider';
import { useSubscription } from '@/components/providers/subscription-provider';
import { MOBILE_APP_UNAVAILABLE_MESSAGE } from '@/lib/app-mode';
import { useIsMobileApp } from '@/lib/use-is-mobile-app';
import { isAdminImpersonation } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function SubscriptionExpiredBlock() {
  const { t, locale } = useTranslation();
  const pathname = usePathname();
  const isMobileApp = useIsMobileApp();
  const { status, loading } = useSubscription();

  const payPath =
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/plans') ||
    pathname.startsWith('/account') ||
    pathname.startsWith('/login');
  const impersonating = isAdminImpersonation();
  const locked = Boolean(status?.hasSubscription && !status.isActive && !impersonating && !payPath);

  useEffect(() => {
    if (!locked) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const blockKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('keydown', blockKeys, true);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', blockKeys, true);
    };
  }, [locked]);

  if (loading || impersonating || !locked || !status) return null;

  const graceDays =
    status.graceDaysRemaining ??
    (status.graceHoursRemaining != null ? Math.max(1, Math.ceil(status.graceHoursRemaining / 24)) : null);

  const trialEnded = Boolean(status.freeTrialEnded);
  const body = isMobileApp
    ? MOBILE_APP_UNAVAILABLE_MESSAGE[locale === 'ar' ? 'ar' : 'en']
    : trialEnded
    ? t('billing.trialEndedBody')
    : status.isInGracePeriod && graceDays !== null
      ? t('billing.subscriptionExpiredGraceBody').replace('{days}', String(graceDays))
      : status.gracePurged
        ? t('billing.subscriptionExpiredPurgedBody')
        : t('billing.subscriptionExpiredBody');

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="subscription-expired-title"
      aria-describedby="subscription-expired-desc"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/90 p-4 backdrop-blur-md"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Card className="w-full max-w-md border-destructive/40 shadow-2xl">
        <CardContent className="flex flex-col items-center gap-4 pt-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
            <Lock className="h-7 w-7 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 id="subscription-expired-title" className="text-xl font-semibold">
              {isMobileApp
                ? locale === 'ar'
                  ? 'الميزة غير متاحة'
                  : 'Feature unavailable'
                : trialEnded
                  ? t('billing.trialEndedTitle')
                  : t('billing.subscriptionExpiredTitle')}
            </h2>
            <p id="subscription-expired-desc" className="text-sm text-muted-foreground">
              {body}
            </p>
          </div>
          {isMobileApp ? (
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/account">{t('nav.account')}</Link>
            </Button>
          ) : (
            <Button asChild className="w-full sm:w-auto">
              <Link href="/plans">{trialEnded ? t('billing.activateSubscription') : t('billing.viewPlans')}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
