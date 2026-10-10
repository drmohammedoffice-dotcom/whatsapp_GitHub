'use client';

import { useEffect, useState } from 'react';
import { CheckoutModal } from '@/components/billing/checkout-modal';
import { PricingCard } from '@/components/billing/pricing-card';
import { useTranslation } from '@/components/providers/locale-provider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { BillingCycle, BillingPlan } from '@/lib/billing';
import { fetchPublicPlans } from '@/lib/billing';

export function LandingPricingSection() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    void fetchPublicPlans()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || plans.length === 0) {
    return null;
  }

  return (
    <section className="mt-20">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">{t('home.pricingTitle')}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">{t('home.pricingSubtitle')}</p>

        <div className="mt-6 inline-flex items-center gap-3 rounded-full border bg-background/80 px-4 py-2 shadow-sm backdrop-blur">
          <Label htmlFor="landing-billing-cycle" className={billingCycle === 'MONTHLY' ? 'font-semibold' : 'text-muted-foreground'}>
            {t('billing.monthly')}
          </Label>
          <Switch
            id="landing-billing-cycle"
            checked={billingCycle === 'YEARLY'}
            onCheckedChange={(checked) => setBillingCycle(checked ? 'YEARLY' : 'MONTHLY')}
          />
          <Label htmlFor="landing-billing-cycle" className={billingCycle === 'YEARLY' ? 'font-semibold' : 'text-muted-foreground'}>
            {t('billing.yearly')}
          </Label>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
            {t('billing.save20')}
          </span>
        </div>
      </div>

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

      <CheckoutModal
        plan={selectedPlan}
        billingCycle={billingCycle}
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        onBillingCycleChange={setBillingCycle}
      />
    </section>
  );
}
