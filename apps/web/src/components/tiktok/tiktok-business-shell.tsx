'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { Share2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useTranslation } from '@/components/providers/locale-provider';
import { cn } from '@/lib/utils';
import { tiktokBusinessNavItems } from '@/lib/tiktok-business';

export function TikTokBusinessShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <AppShell>
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-56">
          <div className="mb-4 flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{t('tiktokBusiness.title')}</h2>
          </div>
          <nav className="flex flex-row flex-wrap gap-1 lg:flex-col">
            {tiktokBusinessNavItems.map((item) => {
              const active =
                item.href === '/tiktok/business'
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-primary/10 font-medium text-primary'
                      : item.href.startsWith('/tiktok/integration')
                        ? 'font-medium text-primary/80 hover:bg-primary/5 hover:text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 hidden border-t pt-4 lg:block">
            <Link
              href="/tiktok"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t('tiktokBusiness.trackingLink')}
            </Link>
          </div>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </AppShell>
  );
}
