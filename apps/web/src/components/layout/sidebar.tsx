'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ChatLooraLogoMark } from '@/components/brand/chatloora-brand';
import { ChannelBrandIcon } from '@/components/channels/channel-brand-icon';
import { isNavActive, visibleNavGroups } from '@/components/layout/nav-config';
import { useTranslation } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobileApp } from '@/lib/use-is-mobile-app';
import { cn } from '@/lib/utils';

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { t, dir } = useTranslation();
  const isMobileApp = useIsMobileApp();
  const groups = visibleNavGroups({ mobileApp: isMobileApp });

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-full w-full flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
          collapsed ? 'lg:w-[72px]' : 'lg:w-[268px]',
        )}
      >
        <div className={cn('flex h-16 shrink-0 items-center border-b border-sidebar-border px-4', collapsed ? 'justify-center' : '')}>
          <Link href="/tiktok/ads/create" prefetch className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
            <ChatLooraLogoMark size={40} />
            {!collapsed && (
              <div>
                <p className="text-sm font-bold leading-none tracking-tight">ChatLoora</p>
                <p className="text-[10px] text-sidebar-foreground/60">{t('auth.platformTagline')}</p>
              </div>
            )}
          </Link>
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-5">
            {groups.map((group) => (
              <div key={group.labelKey}>
                {!collapsed && (
                  <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
                    {t(group.labelKey)}
                  </p>
                )}
                <div className="grid gap-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isNavActive(pathname, item.href);
                    const label = t(item.labelKey);
                    const link = (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch
                        className={cn(
                          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                          active
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-soft'
                            : 'text-sidebar-foreground/75 hover:bg-white/10 hover:text-sidebar-foreground',
                          item.featured && !active && 'bg-white/8',
                          collapsed && 'justify-center px-2',
                        )}
                      >
                        {item.brand ? (
                          <ChannelBrandIcon
                            brand={item.brand}
                            size="sm"
                            featured={item.featured}
                            className="rounded-xl ring-2"
                          />
                        ) : Icon ? (
                          <Icon className={cn('h-4 w-4 shrink-0', active && 'text-white')} />
                        ) : null}
                        {!collapsed && (
                          <>
                            <span className="flex-1">{label}</span>
                            {item.badgeKey && (
                              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                {t(item.badgeKey)}
                              </Badge>
                            )}
                          </>
                        )}
                        {active && !collapsed && (
                          <span className="absolute inset-y-1 start-0 w-1 rounded-full bg-white" />
                        )}
                      </Link>
                    );

                    if (collapsed) {
                      return (
                        <Tooltip key={item.href}>
                          <TooltipTrigger asChild>{link}</TooltipTrigger>
                          <TooltipContent side={dir === 'rtl' ? 'left' : 'right'}>{label}</TooltipContent>
                        </Tooltip>
                      );
                    }
                    return link;
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        <div className="hidden shrink-0 border-t border-sidebar-border p-3 lg:block">
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'default'}
            className={cn('w-full text-sidebar-foreground/80 hover:bg-white/10 hover:text-sidebar-foreground', collapsed && 'h-10 w-10')}
            onClick={onToggle}
          >
            {collapsed ? (
              dir === 'rtl' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                {dir === 'rtl' ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                {t('common.collapse')}
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
