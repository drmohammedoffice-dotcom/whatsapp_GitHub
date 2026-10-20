'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { CheckoutModal } from '@/components/billing/checkout-modal';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PricingCard } from '@/components/billing/pricing-card';
import { useSubscription } from '@/components/providers/subscription-provider';
import { useTranslation } from '@/components/providers/locale-provider';
import { LoadingBlock } from '@/components/shared/loading-block';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { BillingCycle, BillingPlan } from '@/lib/billing';
import { fetchPublicPlans, formatPrice } from '@/lib/billing';

export default function PlansPage() {
  return (
    <AppShell>
      <PlansInner />
    </AppShell>
  );
}

function PlansInner() {
  const { t, locale } = useTranslation();
  const { status, loading: subscriptionLoading } = useSubscription();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    void fetchPublicPlans()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setLoadingPlans(false));
  }, []);

  const current = useMemo(
    () => plans.find((plan) => plan.slug === status?.planSlug) ?? null,
    [plans, status?.planSlug],
  );
  const upgrades = useMemo(
    () => plans.filter((plan) => plan.slug !== status?.planSlug),
    [plans, status?.planSlug],
  );
  const remaining = status?.daysRemaining != null && status.daysRemaining > 0 ? status.daysRemaining : 0;

  if (loadingPlans || subscriptionLoading) {
    return <LoadingBlock label={t('billing.loadingPlans')} className="min-h-[50vh]" />;
  }

  const currentTitle = current
    ? locale === 'ar'
      ? current.nameAr ?? current.name
      : current.nameEn ?? current.name
    : status?.planName ?? '—';
  const currentDesc = current
    ? locale === 'ar'
      ? current.descriptionAr ?? current.description
      : current.descriptionEn ?? current.description
    : t('billing.currentPlanHint');
  const currentPrice = current
    ? formatPrice(billingCycle === 'YEARLY' ? current.yearlyPriceCents : current.monthlyPriceCents, current.currency)
    : null;
  const features = current
    ? locale === 'ar'
      ? current.featuresAr ?? current.features
      : current.features
    : [];

  return (
    <>
      <PageHeader title={t('nav.plans')} description={t('nav.plansDesc')} />

      {status?.freeTrialEnded && (
        <AlertBanner variant="error" className="mt-6" message={t('billing.trialEndedBody')} />
      )}
      {status?.isFreeTrial && status.trialEndsAt && (
        <AlertBanner
          variant="info"
          className="mt-6"
          message={t('billing.trialActiveBody').replace(
            '{date}',
            new Date(status.trialEndsAt).toLocaleString(locale === 'ar' ? 'ar-IQ' : undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
          )}
        />
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-card to-emerald-500/5 shadow-card">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t('billing.currentPlan')}</p>
              <CardTitle className="mt-1 text-2xl">{currentTitle}</CardTitle>
              <CardDescription className="mt-2 max-w-2xl">{currentDesc}</CardDescription>
            </div>
            <Badge className="w-fit bg-primary text-primary-foreground">{t('billing.currentPlanBadge')}</Badge>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {currentPrice && (
              <div className="rounded-2xl border bg-background/80 p-4">
                <p className="text-xs text-muted-foreground">{t('billing.selectedPlan')}</p>
                <p className="mt-1 text-xl font-bold">
                  {currentPrice}
                  <span className="ms-1 text-sm font-normal text-muted-foreground">
                    {billingCycle === 'YEARLY' ? t('billing.perYear') : t('billing.perMonth')}
                  </span>
                </p>
              </div>
            )}
            <div className="rounded-2xl border bg-background/80 p-4">
              <p className="text-xs text-muted-foreground">{t('billing.daysRemainingBadge').replace('{days}', String(remaining))}</p>
              <p className="mt-1 text-xl font-bold">{remaining}</p>
            </div>
            {remaining > 0 && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:col-span-2 lg:col-span-1">
                <p className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('billing.remainingDaysCarry').replace('{days}', String(remaining))}
                </p>
              </div>
            )}
            {Array.isArray(features) && features.length > 0 && (
              <ul className="grid gap-2 sm:col-span-2 lg:col-span-3 sm:grid-cols-2">
                {features.slice(0, 8).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{feature.replace(/^[✓✕]\s*/, '')}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="mt-10 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{t('billing.upgradePlans')}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('billing.upgradePlansHint')}</p>
          </div>
          <div className="inline-flex items-center gap-3 rounded-full border bg-background px-4 py-2 shadow-sm">
            <Label className={billingCycle === 'MONTHLY' ? 'font-semibold' : 'text-muted-foreground'}>{t('billing.monthly')}</Label>
            <Switch checked={billingCycle === 'YEARLY'} onCheckedChange={(checked) => setBillingCycle(checked ? 'YEARLY' : 'MONTHLY')} />
            <Label className={billingCycle === 'YEARLY' ? 'font-semibold' : 'text-muted-foreground'}>{t('billing.yearly')}</Label>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {upgrades.map((plan, index) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              billingCycle={billingCycle}
              index={index}
              onSelect={(p) => {
                setSelectedPlan(p);
                setCheckoutOpen(true);
              }}
            />
          ))}
        </div>
      </div>

      <CheckoutModal
        plan={selectedPlan}
        billingCycle={billingCycle}
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        onBillingCycleChange={setBillingCycle}
      />
    </>
  );
}
