'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChannelBrandIcon, type BrandKey } from '@/components/channels/channel-brand-icon';
import { useTranslation } from '@/components/providers/locale-provider';
import { cn } from '@/lib/utils';

const railItems: Array<{ slug: BrandKey; href: string; labelKey: string; featured?: boolean }> = [
  { slug: 'whatsapp', href: '/inbox/whatsapp', labelKey: 'nav.whatsapp', featured: true },
];

export function InboxChannelRail({ activeSlug }: { activeSlug?: string }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <aside className="flex w-[68px] shrink-0 flex-col items-center gap-1.5 border-e border-border/70 bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--muted)/0.35)_100%)] py-3 xl:w-[92px]">
      <p className="mb-1 hidden px-1 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground xl:block">
        {t('inbox.channelsRail')}
      </p>
      <nav className="flex w-full flex-col items-center gap-1.5 px-1.5">
        {railItems.map((item) => {
          const active =
            activeSlug === item.slug ||
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={t(item.labelKey)}
              className={cn(
                'group flex w-full flex-col items-center gap-1 rounded-2xl px-1 py-2 transition-all duration-200',
                active
                  ? 'bg-background shadow-soft ring-1 ring-border'
                  : 'hover:bg-background/70',
                item.featured && 'mb-1',
              )}
            >
              <ChannelBrandIcon
                brand={item.slug}
                size={item.featured ? 'lg' : 'md'}
                featured={Boolean(item.featured)}
                className={cn(!active && !item.featured && 'opacity-90 grayscale-[0.15]')}
              />
              <span
                className={cn(
                  'hidden max-w-full truncate text-[10px] font-semibold xl:block',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
