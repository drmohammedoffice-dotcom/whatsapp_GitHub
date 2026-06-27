'use client';

import { motion } from 'framer-motion';
import { ReactNode, useEffect, useState } from 'react';
import { AuthGuard } from '@/components/layout/auth-guard';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
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
      <div className="flex min-h-screen bg-background">
        <div className={cn('hidden shrink-0 lg:sticky lg:top-0 lg:block lg:h-screen')}>
          <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onToggleSidebar={toggleSidebar} />
          <motion.main
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex-1 p-4 lg:p-6"
          >
            {children}
          </motion.main>
        </div>
      </div>
    </AuthGuard>
  );
}
