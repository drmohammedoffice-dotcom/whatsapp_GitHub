import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LoadingBlock({ label = 'Loading...', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground', className)}>
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
