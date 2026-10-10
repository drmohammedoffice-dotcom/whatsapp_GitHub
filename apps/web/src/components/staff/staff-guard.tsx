'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { clearAdminToken, fetchAdminMe, getAdminToken } from '@/lib/admin-api';

export function StaffGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      if (pathname !== '/staff/login') router.replace('/staff/login');
      setReady(pathname === '/staff/login');
      return;
    }
    fetchAdminMe()
      .then((me) => {
        if (me.role !== 'STAFF') {
          clearAdminToken();
          router.replace('/staff/login');
          setReady(true);
          return;
        }
        setReady(true);
      })
      .catch(() => {
        clearAdminToken();
        setReady(true);
        router.replace('/staff/login');
      });
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading staff portal...</span>
      </div>
    );
  }

  return <>{children}</>;
}
