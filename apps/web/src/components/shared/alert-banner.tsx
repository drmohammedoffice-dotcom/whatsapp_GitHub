import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function AlertBanner({
  variant = 'error',
  message,
  children,
  onDismiss,
  className,
}: {
  variant?: 'error' | 'success' | 'info' | 'warning';
  message?: string;
  children?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const styles = {
    error: 'border-destructive/30 bg-destructive/10 text-destructive',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    info: 'border-primary/30 bg-primary/10 text-primary',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  };

  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm', styles[variant], className)} role="alert">
      {variant === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="flex-1">{children ?? message}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
