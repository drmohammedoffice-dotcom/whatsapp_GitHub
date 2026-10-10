'use client';

import { ReactNode, useEffect, useState } from 'react';
import { AuthGuard } from '@/components/layout/auth-guard';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { SubscriptionProvider } from '@/components/providers/subscription-provider';
import { SubscriptionWarningModal } from '@/components/billing/subscription-warning-modal';
import { SubscriptionExpiredBlock } from '@/components/billing/subscription-expired-block';
import { PlanOverLimitBanner } from '@/components/billing/plan-over-limit-banner';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored === 'true') setCollapsed(true);
  }, []);

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  }

  return (
    <AuthGuard>
      <SubscriptionProvider>
        {/* قفل ارتفاع الشاشة: الشريط الجانبي ثابت والمحتوى فقط هو الذي يمرّر */}
        <div className="flex h-[100dvh] overflow-hidden bg-[radial-gradient(ellipse_80%_50%_at_0%_-10%,rgba(139,92,246,0.16),transparent),radial-gradient(ellipse_50%_40%_at_100%_0%,rgba(56,189,248,0.12),transparent)] bg-background">
          <div className={cn('hidden h-full shrink-0 lg:flex')}>
            <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <Topbar onToggleSidebar={toggleSidebar} />
            <PlanOverLimitBanner />
            <main className="min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 lg:p-6">
              {children}
            </main>
          </div>
        </div>
        <SubscriptionWarningModal />
        <SubscriptionExpiredBlock />
      </SubscriptionProvider>
    </AuthGuard>
  );
}
