'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { navGroups } from '@/components/layout/nav-config';
import { useTranslation } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { t, dir } = useTranslation();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-full flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300',
          collapsed ? 'w-[72px]' : 'w-[260px]',
        )}
      >
        <div className={cn('flex h-16 shrink-0 items-center border-b border-sidebar-border px-4', collapsed ? 'justify-center' : '')}>
          <Link href="/inbox/whatsapp" className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageSquare className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div>
                <p className="text-sm font-bold leading-none">Watsapp</p>
                <p className="text-[10px] text-muted-foreground">{t('auth.platformTagline')}</p>
              </div>
            )}
          </Link>
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-5">
            {navGroups.map((group) => (
              <div key={group.labelKey}>
                {!collapsed && (
                  <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t(group.labelKey)}
                  </p>
                )}
                <div className="grid gap-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const label = t(item.labelKey);
                    const link = (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                          active
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-soft'
                            : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                          collapsed && 'justify-center px-2',
                        )}
                      >
                        <Icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
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
                          <motion.div
                            layoutId="sidebar-active"
                            className="absolute inset-y-1 start-0 w-1 rounded-full bg-primary"
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                          />
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

        <div className="shrink-0 border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'default'}
            className={cn('w-full', collapsed && 'h-10 w-10')}
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
