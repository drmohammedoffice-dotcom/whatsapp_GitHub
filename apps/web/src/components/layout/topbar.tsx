'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, ChevronRight, LogOut, Menu, Moon, Sun } from 'lucide-react';
import { getNavItem } from '@/components/layout/nav-config';
import { useTranslation } from '@/components/providers/locale-provider';
import { LanguageToggle } from '@/components/shared/language-toggle';
import { useTheme } from '@/components/providers/theme-provider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { API_URL, clearSession, cn, getRefreshToken } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Sidebar } from '@/components/layout/sidebar';

async function logout() {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      /* ignore */
    }
  }
  clearSession();
  window.location.href = '/login';
}

export function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const { t, dir } = useTranslation();
  const pathname = usePathname();
  const current = getNavItem(pathname);

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur-md lg:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side={dir === 'rtl' ? 'right' : 'left'} className="w-[280px] p-0">
          <Sidebar collapsed={false} onToggle={onToggleSidebar} />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/inbox/whatsapp" className="hidden hover:text-foreground sm:inline">
            {t('common.workspace')}
          </Link>
          <ChevronRight className={cn('hidden h-3.5 w-3.5 sm:inline', dir === 'rtl' && 'rotate-180')} />
          <span className="truncate font-semibold text-foreground">
            {current ? t(current.labelKey) : t('common.dashboard')}
          </span>
        </nav>
        {current && (
          <p className="hidden truncate text-xs text-muted-foreground sm:block">{t(current.descKey)}</p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <LanguageToggle />

        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings" aria-label={t('common.notifications')}>
            <span className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />
            </span>
          </Link>
        </Button>

        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={t('common.toggleTheme')}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">WS</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{t('common.myAccount')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">{t('nav.settings')}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/whatsapp">{t('nav.whatsapp')}</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => void logout()}
            >
              <LogOut className="me-2 h-4 w-4" />
              {t('common.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
