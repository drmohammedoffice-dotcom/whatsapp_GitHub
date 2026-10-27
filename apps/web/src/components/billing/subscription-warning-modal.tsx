'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/components/providers/locale-provider';
import { useSubscription } from '@/components/providers/subscription-provider';
import { useIsMobileApp } from '@/lib/use-is-mobile-app';
import { isAdminImpersonation } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const DISMISS_KEY = 'subscription-warning-dismissed';

export function SubscriptionWarningModal() {
  const { t } = useTranslation();
  const { status } = useSubscription();
  const [open, setOpen] = useState(false);
  const isMobileApp = useIsMobileApp();

  useEffect(() => {
    if (isMobileApp) return;
    if (isAdminImpersonation()) return;
    if (!status?.showExpiryWarning || status.daysRemaining === null) return;
    const key = `${DISMISS_KEY}-${status.currentPeriodEnd}`;
    if (sessionStorage.getItem(key)) return;
    setOpen(true);
  }, [status, isMobileApp]);

  function dismiss() {
    if (status?.currentPeriodEnd) {
      sessionStorage.setItem(`${DISMISS_KEY}-${status.currentPeriodEnd}`, '1');
    }
    setOpen(false);
  }

  if (isMobileApp) return null;
  if (isAdminImpersonation()) return null;
  if (!status?.showExpiryWarning || status.daysRemaining === null) return null;

  const trial = Boolean(status.isFreeTrial);
  const when = status.trialEndsAt
    ? new Date(status.trialEndsAt).toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {trial ? t('billing.trialEndingTitle') : t('billing.expiryWarningTitle')}
          </DialogTitle>
          <DialogDescription>
            {trial
              ? t('billing.trialEndingBody').replace('{date}', when)
              : t('billing.expiryWarningBody').replace('{days}', String(status.daysRemaining))}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={dismiss}>
            {t('common.close')}
          </Button>
          <Button asChild>
            <Link href="/plans">{trial ? t('billing.activateSubscription') : t('billing.renewViaWhatsApp')}</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
