'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useSubscription } from '@/components/providers/subscription-provider';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { LoadingBlock } from '@/components/shared/loading-block';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PaymentDetails, SubscriptionState } from '@/lib/billing';
import { formatPrice } from '@/lib/billing';
import { api, forceRefreshSession, parseApiError } from '@/lib/utils';

function extractPaymentId(searchParams: ReturnType<typeof useSearchParams>): string {
  const href = typeof window !== 'undefined' ? window.location.search : `?${searchParams.toString()}`;
  const fromWayl = href.match(/wa-([a-z0-9]+)/i)?.[1];
  const fromQuery = (searchParams.get('paymentId') ?? '').split(/[/?#&]/)[0];
  const id = fromWayl || fromQuery;
  return /^[a-z0-9]{16,40}$/i.test(id) ? id : fromQuery;
}

function PaymentContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = extractPaymentId(searchParams);
  const { refresh } = useSubscription();
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [status, setStatus] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPayment() {
    if (!paymentId) return;
    const data = await api<PaymentDetails>(`/billing/payments/${paymentId}`);
    setPayment(data);
    if (data.status === 'COMPLETED') {
      await forceRefreshSession();
      await refresh();
      const next = await api<SubscriptionState>('/billing/status');
      setStatus(next);
    }
    return data;
  }

  async function sync() {
    if (!paymentId) return;
    setSyncing(true);
    setError(null);
    try {
      const next = await api<SubscriptionState>(`/billing/payments/${paymentId}/sync`, { method: 'POST', body: '{}' });
      setStatus(next);
      await forceRefreshSession();
      await refresh();
      await loadPayment();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (!paymentId || typeof window === 'undefined') return;
    const expected = `?paymentId=${paymentId}`;
    if (window.location.search !== expected) {
      window.history.replaceState(null, '', `/pricing/payment?paymentId=${encodeURIComponent(paymentId)}`);
    }
  }, [paymentId]);

  useEffect(() => {
    if (!paymentId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    loadPayment()
      .catch(async (err) => {
        if (cancelled) return;
        try {
          const next = await api<SubscriptionState>('/billing/status');
          setStatus(next);
          if (!next.isActive) setError(parseApiError(err));
        } catch {
          setError(parseApiError(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  useEffect(() => {
    if (!paymentId || payment?.status === 'COMPLETED') return;
    const timer = window.setInterval(() => void sync(), 4000);
    void sync();
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId, payment?.status]);

  if (loading) return <LoadingBlock label={t('billing.loadingPayment')} className="min-h-[50vh]" />;

  if (!paymentId || (!payment && !status?.isActive)) {
    return (
      <div className="mx-auto max-w-lg py-12">
        <AlertBanner message={error ?? t('billing.paymentNotFound')} />
        <Button className="mt-4" variant="outline" onClick={() => router.push('/pricing')}>
          {t('billing.backToPricing')}
        </Button>
      </div>
    );
  }

  const paid = payment?.status === 'COMPLETED' || !!status?.isActive;

  if (!payment && paid) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center py-8">
        <Card className="w-full border bg-card/90 shadow-lg">
          <CardHeader>
            <CardTitle>{t('billing.paymentSuccess')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.replace('/tiktok/ads/create')}>
              {t('billing.goToInbox')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!payment) return null;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg items-center py-8">
      <Card className="w-full border bg-card/90 shadow-lg backdrop-blur">
        <CardHeader>
          <CardTitle>{paid ? t('billing.paymentSuccess') : t('billing.completePayment')}</CardTitle>
          <CardDescription>
            {paid ? t('billing.completePaymentSubtitle') : t('billing.waitingPayment')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">{payment.description}</p>
            <p className="mt-2 text-3xl font-bold">{formatPrice(payment.amountCents, payment.currency)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {payment.planName} · {payment.billingCycle === 'YEARLY' ? t('billing.yearly') : t('billing.monthly')}
            </p>
          </div>

          {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => router.push('/pricing')}>
              {t('billing.backToPricing')}
            </Button>
            {paid ? (
              <Button className="flex-1" onClick={() => router.replace('/tiktok/ads/create')}>
                {t('billing.goToInbox')}
              </Button>
            ) : payment.waylUrl ? (
              <Button className="flex-1" onClick={() => { window.location.href = payment.waylUrl!; }} disabled={syncing}>
                {t('billing.payWithWayl')}
              </Button>
            ) : (
              <Button className="flex-1" onClick={() => void sync()} disabled={syncing}>
                {syncing ? t('billing.processing') : t('common.refresh')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentPage() {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<LoadingBlock label={t('billing.loadingPayment')} className="min-h-[50vh]" />}>
      <PaymentContent />
    </Suspense>
  );
}
