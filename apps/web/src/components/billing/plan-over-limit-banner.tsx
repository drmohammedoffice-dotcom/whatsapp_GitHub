'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useSubscriptionOptional } from '@/components/providers/subscription-provider';
import { useTranslation } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { useIsMobileApp } from '@/lib/use-is-mobile-app';

export function PlanOverLimitBanner() {
  const { t } = useTranslation();
  const subscription = useSubscriptionOptional();
  const isMobileApp = useIsMobileApp();
  const over = subscription?.status?.overLimit;
  if (!over) return null;
  const exceeded = Object.values(over).some(Boolean);
  if (!exceeded || !subscription?.status?.isActive) return null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium">{t('billing.overLimitTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('billing.overLimitBody')}</p>
          </div>
        </div>
        {!isMobileApp && (
          <Button asChild size="sm" variant="outline">
            <Link href="/pricing?upgrade=1">{t('billing.upgradeViaWhatsApp')}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
