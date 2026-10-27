'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useTranslation } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { PlanFeature } from '@/lib/plan-limits';
import { MOBILE_APP_UNAVAILABLE_MESSAGE } from '@/lib/app-mode';
import { useIsMobileApp } from '@/lib/use-is-mobile-app';

type PlanUpgradeDialogProps = {
  feature: PlanFeature;
  title?: string;
  description?: string;
};

const TITLE_KEYS: Record<PlanFeature, string> = {
  tracking_phone: 'billing.upgradeTrackingTitle',
  whatsapp: 'billing.upgradeLimitTitle',
  whatsapp_api: 'billing.upgradeLockedTitle',
  tiktok: 'billing.upgradeLockedTitle',
  tiktok_pixel: 'billing.upgradeLimitTitle',
  instant_forms: 'billing.upgradeLockedTitle',
  online_store: 'billing.upgradeLockedTitle',
};

const BODY_KEYS: Record<PlanFeature, string> = {
  tracking_phone: 'billing.upgradeTrackingBody',
  whatsapp: 'billing.upgradeLimitBody',
  whatsapp_api: 'billing.upgradeLockedBody',
  tiktok: 'billing.upgradeLockedBody',
  tiktok_pixel: 'billing.upgradeLimitBody',
  instant_forms: 'billing.upgradeLockedBody',
  online_store: 'billing.upgradeLockedBody',
};

export function PlanUpgradeDialog({ feature, title, description }: PlanUpgradeDialogProps) {
  const { t, locale } = useTranslation();
  const isMobileApp = useIsMobileApp();

  if (isMobileApp) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Card className="w-full max-w-md border-primary/20 shadow-lg">
          <CardContent className="flex flex-col items-center gap-4 pt-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">{MOBILE_APP_UNAVAILABLE_MESSAGE[locale === 'ar' ? 'ar' : 'en']}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/20 shadow-lg">
        <CardContent className="flex flex-col items-center gap-4 pt-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{title ?? t(TITLE_KEYS[feature])}</h2>
            <p className="text-sm text-muted-foreground">{description ?? t(BODY_KEYS[feature])}</p>
          </div>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/plans?upgrade=1">{t('billing.upgradeViaWhatsApp')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
