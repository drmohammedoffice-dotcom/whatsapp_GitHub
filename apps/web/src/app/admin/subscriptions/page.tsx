'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, Loader2, Pencil, Plus, Search, Settings2, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { PlanManageDialog, formatPlanPrice, planYearlyCents } from '@/components/admin/plan-manage-dialog';
import { SubscriptionManageDialog } from '@/components/admin/subscription-manage-dialog';
import { SubscriptionExpiryCell } from '@/components/admin/subscription-expiry-cell';
import { UserFormDialog } from '@/components/admin/user-form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  deleteAdminUser,
  fetchAdminPlans,
  fetchAdminSubscriptions,
  fetchAdminUsers,
  suspendAdminUser,
  activateAdminUser,
  type AdminPlanRow,
  type AdminSubscriptionRow,
  type AdminUserRow,
} from '@/lib/admin-api';

function statusVariant(status: string) {
  if (status === 'ACTIVE') return 'success';
  if (status === 'PENDING' || status === 'TRIAL') return 'secondary';
  return 'destructive';
}

function daysLeft(end: string | null | undefined) {
  if (!end) return null;
  return Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000);
}

export default function AdminSubscriptionsPage() {
  const [tab, setTab] = useState('subscribers');
  const [plans, setPlans] = useState<AdminPlanRow[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [subs, setSubs] = useState<AdminSubscriptionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null);

  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AdminPlanRow | null>(null);
  const [subTarget, setSubTarget] = useState<{
    teamId: string;
    teamName: string;
    ownerUserId?: string;
    ownerEmail?: string;
    subscription: AdminSubscriptionRow | null;
  } | null>(null);

  const load = useCallback(async (search?: string, status?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [p, userData, subscriptionData] = await Promise.all([
        fetchAdminPlans(),
        fetchAdminUsers({ q: search }),
        fetchAdminSubscriptions(status && status !== 'ALL' ? { status } : undefined),
      ]);
      setPlans(p);
      setUsers(userData.users);
      setTotal(userData.total);
      setSubs(subscriptionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(q, statusFilter);
  }, [load, q, statusFilter]);

  const usersWithoutSub = useMemo(
    () => users.filter((u) => !u.teamMembers[0]?.team?.subscription),
    [users],
  );

  function openSubscriptionForUser(user: AdminUserRow) {
    const membership = user.teamMembers[0];
    if (!membership) {
      window.alert('User has no workspace');
      return;
    }
    const enriched = subs.find((row) => row.teamId === membership.team.id);
    setSubTarget({
      teamId: membership.team.id,
      teamName: membership.team.name,
      ownerUserId: user.id,
      ownerEmail: user.email,
      subscription: enriched ?? membership.team.subscription ?? null,
    });
    setSubDialogOpen(true);
  }

  function openSubscriptionForSub(sub: AdminSubscriptionRow) {
    setSubTarget({
      teamId: sub.teamId,
      teamName: sub.team?.name ?? sub.teamId,
      ownerUserId: sub.owner?.id,
      ownerEmail: sub.owner?.email,
      subscription: sub,
    });
    setSubDialogOpen(true);
  }

  async function handleDeleteUser(user: AdminUserRow) {
    if (!window.confirm(`Delete "${user.name}" (${user.email})? This removes all their data permanently.`)) return;
    try {
      await deleteAdminUser(user.id);
      await load(q, statusFilter);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function handleToggleSuspend(user: AdminUserRow) {
    try {
      if (user.suspendedAt) await activateAdminUser(user.id);
      else await suspendAdminUser(user.id);
      await load(q, statusFilter);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Request failed');
    }
  }

  return (
    <div>
      <PageHeader
        title="Subscribers & Subscriptions"
        description="Full control: add/edit/delete subscribers, emails, passwords, plans, and subscription days"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load(q, statusFilter)}
          />
        </div>
        <Button variant="outline" onClick={() => void load(q, statusFilter)}>
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
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="subscribers">Subscribers ({total})</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions ({subs.length})</TabsTrigger>
          <TabsTrigger value="no-plan">No plan ({usersWithoutSub.length})</TabsTrigger>
          <TabsTrigger value="plans">Plans ({plans.length})</TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <>
            <TabsContent value="subscribers" className="mt-4">
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Expiry date</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-end">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => {
                      const team = u.teamMembers[0]?.team;
                      const sub = team?.subscription;
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.name}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>{team?.name ?? '—'}</TableCell>
                          <TableCell>
                            {sub ? (
                              <Badge variant={statusVariant(sub.status) as never}>
                                {sub.plan?.name ?? '—'} · {sub.status}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">No plan</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <SubscriptionExpiryCell endDate={sub?.currentPeriodEnd} onEdit={() => openSubscriptionForUser(u)} />
                          </TableCell>
                          <TableCell>
                            {u.suspendedAt ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="success">Active</Badge>}
                          </TableCell>
                          <TableCell className="space-x-1 text-end whitespace-nowrap">
                            <Button variant="outline" size="sm" title="Manage subscription" onClick={() => openSubscriptionForUser(u)}>
                              <CreditCard className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Edit email & password"
                              onClick={() => {
                                setEditingUser(u);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => void handleToggleSuspend(u)}>
                              {u.suspendedAt ? 'Unsuspend' : 'Suspend'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              title="Delete"
                              onClick={() => void handleDeleteUser(u)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="subscriptions" className="mt-4 space-y-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="TRIAL">Trial</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                </SelectContent>
              </Select>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Owner email</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Referral code</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expiry date</TableHead>
                      <TableHead>Days left</TableHead>
                      <TableHead className="text-end">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subs.map((sub) => {
                      const remaining = daysLeft(sub.currentPeriodEnd);
                      return (
                        <TableRow key={sub.id}>
                          <TableCell className="font-medium">{sub.team?.name ?? '—'}</TableCell>
                          <TableCell>{sub.owner?.email ?? '—'}</TableCell>
                          <TableCell>{sub.plan?.name ?? '—'}</TableCell>
                          <TableCell className="font-mono text-sm" dir="ltr">
                            {sub.referral?.partnerReferralCode || sub.referral?.codeUsed || '—'}
                          </TableCell>
                          <TableCell>{sub.referral?.partnerName ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(sub.status) as never}>{sub.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <SubscriptionExpiryCell endDate={sub.currentPeriodEnd} onEdit={() => openSubscriptionForSub(sub)} showDaysLeft={false} />
                          </TableCell>
                          <TableCell>
                            {remaining === null ? '—' : remaining < 0 ? (
                              <span className="text-destructive">Expired</span>
                            ) : (
                              `${remaining}d`
                            )}
                          </TableCell>
                          <TableCell className="text-end">
                            <Button variant="outline" size="sm" onClick={() => openSubscriptionForSub(sub)}>
                              <Settings2 className="me-2 h-4 w-4" />
                              Manage
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!subs.length && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          No subscriptions match this filter
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="no-plan" className="mt-4">
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Workspace</TableHead>
                      <TableHead className="text-end">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersWithoutSub.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>{u.teamMembers[0]?.team.name ?? '—'}</TableCell>
                        <TableCell className="text-end">
                          <Button size="sm" onClick={() => openSubscriptionForUser(u)}>
                            Activate subscription
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!usersWithoutSub.length && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          All subscribers have a plan
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="plans" className="mt-4 space-y-4">
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setEditingPlan(null);
                    setPlanDialogOpen(true);
                  }}
                >
                  <Plus className="me-2 h-4 w-4" />
                  Add plan
                </Button>
              </div>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Monthly</TableHead>
                      <TableHead>Yearly</TableHead>
                      <TableHead>Trial</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="text-end">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium">{plan.name}</TableCell>
                        <TableCell>{plan.slug}</TableCell>
                        <TableCell>{formatPlanPrice(plan.priceCents, plan.currency)}</TableCell>
                        <TableCell>{formatPlanPrice(planYearlyCents(plan), plan.currency)}</TableCell>
                        <TableCell>{plan.trialDays ?? 14}d</TableCell>
                        <TableCell>
                          <Badge variant={plan.isActive ? 'success' : 'secondary'}>{plan.isActive ? 'Yes' : 'No'}</Badge>
                        </TableCell>
                        <TableCell className="text-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingPlan(plan);
                              setPlanDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editingUser} plans={plans} onSaved={() => void load(q, statusFilter)} />

      <PlanManageDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        plan={editingPlan}
        onSaved={() => void load(q, statusFilter)}
      />

      {subTarget && (
        <SubscriptionManageDialog
          open={subDialogOpen}
          onOpenChange={setSubDialogOpen}
          teamId={subTarget.teamId}
          teamName={subTarget.teamName}
          ownerUserId={subTarget.ownerUserId}
          ownerEmail={subTarget.ownerEmail}
          subscription={subTarget.subscription}
          plans={plans}
          onSaved={(updated) => {
            if (updated) {
              setSubTarget((prev) => (prev ? { ...prev, subscription: updated } : prev));
            }
            void load(q, statusFilter);
          }}
        />
      )}
    </div>
  );
}
