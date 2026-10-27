'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { DeleteAccountCard } from '@/components/account/delete-account-card';
import { AppShell } from '@/components/layout/app-shell';
import { useSubscription } from '@/components/providers/subscription-provider';
import { useTranslation } from '@/components/providers/locale-provider';
import { AlertBanner } from '@/components/shared/alert-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { SubscriptionState } from '@/lib/billing';
import { useIsMobileApp } from '@/lib/use-is-mobile-app';
import { api, parseApiError } from '@/lib/utils';

type AccountUser = { id: string; name: string; email: string; createdAt: string };

export function AccountView() {
  const { t } = useTranslation();
  const [user, setUser] = useState<AccountUser | null>(null);
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isMobileApp = useIsMobileApp();

  useEffect(() => {
    api<AccountUser>('/auth/me')
      .then((data) => {
        setUser(data);
        setName(data.name);
      })
      .catch((err) => setError(parseApiError(err)));
  }, []);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api<AccountUser>('/auth/me', { method: 'PATCH', body: JSON.stringify({ name }) });
      setUser(updated);
      setSuccess(t('account.profileUpdated'));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError(t('errors.passwordMin'));
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(t('account.passwordUpdated'));
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title={t('account.title')} description={t('account.subtitle')} />

      <div className="mt-4 space-y-3">
        {error && <AlertBanner message={error} onDismiss={() => setError(null)} />}
        {success && <AlertBanner variant="success" message={success} onDismiss={() => setSuccess(null)} />}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>{t('account.profile')}</CardTitle>
            <CardDescription>{t('account.email')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => void saveName(e)}>
              <div className="space-y-2">
                <Label htmlFor="name">{t('account.name')}</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t('account.email')}</Label>
                <Input id="email" value={user?.email ?? ''} disabled />
              </div>
              <Button type="submit" disabled={saving}>
                {t('common.save')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>{t('account.password')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => void savePassword(e)}>
              <div className="space-y-2">
                <Label htmlFor="currentPassword">{t('account.currentPassword')}</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('account.newPassword')}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('account.confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" disabled={saving}>
                {t('account.changePassword')}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Billing / plan / renewal is website-only — hidden inside the native app. */}
        {!isMobileApp && <AccountBillingCard onError={setError} />}

        <DeleteAccountCard />
      </div>
    </AppShell>
  );
}

function AccountBillingCard({ onError }: { onError: (message: string) => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { status, refresh } = useSubscription();
  const [renewBusy, setRenewBusy] = useState(false);

  async function toggleAutoRenew(enabled: boolean) {
    setRenewBusy(true);
    try {
      await api<SubscriptionState>('/billing/auto-renew', {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      });
      await refresh();
    } catch (err) {
      onError(parseApiError(err));
    } finally {
      setRenewBusy(false);
    }
  }

  const periodEnd = status?.currentPeriodEnd
    ? new Date(status.currentPeriodEnd).toLocaleDateString()
    : '—';

  return (
    <Card className="border-0 shadow-card lg:col-span-2">
      <CardHeader>
        <CardTitle>{t('account.subscription')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">{t('account.currentPlan')}</p>
            <p className="font-semibold">{status?.planName ?? t('account.noSubscription')}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('account.periodEnd')}</p>
            <p className="font-semibold">{periodEnd}</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{t('account.autoRenew')}</p>
              <p className="text-xs text-muted-foreground">{t('account.autoRenewHint')}</p>
            </div>
            <Switch
              checked={!!status?.autoRenew}
              disabled={renewBusy || !status?.hasSubscription}
              onCheckedChange={(v) => void toggleAutoRenew(v)}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {status?.autoRenew ? t('account.autoRenewOn') : t('account.autoRenewOff')}
        </p>
        <Button variant="outline" onClick={() => router.push('/pricing?upgrade=1')}>
          {t('account.upgradePlan')}
        </Button>
      </CardContent>
    </Card>
  );
}

