'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { IntegrationConnectionStatus, IntegrationHealth } from '@/lib/integrations-hub';

const statusVariant: Record<
  IntegrationConnectionStatus,
  'success' | 'secondary' | 'destructive' | 'warning' | 'outline'
> = {
  connected: 'success',
  disconnected: 'secondary',
  expired: 'destructive',
  reconnect_required: 'warning',
  syncing: 'outline',
  error: 'destructive',
};

const healthVariant: Record<
  IntegrationHealth,
  'success' | 'secondary' | 'destructive' | 'warning' | 'outline'
> = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'destructive',
  unknown: 'secondary',
};

export function IntegrationStatusBadge({
  status,
  label,
  className,
}: {
  status: IntegrationConnectionStatus;
  label: string;
  className?: string;
}) {
  return (
    <Badge variant={statusVariant[status]} className={cn('font-medium', className)}>
      {label}
    </Badge>
  );
}

export function IntegrationHealthBadge({
  health,
  label,
  className,
}: {
  health: IntegrationHealth;
  label: string;
  className?: string;
}) {
  return (
    <Badge variant={healthVariant[health]} className={cn('font-medium', className)}>
      {label}
    </Badge>
  );
}
