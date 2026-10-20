'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { ChatLooraBrand } from '@/components/brand/chatloora-brand';
import { useTranslation } from '@/components/providers/locale-provider';
import { LanguageToggle } from '@/components/shared/language-toggle';
import { Button } from '@/components/ui/button';
import { ADMIN_NAV, clearAdminToken, fetchAdminMe } from '@/lib/admin-api';
import { cn } from '@/lib/utils';

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminMe()
      .then((me) => setRole(me.role))
      .catch(() => setRole(null));
  }, []);

  function logout() {
    clearAdminToken();
    router.replace('/admin/login');
  }

  const nav = ADMIN_NAV.filter((item) => {
    if ('superAdminOnly' in item && item.superAdminOnly) return role === 'SUPER_ADMIN';
    return true;
  });

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-4">
        <ChatLooraBrand href="/admin" size="sm" showTagline tagline={t('admin.tagline')} />
        <LanguageToggle />
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block rounded-md px-3 py-2 text-sm transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
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
          {t('admin.signOut')}
        </Button>
      </div>
    </aside>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden shrink-0 lg:sticky lg:top-0 lg:block lg:h-screen">
        <AdminSidebar />
      </div>
      <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
    </div>
  );
}
