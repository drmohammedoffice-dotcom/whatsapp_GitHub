'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, CreditCard, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { SubscriptionManageDialog } from '@/components/admin/subscription-manage-dialog';
import { SubscriptionExpiryCell } from '@/components/admin/subscription-expiry-cell';
import { UserFormDialog } from '@/components/admin/user-form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  activateAdminUser,
  deleteAdminUser,
  fetchAdminPlans,
  fetchAdminUsers,
  impersonateUser,
  suspendAdminUser,
  type AdminPlanRow,
  type AdminSubscriptionRow,
  type AdminUserRow,
} from '@/lib/admin-api';
import { isDeletedAccount } from '@/lib/admin-subscription-utils';

function subscriptionBadge(sub: AdminSubscriptionRow | null | undefined) {
  if (!sub) return <Badge variant="secondary">No plan</Badge>;
  const variant = sub.status === 'ACTIVE' ? 'success' : sub.status === 'PENDING' ? 'secondary' : 'destructive';
  return (
    <Badge variant={variant as never} className="w-fit">
      {sub.plan?.name ?? '—'} · {sub.status}
    </Badge>
  );
}

export default function AdminUsersPage() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [plans, setPlans] = useState<AdminPlanRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null);

  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [subTarget, setSubTarget] = useState<{
    teamId: string;
    teamName: string;
    ownerUserId: string;
    subscription: AdminSubscriptionRow | null;
  } | null>(null);

  const PAGE_SIZE = 100;
  const [skip, setSkip] = useState(0);
  const [showDeleted, setShowDeleted] = useState(false);

  // Self-deleted (anonymised) accounts are hidden by default.
  const deletedCount = useMemo(() => users.filter((u) => isDeletedAccount(u)).length, [users]);
  const visibleUsers = useMemo(
    () => (showDeleted ? users : users.filter((u) => !isDeletedAccount(u))),
    [users, showDeleted],
  );

  const load = useCallback(async (search?: string, pageSkip = 0) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUsers({ q: search, skip: pageSkip, take: PAGE_SIZE });
      setUsers(data.users);
      setTotal(data.total);
      setSkip(pageSkip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load('', 0);
    fetchAdminPlans().then(setPlans).catch(console.error);
  }, [load]);

  async function handleImpersonate(userId: string) {
    await impersonateUser(userId);
    window.location.href = '/dashboard';
  }

  async function handleDelete(user: AdminUserRow) {
    if (!window.confirm(`Delete "${user.name}" (${user.email})? This removes the user and all their data permanently.`)) {
      return;
    }
    try {
      await deleteAdminUser(user.id);
      await load(q, skip);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function handleToggleSuspend(user: AdminUserRow) {
    try {
      if (user.suspendedAt) await activateAdminUser(user.id);
      else await suspendAdminUser(user.id);
      await load(q, skip);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Request failed');
    }
  }

  function openSubscriptionDialog(user: AdminUserRow) {
    const membership = user.teamMembers[0];
    if (!membership) {
      window.alert('User has no workspace');
      return;
    }
    setSubTarget({
      teamId: membership.team.id,
      teamName: membership.team.name,
      ownerUserId: user.id,
      subscription: membership.team.subscription ?? null,
    });
    setSubDialogOpen(true);
  }

  return (
    <div>
      <PageHeader title="Subscribers" description={`${total} registered accounts — full control over users, plans and subscription periods`} />

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder="Search by name or email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load(q, 0)}
          />
        </div>
        <Button variant="outline" onClick={() => void load(q, 0)}>
          Search
        </Button>
        <Button
          onClick={() => {
            setEditingUser(null);
            setFormOpen(true);
          }}
        >
          <Plus className="me-2 h-4 w-4" />
          Add subscriber
        </Button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          إظهار الحسابات المحذوفة ({deletedCount})
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-4 rounded-lg border bg-card">
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading subscribers...
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Expiry date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-end">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleUsers.map((u) => {
                const team = u.teamMembers[0]?.team;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{team?.name ?? '—'}</TableCell>
                    <TableCell>{subscriptionBadge(team?.subscription)}</TableCell>
                    <TableCell>
                      <SubscriptionExpiryCell
                        endDate={team?.subscription?.currentPeriodEnd}
                        onEdit={() => openSubscriptionDialog(u)}
                      />
                    </TableCell>
                    <TableCell>
                      {u.suspendedAt ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="success">Active</Badge>}
                    </TableCell>
                    <TableCell className="space-x-1 text-end whitespace-nowrap">
                      <Button variant="ghost" size="sm" title="Manage subscription" onClick={() => openSubscriptionDialog(u)}>
                        <CreditCard className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Edit user"
                        onClick={() => {
                          setEditingUser(u);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/users/${u.id}`}>View</Link>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void handleImpersonate(u.id)}>
                        Login as
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void handleToggleSuspend(u)}>
                        {u.suspendedAt ? 'Unsuspend' : 'Suspend'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Delete user"
                        className="text-destructive hover:text-destructive"
                        onClick={() => void handleDelete(u)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {!loading && total > 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <p>
            عرض {skip + 1}–{Math.min(skip + users.length, total)} من أصل {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={skip <= 0 || loading}
              onClick={() => void load(q, Math.max(0, skip - PAGE_SIZE))}
            >
              <ChevronRight className="me-1 h-4 w-4" />
              السابق
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={skip + users.length >= total || loading}
              onClick={() => void load(q, skip + PAGE_SIZE)}
            >
              التالي
              <ChevronLeft className="ms-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editingUser} plans={plans} onSaved={() => void load(q, skip)} />

      {subTarget && (
        <SubscriptionManageDialog
          open={subDialogOpen}
          onOpenChange={setSubDialogOpen}
          teamId={subTarget.teamId}
          teamName={subTarget.teamName}
          ownerUserId={subTarget.ownerUserId}
          ownerEmail={users.find((u) => u.id === subTarget.ownerUserId)?.email}
          subscription={subTarget.subscription}
          plans={plans}
          onSaved={(updated) => {
            if (updated) {
              setSubTarget((prev) => (prev ? { ...prev, subscription: updated } : prev));
            }
            void load(q, skip);
          }}
        />
      )}
    </div>
  );
}
