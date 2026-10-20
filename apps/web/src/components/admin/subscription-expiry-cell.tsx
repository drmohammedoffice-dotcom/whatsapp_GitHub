'use client';

import { CalendarClock, Pencil } from 'lucide-react';
import { useTranslation } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { formatAdminDate, subscriptionDaysLeft, subscriptionExpiryState } from '@/lib/admin-subscription-utils';
import { cn } from '@/lib/utils';

type SubscriptionExpiryCellProps = {
  endDate: string | null | undefined;
  onEdit?: () => void;
  showDaysLeft?: boolean;
};

export function SubscriptionExpiryCell({ endDate, onEdit, showDaysLeft = true }: SubscriptionExpiryCellProps) {
  const { t, locale } = useTranslation();
  const state = subscriptionExpiryState(endDate);
  const days = subscriptionDaysLeft(endDate);

  if (!endDate) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('admin.subscription.notSet')}</span>
        {onEdit && (
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Set expiry date" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span
            className={cn(
              'text-sm font-medium',
              state === 'expired' && 'text-destructive',
              state === 'expiring' && 'text-amber-600 dark:text-amber-400',
            )}
          >
            {formatAdminDate(endDate, locale)}
          </span>
        </div>
        {showDaysLeft && days !== null && (
          <p
            className={cn(
              'mt-0.5 text-[11px]',
              state === 'expired' ? 'text-destructive' : state === 'expiring' ? 'text-amber-600' : 'text-muted-foreground',
            )}
          >
            {days < 0
              ? t('admin.subscription.expiredDaysAgo').replace('{days}', String(Math.abs(days)))
              : t('admin.subscription.daysLeft').replace('{days}', String(days))}
          </p>
        )}
      </div>
      {onEdit && (
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Edit expiry date" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
