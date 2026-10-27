'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  activateAdminSubscription,
  cancelAdminSubscription,
  changeAdminSubscriptionPlan,
  deleteAdminSubscription,
  pauseAdminSubscription,
  updateAdminSubscriptionPeriod,
  updateAdminSubscriptionStatus,
  type AdminPlanRow,
  type AdminSubscriptionRow,
} from '@/lib/admin-api';
import { formatAdminDate, subscriptionDaysLeft, toDateInputValue, BILLING_CYCLE_DAYS } from '@/lib/admin-subscription-utils';
import { formatPlanPrice, planYearlyCents } from '@/components/admin/plan-manage-dialog';

const STATUS_OPTIONS = ['ACTIVE', 'TRIAL', 'PENDING', 'PAUSED', 'CANCELLED', 'EXPIRED'] as const;
const QUICK_EXTEND = [7, 30, 90, 365] as const;

type SubscriptionManageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
  ownerUserId?: string;
  ownerEmail?: string;
  subscription: AdminSubscriptionRow | null;
  plans: AdminPlanRow[];
  onSaved: (updated?: AdminSubscriptionRow) => void;
};

function toDateInput(value: string | null | undefined) {
  return toDateInputValue(value);
}

export function SubscriptionManageDialog({
  open,
  onOpenChange,
  teamId,
  teamName,
  ownerUserId,
  ownerEmail,
  subscription,
  plans,
  onSaved,
}: SubscriptionManageDialogProps) {
  const { t, locale } = useTranslation();
  const [planId, setPlanId] = useState('');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [durationDays, setDurationDays] = useState('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [trialEndDate, setTrialEndDate] = useState('');
  const [daysRemaining, setDaysRemaining] = useState('');
  const [reduceDays, setReduceDays] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [liveSubscription, setLiveSubscription] = useState(subscription);

  useEffect(() => {
    if (!open) return;
    setLiveSubscription(subscription);
    setPlanId(subscription?.plan?.id ?? plans.find((p) => p.isActive)?.id ?? '');
    setBillingCycle((subscription?.billingCycle as 'MONTHLY' | 'YEARLY') ?? 'MONTHLY');
    setStatus(subscription?.status ?? 'ACTIVE');
    setDurationDays(String(BILLING_CYCLE_DAYS.MONTHLY));
    setStartDate(toDateInput(subscription?.currentPeriodStart));
    setEndDate(toDateInput(subscription?.currentPeriodEnd));
    setTrialEndDate(toDateInput(subscription?.trialEndsAt));
    setDaysRemaining('');
    setReduceDays('');
    setError(null);
    setNotice(null);
  }, [open, subscription, plans]);

  async function run(label: string, fn: () => Promise<unknown>, successMessage: string) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const result = await fn();
      setNotice(successMessage);
      if (result && typeof result === 'object' && 'id' in result) {
        const updated = result as AdminSubscriptionRow;
        setLiveSubscription(updated);
        setEndDate(toDateInput(updated.currentPeriodEnd));
        setStartDate(toDateInput(updated.currentPeriodStart));
        setTrialEndDate(toDateInput(updated.trialEndsAt));
        setStatus(updated.status);
        onSaved(updated);
      } else {
        onSaved();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(null);
    }
  }

  function handleActivate(addRemainingDays = false) {
    if (!planId) {
      setError('Select a plan first');
      return;
    }
    void run(
      addRemainingDays ? 'renew-add' : 'activate',
      () =>
        activateAdminSubscription({
          teamId,
          planId,
          ownerUserId,
          billingCycle,
          durationDays: durationDays ? Number(durationDays) : undefined,
          addRemainingDays,
        }),
      addRemainingDays
        ? 'Subscription renewed — remaining days added to the new period'
        : subscription
          ? 'Subscription re-activated'
          : 'Subscription activated — customer can access the platform',
    );
  }

  function handleSaveEndDate() {
    if (!liveSubscription || !endDate) {
      setError('Select an expiry date');
      return;
    }
    void run(
      'end-date-only',
      () => updateAdminSubscriptionPeriod(liveSubscription.id, { currentPeriodEnd: new Date(endDate).toISOString() }),
      'Expiry date updated',
    );
  }

  function handleChangePlan() {
    if (!liveSubscription || !planId) return;
    void run('change-plan', () => changeAdminSubscriptionPlan(liveSubscription.id, planId), 'Plan updated');
  }

  function handleQuickExtend(days: number) {
    if (!liveSubscription) return;
    void run(`extend-${days}`, () => updateAdminSubscriptionPeriod(liveSubscription.id, { extendDays: days }), `Extended by ${days} days`);
  }

  function handleSetDaysRemaining() {
    if (!liveSubscription || daysRemaining === '') return;
    void run(
      'days-remaining',
      () => updateAdminSubscriptionPeriod(liveSubscription.id, { setDaysRemaining: Number(daysRemaining) }),
      `Subscription set to ${daysRemaining} days from today`,
    );
  }

  function handleReduceDays() {
    if (!liveSubscription || !reduceDays) return;
    void run(
      'reduce',
      () => updateAdminSubscriptionPeriod(liveSubscription.id, { reduceDays: Number(reduceDays) }),
      `Reduced by ${reduceDays} days`,
    );
  }

  function handleSavePeriod() {
    if (!liveSubscription) return;
    void run(
      'period',
      () =>
        updateAdminSubscriptionPeriod(liveSubscription.id, {
          ...(startDate ? { currentPeriodStart: new Date(startDate).toISOString() } : {}),
          ...(endDate ? { currentPeriodEnd: new Date(endDate).toISOString() } : {}),
          ...(trialEndDate ? { trialEndsAt: new Date(trialEndDate).toISOString() } : { trialEndsAt: null }),
        }),
      'Period dates saved',
    );
  }

  function handleStatus(next: string) {
    if (!liveSubscription) return;
    setStatus(next);
    void run('status', () => updateAdminSubscriptionStatus(liveSubscription.id, next), `Status set to ${next}`);
  }

  function handlePause() {
    if (!liveSubscription) return;
    void run('pause', () => pauseAdminSubscription(liveSubscription.id), 'Subscription paused');
  }

  function handleCancel() {
    if (!liveSubscription) return;
    if (!window.confirm('Cancel this subscription?')) return;
    void run('cancel', () => cancelAdminSubscription(liveSubscription.id), 'Subscription cancelled');
  }

  function handleDelete() {
    if (!liveSubscription) return;
    if (!window.confirm(`Delete subscription for "${teamName}"? The workspace will lose access.`)) return;
    void run('delete', () => deleteAdminSubscription(liveSubscription.id), 'Subscription deleted');
  }

  const remainingDays = subscriptionDaysLeft(liveSubscription?.currentPeriodEnd);
  const selectedPlan = plans.find((p) => p.id === planId);
  const selectedPriceCents = selectedPlan
    ? billingCycle === 'YEARLY'
      ? planYearlyCents(selectedPlan)
      : selectedPlan.priceCents
    : null;

  function handleBillingCycleChange(value: 'MONTHLY' | 'YEARLY') {
    setBillingCycle(value);
    setDurationDays(String(value === 'YEARLY' ? BILLING_CYCLE_DAYS.YEARLY : BILLING_CYCLE_DAYS.MONTHLY));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {subscription ? t('admin.subscription.manageTitle') : t('admin.subscription.activateTitle')}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                {t('admin.subscription.workspace')}: <span className="font-medium text-foreground">{teamName}</span>
                {ownerEmail && (
                  <>
                    {' · '}
                    {t('admin.subscription.owner')}: <span className="font-medium text-foreground">{ownerEmail}</span>
                  </>
                )}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {liveSubscription && (
            <div className="space-y-3 rounded-xl border-2 border-primary/25 bg-primary/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('admin.subscription.expiryTitle')}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">
                    {liveSubscription.currentPeriodEnd
                      ? formatAdminDate(liveSubscription.currentPeriodEnd, locale)
                      : t('admin.subscription.notSet')}
                  </p>
                  {remainingDays !== null && (
                    <p className={remainingDays < 0 ? 'mt-1 text-sm text-destructive' : 'mt-1 text-sm text-muted-foreground'}>
                      {remainingDays < 0
                        ? t('admin.subscription.expiredDaysAgo').replace('{days}', String(Math.abs(remainingDays)))
                        : t('admin.subscription.daysRemaining').replace('{days}', String(remainingDays))}
                    </p>
                  )}
                </div>
                <div className="rounded-lg bg-background px-3 py-1.5 text-xs text-muted-foreground">
                  {liveSubscription.plan?.name ?? 'No plan'} · {liveSubscription.status}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="expiry-date-edit">{t('admin.subscription.editExpiry')}</Label>
                  <Input id="expiry-date-edit" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                <Button onClick={handleSaveEndDate} disabled={busy !== null || !endDate} className="sm:mb-0.5">
                  {busy === 'end-date-only' && <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />}
                  {t('admin.subscription.saveExpiry')}
                </Button>
              </div>
            </div>
          )}

          {/* Plan & activation */}
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-semibold">
              {subscription ? t('admin.subscription.planReactivate') : t('admin.subscription.planActivate')}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('admin.subscription.plan')}</Label>
                <Select value={planId} onValueChange={setPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.filter((p) => p.isActive).map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} — {formatPlanPrice(plan.priceCents, plan.currency)}/{t('billing.monthly').toLowerCase()} · {formatPlanPrice(planYearlyCents(plan), plan.currency)}/{t('billing.yearly').toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleBillingCycleChange('MONTHLY')}
                  className={`rounded-lg border-2 p-3 text-start transition-colors ${billingCycle === 'MONTHLY' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                >
                  <p className="text-xs font-medium text-muted-foreground">{t('admin.subscription.monthly')}</p>
                  <p className="mt-1 text-lg font-bold">
                    {selectedPlan ? formatPlanPrice(selectedPlan.priceCents, selectedPlan.currency) : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">30 {t('admin.plans.days')}</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleBillingCycleChange('YEARLY')}
                  className={`rounded-lg border-2 p-3 text-start transition-colors ${billingCycle === 'YEARLY' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                >
                  <p className="text-xs font-medium text-muted-foreground">{t('admin.subscription.yearly')}</p>
                  <p className="mt-1 text-lg font-bold">
                    {selectedPlan ? formatPlanPrice(planYearlyCents(selectedPlan), selectedPlan.currency) : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">365 {t('admin.plans.days')}</p>
                </button>
              </div>

              {selectedPriceCents !== null && (
                <p className="rounded-md bg-muted px-3 py-2 text-sm">
                  {t('admin.plans.selectedPrice')}: <strong>{formatPlanPrice(selectedPriceCents, selectedPlan?.currency)}</strong>
                </p>
              )}

              <div className="hidden space-y-2 sm:col-span-2">
                <Label>{t('admin.subscription.billingCycle')}</Label>
                <Select value={billingCycle} onValueChange={(v) => handleBillingCycleChange(v as 'MONTHLY' | 'YEARLY')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">{t('admin.subscription.monthly')}</SelectItem>
                    <SelectItem value="YEARLY">{t('admin.subscription.yearly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('admin.subscription.durationDays')}</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder={t('admin.subscription.durationHint')}
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => handleActivate(false)} disabled={busy !== null}>
                {busy === 'activate' && <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />}
                {subscription ? t('admin.subscription.reactivate') : t('admin.subscription.activate')}
              </Button>
              {subscription && remainingDays !== null && remainingDays > 0 && (
                <Button size="sm" variant="secondary" onClick={() => handleActivate(true)} disabled={busy !== null || !planId}>
                  {busy === 'renew-add' && <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />}
                  {t('admin.subscription.renewAddRemaining')}
                </Button>
              )}
              {subscription && (
                <Button size="sm" variant="outline" onClick={handleChangePlan} disabled={busy !== null || !planId}>
                  {busy === 'change-plan' && <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />}
                  {t('admin.subscription.changePlan')}
                </Button>
              )}
            </div>
            {subscription && remainingDays !== null && remainingDays > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('admin.subscription.renewAddRemainingHint').replace('{days}', String(remainingDays))}
              </p>
            )}
          </div>

          {liveSubscription && (
            <>
              {/* Period control */}
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-semibold">Subscription period — full control</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Start date</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>End date</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Trial end (optional)</Label>
                    <Input type="date" value={trialEndDate} onChange={(e) => setTrialEndDate(e.target.value)} />
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={handleSavePeriod} disabled={busy !== null}>
                  {busy === 'period' && <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />}
                  Save period dates
                </Button>

                <Separator />

                <p className="text-xs font-medium text-muted-foreground">Quick extend</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_EXTEND.map((days) => (
                    <Button key={days} size="sm" variant="secondary" onClick={() => handleQuickExtend(days)} disabled={busy !== null}>
                      +{days}d
                    </Button>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-2">
                      <Label>Set days remaining from today</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="e.g. 30"
                        value={daysRemaining}
                        onChange={(e) => setDaysRemaining(e.target.value)}
                      />
                    </div>
                    <Button size="sm" variant="outline" onClick={handleSetDaysRemaining} disabled={busy !== null || daysRemaining === ''}>
                      Set
                    </Button>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-2">
                      <Label>Reduce days</Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="e.g. 7"
                        value={reduceDays}
                        onChange={(e) => setReduceDays(e.target.value)}
                      />
                    </div>
                    <Button size="sm" variant="outline" onClick={handleReduceDays} disabled={busy !== null || !reduceDays}>
                      Reduce
                    </Button>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-semibold">Status</p>
                <Select value={status} onValueChange={handleStatus} disabled={busy !== null}>
                  <SelectTrigger>
                    <SelectValue placeholder="Change status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handlePause} disabled={busy !== null}>
                    Pause
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancel} disabled={busy !== null}>
                    Cancel
                  </Button>
                </div>
              </div>

              <Separator />
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={busy !== null}>
                {busy === 'delete' && <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />}
                Delete subscription
              </Button>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && <p className="text-sm text-emerald-600">{notice}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
