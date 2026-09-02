'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useSubscription } from '@/components/providers/subscription-provider';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { LoadingBlock } from '@/components/shared/loading-block';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PaymentDetails } from '@/lib/billing';
import { formatPrice } from '@/lib/billing';
import { api, parseApiError } from '@/lib/utils';

function PaymentContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('paymentId');
  const { confirmPayment } = useSubscription();
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api<PaymentDetails>(`/billing/payments/${paymentId}`)
      .then((data) => {
        if (!cancelled) setPayment(data);
      })
      .catch((err) => {
        if (!cancelled) setError(parseApiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  async function handlePay() {
    if (!paymentId) return;
    setPaying(true);
    setError(null);
    try {
      // If Wayl provides a hosted checkout URL, redirect the customer there
      if (payment?.waylUrl) {
        window.location.href = payment.waylUrl;
        return;
      }
      await confirmPayment(paymentId);
      router.replace('/dashboard');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setPaying(false);
    }
  }

  if (loading) return <LoadingBlock label={t('billing.loadingPayment')} className="min-h-[50vh]" />;

  if (!paymentId || !payment) {
    return (
      <div className="mx-auto max-w-lg py-12">
        <AlertBanner message={error ?? t('billing.paymentNotFound')} />
        <Button className="mt-4" variant="outline" onClick={() => router.push('/pricing')}>
          {t('billing.backToPricing')}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg items-center py-8">
      <Card className="w-full border bg-card/90 shadow-lg backdrop-blur">
        <CardHeader>
          <CardTitle>{t('billing.completePayment')}</CardTitle>
          <CardDescription>{t('billing.completePaymentSubtitle')}</CardDescription>
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
            <Button variant="outline" className="flex-1" onClick={() => router.push('/pricing')} disabled={paying}>
              {t('common.back')}
            </Button>
            <Button className="flex-1" onClick={handlePay} disabled={paying || payment.status === 'COMPLETED'}>
              {paying ? t('billing.processing') : t('billing.payNow')}
            </Button>
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
