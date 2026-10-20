'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type ConnectionHealth =
  | 'connected'
  | 'disconnected'
  | 'expired'
  | 'reconnect_required'
  | 'connecting'
  | 'failed';

const variants: Record<ConnectionHealth, 'success' | 'secondary' | 'destructive' | 'warning' | 'outline'> = {
  connected: 'success',
  disconnected: 'secondary',
  expired: 'destructive',
  reconnect_required: 'warning',
  connecting: 'outline',
  failed: 'destructive',
};

const labels: Record<ConnectionHealth, string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  expired: 'Expired',
  reconnect_required: 'Reconnect required',
  connecting: 'Connecting…',
  failed: 'Failed',
};

export function ConnectionStatusBadge({
  health,
  className,
}: {
  health: ConnectionHealth;
  className?: string;
}) {
  return (
    <Badge variant={variants[health]} className={cn('capitalize', className)}>
      {labels[health]}
    </Badge>
  );
}
