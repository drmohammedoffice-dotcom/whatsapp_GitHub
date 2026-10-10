'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { ReactNode } from 'react';
import { ChatLooraBrand } from '@/components/brand/chatloora-brand';
import { useTranslation } from '@/components/providers/locale-provider';
import { LanguageToggle } from '@/components/shared/language-toggle';
import { Button } from '@/components/ui/button';
import { STAFF_NAV, clearAdminToken } from '@/lib/admin-api';
import { cn } from '@/lib/utils';

function StaffSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();

  function logout() {
    clearAdminToken();
    router.replace('/staff/login');
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-4">
        <ChatLooraBrand href="/staff" size="sm" showTagline tagline={t('staff.tagline')} />
        <LanguageToggle />
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {STAFF_NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <Button variant="outline" className="w-full justify-start gap-2" onClick={logout}>
          <LogOut className="h-4 w-4" />
          {t('staff.signOut')}
        </Button>
      </div>
    </aside>
  );
}

export function StaffShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden shrink-0 lg:sticky lg:top-0 lg:block lg:h-screen">
        <StaffSidebar />
      </div>
      <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
    </div>
  );
}
