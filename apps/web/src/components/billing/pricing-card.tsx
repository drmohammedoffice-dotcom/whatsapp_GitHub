'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useTranslation } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { BillingCycle, BillingPlan } from '@/lib/billing';
import { formatPrice, planButtonKey } from '@/lib/billing';
import { cn } from '@/lib/utils';

type PricingCardProps = {
  plan: BillingPlan;
  billingCycle: BillingCycle;
  index: number;
  onSelect: (plan: BillingPlan) => void;
};

export function PricingCard({ plan, billingCycle, index, onSelect }: PricingCardProps) {
  const { t, locale } = useTranslation();
  const priceCents = billingCycle === 'YEARLY' ? plan.yearlyPriceCents : plan.monthlyPriceCents;
  const periodLabel = billingCycle === 'YEARLY' ? t('billing.perYear') : t('billing.perMonth');
  const title = locale === 'ar' ? plan.nameAr ?? plan.name : plan.nameEn ?? plan.name;
  const description = locale === 'ar' ? plan.descriptionAr ?? plan.description : plan.descriptionEn ?? plan.description;
  const featureLines = locale === 'ar' ? plan.featuresAr ?? plan.features : plan.features;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.1 }}
      whileHover={{ y: -6 }}
      className="h-full"
    >
      <Card
        className={cn(
          'relative flex h-full flex-col overflow-hidden border bg-card/80 backdrop-blur-sm transition-shadow duration-300 hover:shadow-xl',
          plan.popular && 'border-primary shadow-lg ring-1 ring-primary/20',
        )}
      >
        {plan.popular && (
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-primary to-cyan-400" />
        )}
        <CardHeader className="space-y-4 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-xl">{title}</CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
            {plan.popular && (
              <Badge className="shrink-0 bg-primary/10 text-primary hover:bg-primary/10">{t('billing.mostPopular')}</Badge>
            )}
          </div>
          <div>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold tracking-tight">{formatPrice(priceCents, plan.currency)}</span>
              <span className="mb-1 text-sm text-muted-foreground">{periodLabel}</span>
            </div>
            {billingCycle === 'YEARLY' && (
              <p className="mt-1 text-xs text-emerald-600">{t('billing.yearlyDiscount')}</p>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <ul className="space-y-3">
            {(Array.isArray(featureLines) ? featureLines : []).map((feature) => {
              const excluded = feature.startsWith('✕');
              return (
                <li key={feature} className={`flex items-start gap-2.5 text-sm ${excluded ? 'text-muted-foreground' : ''}`}>
                  {excluded ? (
                    <span className="mt-0.5 h-4 w-4 shrink-0 text-center">✕</span>
                  ) : (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  )}
                  <span>{feature.replace(/^[✓✕]\s*/, '')}</span>
                </li>
              );
            })}
          </ul>
        </CardContent>
        <CardFooter>
          <Button
            className={cn('w-full', plan.popular && 'bg-primary shadow-md hover:bg-primary/90')}
            variant={plan.popular ? 'default' : 'outline'}
            onClick={() => onSelect(plan)}
          >
            {t(planButtonKey(plan.slug))}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
