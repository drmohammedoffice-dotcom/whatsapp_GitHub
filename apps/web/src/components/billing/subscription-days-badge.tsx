'use client';

import { Clock } from 'lucide-react';
import { useTranslation } from '@/components/providers/locale-provider';
import { useSubscription } from '@/components/providers/subscription-provider';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function SubscriptionDaysBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { status, loading } = useSubscription();

  if (loading || !status?.hasSubscription) return null;

  const days = status.daysRemaining;
  if (days === null) return null;

  const expired = !status.isActive || days < 0;
  const warning = !expired && days <= 3;

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-normal',
        expired && 'border-destructive/50 text-destructive',
        warning && 'border-amber-500/50 text-amber-700 dark:text-amber-400',
        className,
      )}
    >
      <Clock className="h-3 w-3" />
      {expired
        ? t('billing.expiredBadge')
        : t('billing.daysRemainingBadge').replace('{days}', String(days))}
    </Badge>
  );
}
