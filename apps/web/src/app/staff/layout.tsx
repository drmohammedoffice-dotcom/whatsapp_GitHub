'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { StaffGuard } from '@/components/staff/staff-guard';
import { StaffShell } from '@/components/staff/staff-shell';

export default function StaffLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/staff/login';

  if (isLogin) return <>{children}</>;

  return (
    <StaffGuard>
      <StaffShell>{children}</StaffShell>
    </StaffGuard>
  );
}
