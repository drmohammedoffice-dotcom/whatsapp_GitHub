'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function SubscriptionRequired() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md border-dashed shadow-none">
        <CardContent className="flex flex-col items-center gap-4 pt-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-2xl">🔒</div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{t('billing.subscriptionRequired')}</h2>
            <p className="text-sm text-muted-foreground">{t('billing.workspaceInactive')}</p>
          </div>
          <Button asChild>
            <Link href="/plans">{t('billing.viewPlans')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
