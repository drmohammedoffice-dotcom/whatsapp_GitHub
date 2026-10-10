'use client';

import { cn } from '@/lib/utils';
import type { IntegrationProvider } from '@/lib/integrations-hub';

const brandStyles: Record<
  IntegrationProvider,
  { bg: string; ring: string; label: string }
> = {
  'facebook-messenger': {
    bg: 'bg-[#1877F2]',
    ring: 'ring-[#1877F2]/20',
    label: 'Messenger',
  },
  instagram: {
    bg: 'bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCAF45]',
    ring: 'ring-pink-500/20',
    label: 'Instagram',
  },
  whatsapp: {
    bg: 'bg-[#25D366]',
    ring: 'ring-emerald-500/20',
    label: 'WA',
  },
  tiktok: {
    bg: 'bg-black dark:bg-zinc-900',
    ring: 'ring-zinc-500/20',
    label: 'TT',
  },
  telegram: {
    bg: 'bg-[#229ED9]',
    ring: 'ring-sky-500/20',
    label: 'TG',
  },
};

export function ProviderLogo({
  provider,
  className,
  size = 'md',
}: {
  provider: IntegrationProvider;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const style = brandStyles[provider];
  const sizeClass =
    size === 'sm' ? 'h-10 w-10 text-xs' : size === 'lg' ? 'h-14 w-14 text-base' : 'h-12 w-12 text-sm';

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-2xl font-bold text-white shadow-soft ring-4',
        style.bg,
        style.ring,
        sizeClass,
        className,
      )}
      aria-hidden
    >
      {style.label}
    </div>
  );
}
