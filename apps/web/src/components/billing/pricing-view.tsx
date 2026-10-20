'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { CheckoutModal } from '@/components/billing/checkout-modal';
import { PricingCard } from '@/components/billing/pricing-card';
import { useSubscription } from '@/components/providers/subscription-provider';
import { useTranslation } from '@/components/providers/locale-provider';
import { LoadingBlock } from '@/components/shared/loading-block';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { BillingCycle, BillingPlan } from '@/lib/billing';
import { fetchPublicPlans } from '@/lib/billing';
import { getAccessToken } from '@/lib/utils';

export function PricingView() {
  const { t, locale } = useTranslation();
  const { loading: subscriptionLoading } = useSubscription();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const isLoggedIn = !!getAccessToken();

  useEffect(() => {
    void fetchPublicPlans()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setLoadingPlans(false));
  }, []);

  const loading = loadingPlans || (isLoggedIn && subscriptionLoading);
  if (loading) {
    return <LoadingBlock label={t('billing.loadingPlans')} className="min-h-[50vh]" />;
  }

  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-violet-500/10 via-background to-cyan-400/10" />
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

      <div className="mx-auto max-w-6xl space-y-10 py-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('billing.title')}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{t('billing.subtitle')}</p>

          <div className="mt-8 inline-flex items-center gap-3 rounded-full border bg-background/80 px-4 py-2 shadow-sm backdrop-blur">
            <Label htmlFor="billing-cycle" className={billingCycle === 'MONTHLY' ? 'font-semibold' : 'text-muted-foreground'}>
              {t('billing.monthly')}
            </Label>
            <Switch
              id="billing-cycle"
              checked={billingCycle === 'YEARLY'}
              onCheckedChange={(checked) => setBillingCycle(checked ? 'YEARLY' : 'MONTHLY')}
            />
            <Label htmlFor="billing-cycle" className={billingCycle === 'YEARLY' ? 'font-semibold' : 'text-muted-foreground'}>
              {t('billing.yearly')}
            </Label>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
              {t('billing.save20')}
            </span>
          </div>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan, index) => (
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

        {plans.length > 1 && plans[0]?.comparison && (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-start font-semibold">{t('billing.comparePlans')}</th>
                  {plans.map((plan) => (
                    <th key={plan.id} className="px-4 py-3 text-start font-semibold">
                      {locale === 'ar' ? plan.nameAr ?? plan.name : plan.nameEn ?? plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(plans[0].comparison ?? []).map((row, rowIndex) => (
                  <tr key={row.key} className={rowIndex % 2 ? 'bg-muted/20' : ''}>
                    <td className="px-4 py-2 font-medium">{locale === 'ar' ? row.nameAr : row.nameEn}</td>
                    {plans.map((plan) => {
                      const cell = plan.comparison?.find((item) => item.key === row.key);
                      let label = t('billing.notIncluded');
                      if (cell?.valueType === 'LIMIT') {
                        if (cell.limit !== null && cell.limit < 0) label = t('billing.unlimited');
                        else if (cell.limit === 0) label = t('billing.notIncluded');
                        else label = String(cell.limit ?? 0);
                      } else if (cell?.enabled) {
                        label = '✓';
                      } else {
                        label = '✕';
                      }
                      return (
                        <td key={`${plan.id}-${row.key}`} className="px-4 py-2">
                          {label}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CheckoutModal
        plan={selectedPlan}
        billingCycle={billingCycle}
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        onBillingCycleChange={setBillingCycle}
      />
    </div>
  );
}
