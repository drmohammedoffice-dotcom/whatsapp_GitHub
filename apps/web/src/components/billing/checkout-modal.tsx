'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSubscription } from '@/components/providers/subscription-provider';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { BillingCycle, BillingPlan, CheckoutResult } from '@/lib/billing';
import { formatPrice } from '@/lib/billing';
import { getAccessToken, parseApiError } from '@/lib/utils';

type CheckoutModalProps = {
  plan: BillingPlan | null;
  billingCycle: BillingCycle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBillingCycleChange: (cycle: BillingCycle) => void;
};

export function CheckoutModal({ plan, billingCycle, open, onOpenChange, onBillingCycleChange }: CheckoutModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { checkout } = useSubscription();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefetch, setPrefetch] = useState<CheckoutResult | null>(null);
  const [prefetching, setPrefetching] = useState(false);
  const prefetchKey = useRef<string>('');

  const priceCents = plan
    ? billingCycle === 'YEARLY'
      ? plan.yearlyPriceCents
      : plan.monthlyPriceCents
    : 0;

  useEffect(() => {
    if (!open || !plan) {
      setPrefetch(null);
      setPrefetching(false);
      prefetchKey.current = '';
      return;
    }
    if (!getAccessToken()) return;

    const key = `${plan.slug}:${billingCycle}`;
    if (prefetchKey.current === key) return;
    prefetchKey.current = key;
    setPrefetch(null);
    setPrefetching(true);
    setError(null);

    let cancelled = false;
    void checkout(plan.slug, billingCycle)
      .then((result) => {
        if (cancelled) return;
        setPrefetch(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(parseApiError(err));
        prefetchKey.current = '';
      })
      .finally(() => {
        if (!cancelled) setPrefetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, plan, billingCycle, checkout]);

  async function pay() {
    if (!plan) return;
    if (!getAccessToken()) {
      router.push(`/login?next=${encodeURIComponent('/pricing')}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result =
        prefetch && prefetch.planSlug === plan.slug && prefetch.billingCycle === billingCycle
          ? prefetch
          : await checkout(plan.slug, billingCycle);
      const url = result.waylUrl || result.checkoutPath;
      if (!url) throw new Error(t('billing.paymentNotFound'));
      window.location.href = url.startsWith('http') ? url : url;
    } catch (err) {
      setError(parseApiError(err));
      setBusy(false);
    }
  }

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('billing.payWithWayl')}</DialogTitle>
          <DialogDescription>{t('billing.completePaymentSubtitle')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-sm font-medium text-muted-foreground">{t('billing.selectedPlan')}</p>
            <p className="mt-1 text-lg font-semibold">{plan.name}</p>
            <p className="mt-2 text-2xl font-bold">{formatPrice(priceCents, plan.currency)}</p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="checkout-billing-cycle">{t('billing.yearlyBilling')}</Label>
              <p className="text-xs text-muted-foreground">{t('billing.yearlyBillingHint')}</p>
            </div>
            <Switch
              id="checkout-billing-cycle"
              checked={billingCycle === 'YEARLY'}
              onCheckedChange={(checked) => onBillingCycleChange(checked ? 'YEARLY' : 'MONTHLY')}
              disabled={busy || prefetching}
            />
          </div>

          {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}
        </div>

        <DialogFooter className="gap-2 sm:flex-col sm:space-x-0">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => void pay()} disabled={busy || (prefetching && !prefetch)}>
            {busy || prefetching ? t('billing.redirectingPay') : t('billing.subscribeNow')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
