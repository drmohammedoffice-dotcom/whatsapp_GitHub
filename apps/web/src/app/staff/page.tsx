'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, Settings2 } from 'lucide-react';
import { SubscriptionManageDialog } from '@/components/admin/subscription-manage-dialog';
import { SubscriptionExpiryCell } from '@/components/admin/subscription-expiry-cell';
import { StaffIdentityBadge } from '@/components/staff/staff-identity-badge';
import { PageHeader } from '@/components/shared/page-header';
import { useTranslation } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  fetchAdminMe,
  fetchAdminPlans,
  fetchAdminUsers,
  type AdminPlanRow,
  type AdminSubscriptionRow,
  type AdminUserRow,
} from '@/lib/admin-api';

function statusVariant(status: string) {
  if (status === 'ACTIVE') return 'success' as const;
  if (status === 'PENDING' || status === 'TRIAL') return 'secondary' as const;
  return 'destructive' as const;
}

export default function StaffSubscribersPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [plans, setPlans] = useState<AdminPlanRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [subTarget, setSubTarget] = useState<{
    teamId: string;
    teamName: string;
    ownerUserId?: string;
    ownerEmail?: string;
    subscription: AdminSubscriptionRow | null;
  } | null>(null);

  const load = useCallback(async (search?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [userData, planData] = await Promise.all([
        fetchAdminUsers({ q: search }),
        fetchAdminPlans(),
      ]);
      setUsers(userData.users);
      setPlans(planData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminMe()
      .then((me) => {
        const roles = me.roles?.length ? me.roles : me.role ? [me.role] : [];
        const onlyMail =
          roles.includes('MAILBOX_CREATOR') &&
          !roles.includes('ACCOUNTANT') &&
          !roles.includes('STAFF');
        if (onlyMail) router.replace('/staff/mail');
      })
      .catch(() => undefined);
  }, [router]);

  useEffect(() => {
    void load(q);
  }, [load, q]);

  function openSubscription(user: AdminUserRow) {
    const membership = user.teamMembers[0];
    if (!membership) {
      window.alert('لا توجد مساحة عمل لهذا المشترك');
      return;
    }
    setSubTarget({
      teamId: membership.team.id,
      teamName: membership.team.name,
      ownerUserId: user.id,
      ownerEmail: user.email,
      subscription: (membership.team.subscription as AdminSubscriptionRow | null | undefined) ?? null,
    });
    setSubDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('staff.pageTitle')}
        description={t('staff.pageSubtitle')}
        actions={<StaffIdentityBadge />}
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground rtl:left-auto rtl:right-3" />
        <Input
          className="pl-9 rtl:pl-3 rtl:pr-9"
          placeholder="بحث بالاسم أو الإيميل..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead>الإيميل</TableHead>
              <TableHead>الباقة</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>الانتهاء</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const sub = user.teamMembers[0]?.team?.subscription as AdminSubscriptionRow | null | undefined;
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{sub?.plan?.nameAr || sub?.plan?.name || '—'}</TableCell>
                  <TableCell>
                    {sub ? (
                      <Badge variant={statusVariant(sub.status)}>{sub.status}</Badge>
                    ) : (
                      <Badge variant="secondary">بدون باقة</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {sub ? <SubscriptionExpiryCell endDate={sub.currentPeriodEnd} /> : '—'}
                  </TableCell>
                  <TableCell className="text-end">
                    <Button size="sm" variant="outline" onClick={() => openSubscription(user)}>
                      <Settings2 className="mr-1 h-4 w-4" />
                      إدارة الباقة
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!users.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  لا يوجد مشتركون
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {subTarget && (
        <SubscriptionManageDialog
          open={subDialogOpen}
          onOpenChange={setSubDialogOpen}
          plans={plans}
          teamId={subTarget.teamId}
          teamName={subTarget.teamName}
          ownerUserId={subTarget.ownerUserId}
          ownerEmail={subTarget.ownerEmail}
          subscription={subTarget.subscription}
          onSaved={() => void load(q)}
        />
      )}
    </div>
  );
}
