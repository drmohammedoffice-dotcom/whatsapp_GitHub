'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { Target } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { cn } from '@/lib/utils';
import { tiktokIntegrationNavItems } from '@/lib/tiktok-integration';

export function TikTokIntegrationShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <AppShell>
      <div className="flex min-h-0 flex-col gap-4 lg:flex-row lg:gap-6">
        <aside className="w-full shrink-0 lg:sticky lg:top-0 lg:w-56 lg:self-start">
          <div className="mb-3 flex items-center gap-2 lg:mb-4">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold sm:text-lg">{t('tiktokIntegration.title')}</h2>
          </div>
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
            {tiktokIntegrationNavItems.map((item) => {
              const active =
                item.href === '/tiktok/integration'
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </AppShell>
  );
}
