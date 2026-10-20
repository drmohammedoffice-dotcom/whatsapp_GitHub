'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  activateAdminSubscription,
  createAdminUser,
  updateAdminUser,
  type AdminPlanRow,
  type AdminUserRow,
} from '@/lib/admin-api';

type UserFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUserRow | null;
  plans: AdminPlanRow[];
  onSaved: () => void;
};

export function UserFormDialog({ open, onOpenChange, user, plans, onSaved }: UserFormDialogProps) {
  const isEdit = !!user;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [teamName, setTeamName] = useState('');
  const [activatePlan, setActivatePlan] = useState(false);
  const [planId, setPlanId] = useState('');
  const [durationDays, setDurationDays] = useState('30');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setPassword('');
    setTeamName('');
    setActivatePlan(false);
    setPlanId(plans.find((p) => p.isActive)?.id ?? '');
    setDurationDays('30');
    setBillingCycle('MONTHLY');
    setError(null);
  }, [open, user, plans]);

  async function handleSubmit() {
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required');
      return;
    }
    if (!isEdit && password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (isEdit && password && password.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (!isEdit && activatePlan && !planId) {
      setError('Select a plan or disable activation');
      return;
    }

    setBusy(true);
    try {
      if (isEdit && user) {
        await updateAdminUser(user.id, {
          name: name.trim(),
          email: email.trim(),
          ...(password ? { password } : {}),
        });
      } else {
        const created = await createAdminUser({
          name: name.trim(),
          email: email.trim(),
          password,
          teamName: teamName.trim() || undefined,
        });
        if (activatePlan && planId) {
          const teamId = created.teamMembers[0]?.team.id;
          if (teamId) {
            await activateAdminSubscription({
              teamId,
              planId,
              ownerUserId: created.id,
              billingCycle,
              durationDays: durationDays ? Number(durationDays) : 30,
            });
          }
        }
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit subscriber' : 'Add subscriber'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update name, email, or password. Manage subscription from the subscription dialog.'
              : 'Create account with email & password. Optionally activate a plan immediately.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-user-name">Full name</Label>
            <Input id="admin-user-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-user-email">Email</Label>
            <Input id="admin-user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-user-password">{isEdit ? 'New password (optional)' : 'Password'}</Label>
            <Input
              id="admin-user-password"
              type="text"
              placeholder={isEdit ? 'Leave empty to keep current' : 'Min 8 characters'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {!isEdit && (
            <>
              <div className="space-y-2">
                <Label htmlFor="admin-user-team">Workspace name (optional)</Label>
                <Input
                  id="admin-user-team"
                  placeholder="Defaults to user name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="activate-plan">Activate subscription on create</Label>
                    <p className="text-xs text-muted-foreground">Grant platform access immediately</p>
                  </div>
                  <Switch id="activate-plan" checked={activatePlan} onCheckedChange={setActivatePlan} />
                </div>
                {activatePlan && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Plan</Label>
                      <Select value={planId} onValueChange={setPlanId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {plans.filter((p) => p.isActive).map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Billing cycle</Label>
                      <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v as 'MONTHLY' | 'YEARLY')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MONTHLY">Monthly</SelectItem>
                          <SelectItem value="YEARLY">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Duration (days)</Label>
                      <Input type="number" min={1} value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create subscriber'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
