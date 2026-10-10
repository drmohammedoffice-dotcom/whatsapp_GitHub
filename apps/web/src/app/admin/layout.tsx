'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AdminGuard } from '@/components/admin/admin-guard';
import { AdminShell } from '@/components/admin/admin-shell';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/admin/login';

  if (isLogin) return <>{children}</>;

  return (
    <AdminGuard>
      <AdminShell>{children}</AdminShell>
    </AdminGuard>
  );
}
